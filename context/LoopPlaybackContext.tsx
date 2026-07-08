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

import { findLoopByKey } from "../constants/loops";
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
// (constants/loopEngine.ts) rather than expo-audio: AVPlayer/ExoPlayer
// looping seeks back to 0 (never sample-accurate) and MP3/AAC decode with
// encoder padding at both edges, so `player.loop = true` always stumbled at
// the loop point. The engine loops the decoded buffer sample-accurately with
// silence-trimmed, beat-snapped loop points.
//
// Mounted above the tab navigator (app/(tabs)/_layout.tsx) like the other
// engines so it can be seen/stopped from the floating control and kept
// mutually exclusive with the Metronome tab via PlaybackLockContext.
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
  const [loopReady, setLoopReady] = useState(false);
  const loopReadyRef = useRef(false);
  // Bumped on every setSelectedLoopKey so a slow asset load can't apply a
  // stale loop over a newer selection.
  const loadTokenRef = useRef(0);

  const webViewRef = useRef<WebView>(null);
  const [engineHtml] = useState(buildLoopEngineHtml);
  // The WebView page posts "ready" once its script has attached message
  // listeners. Any "load" posted before that is silently dropped, so loads
  // requested earlier are parked here and flushed on "ready".
  const engineReadyRef = useRef(false);
  const pendingLoadRef = useRef<Record<string, unknown> | null>(null);

  const postToEngine = (message: Record<string, unknown>) => {
    webViewRef.current?.postMessage(JSON.stringify(message));
  };

  const requestEngineLoad = (message: Record<string, unknown>) => {
    if (engineReadyRef.current) {
      postToEngine(message);
    } else {
      pendingLoadRef.current = message;
    }
  };

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

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") {
        engineReadyRef.current = true;
        if (pendingLoadRef.current) {
          postToEngine(pendingLoadRef.current);
          pendingLoadRef.current = null;
        }
      } else if (data.type === "loaded") {
        loopReadyRef.current = true;
        setLoopReady(true);
      } else if (data.type === "error") {
        console.error("Loop engine error:", data.message);
      }
    } catch (error) {
      // Ignore malformed messages
    }
  };

  // Load the selected loop's audio into the engine, resetting the tempo
  // control to the loop's own native BPM so it starts back at 1x speed.
  const setSelectedLoopKey = (key: string | undefined) => {
    loadTokenRef.current += 1;
    const token = loadTokenRef.current;

    loopReadyRef.current = false;
    setLoopReady(false);
    stopLoop();

    if (!key) {
      nativeBpmRef.current = null;
      return;
    }

    const selectedLoop = findLoopByKey(key);
    if (!selectedLoop) {
      nativeBpmRef.current = null;
      return;
    }

    nativeBpmRef.current = selectedLoop.bpm;
    setBpm(selectedLoop.bpm);

    loadAssetBase64(selectedLoop.source)
      .then((base64) => {
        if (token !== loadTokenRef.current) return; // superseded
        requestEngineLoad({
          type: "load",
          base64,
          nativeBpm: selectedLoop.bpm,
        });
      })
      .catch((error) => {
        console.error("Failed to load loop sound", error);
      });
  };

  const getPlaybackRate = (nextBpm = bpm) =>
    nativeBpmRef.current ? nextBpm / nativeBpmRef.current : 1;

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

    if (!loopReadyRef.current) {
      Alert.alert("Loading", "The loop is still loading — try again in a moment.");
      return;
    }

    if (!requestStart("loop")) {
      console.warn("Stop the Metronome before starting the Loop");
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);
    postToEngine({ type: "play", rate: getPlaybackRate() });
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
