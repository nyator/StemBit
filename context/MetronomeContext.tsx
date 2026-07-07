import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import audio from "../constants/audio";
import { buildMetronomeHtml } from "../constants/metronomeEngine";
import { loadAssetBase64 } from "../utils/loadAssetBase64";
import { usePlaybackLock } from "./PlaybackLockContext";

export const MIN_BPM = 20;
export const MAX_BPM = 320;

export const TIME_SIGNATURES = [
  { label: "2 / 4", beats: 2, note: 4 },
  { label: "3 / 4", beats: 3, note: 4 },
  { label: "4 / 4", beats: 4, note: 4 },
  { label: "5 / 4", beats: 5, note: 4 },
  { label: "6 / 8", beats: 6, note: 8 },
  { label: "7 / 8", beats: 7, note: 8 },
  { label: "9 / 8", beats: 9, note: 8 },
  { label: "12 / 8", beats: 12, note: 8 },
];

export type TimeSignature = (typeof TIME_SIGNATURES)[number];

// Playback feel: changes how fast the clicks actually fall relative to the
// set BPM, without changing the BPM number itself. Double time halves the
// gap between clicks (1 2 3 4 1 2 3 4).
export const PLAYBACK_FEELS = [
  { label: "Normal", short: "1×", multiplier: 1 },
  { label: "Double Time", short: "2×", multiplier: 2 },
];

type MetronomeContextValue = {
  bpm: number;
  setBpm: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  currentBeat: number;
  timeSignature: TimeSignature;
  setTimeSignature: (timeSignature: TimeSignature) => void;
  feelIndex: number;
  setFeelIndex: (index: number) => void;
  engineReady: boolean;
  isBlockedByOtherEngine: boolean;
  startMetronome: () => void;
  stopMetronome: () => void;
};

const MetronomeContext = createContext<MetronomeContextValue | null>(null);

// Metronome timing engine: a hidden WebView running a Web Audio API
// "lookahead scheduler". Web Audio's hardware clock is sample-accurate,
// unlike RN JS timers, so beat timing stays steady regardless of JS thread
// jitter. See constants/metronomeEngine.ts for details.
//
// This lives above the tab navigator (mounted once in app/(tabs)/_layout.tsx)
// rather than inside the metro screen itself: bottom-tab navigators hide
// inactive screens with `display: none`, which throttles a WebView's JS/audio
// clock exactly like backgrounding does. Mounting it here means it keeps
// ticking steadily no matter which tab is active.
export function MetronomeProvider({ children }: { children: ReactNode }) {
  const { activeEngine, requestStart, release } = usePlaybackLock();
  const isBlockedByOtherEngine = activeEngine !== null && activeEngine !== "metro";

  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const isPlayingRef = useRef(false);

  const [timeSignature, setTimeSignature] = useState(TIME_SIGNATURES[2]); // Default 4/4
  const [feelIndex, setFeelIndex] = useState(0); // Default Normal
  const speedMultiplier = PLAYBACK_FEELS[feelIndex].multiplier;
  const getEffectiveBpm = (nextBpm = bpm, nextMultiplier = speedMultiplier) =>
    nextBpm * nextMultiplier;

  const webViewRef = useRef<WebView>(null);
  const [engineHtml, setEngineHtml] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  const postToEngine = (message: Record<string, unknown>) => {
    webViewRef.current?.postMessage(JSON.stringify(message));
  };

  // Load the click samples once and build the WebView engine page
  useEffect(() => {
    let isMounted = true;

    const loadEngine = async () => {
      try {
        const [brightBase64, lowBase64] = await Promise.all([
          loadAssetBase64(audio.metronome_bright),
          loadAssetBase64(audio.metronome_low),
        ]);

        if (!isMounted) return;
        setEngineHtml(buildMetronomeHtml({ brightBase64, lowBase64 }));
      } catch (error) {
        console.error("Failed to load metronome engine", error);
      }
    };

    loadEngine();

    return () => {
      isMounted = false;
    };
  }, []);

  const stopMetronome = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentBeat(0);
    postToEngine({ type: "stop" });
    release("metro");
  };

  // The metronome only makes sense in the foreground: pause it if the app
  // is backgrounded or the screen locks, since the WebView's audio clock
  // suspends there anyway.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && isPlayingRef.current) {
        stopMetronome();
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") {
        setEngineReady(true);
      } else if (data.type === "beat" && isPlayingRef.current) {
        setCurrentBeat(data.beat);
      } else if (data.type === "error") {
        console.error("Metronome engine error:", data.message);
      }
    } catch (error) {
      // Ignore malformed messages
    }
  };

  const startMetronome = () => {
    if (isPlaying) return;

    if (!engineReady) {
      console.warn("Metronome engine not loaded yet");
      return;
    }

    if (!requestStart("metro")) {
      console.warn("Stop the Loop click track before starting the Metronome");
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);
    setCurrentBeat(0);
    postToEngine({
      type: "start",
      bpm: getEffectiveBpm(),
      beats: timeSignature.beats,
    });
  };

  // Handle BPM or playback feel changes while playing
  useEffect(() => {
    if (isPlaying) {
      postToEngine({ type: "setTempo", bpm: getEffectiveBpm() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, speedMultiplier]);

  useEffect(() => {
    if (isPlaying) {
      setCurrentBeat(0);
      postToEngine({ type: "setBeats", beats: timeSignature.beats });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeSignature]);

  useEffect(() => {
    return () => {
      stopMetronome();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MetronomeContext.Provider
      value={{
        bpm,
        setBpm,
        isPlaying,
        currentBeat,
        timeSignature,
        setTimeSignature,
        feelIndex,
        setFeelIndex,
        engineReady,
        isBlockedByOtherEngine,
        startMetronome,
        stopMetronome,
      }}
    >
      {children}
      {engineHtml && (
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
      )}
    </MetronomeContext.Provider>
  );
}

export function useMetronome() {
  const context = useContext(MetronomeContext);
  if (!context) {
    throw new Error("useMetronome must be used within a MetronomeProvider");
  }
  return context;
}
