import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { Alert, AppState } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { setAudioModeAsync } from "expo-audio";

import { LOOPS, findLoopByKey } from "../constants/loops";
import { buildLoopEngineHtml } from "../constants/loopEngine";
import { loadAssetBase64 } from "../utils/loadAssetBase64";
import { usePlaybackLock } from "./PlaybackLockContext";

export const LOOP_MIN_BPM = 20;
export const LOOP_MAX_BPM = 240;

type LoopPlaybackContextValue = {
  bpm: number;
  setBpm: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  isBlockedByOtherEngine: boolean;
  setSelectedLoopKey: (key: string | undefined) => void;
  startLoop: () => void;
  stopLoop: () => void;
};

const LoopPlaybackContext = createContext<LoopPlaybackContextValue | null>(
  null
);

// Plays the selected backing loop track, "warped" to the current BPM
// (playback rate = bpm / the loop's own recorded tempo, see
// constants/loops.ts).
//
// Playback happens inside a hidden WebView running a Web Audio engine
// (constants/loopEngine.ts): sample-accurate gapless looping with
// silence-trimmed, beat-snapped loop points — things AVPlayer/ExoPlayer
// looping can't do.
//
// The whole catalog is preloaded and decoded into the engine as soon as it
// boots, so selecting a loop is a pointer swap and pressing play is always
// instant. If play is somehow pressed mid-load (e.g. first seconds of app
// start), it's queued and fires the moment the loop is ready rather than
// asking the user to try again.
export function LoopPlaybackProvider({ children }: { children: ReactNode }) {
  const { activeEngine, requestStart, release } = usePlaybackLock();
  const isBlockedByOtherEngine =
    activeEngine !== null && activeEngine !== "loop";

  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);

  // The tempo the loaded loop was recorded at; BPM changes are warped onto
  // it via playback rate (bpm / nativeBpm = 1x at the loop's own tempo).
  const nativeBpmRef = useRef<number | null>(null);
  const currentKeyRef = useRef<string | null>(null);
  const [loopReady, setLoopReady] = useState(false);
  const loopReadyRef = useRef(false);
  // Play was pressed while the loop was still decoding: start as soon as
  // the engine reports it loaded.
  const pendingPlayRef = useRef(false);

  const webViewRef = useRef<WebView>(null);
  const [engineHtml] = useState(buildLoopEngineHtml);

  // Messages posted before the WebView page has attached its listeners are
  // silently dropped, so everything is queued until its "ready" handshake.
  const engineReadyRef = useRef(false);
  const messageQueueRef = useRef<Record<string, unknown>[]>([]);
  // Loop keys whose preload has been handed to the engine (or is in flight).
  const preloadStartedRef = useRef<Set<string>>(new Set());

  const postToEngine = (message: Record<string, unknown>) => {
    if (engineReadyRef.current) {
      webViewRef.current?.postMessage(JSON.stringify(message));
    } else {
      messageQueueRef.current.push(message);
    }
  };

  // Read a loop's asset and hand it to the engine to decode ahead of time.
  const preloadLoop = (key: string) => {
    if (preloadStartedRef.current.has(key)) return;
    preloadStartedRef.current.add(key);

    const loop = findLoopByKey(key);
    if (!loop) return;

    loadAssetBase64(loop.source)
      .then((base64) => {
        postToEngine({
          type: "preload",
          key: loop.key,
          base64,
          nativeBpm: loop.bpm,
        });
      })
      .catch((error) => {
        // Allow a retry on next select.
        preloadStartedRef.current.delete(key);
        console.error("Failed to preload loop", key, error);
      });
  };

  // Warm the whole catalog at startup so play is always instant.
  useEffect(() => {
    LOOPS.forEach((loop) => preloadLoop(loop.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the app's audio session configured for playback in silent mode
  // (iOS). The WebView plays through the same session.
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionModeAndroid: "duckOthers",
    }).catch((error) => {
      console.error("Failed to set audio mode", error);
    });
  }, []);

  const stopLoop = () => {
    pendingPlayRef.current = false;
    isPlayingRef.current = false;
    setIsPlaying(false);
    postToEngine({ type: "stop" });
    release("loop");
  };

  // Loop audio only makes sense in the foreground: the WebView's audio
  // clock suspends in the background anyway.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && isPlayingRef.current) {
        stopLoop();
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPlaybackRate = (nextBpm = bpm) =>
    nativeBpmRef.current ? nextBpm / nativeBpmRef.current : 1;

  const beginPlayback = () => {
    isPlayingRef.current = true;
    setIsPlaying(true);
    postToEngine({ type: "play", rate: getPlaybackRate() });
  };

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") {
        // Fires on first boot and again if the WebView ever reloads (its
        // caches are wiped then, so everything must be re-sent).
        engineReadyRef.current = true;
        const queued = messageQueueRef.current;
        messageQueueRef.current = [];
        queued.forEach((message) =>
          webViewRef.current?.postMessage(JSON.stringify(message))
        );
        preloadStartedRef.current.clear();
        LOOPS.forEach((loop) => preloadLoop(loop.key));
        if (currentKeyRef.current && nativeBpmRef.current) {
          postToEngine({
            type: "select",
            key: currentKeyRef.current,
            nativeBpm: nativeBpmRef.current,
          });
        }
      } else if (data.type === "loaded") {
        if (data.key !== currentKeyRef.current) return; // stale select
        loopReadyRef.current = true;
        setLoopReady(true);
        if (pendingPlayRef.current) {
          pendingPlayRef.current = false;
          beginPlayback();
        }
      } else if (data.type === "error") {
        // Self-heal: the engine has no bytes for the current loop (e.g. a
        // preload was lost) — re-read the asset and select again with the
        // data attached. The pending play, if any, stays queued and fires
        // when the retried select reports "loaded".
        if (
          data.code === "missing-data" &&
          data.key &&
          data.key === currentKeyRef.current
        ) {
          const loop = findLoopByKey(data.key);
          if (loop) {
            loadAssetBase64(loop.source)
              .then((base64) => {
                if (currentKeyRef.current !== loop.key) return;
                postToEngine({
                  type: "select",
                  key: loop.key,
                  nativeBpm: loop.bpm,
                  base64,
                });
              })
              .catch((error) => {
                console.error("Loop reload failed", error);
              });
            return;
          }
        }

        console.error("Loop engine error:", data.message);
        if (pendingPlayRef.current) {
          pendingPlayRef.current = false;
          isPlayingRef.current = false;
          setIsPlaying(false);
          release("loop");
        }
      }
    } catch (error) {
      // Ignore malformed messages
    }
  };

  // Make the given loop the engine's active loop, resetting the tempo
  // control to the loop's own native BPM so it starts back at 1x speed.
  const setSelectedLoopKey = (key: string | undefined) => {
    loopReadyRef.current = false;
    setLoopReady(false);
    stopLoop();

    if (!key) {
      currentKeyRef.current = null;
      nativeBpmRef.current = null;
      return;
    }

    const selectedLoop = findLoopByKey(key);
    if (!selectedLoop) {
      currentKeyRef.current = null;
      nativeBpmRef.current = null;
      return;
    }

    currentKeyRef.current = selectedLoop.key;
    nativeBpmRef.current = selectedLoop.bpm;
    setBpm(selectedLoop.bpm);

    // Normally instant: the engine already holds the decoded buffer from
    // the startup preload. preloadLoop is a no-op if it's in flight, and a
    // recovery path if the original preload failed.
    preloadLoop(selectedLoop.key);
    postToEngine({
      type: "select",
      key: selectedLoop.key,
      nativeBpm: selectedLoop.bpm,
    });
  };

  // Warp the loop's playback rate to match the current BPM relative to the
  // tempo it was recorded at (e.g. sample_bpm80 at bpm=160 plays at 2x).
  useEffect(() => {
    if (loopReady) {
      postToEngine({ type: "setRate", rate: getPlaybackRate() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, loopReady]);

  const startLoop = () => {
    if (isPlaying) return;

    if (nativeBpmRef.current === null) {
      Alert.alert("No loop selected", "Select a loop before pressing play.");
      return;
    }

    if (!requestStart("loop")) {
      console.warn("Stop the Metronome before starting the Loop");
      return;
    }

    if (!loopReadyRef.current) {
      // Still decoding (only possible in the first moments after app
      // start): show the playing state now and start the instant it lands.
      pendingPlayRef.current = true;
      isPlayingRef.current = true;
      setIsPlaying(true);
      return;
    }

    beginPlayback();
  };

  useEffect(() => {
    return () => {
      stopLoop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LoopPlaybackContext.Provider
      value={{
        bpm,
        setBpm,
        isPlaying,
        isBlockedByOtherEngine,
        setSelectedLoopKey,
        startLoop,
        stopLoop,
      }}
    >
      {children}
      <WebView
        ref={webViewRef}
        source={{ html: engineHtml }}
        onMessage={handleWebViewMessage}
        originWhitelist={["*"]}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        containerStyle={{ flex: 0, width: 0, height: 0 }}
        style={{ flex: 0, width: 0, height: 0, opacity: 0 }}
        pointerEvents="none"
      />
    </LoopPlaybackContext.Provider>
  );
}

export function useLoopPlayback() {
  const context = useContext(LoopPlaybackContext);
  if (!context) {
    throw new Error(
      "useLoopPlayback must be used within a LoopPlaybackProvider"
    );
  }
  return context;
}
