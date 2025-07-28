import React, { useState, useEffect, useRef, useCallback } from "react";
import { SafeAreaView, View, Text, StatusBar, ScrollView, TouchableOpacity, Button } from "react-native";
import { useFocusEffect } from '@react-navigation/native';

import LaunchPadComponent from "../../components/launchPad";
import HeaderComponent from "../../components/headerComponent";
// import OptionField from "../../components/optionField";

import { useAudioPlayer } from 'expo-audio';
import audio from "../../constants/audio";

export default function PadScreen() {
  const [keySelected, setKeySelected] = useState('')
  const [majorMinor, setMajorMinor] = useState('major')

  // Assign audio sources for each pad (example: beep for C major, censor for D major, beep for others)
  const majorPadAudios = [audio.A, audio.As, audio.B, audio.C, audio.Cs, audio.D, audio.Ds, audio.E, audio.F, audio.Fs, audio.G, audio.Gs];
  const minorPadAudios = [audio.censor, audio.beep, audio.censor, audio.beep, audio.censor, audio.beep, audio.censor];

  // Create persistent players for each pad using useRef
  const majorPadPlayersRef = useRef(majorPadAudios.map(src => useAudioPlayer(src)));
  const minorPadPlayersRef = useRef(minorPadAudios.map(src => useAudioPlayer(src)));
  const majorPadPlayers = majorPadPlayersRef.current;
  const minorPadPlayers = minorPadPlayersRef.current;

  useEffect(() => {
    setKeySelected('');
    // Stop all pad audio when switching key type
    majorPadPlayers.forEach(player => {
      player.pause();
      player.seekTo(0);
      player.loop = false;
    });
    minorPadPlayers.forEach(player => {
      player.pause();
      player.seekTo(0);
      player.loop = false;
    });
  }, [majorMinor]);


  useFocusEffect(
    useCallback(() => {
      // On unfocus tab, stop all pad players
      return () => {
        majorPadPlayers.forEach(player => {
          player.pause();
          player.seekTo(0);
          player.loop = false;
        });
        minorPadPlayers.forEach(player => {
          player.pause();
          player.seekTo(0);
          player.loop = false;
        });
      };
    }, [majorPadPlayers, minorPadPlayers])
  );

  const majorPads = [
    { selectKey: 'A' },
    { selectKey: 'A#' },
    { selectKey: 'B' },
    { selectKey: 'C' },
    { selectKey: 'C#' },
    { selectKey: 'D' },
    { selectKey: 'D#' },
    { selectKey: 'E' },
    { selectKey: 'F' },
    { selectKey: 'F#' },
    { selectKey: 'G' },
    { selectKey: 'G#' },
  ];

  const minorPads = [
    { selectKey: 'C minor' },
    { selectKey: 'D minor' },
    { selectKey: 'E minor' },
    { selectKey: 'F minor' },
    { selectKey: 'G minor' },
    { selectKey: 'A minor' },
    { selectKey: 'B minor' },
  ];

  // Handler for pad press
  const handlePadPress = (idx: number) => {
    const isSelected = keySelected === `${idx}`;
    // Stop the previous sound if a different pad is selected
    if (!isSelected && keySelected !== '') {
      const prevIdx = parseInt(keySelected, 10);
      if (majorMinor.toLowerCase() === 'minor') {
        minorPadPlayers[prevIdx]?.pause();
        minorPadPlayers[prevIdx]?.seekTo(0);
        minorPadPlayers[prevIdx].loop = false;
      } else {
        majorPadPlayers[prevIdx]?.pause();
        majorPadPlayers[prevIdx]?.seekTo(0);
        majorPadPlayers[prevIdx].loop = false;
      }
    }
    setKeySelected(isSelected ? '' : `${idx}`);
    if (!isSelected) { // Only play if selecting (turning on)
      if (majorMinor.toLowerCase() === 'minor') {
        minorPadPlayers[idx].seekTo(0);
        minorPadPlayers[idx].loop = true;
        minorPadPlayers[idx].play();
      } else {
        majorPadPlayers[idx].seekTo(0);
        majorPadPlayers[idx].loop = true;
        majorPadPlayers[idx].play();
      }
    } else {
      // Optionally, stop the sound when turning off
      if (majorMinor.toLowerCase() === 'minor') {
        minorPadPlayers[idx].pause();
        minorPadPlayers[idx].seekTo(0);
        minorPadPlayers[idx].loop = false;
      } else {
        majorPadPlayers[idx].pause();
        majorPadPlayers[idx].seekTo(0);
        majorPadPlayers[idx].loop = false;
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 justify-start items-center bg-primary">
      <HeaderComponent />
      <View className="flex-1 justify-start items-center px-5 w-full">
        {/* <View className="flex flex-row gap-2 w-full">
          <OptionField
            label="Key Type"
            options={['Major', 'Minor']}
            selected={majorMinor}
            onSelect={setMajorMinor}
          />
        </View> */}

        <View className="flex flex-row justify-center items-center rounded-[20px] border-2 border-white/50 mt-9">
          <TouchableOpacity className={`px-6 py-3 rounded-s-[18px] bg-accent ${majorMinor.toLocaleLowerCase() === "major" ? "bg-accent border-r-2 border-gray-500" : "bg-black"}`} onPress={() => setMajorMinor("major")}>
            <Text className="text-white font-rBold">Major</Text>
          </TouchableOpacity>
          <TouchableOpacity className={`px-6 py-3 rounded-e-[18px] bg-accent ${majorMinor.toLocaleLowerCase() === "minor" ? "bg-accent border-l-2 border-gray-500" : "bg-black"}`} onPress={() => setMajorMinor("minor")}>
            <Text className="text-white font-rBold">Minor</Text>
          </TouchableOpacity>
        </View>
        <View className="flex flex-row flex-wrap justify-center items-center mt-5 w-full">
          {(majorMinor.toLowerCase() === 'minor' ? minorPads : majorPads).map((pad, idx) => (
            <LaunchPadComponent
              key={idx}
              isPlaying={keySelected === `${idx}`}
              selectKey={pad.selectKey}
              onPress={() => handlePadPress(idx)}
            />
          ))}
        </View>
      </View>
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
}