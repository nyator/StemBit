import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StatusBar, TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import LaunchPadComponent from "../../components/launchPad";
import HeaderComponent from "../../components/headerComponent";

import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer } from "expo-audio";
import audio from "../../constants/audio";
import { usePreferences } from "../../context/PreferencesContext";

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

const MAJOR_KEYS = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
const MINOR_NOTE_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const MINOR_KEYS = MINOR_NOTE_LETTERS.map((n) => `${n} minor`);

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

export default function PadScreen() {
  const { prefs } = usePreferences();
  const [keySelected, setKeySelected] = useState("");
  const [majorMinor, setMajorMinor] = useState("major");
  const fadeTimersRef = useRef<Map<AudioPlayer, TimerHandle>>(new Map());
  const hasMountedRef = useRef(false);

  // One shared two-layer player for the whole instrument — each key just
  // swaps in its own pre-pitched sample via replace().
  const padPlayerRef = useRef<PadPlayer | null>(null);
  if (!padPlayerRef.current) padPlayerRef.current = createPadPlayer(DEFAULT_PAD_SOURCE);
  const padPlayer = padPlayerRef.current;

  const isMinor = majorMinor.toLowerCase() === "minor";
  const activeKeys = isMinor ? MINOR_KEYS : MAJOR_KEYS;

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

  const clearAllFades = useCallback(() => {
    fadeTimersRef.current.forEach((timer) => clearInterval(timer));
    fadeTimersRef.current.clear();
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

  const stopPad = useCallback(
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

            fadeVolume(nextPlayer, TARGET_VOLUME, LOOP_CROSSFADE_MS);
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

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    setKeySelected("");
    stopPad(padPlayer);
  }, [majorMinor, padPlayer, stopPad]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setKeySelected("");
        stopPad(padPlayer);
      };
    }, [padPlayer, stopPad])
  );

  useEffect(() => {
    return () => {
      clearAllFades();
      if (padPlayer.loopTimer) {
        clearInterval(padPlayer.loopTimer);
      }

      padPlayer.layers.forEach((layer) => {
        clearFade(layer);
        layer.pause();
        layer.loop = false;
        layer.remove();
      });

    };
  }, [clearAllFades, clearFade, padPlayer]);

  const handlePadPress = async (idx: number) => {
    if (prefs.haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const isSelected = keySelected === `${idx}`;

    if (isSelected) {
      stopPad(padPlayer);
      setKeySelected("");
      return;
    }

    const noteLetter = isMinor ? MINOR_NOTE_LETTERS[idx] : MAJOR_KEYS[idx];
    const source = sourceForKey(noteLetter, isMinor);

    padPlayer.playToken += 1;
    const pressToken = padPlayer.playToken;

    let targetLayer = padPlayer.activeLayer;

    if (keySelected !== "") {
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

    try {
      await prepareLayer(player, source, 0);
    } catch (error) {
      console.error("Failed to prepare pad:", error);
      return;
    }

    if (pressToken !== padPlayer.playToken) return;

    padPlayer.activeLayer = targetLayer;
    player.play();

    fadeVolume(player, TARGET_VOLUME);
    startSelfCrossfadeLoop(padPlayer);
    setKeySelected(`${idx}`);
  };

  return (
    <SafeAreaView className="items-center justify-start flex-1 bg-canvas">
      <HeaderComponent />
      <View className="items-center justify-start flex-1 w-full px-5">
        <View className="flex flex-row items-center justify-center w-full mt-9 border-b border-white/10">
          <TouchableOpacity
            className={`px-10 py-4 items-center justify-center border-b-2 -mb-[1px] ${!isMinor ? "border-green-400" : "border-transparent"
              }`}
            onPress={() => setMajorMinor("major")}
            activeOpacity={0.7}
          >
            <Text className={`font-satoshiBold text-base ${!isMinor ? "text-green-400 font-spaceBold" : "text-gray-500"}`}>
              Major
            </Text>
          </TouchableOpacity>

          {/* Clean Divider */}
          <View className="w-[1px] h-4 bg-white/10 mx-2" />

          <TouchableOpacity
            className={`px-10 py-4 items-center justify-center border-b-2 -mb-[1px] ${isMinor ? "border-green-400" : "border-transparent"
              }`}
            onPress={() => setMajorMinor("minor")}
            activeOpacity={0.7}
          >
            <Text className={`font-satoshiBold text-base ${isMinor ? "text-green-400 font-spaceBold" : "text-gray-500"}`}>
              Minor
            </Text>
          </TouchableOpacity>
        </View>
        <View className="flex flex-row flex-wrap items-center justify-center w-full mt-5">
          {activeKeys.map((key, idx) => (
            <LaunchPadComponent
              key={key}
              isPlaying={keySelected === `${idx}`}
              selectKey={key}
              onPress={() => handlePadPress(idx)}
            />
          ))}
        </View>
      </View>
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
}
