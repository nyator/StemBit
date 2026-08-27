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

// How long the engine gets to answer a liveness ping before it's declared
// dead. Generous: the WebView may still be waking up after a spell in the
// background, and a needless restart drops the play button for a moment.
// Kept local rather than shared with the loop engine's copy — the two hosts
// are independent and could reasonably be tuned apart.
const ENGINE_PONG_TIMEOUT_MS = 2000;

// How long the beat survives after the app reports it went to the background
// before it's actually stopped. See the AppState handler for why this exists.
//
// A minute, not the five seconds this started at. Android reports a pulled-down
// notification shade as "background" -- identical to actually leaving the app --
// and behind that shade the activity is only paused, so the beat is still
// audible and still correct. Five seconds meant that glancing at a notification
// for longer than a glance killed a running click, which is worse than anything
// this timer is protecting against: the engine it eventually stops is a
// suspended WebView that has already gone silent on its own, so waiting longer
// costs nothing but a stale isPlaying flag that coming back clears anyway.
const BACKGROUND_STOP_GRACE_MS = 60000;

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

// Metronome click sounds, one entry per selectable sample.
//
// Sounds are categorized by `group`: each DAW kit (Ableton, Logic, ...) supplies
// a `beat` voice (its normal click) and an `accent` voice (its accented/downbeat
// click). `role` marks which one so each voice's picker can lean toward the
// matching variant, though any voice may play any sound. `label` is what the
// picker renders.
//
// Extend by dropping WAVs into assets/audio/clicks, registering them in
// constants/audio.js, and adding entries here: the engine decodes every id up
// front (see MetronomeAssets in constants/metronomeEngine.ts) and each voice's
// picker lists these labels.
export type MetronomeSoundRole = "accent" | "beat";
export type MetronomeSound = {
  id: string;
  group: string;
  role: MetronomeSoundRole;
  label: string;
  asset: number;
};

// Kits render in this order; each expands into an accent + beat entry below.
const METRONOME_KITS: { id: string; group: string }[] = [
  { id: "ableton", group: "Ableton" },
  { id: "cubase", group: "Cubase" },
  { id: "fl", group: "FL Studio" },
  { id: "logic", group: "Logic" },
  { id: "maschine", group: "Maschine" },
  { id: "mpc", group: "MPC" },
  { id: "protools", group: "Pro Tools" },
  { id: "marimba", group: "Pro Tools Marimba" },
  { id: "reason", group: "Reason" },
  { id: "sonar", group: "Sonar" },
];

const clicks = audio.clicks as Record<string, number>;

