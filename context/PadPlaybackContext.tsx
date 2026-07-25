import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer } from "expo-audio";

import audio from "../constants/audio";
import { usePreferences } from "./PreferencesContext";

// Pad instrument engine. This used to live inside the pad screen, but a held
// pad drone needs to keep sounding while the user navigates elsewhere (the same
// requirement the metronome and loop engines meet). So the player and all its
// crossfade/loop logic live here, in a provider mounted at the app root
// (app/_layout.tsx) above every navigator. Nothing about it is tied to the pad
// screen being mounted or focused anymore; the screen is just a remote control.

export type PadMode = "major" | "minor";

const NOTE_INDEX: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5,
  "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// One pre-pitched clip per chromatic root, rendered offline from the C master
// (scripts/generate_pads.sh). We select the right clip per key instead of
// pitch-shifting at runtime — AVPlayer's varispeed pitch shift is unreliable on
// physical iOS devices (it plays back in C on device while working in the
// Simulator).
const PAD_SOURCES: Record<string, number> = audio.pads;

// Minor keys play the *relative major* clip (tonic + 3 semitones), which shares
// the same notes as the natural minor key (A minor -> C major pad).
function sourceForKey(note: string, minor: boolean) {
  const idx = (NOTE_INDEX[note] + (minor ? 3 : 0)) % 12;
  return PAD_SOURCES[NOTE_NAMES[idx]];
}

const DEFAULT_PAD_SOURCE: number = audio.pads.C;

// Same 12 chromatic pads for both major and minor -- only the sample source
// (relative major clip, see sourceForKey) and the active color differ. Exported
// so the pad screen renders the same grid the engine plays.
export const KEYS = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];

// Sharp keys show their enharmonic flat name too, matching the Figma pad grid
// (e.g. "C#/Db"). Natural keys are unambiguous, so they're left as-is.
export const KEY_DISPLAY_LABELS: Record<string, string> = {
  "A#": "Bb",
  "C#": "C#",
  "D#": "Eb",
  "F#": "F#",
  "G#": "G#",
};

const CROSSFADE_MS = 1200;
// Loop crossfade: the next copy of the pad starts and fades in over this long
// while the current copy fades out, so the two overlap by ~3s and the pad never
// audibly ends and restarts. Longer than the key-switch fade for seamlessness.
const LOOP_CROSSFADE_MS = 5000;
// Loop copies start this far into the clip instead of at 0, skipping the pad's
// intro swell so its recognizable beginning isn't heard on every loop. The
// first press still starts at 0 for a natural attack.
const LOOP_START_OFFSET_MS = 5000;
// Extra headroom so the async prepareLayer/seek finishes before the sample
// actually runs out (also covers the LOOP_POLL_MS polling granularity).
const CROSSFADE_MARGIN_MS = 400;
const LOOP_POLL_MS = 200;
const FADE_STEP_MS = 40;
const TARGET_VOLUME = 1;

type TimerHandle = ReturnType<typeof setInterval>;

type PadPlayer = {
  layers: [AudioPlayer, AudioPlayer];
  activeLayer: 0 | 1;
  loopTimer?: TimerHandle;
  isLoopCrossfading: boolean;
  currentSource: number;
  playToken: number;
};

const resetPlayer = (player?: AudioPlayer, volume = TARGET_VOLUME) => {
  if (!player) return;

  player.pause();
  player.loop = false;
  player.volume = volume;
  player.seekTo(0).catch(console.error);
};

const createPadPlayer = (source: number): PadPlayer => ({
  layers: [
    createAudioPlayer(source, {
      downloadFirst: true,
      keepAudioSessionActive: true,
      updateInterval: 100,
    }),
    createAudioPlayer(source, {
      downloadFirst: true,
      keepAudioSessionActive: true,
      updateInterval: 100,
    }),
  ],
  activeLayer: 0,
  isLoopCrossfading: false,
  currentSource: source,
  playToken: 0,
});

const prepareLayer = async (
  player: AudioPlayer,
  source: number,
  volume: number,
  startAtSeconds = 0
) => {
  player.pause();
  player.loop = false;
  player.volume = volume;
  player.replace(source);
  await player.seekTo(startAtSeconds);
};

type PadPlaybackContextValue = {
  /** True while a pad drone is sounding. */
  isPlaying: boolean;
  /** Index into KEYS of the lit pad, or null when nothing is playing. */
  activeKeyIndex: number | null;
  /** Major/minor voicing; switching it stops any current drone. */
  mode: PadMode;
  setMode: (mode: PadMode) => void;
  /** Play the pad at KEYS[index], or stop it if it's already the active one. */
  togglePad: (index: number) => void;
  stopPad: () => void;
  /** Short label for the floating control, e.g. "C# maj" (null when stopped). */
  activeLabel: string | null;
};

