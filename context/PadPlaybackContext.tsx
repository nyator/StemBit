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
import {
  usePreferences,
  type MixSettings,
  type PadLayer,
} from "./PreferencesContext";
import {
  NATURE_CHANNEL,
  findPadPackByKey,
  padBusScale,
  type PadPack,
} from "../constants/pads";

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
function sourceForKey(pack: PadPack, note: string, minor: boolean) {
  const idx = (NOTE_INDEX[note] + (minor ? 3 : 0)) % 12;
  return pack.sources[NOTE_NAMES[idx]];
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
  // The nature bed's mix, and its voice. Unlike the pads it isn't keyed off a
  // pad press: it runs whenever it's audible and stops when it isn't. It does
  // share the output bus, so the pad voices have to account for it.
  const natureRef = useRef<MixSettings>(prefs.natureNoise);
  const naturePlayerRef = useRef<PadPlayer | null>(null);

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
    // The nature bed shares this output bus, so it counts towards the scale
    // even though it isn't one of the pad voices — otherwise bringing it in
    // would push the total past full scale and clip everything.
    const scale = padBusScale([...layers, natureRef.current]);

    if (packKey === NATURE_CHANNEL.key) {
      const nature = natureRef.current;
      if (nature.muted) return 0;
      return padVolumeRef.current * nature.level * scale;
    }

    const layer = layers.find((entry) => entry.pack === packKey);
    if (!layer || layer.muted) return 0;

    return padVolumeRef.current * layer.level * scale;
  }, []);

  // The bed only sounds when a pad is sounding. It's ambience *under the
  // instrument*, not a standalone player: with no pad held there's nothing for
  // it to sit beneath, and leaving it running would mean the app quietly
  // playing forest audio with the transport stopped and no obvious way to
  // notice. So no combination of unmuting and fader position starts it on its
  // own — the pad is the gate, and the mix settings only decide whether it
  // comes along.
  const isNatureAudible = (settings: MixSettings, padSounding: boolean) =>
    padSounding && !settings.muted && settings.level > 0;

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
    natureRef.current = prefs.natureNoise;

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

      const player = createPadPlayer(layer.pack, pack.sources.C);
      players.set(layer.pack, player);

      if (isPlayingRef.current && activeKeyIndexRef.current !== null) {
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
    prefs.natureNoise,
    clearFade,
    startVoice,
    teardownPad,
    volumeForPack,
  ]);

  // Run the nature bed whenever it's audible. Unlike a pad voice it isn't tied
  // to a particular key — switching keys leaves it running rather than
  // restarting it — but it does follow the transport: it comes in when a pad
  // starts and goes out when the last one stops.
  //
  // It loops through the same crossfade pair the pads use rather than
  // AudioPlayer.loop. A 60-second slice of a field recording doesn't
  // butt-splice cleanly, and AAC's encoder padding would add a gap on top of
  // that; overlapping the end against a fresh copy hides the seam entirely.
  useEffect(() => {
    if (!isLoaded) return;

    const audible = isNatureAudible(prefs.natureNoise, isPlaying);
    const player = naturePlayerRef.current;

    if (!audible) {
      if (player) {
        teardownPad(player, true);
        naturePlayerRef.current = null;
        // Release the natives once the fade can no longer be writing to them.
        setTimeout(() => {
          player.layers.forEach((layer) => {
            clearFade(layer);
            layer.pause();
            layer.loop = false;
            layer.remove();
          });
        }, CROSSFADE_MS + CROSSFADE_MARGIN_MS);
      }
      return;
    }

    // Already running: just follow the fader.
    if (player) {
      if (player.isLoopCrossfading) return;
      const audioLayer = player.layers[player.activeLayer];
      clearFade(audioLayer);
      audioLayer.volume = volumeForPack(NATURE_CHANNEL.key);
      return;
    }

    const nature = createPadPlayer(NATURE_CHANNEL.key, NATURE_CHANNEL.source);
    naturePlayerRef.current = nature;

    nature.playToken += 1;
    const startToken = nature.playToken;
    nature.currentSource = NATURE_CHANNEL.source;
    const first = nature.layers[0];

    prepareLayer(first, NATURE_CHANNEL.source, 0)
      .then(() => {
        if (startToken !== nature.playToken) return;
        nature.activeLayer = 0;
        first.play();
        fadeVolume(first, volumeForPack(NATURE_CHANNEL.key));
        startSelfCrossfadeLoop(nature);
      })
      .catch((error) => {
        console.error("Failed to start nature bed:", error);
      });
  }, [
    isLoaded,
    // The transport gates the bed, so starting or stopping a pad has to
    // re-evaluate it — this is what brings it in and takes it out.
    isPlaying,
    prefs.natureNoise,
    prefs.padVolume,
    prefs.padLayers,
    clearFade,
    fadeVolume,
    startSelfCrossfadeLoop,
    teardownPad,
    volumeForPack,
  ]);

  // Release the native players when the app itself tears down (this provider
  // lives for the app's lifetime, so this only runs on full unmount).
  useEffect(() => {
    const fadeTimers = fadeTimersRef.current;
    const players = padPlayersRef.current;
    // The nature ref is read inside the cleanup, not out here: it's still null
    // at mount and only gets a player once the bed is first unmuted, so
    // capturing it now would leak those two natives.
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
      if (naturePlayerRef.current) {
        release(naturePlayerRef.current);
        naturePlayerRef.current = null;
      }
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
