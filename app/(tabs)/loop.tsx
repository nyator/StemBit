
import { useState, useRef, useEffect } from "react";
import { SafeAreaView, View, Text, StatusBar, Image, TouchableOpacity, TextInput } from "react-native";

import { useAudioPlayer } from "expo-audio";
import audio from "../../constants/audio";

import HeaderComponent from "../../components/headerComponent";
import icons from "../../constants/icons";
import PlaySvg from "../../assets/icons/playSvg"
import PauseSvg from "../../assets/icons/pauseSvg"
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AntDesign from '@expo/vector-icons/AntDesign';

export default function MetroScreen() {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  // Remove currentBeat from state to avoid unnecessary re-renders
  const currentBeatRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use expo-audio's useAudioPlayer for metronome sounds
  const beatPlayer = useAudioPlayer(audio.metronome_low);
  const accentPlayer = useAudioPlayer(audio.metronome_bright);

  // For tap tempo
  const tapTimesRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to clamp BPM between min and max
  const clampBpm = (value: number) => {
    const min = 20;
    const max = 240;
    return Math.max(min, Math.min(max, value));
  };

  const handleDecrease = () => {
    setBpm(prev => clampBpm(prev - 1));
  };

  const handleIncrease = () => {
    setBpm(prev => clampBpm(prev + 1));
  };

  // Use a ref to store the interval id for holding decrease/increase
  const holdInterval = useRef<NodeJS.Timeout | null>(null);

  const handleHoldDecrease = () => {
    if (holdInterval.current) return; // Prevent multiple intervals
    holdInterval.current = setInterval(() => {
      setBpm(prev => {
        const newBpm = clampBpm(prev - 1);
        if (newBpm === 20 && holdInterval.current) {
          clearInterval(holdInterval.current);
          holdInterval.current = null;
        }
        return newBpm;
      });
    }, 70);
  };

  const handleHoldIncrease = () => {
    if (holdInterval.current) return; // Prevent multiple intervals
    holdInterval.current = setInterval(() => {
      setBpm(prev => {
        const newBpm = clampBpm(prev + 1);
        if (newBpm === 240 && holdInterval.current) {
          clearInterval(holdInterval.current);
          holdInterval.current = null;
        }
        return newBpm;
      });
    }, 70);
  };

  const handleRelease = () => {
    if (holdInterval.current) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
  };

  // Handle direct BPM input
  const handleBpmInput = (text: string) => {
    // Only allow numbers
    const numeric = text.replace(/[^0-9]/g, "");
    if (numeric.length === 0) {
      setBpm(20); // fallback to min if cleared
      return;
    }
    let value = parseInt(numeric, 10);
    if (isNaN(value)) value = 20;
    setBpm(clampBpm(value));
  };

  // Tap to set BPM
  const handleTapTempo = () => {
    const now = Date.now();

    // If last tap was more than 2 seconds ago, reset
    if (
      tapTimesRef.current.length > 0 &&
      now - tapTimesRef.current[tapTimesRef.current.length - 1] > 2000
    ) {
      tapTimesRef.current = [];
    }

    tapTimesRef.current.push(now);

    // Only keep the last 6 taps for smoothing
    if (tapTimesRef.current.length > 6) {
      tapTimesRef.current.shift();
    }

    if (tapTimesRef.current.length >= 2) {
      // Calculate intervals between taps
      const intervals = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      }
      // Average interval
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      // BPM = 60000 / avgInterval
      const newBpm = clampBpm(Math.round(60000 / avgInterval));
      setBpm(newBpm);
    }

    // Clear tap times if no tap for 2 seconds
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    tapTimeoutRef.current = setTimeout(() => {
      tapTimesRef.current = [];
    }, 2000);
  };

  // Metronome logic
  const playBeat = (beat: number) => {
    // Try to avoid seekTo(0) if not needed, but expo-audio may require it
    if (beat === 0) {
      accentPlayer.seekTo(0);
      accentPlayer.play();
    } else {
      beatPlayer.seekTo(0);
      beatPlayer.play();
    }
  };

  const startLoop = () => {
    if (intervalRef.current) return;
    setIsPlaying(true);
    currentBeatRef.current = 0;
    playBeat(0);

    // Use Date.now() to schedule next beat as precisely as possible
    let nextTick = Date.now() + (60 * 1000) / bpm;
    intervalRef.current = setInterval(() => {
      currentBeatRef.current = (currentBeatRef.current + 1) % 4;
      playBeat(currentBeatRef.current);

      // Try to correct for drift
      const interval = (60 * 1000) / bpm;
      nextTick += interval;
      const drift = Date.now() - nextTick;
      if (Math.abs(drift) > 20) {
        // If drift is too high, resync
        nextTick = Date.now() + interval;
      }
    }, (60 * 1000) / bpm);
  };

  const stopLoop = () => {
    setIsPlaying(false);
    currentBeatRef.current = 0;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Update interval when BPM changes and metronome is playing
  useEffect(() => {
    if (isPlaying) {
      // Instead of clearing and restarting, stop and startMetronome to resync
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      startLoop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm]);

  useEffect(() => {
    return () => {
      stopLoop();
      if (holdInterval.current) {
        clearInterval(holdInterval.current);
        holdInterval.current = null;
      }
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView className="flex-1 justify-start items-center bg-primary">
      <HeaderComponent />
      <View className="flex-1 justify-start items-center w-full">

        <View className="flex justify-center items-center py-2 w-2/5">

          <Text className="text-sm text-white font-rMedium">Select Loop</Text>
          <TouchableOpacity className="px-3 py-2 mt-2 w-full bg-white/10 rounded-xl border-[1.2px] border-black/40 flex flex-row justify-stretch items-center ">
            <View className="flex-row mr-2">
              <Image source={icons.folder} className="w-8 h-8" tintColor="#ffffff" />
            </View>
            <View className="w-[2px] h-8 bg-black/40 mr-6"></View>
            <Text className="text-white font-cSemibold">BALLAD</Text>
          </TouchableOpacity>
        </View>


        <View className="flex items-center mt-20">
          <View className="flex flex-row justify-between items-end w-3/5">
            <TouchableOpacity onPress={handleDecrease} onLongPress={handleHoldDecrease} onPressOut={handleRelease} className="p-2 rounded-lg bg-white/10">
              <AntDesign name="minus" size={30} color="white" />
            </TouchableOpacity>

            <TextInput
              className="w-20 text-4xl text-center text-white font-cBold"
              value={bpm.toString()}
              onChangeText={handleBpmInput}
              keyboardType="numeric"
              maxLength={3}
              selectTextOnFocus
              underlineColorAndroid="transparent"
            />

            <TouchableOpacity onPress={handleIncrease} onLongPress={handleHoldIncrease} onPressOut={handleRelease} className="p-2 rounded-lg bg-white/10">
              <AntDesign name="plus" size={30} color="white" />
            </TouchableOpacity>
          </View>
          <Text className="text-sm text-white font-rMedium">Beats per min</Text>
          {/* <View className="flex-row justify-between items-center mt-6 w-56">
            <Text className="p-2 text-xl text-white rounded-full bg-accent font-rMedium">/2</Text>
            <Text className="p-2 text-xl text-white rounded-full bg-accent font-rMedium">x2</Text>
          </View> */}

        </View>
        {/* Tap to set BPM button */}
        <TouchableOpacity
          className=" mt-20 p-2 rounded-full bg-accent border-2 border-[#098E6C]"
          onPress={handleTapTempo}
          activeOpacity={0.7}
        >
          <View className="p-4 rounded-full border-2 border-dashed border-black/30 bg-black/20">
            <MaterialCommunityIcons name="gesture-double-tap" size={60} color="black" />
          </View>
        </TouchableOpacity>



        <View
          className="absolute bottom-20 justify-center items-center w-2/6"
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            className="justify-center items-center py-3 w-full rounded-[40rem] bg-black border-2 border-accent/50"
            onPress={isPlaying ? stopLoop : startLoop}
          >
            <Text className="text-white font-cBold">
              {isPlaying ? <PauseSvg /> : <PlaySvg />}
            </Text>
          </TouchableOpacity>
        </View>

      </View>
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
}

// ---
// Summary: The app is slow and the metronome is inconsistent because JS timers and audio are not real-time. For a truly accurate metronome, use a native audio engine or a library with sample-accurate scheduling.