export const METRONOME_SOUNDS: MetronomeSound[] = [
  ...METRONOME_KITS.flatMap(({ id, group }): MetronomeSound[] => [
    {
      id: `${id}_accent`,
      group,
      role: "accent",
      label: `${group} · Accent`,
      asset: clicks[`${id}_accent`],
    },
    {
      id: `${id}_beat`,
      group,
      role: "beat",
      label: `${group} · Beat`,
      asset: clicks[`${id}_beat`],
    },
  ]),
  // Original synthetic clicks, kept so saved preferences referencing them stay
  // valid.
  { id: "bright", group: "Basic", role: "accent", label: "Basic · Bright", asset: audio.metronome_bright },
  { id: "low", group: "Basic", role: "beat", label: "Basic · Low", asset: audio.metronome_low },
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
  // Master metronome level (Settings -> Metronome Volume); the engine scales
  // both voices by it.
  const masterVolume = prefs.metronomeVolume;
  // Per-voice sound choices also persist; the effect below pushes live changes.
  const accentSound = prefs.accentSound;
  const beatSound = prefs.beatSound;
  const setAccentSound = (id: string) => setPref("accentSound", id);
  const setBeatSound = (id: string) => setPref("beatSound", id);
  // Preference: group accents in compound/odd meters (settings -> Playback).
  // Off = only the downbeat is accented, in any meter.
  const effectiveAccents = prefs.meterAccents ? timeSignature.accents : [0];
  // Playback-feel (subdivision) multiplier. The engine multiplies the raw BPM
  // by this; BPM changes take effect immediately, feel changes on the next
  // downbeat (see the effects below).
  const speedMultiplier = PLAYBACK_FEELS[feelIndex].multiplier;

  const webViewRef = useRef<WebView>(null);
  const [engineHtml, setEngineHtml] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  // Bumping this remounts the WebView, which is how a dead engine is
  // recovered (see restartEngine).
  const [engineGeneration, setEngineGeneration] = useState(0);
  // Pending liveness check, if one is in flight.
  const pongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Countdown to stopping playback after the app went to the background.
  const backgroundStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

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
    // Silence first, bookkeeping after -- same reasoning as startMetronome.
    postToEngine({ type: "stop" });

    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentBeat(0);
    release("metro");
  };

  // Throw the engine away and build a new one.
  //
  // The WebView's process can be reclaimed by the OS while the app sits in
  // the background (Android kills the renderer, iOS terminates the content
  // process). The view object survives, so nothing looks wrong, but its page
  // is gone and every postMessage lands nowhere — the transport goes dead
  // with no way back.
  //
  // Recovery is a remount rather than webViewRef.reload(): after
  // onRenderProcessGone, Android's WebView instance is unusable and must be
  // replaced, not reloaded. Nothing needs restoring afterwards the way the
  // loop engine's decoded buffers do — the samples are baked into the page
  // HTML, and every playback setting is re-sent with the next "start".
  const restartEngine = () => {
    if (pongTimerRef.current) {
      clearTimeout(pongTimerRef.current);
      pongTimerRef.current = null;
    }
    // Blocks startMetronome until the replacement reports "ready".
    setEngineReady(false);
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentBeat(0);
    release("metro");
    setEngineGeneration((generation) => generation + 1);
  };

  // Ask the engine to answer for itself. onRenderProcessGone /
  // onContentProcessDidTerminate cover most deaths, but they don't fire on
  // every OS and build, and a silently dead engine leaves the user with a
  // play button that does nothing.
  const checkEngineAlive = () => {
    if (!engineReady) return; // still booting; "ready" will settle it
    if (pongTimerRef.current) return; // a check is already outstanding
    pongTimerRef.current = setTimeout(() => {
      pongTimerRef.current = null;
      console.warn("Metronome engine stopped responding — restarting it");
      restartEngine();
    }, ENGINE_PONG_TIMEOUT_MS);
    postToEngine({ type: "ping" });
  };

  // The metronome only makes sense in the foreground: pause it if the app
  // is backgrounded or the screen locks, since the WebView's audio clock
  // suspends there anyway. Coming back is also the moment the engine is most
  // likely to have been reclaimed while we weren't looking, so that's where
  // the liveness check goes.
  //
  // Only a real "background" counts, and even then not straight away.
  // "inactive" is a transient overlay — Control Centre, the notification
  // shade, an incoming-call banner, the app switcher — where the app is still
  // on screen and its audio keeps running.
  //
  // Android doesn't report "inactive" at all: RN maps the activity's onPause
  // straight to "background", so pulling down the notification shade looks
  // identical to genuinely leaving the app. Hence the grace period rather
  // than a state test alone — a glance at a notification is over in a second
  // or two, actually leaving the app isn't. Whichever state the platform
  // reports, the beat survives the short excursion and stops on the long one.
  useEffect(() => {
    const cancelPendingStop = () => {
      if (backgroundStopTimerRef.current) {
        clearTimeout(backgroundStopTimerRef.current);
        backgroundStopTimerRef.current = null;
      }
    };

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        if (!isPlayingRef.current || backgroundStopTimerRef.current) return;
        backgroundStopTimerRef.current = setTimeout(() => {
          backgroundStopTimerRef.current = null;
          // The JS thread can be frozen while backgrounded, so this may fire
          // late — possibly just as the user comes back. Never stop
          // something that is playing in the foreground.
          if (AppState.currentState === "active") return;
          if (isPlayingRef.current) stopMetronome();
        }, BACKGROUND_STOP_GRACE_MS);
        return;
      }
      // Back on screen, so whatever took us away was brief.
      cancelPendingStop();
      if (state === "active") checkEngineAlive();
    });
    return () => {
      subscription.remove();
      cancelPendingStop();
      // Null it too, not just clear it: this effect re-subscribes whenever
      // engineReady flips, and a non-null handle pointing at a cancelled
      // timer would make checkEngineAlive think a check is still outstanding
      // and never run another one.
      if (pongTimerRef.current) {
        clearTimeout(pongTimerRef.current);
        pongTimerRef.current = null;
      }
    };
    // checkEngineAlive reads engineReady, so the listener has to be rebuilt
    // when it changes or it would capture the initial `false` forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady]);

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") {
        setEngineReady(true);
      } else if (data.type === "pong") {
        if (pongTimerRef.current) {
          clearTimeout(pongTimerRef.current);
          pongTimerRef.current = null;
        }
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

    // The engine message goes out before the React state updates. Both are
    // cheap, but setState schedules a render and this is the one call whose
    // latency is audible -- so it gets the head start.
    postToEngine({
      type: "start",
      bpm,
      multiplier: speedMultiplier,
      beats: timeSignature.beats,
      accents: effectiveAccents,
      accentVolume,
      beatVolume,
      masterVolume,
      accentSound,
      beatSound,
    });

    isPlayingRef.current = true;
    setIsPlaying(true);
    setCurrentBeat(0);
  };

  // BPM changes take effect immediately mid-playback.
  useEffect(() => {
    if (isPlaying) {
      postToEngine({ type: "setTempo", bpm });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm]);

  // Playback-feel (subdivision) changes are queued in the engine and applied on
  // the next downbeat, so switching half/normal/double time never lurches the
  // pulse mid-bar.
  useEffect(() => {
    if (isPlaying) {
      postToEngine({ type: "setFeel", multiplier: speedMultiplier });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedMultiplier]);

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
      postToEngine({ type: "setVolumes", accentVolume, beatVolume, masterVolume });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentVolume, beatVolume, masterVolume]);

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
          // Remounting on a new generation is what actually rebuilds a dead
          // engine — see restartEngine.
          key={engineGeneration}
          ref={webViewRef}
          source={{ html: engineHtml }}
          onMessage={handleWebViewMessage}
          // The OS reclaimed this WebView's process, almost always while the
          // app was backgrounded. Both callbacks mean the same thing: the
          // page is gone and this view can't be used again.
          onRenderProcessGone={() => {
            console.warn("Metronome engine renderer was killed — restarting it");
            restartEngine();
          }}
          onContentProcessDidTerminate={() => {
            console.warn("Metronome engine content process ended — restarting it");
            restartEngine();
          }}
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
