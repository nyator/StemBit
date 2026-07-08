import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState, useRef } from "react";

import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { useRouter } from "expo-router";
import { LOOPS, type Loop } from "../constants/loops";

const SelectLoopView = () => {
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

    const sound = createAudioPlayer(LOOPS[index].source);
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

  return (
    <View style={{ flex: 1 }}>
      <ScrollView className="flex-1 px-5">
        {LOOPS.map((item, i) => (
          <TouchableOpacity
            key={item.key}
            className="flex-row items-center justify-between py-4 border-b border-white/10"
            onPress={() => handleRowPress(item)}
          >
            <View className="w-2/6">
              <Text className="text-white text-md font-rBold">
                {item.title}
              </Text>
              <Text className="text-sm text-white font-rRegular">
                BPM : {item.bpm}
              </Text>
            </View>
            <View className="flex items-center justify-between w-2/6">
              <Text className="text-white text-md font-rMedium">
                {item.artist}
              </Text>
              <Text className="text-white text-md font-rRegular">
                {item.timeSignature}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handlePlayPause(i)}>
              {playingIndex === i ? (
                <Ionicons name="pause" size={20} color="white" />
              ) : (
                <Ionicons name="play" size={20} color="white" />
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default SelectLoopView;
