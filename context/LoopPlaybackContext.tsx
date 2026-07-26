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

import { LOOPS, findLoopByKey, getBeatsPerBar } from "../constants/loops";
import { buildLoopEngineHtml } from "../constants/loopEngine";
import { loadAssetBase64 } from "../utils/loadAssetBase64";
import { usePlaybackLock } from "./PlaybackLockContext";
import { usePreferences } from "./PreferencesContext";
import { METRONOME_SOUNDS } from "./MetronomeContext";

export const LOOP_MIN_BPM = 20;
export const LOOP_MAX_BPM = 240;

// Loop-click pan preference -> StereoPanner value (-1 left .. 0 .. 1 right).
const CLICK_PAN_VALUE: Record<string, number> = {
  left: -1,
  center: 0,
  right: 1,
};

// Asset id -> bundled asset module, from the shared metronome sound registry.
// The loop click "follows the metronome's sound", so it plays whichever
// accent/beat samples the Metronome is set to.
const soundAsset = (id: string) =>
  METRONOME_SOUNDS.find((s) => s.id === id)?.asset;

type LoopPlaybackContextValue = {
  bpm: number;
  setBpm: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  isBlockedByOtherEngine: boolean;
  // Title of the currently selected loop, or null when none is selected.
  // Lives here (not in route params) so it survives regardless of which
  // screen instance is currently focused -- same pattern as Pad/Metro.
  selectedTitle: string | null;
  // The tempo the selected loop was recorded at, or null when none is
  // selected. Reset returns the BPM control to this.
  nativeBpm: number | null;
  // Beats per bar of the selected loop (time-signature numerator, defaults
  // to 4). Drives the beat-dot count on the loop screen.
  beatsPerBar: number;
  resetBpm: () => void;
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
  const { prefs } = usePreferences();
  const isBlockedByOtherEngine =
    activeEngine !== null && activeEngine !== "loop";

  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);

  // The tempo the loaded loop was recorded at; BPM changes are warped onto
  // it via playback rate (bpm / nativeBpm = 1x at the loop's own tempo).
  const nativeBpmRef = useRef<number | null>(null);
  // Mirror of nativeBpmRef in state, so the UI can show/enable a reset
  // control against the loop's original tempo.
  const [nativeBpm, setNativeBpm] = useState<number | null>(null);
  // Beats per bar of the selected loop (time-signature numerator), so the
  // engine accents every bar downbeat rather than only the loop's first beat.
  // Mirrored in state so the beat visuals can react to it.
  const beatsPerBarRef = useRef<number>(4);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const currentKeyRef = useRef<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
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
  // Click sound ids already handed to the engine to decode.
  const clickLoadedRef = useRef<Set<string>>(new Set());

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

  // Hand a click sample (by metronome sound id) to the engine to decode, once.
  const loadClickSound = (id: string | undefined) => {
    if (!id || clickLoadedRef.current.has(id)) return;
    const asset = soundAsset(id);
    if (asset == null) return;
    clickLoadedRef.current.add(id);
    loadAssetBase64(asset)
      .then((base64) => {
        postToEngine({ type: "loadClick", id, base64 });
      })
      .catch((error) => {
        clickLoadedRef.current.delete(id);
        console.error("Failed to load loop click sound", id, error);
      });
  };

  // Push the current loop-click config (from preferences) to the engine. The
  // click follows the metronome's selected sounds + per-voice volumes, and its
  // overall level tracks the metronome master (Settings -> Metronome Volume) —
  // NOT the Loop Volume, which governs the backing track. Plus its own enable +
  // pan preferences.
  const postClickConfig = () => {
    postToEngine({
      type: "setClick",
      enabled: prefs.loopClick,
      pan: CLICK_PAN_VALUE[prefs.loopClickPan] ?? 0,
      accentId: prefs.accentSound,
      beatId: prefs.beatSound,
      accentVolume: prefs.accentVolume * prefs.metronomeVolume,
      beatVolume: prefs.beatVolume * prefs.metronomeVolume,
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
            beatsPerBar: beatsPerBarRef.current,
          });
        }
        // The WebView's decoded click buffers + master gain are wiped on
        // reload too: re-send the click samples, config, and loop volume.
        clickLoadedRef.current.clear();
        loadClickSound(prefs.accentSound);
        loadClickSound(prefs.beatSound);
        postClickConfig();
        postToEngine({ type: "setLoopVolume", volume: prefs.loopVolume });
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
                  beatsPerBar: getBeatsPerBar(loop),
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
      setNativeBpm(null);
      setSelectedTitle(null);
      return;
    }

    const selectedLoop = findLoopByKey(key);
    if (!selectedLoop) {
      currentKeyRef.current = null;
      nativeBpmRef.current = null;
      setNativeBpm(null);
      setSelectedTitle(null);
      return;
    }

    currentKeyRef.current = selectedLoop.key;
    nativeBpmRef.current = selectedLoop.bpm;
    beatsPerBarRef.current = getBeatsPerBar(selectedLoop);
    setBeatsPerBar(beatsPerBarRef.current);
    setNativeBpm(selectedLoop.bpm);
    setBpm(selectedLoop.bpm);
    setSelectedTitle(selectedLoop.title);

    // Normally instant: the engine already holds the decoded buffer from
    // the startup preload. preloadLoop is a no-op if it's in flight, and a
    // recovery path if the original preload failed.
    preloadLoop(selectedLoop.key);
    postToEngine({
      type: "select",
      key: selectedLoop.key,
      nativeBpm: selectedLoop.bpm,
      beatsPerBar: beatsPerBarRef.current,
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

  // Keep the engine's click samples + config in sync with preferences. Runs on
  // mount (queued until the engine is ready) and whenever any click-relevant
  // preference changes; the engine reacts live if a loop is already playing.
  useEffect(() => {
    loadClickSound(prefs.accentSound);
    loadClickSound(prefs.beatSound);
    postClickConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    prefs.loopClick,
    prefs.loopClickPan,
    prefs.accentSound,
    prefs.beatSound,
    prefs.accentVolume,
    prefs.beatVolume,
    prefs.metronomeVolume,
  ]);

  // Backing-track level (Settings -> Loop Volume). The engine ramps to it, so
  // it applies live if a loop is already playing.
  useEffect(() => {
    postToEngine({ type: "setLoopVolume", volume: prefs.loopVolume });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.loopVolume]);

  // Return the tempo control to the selected loop's recorded BPM (1x rate).
  // No-op when nothing is selected.
  const resetBpm = () => {
    if (nativeBpmRef.current === null) return;
    setBpm(nativeBpmRef.current);
  };

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
        selectedTitle,
        nativeBpm,
        beatsPerBar,
        resetBpm,
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