const PadPlaybackContext = createContext<PadPlaybackContextValue | null>(null);

export function PadPlaybackProvider({ children }: { children: ReactNode }) {
  const { prefs } = usePreferences();

  const [isPlaying, setIsPlaying] = useState(false);
  const [activeKeyIndex, setActiveKeyIndex] = useState<number | null>(null);
  const [mode, setModeState] = useState<PadMode>("major");

  // Master pad level (Settings -> Pad Volume). A ref so the fade helpers read
  // the current value at call time without being recreated on every change.
  const padVolumeRef = useRef(prefs.padVolume);

  // Mirrors of the above for reading inside memoized callbacks/timers without
  // stale closures or re-creating the callbacks on every state change.
  const isPlayingRef = useRef(false);
  const activeKeyIndexRef = useRef<number | null>(null);
  const modeRef = useRef<PadMode>("major");

  const fadeTimersRef = useRef<Map<AudioPlayer, TimerHandle>>(new Map());

  // One shared two-layer player for the whole instrument — each key just
  // swaps in its own pre-pitched sample via replace().
  const padPlayerRef = useRef<PadPlayer | null>(null);
  if (!padPlayerRef.current) {
    padPlayerRef.current = createPadPlayer(DEFAULT_PAD_SOURCE);
  }

  // Keep the app's audio session configured for playback in silent mode (iOS).
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionModeAndroid: "duckOthers",
    }).catch((error) => {
      console.error("Failed to configure pad audio mode:", error);
    });
  }, []);

  const clearFade = useCallback((player: AudioPlayer) => {
    const timer = fadeTimersRef.current.get(player);
    if (timer) {
      clearInterval(timer);
      fadeTimersRef.current.delete(player);
    }
  }, []);

  const fadeVolume = useCallback(
    (
      player: AudioPlayer,
      toVolume: number,
      durationMs = CROSSFADE_MS,
      onComplete?: () => void
    ) => {
      clearFade(player);

      const fromVolume = player.volume;
      const steps = Math.max(1, Math.ceil(durationMs / FADE_STEP_MS));
      let currentStep = 0;

      const timer = setInterval(() => {
        currentStep += 1;
        const progress = Math.min(currentStep / steps, 1);

        player.volume = fromVolume + (toVolume - fromVolume) * progress;

        if (progress >= 1) {
          clearInterval(timer);
          fadeTimersRef.current.delete(player);
          player.volume = toVolume;
          onComplete?.();
        }
      }, FADE_STEP_MS);

      fadeTimersRef.current.set(player, timer);
    },
    [clearFade]
  );

  // Fade/stop both layers of the player. Doesn't touch React state — public
  // stopPad does that; this is the shared audio teardown.
  const teardownPad = useCallback(
    (player: PadPlayer, fadeOut = true) => {
      player.playToken += 1;

      if (player.loopTimer) {
        clearInterval(player.loopTimer);
        player.loopTimer = undefined;
      }

      player.isLoopCrossfading = false;

      player.layers.forEach((layer) => {
        if (fadeOut) {
          fadeVolume(layer, 0, CROSSFADE_MS, () => resetPlayer(layer, 0));
        } else {
          clearFade(layer);
          resetPlayer(layer, 0);
        }
      });

      player.activeLayer = 0;
    },
    [clearFade, fadeVolume]
  );

  const stopPad = useCallback(() => {
    const player = padPlayerRef.current;
    if (player) teardownPad(player, true);
    isPlayingRef.current = false;
    activeKeyIndexRef.current = null;
    setIsPlaying(false);
    setActiveKeyIndex(null);
  }, [teardownPad]);

  const startSelfCrossfadeLoop = useCallback(
    (player: PadPlayer) => {
      if (player.loopTimer) {
        clearInterval(player.loopTimer);
      }

      player.loopTimer = setInterval(() => {
        const activePlayer = player.layers[player.activeLayer];
        const duration = activePlayer.duration;
        const timeRemaining = duration - activePlayer.currentTime;

        // Start the crossfade ~3s before the end so the next copy is already
        // fading in as this one fades out — no gap, no restart.
        const triggerThreshold = (LOOP_CROSSFADE_MS + CROSSFADE_MARGIN_MS) / 1000;

        if (
          player.isLoopCrossfading ||
          !duration ||
          timeRemaining > triggerThreshold
        ) {
          return;
        }

        player.isLoopCrossfading = true;

        const nextLayer = player.activeLayer === 0 ? 1 : 0;
        const nextPlayer = player.layers[nextLayer];
        const loopToken = player.playToken;

        prepareLayer(
          nextPlayer,
          player.currentSource,
          0,
          LOOP_START_OFFSET_MS / 1000
        )
          .then(() => {
            if (loopToken !== player.playToken) return;

            nextPlayer.play();

            fadeVolume(nextPlayer, padVolumeRef.current, LOOP_CROSSFADE_MS);
            fadeVolume(activePlayer, 0, LOOP_CROSSFADE_MS, () => {
              if (loopToken !== player.playToken) return;

              resetPlayer(activePlayer, 0);
              player.activeLayer = nextLayer;
              player.isLoopCrossfading = false;
            });
          })
          .catch((error) => {
            console.error("Failed to prepare pad loop layer:", error);
            player.isLoopCrossfading = false;
          });
      }, LOOP_POLL_MS);
    },
    [fadeVolume]
  );

  const togglePad = useCallback(
    (index: number) => {
      const padPlayer = padPlayerRef.current;
      if (!padPlayer) return;

      // Tapping the lit pad stops it.
      if (activeKeyIndexRef.current === index && isPlayingRef.current) {
        stopPad();
        return;
      }

      const noteLetter = KEYS[index];
      const source = sourceForKey(noteLetter, modeRef.current === "minor");

      padPlayer.playToken += 1;
      const pressToken = padPlayer.playToken;

      let targetLayer = padPlayer.activeLayer;

      if (activeKeyIndexRef.current !== null) {
        // Switch keys with a crossfade instead of a hard cut: fade the old key
        // out on its current layer and bring the new key in on the other one.
        if (padPlayer.loopTimer) {
          clearInterval(padPlayer.loopTimer);
          padPlayer.loopTimer = undefined;
        }
        padPlayer.isLoopCrossfading = false;

        const oldLayer = padPlayer.layers[padPlayer.activeLayer];
        targetLayer = padPlayer.activeLayer === 0 ? 1 : 0;
        fadeVolume(oldLayer, 0, CROSSFADE_MS, () => resetPlayer(oldLayer, 0));
      }

      padPlayer.currentSource = source;
      const player = padPlayer.layers[targetLayer];

      // Light the pad immediately for responsiveness; the audio fades in once
      // the layer is prepared.
      activeKeyIndexRef.current = index;
      isPlayingRef.current = true;
      setActiveKeyIndex(index);
      setIsPlaying(true);

      prepareLayer(player, source, 0)
        .then(() => {
          if (pressToken !== padPlayer.playToken) return;

          padPlayer.activeLayer = targetLayer;
          player.play();

          fadeVolume(player, padVolumeRef.current);
          startSelfCrossfadeLoop(padPlayer);
        })
        .catch((error) => {
          console.error("Failed to prepare pad:", error);
        });
    },
    [fadeVolume, startSelfCrossfadeLoop, stopPad]
  );

  // Changing voicing stops any current drone and clears the selection, matching
  // the original pad-screen behavior.
  const setMode = useCallback(
    (nextMode: PadMode) => {
      if (nextMode === modeRef.current) return;
      modeRef.current = nextMode;
      setModeState(nextMode);
      stopPad();
    },
    [stopPad]
  );

  // Apply Pad Volume changes: keep the ref current for future fades, and
  // retarget the sounding layer live — unless a crossfade is already driving
  // its volume, in which case the next fade picks up the new level.
  useEffect(() => {
    padVolumeRef.current = prefs.padVolume;
    const player = padPlayerRef.current;
    if (player && isPlayingRef.current && !player.isLoopCrossfading) {
      const layer = player.layers[player.activeLayer];
      clearFade(layer);
      layer.volume = prefs.padVolume;
    }
  }, [prefs.padVolume, clearFade]);

  // Release the native players when the app itself tears down (this provider
  // lives for the app's lifetime, so this only runs on full unmount).
  useEffect(() => {
    const fadeTimers = fadeTimersRef.current;
    const padPlayer = padPlayerRef.current;
    return () => {
      fadeTimers.forEach((timer) => clearInterval(timer));
      fadeTimers.clear();
      if (!padPlayer) return;
      if (padPlayer.loopTimer) clearInterval(padPlayer.loopTimer);
      padPlayer.layers.forEach((layer) => {
        layer.pause();
        layer.loop = false;
        layer.remove();
      });
    };
  }, []);

  const activeLabel =
    activeKeyIndex === null
      ? null
      : `${KEY_DISPLAY_LABELS[KEYS[activeKeyIndex]] ?? KEYS[activeKeyIndex]} ${
          mode === "minor" ? "min" : "maj"
        }`;

  return (
    <PadPlaybackContext.Provider
      value={{
        isPlaying,
        activeKeyIndex,
        mode,
        setMode,
        togglePad,
        stopPad,
        activeLabel,
      }}
    >
      {children}
    </PadPlaybackContext.Provider>
  );
}

export function usePadPlayback() {
  const context = useContext(PadPlaybackContext);
  if (!context) {
    throw new Error("usePadPlayback must be used within a PadPlaybackProvider");
  }
  return context;
}
