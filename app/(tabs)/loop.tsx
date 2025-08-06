
import { useState, useRef, useEffect } from "react";
import { SafeAreaView, View, Text, StatusBar, Image, TouchableOpacity, TextInput, Modal, Pressable } from "react-native";

import { Audio } from "expo-av";
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

  // Use expo-av's Audio API for metronome sounds
  const [beatSound, setBeatSound] = useState<Audio.Sound | null>(null);
  const [accentSound, setAccentSound] = useState<Audio.Sound | null>(null);
  
  // Load sounds on component mount
  useEffect(() => {
    const loadSounds = async () => {
      try {
        // Enable audio playback in silent mode (iOS)
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
        
        // Load the sounds
        const { sound: beatSnd } = await Audio.Sound.createAsync(audio.metronome_low);
        const { sound: accentSnd } = await Audio.Sound.createAsync(audio.metronome_bright);
        
        setBeatSound(beatSnd);
        setAccentSound(accentSnd);
      } catch (error) {
        console.error("Failed to load sounds", error);
      }
    };
    
    loadSounds();
    
    // Cleanup sounds on unmount
    return () => {
      if (beatSound) {
        beatSound.unloadAsync();
      }
      if (accentSound) {
        accentSound.unloadAsync();
      }
    };
  }, []);

  // For tap tempo
  const tapTimesRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [modalVisible, setModalVisible] = useState(false);

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

  // Metronome logic with precise timing using expo-av
  const playBeat = async (beat: number) => {
    try {
      if (beat === 0 && accentSound) {
        // Stop and rewind the sound before playing to ensure consistent playback
        await accentSound.stopAsync();
        await accentSound.setPositionAsync(0);
        await accentSound.playAsync();
      } else if (beatSound) {
        await beatSound.stopAsync();
        await beatSound.setPositionAsync(0);
        await beatSound.playAsync();
      }
    } catch (error) {
      console.error("Error playing beat:", error);
    }
  };
  
  // Create a buffer of scheduled sounds for more precise timing
  const scheduledBeats = useRef<{time: number, beat: number}[]>([]);
  const audioProcessingInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Advanced scheduling system for precise metronome timing
  const scheduleBeats = () => {
    // Calculate interval for current bpm
    const interval = (60 * 1000) / bpm;
    
    // Get current time
    const now = Date.now();
    
    // Schedule beats ahead of time (buffer of 4 beats)
    // This ensures we always have beats ready to play
    while (scheduledBeats.current.length < 4) {
      const lastScheduledBeat = scheduledBeats.current[scheduledBeats.current.length - 1];
      const nextBeatTime = lastScheduledBeat 
        ? lastScheduledBeat.time + interval 
        : now + interval;
      
      const nextBeatNumber = lastScheduledBeat
        ? (lastScheduledBeat.beat + 1) % 4 // Fixed at 4 beats for loop.tsx
        : (currentBeatRef.current + 1) % 4;
      
      scheduledBeats.current.push({
        time: nextBeatTime,
        beat: nextBeatNumber
      });
    }
  };
  
  // Process scheduled beats
  const processScheduledBeats = () => {
    const now = Date.now();
    
    // Play any beats that are due
    while (
      scheduledBeats.current.length > 0 && 
      scheduledBeats.current[0].time <= now
    ) {
      const { beat } = scheduledBeats.current.shift()!;
      
      // Update current beat
      currentBeatRef.current = beat;
      
      // Play the beat
      playBeat(beat);
      
      // Schedule more beats to maintain the buffer
      scheduleBeats();
    }
  };

  const startLoop = () => {
    if (isPlaying) return;
    
    // Make sure sounds are loaded
    if (!beatSound || !accentSound) {
      console.warn("Loop sounds not loaded yet");
      return;
    }
    
    setIsPlaying(true);
    currentBeatRef.current = 0;
    
    // Clear any existing scheduled beats
    scheduledBeats.current = [];
    
    // Play the first beat immediately
    playBeat(0);
    
    // Schedule the next beats
    scheduleBeats();
    
    // Start the processing interval (check for due beats every 10ms)
    // This provides much more precise timing than setInterval
    if (audioProcessingInterval.current) {
      clearInterval(audioProcessingInterval.current);
    }
    
    audioProcessingInterval.current = setInterval(() => {
      processScheduledBeats();
    }, 10); // Check every 10ms for precise timing
  };

  const stopLoop = () => {
    setIsPlaying(false);
    currentBeatRef.current = 0;
    
    // Clear the processing interval
    if (audioProcessingInterval.current) {
      clearInterval(audioProcessingInterval.current);
      audioProcessingInterval.current = null;
    }
    
    // Clear scheduled beats
    scheduledBeats.current = [];
    
    // Stop any playing sounds
    if (beatSound) {
      beatSound.stopAsync().catch(console.error);
    }
    if (accentSound) {
      accentSound.stopAsync().catch(console.error);
    }
  };

  // Handle BPM changes
  useEffect(() => {
    if (isPlaying) {
      // When BPM changes, we need to reschedule all beats with the new tempo
      // but maintain the current beat position
      
      // Stop the processing interval
      if (audioProcessingInterval.current) {
        clearInterval(audioProcessingInterval.current);
        audioProcessingInterval.current = null;
      }
      
      // Clear scheduled beats but remember the current beat
      const currentBeat = currentBeatRef.current;
      scheduledBeats.current = [];
      
      // Schedule new beats with the updated BPM
      scheduleBeats();
      
      // Restart the processing interval
      audioProcessingInterval.current = setInterval(() => {
        processScheduledBeats();
      }, 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm]);

  useEffect(() => {
    return () => {
      // Stop the loop
      stopLoop();
      
      // Clean up all intervals and timeouts
      if (holdInterval.current) {
        clearInterval(holdInterval.current);
        holdInterval.current = null;
      }
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      if (audioProcessingInterval.current) {
        clearInterval(audioProcessingInterval.current);
        audioProcessingInterval.current = null;
      }
      
      // Clear scheduled beats
      scheduledBeats.current = [];
      
      // Unload audio resources
      if (beatSound) {
        beatSound.unloadAsync().catch(console.error);
      }
      if (accentSound) {
        accentSound.unloadAsync().catch(console.error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderLoopSelectionModel = () => {
    <Modal
      visible={modalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setModalVisible(false)}
    >
      <Pressable
        style={{
          flex: 1,
          // backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "flex-end",
          alignItems: "stretch",
        }}
        onPress={() => setModalVisible(false)}>
        <View style={{
          backgroundColor: "#000000",
          borderRadius: 16,
          padding: 24,
          minWidth: 220,
          maxHeight: 700,
          elevation: 8,
        }}>
          <Text className="mb-3 text-lg text-white font-rBold">Choose Time Signature</Text>

        </View>
      </Pressable>

    </Modal>
  }

  return (
    <SafeAreaView className="flex-1 justify-start items-center bg-primary">
      <HeaderComponent />
      <View className="flex-1 justify-start items-center w-full">

        <View className="flex justify-center items-center py-2 w-2/5">

          <Text className="text-sm text-white font-rMedium">Select Loop</Text>
          <TouchableOpacity onPress={() => setModalVisible(true)} className="px-3 py-2 mt-2 w-full bg-white/10 rounded-xl border-[1.2px] border-black/40 flex flex-row justify-stretch items-center ">
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
