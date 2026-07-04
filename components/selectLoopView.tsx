import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import {
  Dialog,
  Portal,
  Button,
  Provider as PaperProvider,
} from "react-native-paper";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState, useRef } from "react";

import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { useRouter } from "expo-router";
import { LOOPS } from "../constants/loops";

const SelectLoopView = () => {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const soundRef = useRef<AudioPlayer | null>(null);
  const playbackSubscriptionRef =
    useRef<ReturnType<AudioPlayer["addListener"]> | null>(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
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

  const handleRowPress = (i: number) => {
    setSelectedIndex(i);
    setDialogVisible(true);
  };

  const handleDialogCancel = () => {
    setDialogVisible(false);
    setSelectedIndex(null);
  };

  const handleDialogLoad = () => {
    setDialogVisible(false);
    if (selectedIndex !== null) {
      const loop = LOOPS[selectedIndex];
      if (soundRef.current) {
        soundRef.current.pause();
        soundRef.current.seekTo(0).catch(console.error);
      }
      router.replace({
        pathname: "/(tabs)/loop",
        params: {
          bpm: String(loop.bpm),
          title: loop.title,
          artist: loop.artist,
          loopKey: loop.key,
        },
      });
    }
    setSelectedIndex(null);
  };

  return (
    <PaperProvider>
      <View style={{ flex: 1 }}>
        <ScrollView className="flex-1 px-5">
          {LOOPS.map((item, i) => (
            <TouchableOpacity
              key={item.key}
              className="flex-row items-center justify-between py-4 border-b border-white/10"
              onPress={() => handleRowPress(i)}
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
        <Portal>
          <Dialog
            visible={dialogVisible}
            onDismiss={handleDialogCancel}
            style={{ borderRadius: 10 }}
          >
            <Dialog.Title className="font-rBold">Load File</Dialog.Title>
            <Dialog.Content>
              <Text className="font-rRegular">
                Do you want to load this file?
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={handleDialogCancel}>Cancel</Button>
              <Button onPress={handleDialogLoad}>Load</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    </PaperProvider>
  );
};

export default SelectLoopView;
