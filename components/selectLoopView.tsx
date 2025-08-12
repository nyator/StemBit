import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Dialog, Portal, Button, Provider as PaperProvider } from 'react-native-paper';
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState, useRef } from "react";

import { Audio } from "expo-av";

// const TIME_SIGNATURES = [
//     {label: "2 / 4", beats: 2, note: 4},
//     {label: "3 / 4", beats: 3, note: 4},
//     {label: "4 / 4", beats: 4, note: 4},
//     {label: "5 / 4", beats: 5, note: 4},
//     {label: "6 / 8", beats: 6, note: 8},
//     {label: "7 / 8", beats: 7, note: 8},
//     {label: "9 / 8", beats: 9, note: 8},
//     {label: "12 / 8", beats: 12, note: 8},
// ];

const LOOPS = [
  {
    Title: "Worship Loop",
    Artist: "Nyator",
    BPM: 90,
    TimeSignature: "2 / 4",
    Audio: require("../assets/audio/pads/A_MAJOR.mp3"),
  },
  {
    Title: "Praise Loop",
    Artist: "Stephen",
    BPM: 120,
    TimeSignature: "4 / 4",
    Audio: require("../assets/audio/pads/A_MAJOR.mp3"),
  },
  {
    Title: "Reggae",
    Artist: "SponTheProducer",
    BPM: 90,
    TimeSignature: "4 / 4",
    Audio: require("../assets/audio/pads/A_MAJOR.mp3"),
  },
];

const SelectLoopView = () => {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handlePlayPause = async (index: number) => {
    if (playingIndex === index) {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
      }
      setPlayingIndex(null);
      return;
    }
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    const { sound } = await Audio.Sound.createAsync(LOOPS[index].Audio);
    soundRef.current = sound;
    await sound.playAsync();
    setPlayingIndex(index);
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        setPlayingIndex(null);
      }
    });
  };

  React.useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
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
      // Perform your task here, e.g., load the file or update state
      // Example: console.log(`Loading file for ${LOOPS[selectedIndex].Title}`);
    }
    setSelectedIndex(null);
  };

  return (
    <PaperProvider>
      <View style={{ flex: 1 }}>
        <ScrollView className="flex-1 px-5">
          {LOOPS.map((item, i) => (
            <TouchableOpacity
              key={item.Title + item.Artist}
              className="flex-row justify-between items-center py-4 border-b border-white/10"
              onPress={() => handleRowPress(i)}
            >
              <View className="w-2/6">
                <Text className="text-white text-md font-rBold">
                  {item.Title}
                </Text>
                <Text className="text-white text-sm font-rRegular">
                  BPM : {item.BPM}
                </Text>
              </View>
              <View className="flex justify-between items-center w-2/6 ">
                <Text className="text-white text-md font-rMedium ">
                  {item.Artist}
                </Text>
                <Text className="text-white text-md font-rRegular">
                  {item.TimeSignature}
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
          <Dialog visible={dialogVisible} onDismiss={handleDialogCancel}>
            <Dialog.Title>Load File</Dialog.Title>
            <Dialog.Content>
              <Text>Do you want to load this file?</Text>
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
