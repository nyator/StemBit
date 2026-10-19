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
import { usePreferences, type PadLayer } from "./PreferencesContext";
import {
  MINOR_KEYS_ENABLED,
  findPadPackByKey,
  padBusScale,
  padSourceFor,
  padTrim,
  type PadPack,
} from "../constants/pads";
import { onVolumePreview } from "../utils/volumePreview";

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
// Simulator). Each pack brings its own set of these; see PadPack.sources.
//
// Minor keys play the *relative major* clip (tonic + 3 semitones), which shares
// the same notes as the natural minor key (A minor -> C major pad).
//
// Ambience has one clip whatever the key; padSourceFor hands that back.
function sourceForKey(pack: PadPack, note: string, minor: boolean) {
  const idx = (NOTE_INDEX[note] + (minor ? 3 : 0)) % 12;
  return padSourceFor(pack, NOTE_NAMES[idx]);
}

/**
 * The clip a pack sounds at a pad key (an index into KEYS) and voicing -- or
 * its C clip when no key is lit. What the engine plays, for anything that
 * wants to sound a pack in tune with it: the picker's preview, so auditioning
 * a pack over a held drone doesn't play it in C against a song in E.
 */
export function padClipAt(
  pack: PadPack,
  keyIndex: number | null,
  mode: PadMode
): number {
  if (keyIndex === null) return padSourceFor(pack, "C");
  return sourceForKey(pack, KEYS[keyIndex], mode === "minor");
}

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

// One stacked pack's voice. `layers` is NOT polyphony -- it's the crossfade
// pair that lets a single voice loop and change key seamlessly. Sounding two
// packs together means two of these, not one with more layers.
type PadPlayer = {
  packKey: string;
  layers: [AudioPlayer, AudioPlayer];
  activeLayer: 0 | 1;
  loopTimer?: TimerHandle;
  isLoopCrossfading: boolean;
  currentSource: number;
  playToken: number;
  /**
   * Started and not since torn down. What lets an ambience voice carry on
   * through a key change instead of starting its recording again.
   */
  sounding: boolean;
};

const resetPlayer = (player?: AudioPlayer, volume = TARGET_VOLUME) => {
  if (!player) return;

  player.pause();
  player.loop = false;
  player.volume = volume;
  player.seekTo(0).catch(console.error);
};

