import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import React, { useState, useRef } from "react";

import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { useRouter } from "expo-router";
import { LOOPS, type Loop } from "../constants/loops";
import { Musicnote, PauseCircle, PlayCircle } from "./icons";

type SelectLoopViewProps = {
  // Which loops to show — defaults to the full catalog. The browser screen
  // passes a category- or artist-filtered subset.
  loops?: Loop[];
};

const SelectLoopView = ({ loops = LOOPS }: SelectLoopViewProps) => {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const soundRef = useRef<AudioPlayer | null>(null);
  const playbackSubscriptionRef =
    useRef<ReturnType<AudioPlayer["addListener"]> | null>(null);
  const router = useRouter();

  const unloadCurrentSound = async () => {
    if (!soundRef.current) return;

    const sound = soundRef.current;
    soundRef.current = null;
    setPlayingIndex(null);
    playbackSubscriptionRef.current?.remove();
    playbackSubscriptionRef.current = null;
    sound.remove();
  };

  const handlePlayPause = async (index: number) => {
    if (playingIndex === index) {
      if (soundRef.current) {
        soundRef.current.pause();
      }
      setPlayingIndex(null);
      return;
    }

    await unloadCurrentSound();

    const sound = createAudioPlayer(loops[index].source);
    soundRef.current = sound;
    sound.play();
    setPlayingIndex(index);
    playbackSubscriptionRef.current = sound.addListener(
      "playbackStatusUpdate",
      (status) => {
        if (!status.didJustFinish) return;
        setPlayingIndex(null);
        playbackSubscriptionRef.current?.remove();
        playbackSubscriptionRef.current = null;
      }
    );
  };

  React.useEffect(() => {
    return () => {
      if (soundRef.current) {
        playbackSubscriptionRef.current?.remove();
        soundRef.current.remove();
      }
    };
  }, []);

  // Row indices shift when the filter changes, so stop any running preview
  // rather than letting it point at the wrong row.
  React.useEffect(() => {
    unloadCurrentSound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loops]);

  const loadLoop = (loop: Loop) => {
    // Stop any preview that's still playing before handing off.
    if (soundRef.current) {
      soundRef.current.pause();
      soundRef.current.seekTo(0).catch(console.error);
    }
    setPlayingIndex(null);

    router.replace({
      pathname: "/(tabs)/loop",
      params: {
        bpm: String(loop.bpm),
        title: loop.title,
        artist: loop.artist,
        loopKey: loop.key,
        // Forces the loop screen to (re)load even when picking the same
        // loop it already has selected.
        loadedAt: String(Date.now()),
      },
    });
  };

  // Native confirm dialog (iOS/Android system alert) instead of an in-app one.
  const handleRowPress = (loop: Loop) => {
    Alert.alert(
      "Load Loop",
      `Load "${loop.title}" at ${loop.bpm} BPM?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Load", onPress: () => loadLoop(loop) },
      ],
      { cancelable: true }
    );
  };

  if (loops.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-10">
        <Musicnote size={40} color="rgba(255,255,255,0.3)" />
        <Text className="mt-4 text-center text-white/50 font-satoshiMedium">
          No loops here yet — they'll show up as the catalog grows.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView className="flex-1 px-5">
        {loops.map((item, i) => (
          <TouchableOpacity
            key={item.key}
            className="flex-row items-center justify-between py-4 border-b border-white/10"
            onPress={() => handleRowPress(item)}
          >
            <TouchableOpacity
              onPress={() => handlePlayPause(i)}
              className="items-center justify-center rounded-full"
              style={{
                width: 34,
                height: 34,
                backgroundColor: "rgba(0,89,128,0.3)",
              }}>
              {playingIndex === i ? (
                <PauseCircle size={24} color="white" />
              ) : (
                <PlayCircle size={24} color="white" />
              )}
            </TouchableOpacity>

            <View className="w-2/6">
              <Text className="text-white text-md font-satoshiBold">
                {item.title}
              </Text>
              <View className="flex-row items-center justify-start gap-2">
                <Text className="text-ink-muted text-xs font-satoshiRegular">
                  {item.artist} Artist
                </Text>
                <Text className="text-ink-muted text-xs font-satoshiRegular">
                  .
                </Text>
                <Text className="text-xs text-ink-muted font-satoshiRegular">
                  {item.category}
                </Text>
              </View>
            </View>

            <View className="flex items-center justify-between w-2/6">
              <Text className="text-white text-md font-satoshiRegular">
                {item.timeSignature}
              </Text>
              <Text className="text-sm text-white font-satoshiRegular">
                {item.bpm} bpm
              </Text>
            </View>

          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default SelectLoopView;
