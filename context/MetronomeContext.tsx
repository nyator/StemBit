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
import { usePreferences } from "./PreferencesContext";

export const MIN_BPM = 20;
export const MAX_BPM = 320;

// The time-signature picker groups meters into three families (Figma node
// 93:534). `category` drives that grouping in the modal.
export type TimeSignatureCategory = "standard" | "compound" | "odd";

export const TIME_SIGNATURE_CATEGORIES: {
  key: TimeSignatureCategory;
  label: string;
}[] = [
  { key: "standard", label: "Standard" },
  { key: "compound", label: "Compound" },
  { key: "odd", label: "Odd meters" },
];

// `accents` are the 0-based beats that start a rhythmic group. Beat 0 gets
// the full bright click; the other listed beats get a softer bright click so
// compound and odd meters are felt in their natural groupings instead of as
// a flat pulse (e.g. 6/8 = 3+3, 7/8 = 2+2+3, 12/8 = 3+3+3+3).
export const TIME_SIGNATURES: {
  label: string;
  beats: number;
  note: number;
  accents: number[];
  category: TimeSignatureCategory;
}[] = [
  // Standard (simple meters)
  { label: "2 / 2", beats: 2, note: 2, accents: [0], category: "standard" },
  { label: "2 / 4", beats: 2, note: 4, accents: [0], category: "standard" },
  { label: "3 / 4", beats: 3, note: 4, accents: [0], category: "standard" },
  { label: "4 / 4", beats: 4, note: 4, accents: [0], category: "standard" },
  { label: "5 / 4", beats: 5, note: 4, accents: [0, 3], category: "standard" }, // 3+2
  { label: "6 / 4", beats: 6, note: 4, accents: [0, 3], category: "standard" }, // 3+3
  // Compound (dotted-beat meters)
  { label: "3 / 8", beats: 3, note: 8, accents: [0], category: "compound" },
  { label: "6 / 8", beats: 6, note: 8, accents: [0, 3], category: "compound" }, // 3+3
  { label: "9 / 8", beats: 9, note: 8, accents: [0, 3, 6], category: "compound" }, // 3+3+3
  { label: "12 / 8", beats: 12, note: 8, accents: [0, 3, 6, 9], category: "compound" }, // 3+3+3+3
  // Odd meters (asymmetric groupings)
  { label: "5 / 8", beats: 5, note: 8, accents: [0, 3], category: "odd" }, // 3+2
  { label: "7 / 8", beats: 7, note: 8, accents: [0, 2, 4], category: "odd" }, // 2+2+3
  { label: "11 / 8", beats: 11, note: 8, accents: [0, 3, 6, 9], category: "odd" }, // 3+3+3+2
  { label: "13 / 8", beats: 13, note: 8, accents: [0, 3, 6, 9, 11], category: "odd" }, // 3+3+3+2+2
];

export type TimeSignature = (typeof TIME_SIGNATURES)[number];

// Playback feel: changes how fast the clicks actually fall relative to the
// set BPM, without changing the BPM number itself. Half time doubles the gap
// between clicks; double time halves it (1 2 3 4 1 2 3 4).
export const PLAYBACK_FEELS = [
  { label: "Half Time", short: "0.5×", multiplier: 0.5 },
  { label: "Normal", short: "1×", multiplier: 1 },
  { label: "Double Time", short: "2×", multiplier: 2 },
];

export const DEFAULT_FEEL_INDEX = 1; // Normal

// Metronome click sounds, one entry per selectable sample. Extend by dropping a
// new file into assets/audio/clicks, registering it in constants/audio.js, and
// adding an entry here: the engine decodes every id up front and each voice's
// picker lists these labels.
export const METRONOME_SOUNDS: { id: string; label: string; asset: number }[] = [
  { id: "bright", label: "Bright", asset: audio.metronome_bright },
  { id: "low", label: "Low", asset: audio.metronome_low },
];

type MetronomeContextValue = {
  bpm: number;
  setBpm: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  currentBeat: number;
  timeSignature: TimeSignature;
  setTimeSignature: (timeSignature: TimeSignature) => void;
  accents: number[];
  feelIndex: number;
  setFeelIndex: (index: number) => void;
  /** Metronome accent-click gain, 0–1 (persisted). */
  accentVolume: number;
  setAccentVolume: (value: number) => void;
  /** Metronome regular-click gain, 0–1 (persisted). */
  beatVolume: number;
  setBeatVolume: (value: number) => void;
  /** Sound id the accent voice plays (persisted). See METRONOME_SOUNDS. */
  accentSound: string;
  setAccentSound: (id: string) => void;
  /** Sound id the regular-beat voice plays (persisted). See METRONOME_SOUNDS. */
  beatSound: string;
  setBeatSound: (id: string) => void;
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
  const { prefs, setPref } = usePreferences();
  const isBlockedByOtherEngine = activeEngine !== null && activeEngine !== "metro";

  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const isPlayingRef = useRef(false);

  const [timeSignature, setTimeSignature] = useState(
    () => TIME_SIGNATURES.find((ts) => ts.label === "4 / 4") ?? TIME_SIGNATURES[0]
  ); // Default 4/4
  const [feelIndex, setFeelIndex] = useState(DEFAULT_FEEL_INDEX); // Default Normal

  // Per-voice output volumes live in preferences so they persist. Setters here
  // just proxy to setPref; the effect below pushes live changes to the engine.
  const accentVolume = prefs.accentVolume;
  const beatVolume = prefs.beatVolume;
  const setAccentVolume = (value: number) => setPref("accentVolume", value);
  const setBeatVolume = (value: number) => setPref("beatVolume", value);
  // Per-voice sound choices also persist; the effect below pushes live changes.
  const accentSound = prefs.accentSound;
  const beatSound = prefs.beatSound;
  const setAccentSound = (id: string) => setPref("accentSound", id);
  const setBeatSound = (id: string) => setPref("beatSound", id);
  // Preference: group accents in compound/odd meters (settings -> Playback).
  // Off = only the downbeat is accented, in any meter.
  const effectiveAccents = prefs.meterAccents ? timeSignature.accents : [0];
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
        const encoded = await Promise.all(
          METRONOME_SOUNDS.map((s) => loadAssetBase64(s.asset))
        );

        if (!isMounted) return;
        const sounds = Object.fromEntries(
          METRONOME_SOUNDS.map((s, i) => [s.id, encoded[i]])
        );
        setEngineHtml(buildMetronomeHtml({ sounds }));
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
      accents: effectiveAccents,
      accentVolume,
      beatVolume,
      accentSound,
      beatSound,
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
      postToEngine({
        type: "setBeats",
        beats: timeSignature.beats,
        accents: effectiveAccents,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeSignature, prefs.meterAccents]);

  // Live volume changes reach the engine mid-playback (no restart needed).
  useEffect(() => {
    if (isPlaying) {
      postToEngine({ type: "setVolumes", accentVolume, beatVolume });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentVolume, beatVolume]);

  // Live sound changes likewise switch the voices mid-playback.
  useEffect(() => {
    if (isPlaying) {
      postToEngine({ type: "setSounds", accentSound, beatSound });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentSound, beatSound]);

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
        accents: effectiveAccents,
        feelIndex,
        setFeelIndex,
        accentVolume,
        setAccentVolume,
        beatVolume,
        setBeatVolume,
        accentSound,
        setAccentSound,
        beatSound,
        setBeatSound,
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