const createPadPlayer = (packKey: string, source: number): PadPlayer => ({
  packKey,
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
  sounding: false,
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
  const { prefs, isLoaded } = usePreferences();

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

  // One voice per stacked pack, keyed by PadPack.key. A key press sounds all
  // of them; each keeps its own crossfade pair, loop timer and play token, so
  // they stay independent and a slow prepare on one can't stall the others.
  const padPlayersRef = useRef<Map<string, PadPlayer>>(new Map());

  // The current stack, mirrored for reading inside timers and callbacks
  // without stale closures.
  const padLayersRef = useRef<PadLayer[]>(prefs.padLayers);

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

  // Playback volume for one stacked pack: its own mix level, scaled by the
  // master pad volume, then divided down so the stack as a whole can't exceed
  // full scale.
  //
  // Native players sum in the OS mixer with no headroom, so three voices at
  // level 1 would clip rather than just sound loud. Normalising by the summed
  // level means a single layer at 1 plays exactly as it did before layering
  // existed, and adding a second one splits the same ceiling between them
  // instead of piling on top of it. Levels below a total of 1 are left alone —
  // the scale only ever attenuates, never boosts a quiet stack.
  const volumeForPack = useCallback((packKey: string) => {
    const layers = padLayersRef.current;
    // Each channel counts at its trimmed level, which is what actually
    // reaches the bus: charging the pads for gain a trimmed field recording
    // never uses would duck them for nothing.
    const scale = padBusScale(
      layers.map((layer) => ({ ...layer, level: layer.level * padTrim(layer.pack) }))
    );

    const layer = layers.find((entry) => entry.pack === packKey);
    if (!layer || layer.muted) return 0;

    return padVolumeRef.current * layer.level * padTrim(packKey) * scale;
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
      player.sounding = false;

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
    padPlayersRef.current.forEach((player) => teardownPad(player, true));
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

            fadeVolume(
              nextPlayer,
              volumeForPack(player.packKey),
              LOOP_CROSSFADE_MS
            );
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
    [fadeVolume, volumeForPack]
  );

  // Bring one stacked pack in on the given key. Each voice does this for
  // itself, so a pack whose clip is slow to prepare delays only its own
  // entrance rather than holding up the rest of the stack.
  const startVoice = useCallback(
    (padPlayer: PadPlayer, index: number, isKeyChange: boolean) => {
      const pack = findPadPackByKey(padPlayer.packKey);
      if (!pack) return;

      // Ambience has no key to change to. A voice already running carries on
      // -- a forest doesn't start again because the song modulated -- and
      // only picks up its share of the mix.
      if (pack.kind === "ambience" && padPlayer.sounding) {
        if (!padPlayer.isLoopCrossfading) {
          fadeVolume(
            padPlayer.layers[padPlayer.activeLayer],
            volumeForPack(padPlayer.packKey)
          );
        }
        return;
      }

      const source = sourceForKey(
        pack,
        KEYS[index],
        modeRef.current === "minor"
      );

      padPlayer.playToken += 1;
      const pressToken = padPlayer.playToken;

      let targetLayer = padPlayer.activeLayer;

      if (isKeyChange) {
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

      prepareLayer(player, source, 0)
        .then(() => {
          if (pressToken !== padPlayer.playToken) return;

          padPlayer.activeLayer = targetLayer;
          padPlayer.sounding = true;
          player.play();

          fadeVolume(player, volumeForPack(padPlayer.packKey));
          startSelfCrossfadeLoop(padPlayer);
        })
        .catch((error) => {
          console.error("Failed to prepare pad:", error);
        });
    },
    [fadeVolume, startSelfCrossfadeLoop, volumeForPack]
  );

  const togglePad = useCallback(
    (index: number) => {
      // Tapping the lit pad stops it.
      if (activeKeyIndexRef.current === index && isPlayingRef.current) {
        stopPad();
        return;
      }

      const isKeyChange = activeKeyIndexRef.current !== null;

      // Light the pad immediately for responsiveness; the audio fades in once
      // each voice's layer is prepared.
      activeKeyIndexRef.current = index;
      isPlayingRef.current = true;
      setActiveKeyIndex(index);
      setIsPlaying(true);

      padPlayersRef.current.forEach((padPlayer) =>
        startVoice(padPlayer, index, isKeyChange)
      );
    },
    [startVoice, stopPad]
  );

  // Changing voicing stops any current drone and clears the selection, matching
  // the original pad-screen behavior.
  const setMode = useCallback(
    (nextMode: PadMode) => {
      // Minor is switched off for now (constants/pads.ts); the engine stays
      // in major whoever asks.
      if (nextMode === "minor" && !MINOR_KEYS_ENABLED) return;
      if (nextMode === modeRef.current) return;
      modeRef.current = nextMode;
      setModeState(nextMode);
      stopPad();
    },
    [stopPad]
  );

  // Reconcile the live voices with the stack the user has configured. Runs on
  // mount to build the initial voices, and again whenever a pack is added,
  // removed or remixed.
  //
  // Editing the stack mid-drone is the interesting case: a pack added while
  // something is sounding joins on the current key rather than waiting for the
  // next press, and one removed fades out instead of cutting. Levels are
  // reapplied to every voice on any change, since the bus scale depends on the
  // whole stack — raising one layer quietly lowers the others.
  useEffect(() => {
    padVolumeRef.current = prefs.padVolume;
    padLayersRef.current = prefs.padLayers;

    // Preferences start at DEFAULTS and are replaced once the file is read.
    // Building voices for the defaults first would open native players just to
    // tear them down a moment later.
    if (!isLoaded) return;

    const players = padPlayersRef.current;
    const wanted = new Set(prefs.padLayers.map((layer) => layer.pack));

    // Drop voices whose pack has left the stack.
    players.forEach((player, packKey) => {
      if (wanted.has(packKey)) return;
      teardownPad(player, true);
      players.delete(packKey);
      // Fade first, then release the natives once the fade can't still be
      // writing to them.
      setTimeout(() => {
        player.layers.forEach((layer) => {
          clearFade(layer);
          layer.pause();
          layer.loop = false;
          layer.remove();
        });
      }, CROSSFADE_MS + CROSSFADE_MARGIN_MS);
    });

    // Build voices for packs that have just joined.
    prefs.padLayers.forEach((layer) => {
      if (players.has(layer.pack)) return;
      const pack = findPadPackByKey(layer.pack);
      if (!pack) return; // stale key from an older catalog

      // Loaded mid-drone, the voice is built on the clip for the key that's
      // sounding, not C. It used to start on C and be switched straight
      // after -- but the players download their first clip before loading
      // it, and a C download landing after the switch put it back, so a pack
      // added over a held E could come in in C.
      const sounding =
        isPlayingRef.current && activeKeyIndexRef.current !== null;
      const player = createPadPlayer(
        layer.pack,
        sounding
          ? padClipAt(pack, activeKeyIndexRef.current, modeRef.current)
          : pack.sources.C
      );
      players.set(layer.pack, player);

      if (sounding && activeKeyIndexRef.current !== null) {
        startVoice(player, activeKeyIndexRef.current, false);
      }
    });

    // Retarget everything still sounding to its new share of the mix. A voice
    // mid-crossfade is left alone; its fade already ends on a fresh value.
    if (!isPlayingRef.current) return;
    players.forEach((player) => {
      if (player.isLoopCrossfading) return;
      const audioLayer = player.layers[player.activeLayer];
      clearFade(audioLayer);
      audioLayer.volume = volumeForPack(player.packKey);
    });
  }, [
    isLoaded,
    prefs.padLayers,
    prefs.padVolume,
    clearFade,
    startVoice,
    teardownPad,
    volumeForPack,
  ]);

  // The master pad level live, while its Settings slider is still moving (see
  // utils/volumePreview.ts). Through the ref the fades already read, so a
  // voice that starts mid-drag starts at the dragged level; the release's
  // setPref then runs the reconcile above and lands on the same value.
  useEffect(
    () =>
      onVolumePreview("pad", (volume) => {
        padVolumeRef.current = volume;
        if (!isPlayingRef.current) return;
        padPlayersRef.current.forEach((player) => {
          if (player.isLoopCrossfading) return;
          const audioLayer = player.layers[player.activeLayer];
          clearFade(audioLayer);
          audioLayer.volume = volumeForPack(player.packKey);
        });
      }),
    [clearFade, volumeForPack]
  );

  // Release the native players when the app itself tears down (this provider
  // lives for the app's lifetime, so this only runs on full unmount).
  useEffect(() => {
    const fadeTimers = fadeTimersRef.current;
    const players = padPlayersRef.current;
    return () => {
      fadeTimers.forEach((timer) => clearInterval(timer));
      fadeTimers.clear();
      const release = (padPlayer: PadPlayer) => {
        if (padPlayer.loopTimer) clearInterval(padPlayer.loopTimer);
        padPlayer.layers.forEach((layer) => {
          layer.pause();
          layer.loop = false;
          layer.remove();
        });
      };
      players.forEach(release);
      players.clear();
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
