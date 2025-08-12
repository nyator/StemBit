import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StatusBar,
  Image,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  FlatList,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import audio from "../../constants/audio";

import HeaderComponent from "../../components/headerComponent";
import icons from "../../constants/icons";
import EclipseSvg from "../../assets/icons/eclipseSvg";
import PlaySvg from "../../assets/icons/playSvg";
import PauseSvg from "../../assets/icons/pauseSvg";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AntDesign from "@expo/vector-icons/AntDesign";

const TIME_SIGNATURES = [
  { label: "2 / 4", beats: 2, note: 4 },
  { label: "3 / 4", beats: 3, note: 4 },
  { label: "4 / 4", beats: 4, note: 4 },
  { label: "5 / 4", beats: 5, note: 4 },
  { label: "6 / 8", beats: 6, note: 8 },
  { label: "7 / 8", beats: 7, note: 8 },
  { label: "9 / 8", beats: 9, note: 8 },
  { label: "12 / 8", beats: 12, note: 8 },
];

export default function MetroScreen() {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const currentBeatRef = useRef(0);

  // For gradual tempo transition
  const currentTempoRef = useRef(120); // Actual current tempo that may be transitioning
  const targetTempoRef = useRef(120); // Target tempo to transition to
  const tempoTransitionStartTimeRef = useRef<number | null>(null); // When the transition started
  const tempoTransitionDurationRef = useRef(1000); // Duration of transition in ms (default 1 second)

  // Instead of setInterval, use a single timeout and reschedule on bpm change
  const nextBeatTimeout = useRef<NodeJS.Timeout | null>(null);
  const nextBeatTimeRef = useRef<number | null>(null); // for drift correction

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
        const { sound: beatSnd } = await Audio.Sound.createAsync(
          audio.metronome_low
        );
        const { sound: accentSnd } = await Audio.Sound.createAsync(
          audio.metronome_bright
        );

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

  // Time signature state
  const [timeSignature, setTimeSignature] = useState(TIME_SIGNATURES[2]); // Default 4/4
  const [modalVisible, setModalVisible] = useState(false);

  // Helper to clamp BPM between min and max
  const clampBpm = (value: number) => {
    const min = 20;
    const max = 320;
    return Math.max(min, Math.min(max, value));
  };

  const handleDecrease = () => {
    setBpm((prev) => clampBpm(prev - 1));
  };

  const handleIncrease = () => {
    setBpm((prev) => clampBpm(prev + 1));
  };

  // Use a ref to store the interval id for holding decrease/increase
  const holdInterval = useRef<NodeJS.Timeout | null>(null);

  const handleHoldDecrease = () => {
    if (holdInterval.current) return; // Prevent multiple intervals
    holdInterval.current = setInterval(() => {
      setBpm((prev) => {
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
      setBpm((prev) => {
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
      const avgInterval =
        intervals.reduce((a, b) => a + b, 0) / intervals.length;
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
  const scheduledBeats = useRef<{ time: number; beat: number }[]>([]);
  const audioProcessingInterval = useRef<NodeJS.Timeout | null>(null);

  // Calculate the current tempo based on transition state
  const getCurrentTempo = () => {
    // If no transition is in progress, return the target tempo
    if (tempoTransitionStartTimeRef.current === null) {
      return targetTempoRef.current;
    }

    const now = Date.now();
    const elapsedTime = now - tempoTransitionStartTimeRef.current;
    const duration = tempoTransitionDurationRef.current;

    // If transition is complete, return target tempo
    if (elapsedTime >= duration) {
      tempoTransitionStartTimeRef.current = null;
      currentTempoRef.current = targetTempoRef.current;
      return targetTempoRef.current;
    }

    // Calculate the current tempo using linear interpolation
    const startTempo = currentTempoRef.current;
    const endTempo = targetTempoRef.current;
    const progress = elapsedTime / duration;

    // Linear interpolation: start + progress * (end - start)
    const currentTempo = startTempo + progress * (endTempo - startTempo);
    return currentTempo;
  };

  // Advanced scheduling system for precise metronome timing
  const scheduleBeats = () => {
    // Get current time
    const now = Date.now();

    // Schedule beats ahead of time (buffer of 4 beats)
    // This ensures we always have beats ready to play
    while (scheduledBeats.current.length < 4) {
      const lastScheduledBeat =
        scheduledBeats.current[scheduledBeats.current.length - 1];

      // If this is the first beat or we're not transitioning, use simple scheduling
      if (!lastScheduledBeat || tempoTransitionStartTimeRef.current === null) {
        // Calculate interval for current tempo
        const currentTempo = getCurrentTempo();
        const interval = (60 * 1000) / currentTempo;

        const nextBeatTime = lastScheduledBeat
          ? lastScheduledBeat.time + interval
          : now + interval;

        const nextBeatNumber = lastScheduledBeat
          ? (lastScheduledBeat.beat + 1) % timeSignature.beats
          : (currentBeatRef.current + 1) % timeSignature.beats;

        scheduledBeats.current.push({
          time: nextBeatTime,
          beat: nextBeatNumber,
        });
      } else {
        // For transitioning tempo, we need to calculate the exact time for the next beat
        // based on the tempo at that moment
        const nextBeatNumber =
          (lastScheduledBeat.beat + 1) % timeSignature.beats;

        // Estimate when the next beat should occur based on current tempo
        const currentTempo = getCurrentTempo();
        const interval = (60 * 1000) / currentTempo;
        const nextBeatTime = lastScheduledBeat.time + interval;

        scheduledBeats.current.push({
          time: nextBeatTime,
          beat: nextBeatNumber,
        });
      }
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
      setCurrentBeat(beat);

      // Play the beat
      playBeat(beat);

      // Schedule more beats to maintain the buffer
      scheduleBeats();
    }
  };

  const startMetronome = () => {
    if (isPlaying) return;

    // Make sure sounds are loaded
    if (!beatSound || !accentSound) {
      console.warn("Metronome sounds not loaded yet");
      return;
    }

    setIsPlaying(true);
    currentBeatRef.current = 0;
    setCurrentBeat(0);

    // Initialize tempo references
    currentTempoRef.current = bpm;
    targetTempoRef.current = bpm;
    tempoTransitionStartTimeRef.current = null; // No transition in progress

    // Clear any existing scheduled beats
    scheduledBeats.current = [];

    // Play the first beat immediately
    playBeat(0);

    // Schedule the next beats
    scheduleBeats();

    // Start the processing interval (check for due beats every 10ms)
    // This provides much more precise timing than setTimeout
    if (audioProcessingInterval.current) {
      clearInterval(audioProcessingInterval.current);
    }

    audioProcessingInterval.current = setInterval(() => {
      processScheduledBeats();
    }, 10); // Check every 10ms for precise timing
  };

  const stopMetronome = () => {
    setIsPlaying(false);
    currentBeatRef.current = 0;
    setCurrentBeat(0);

    // Reset tempo transition state
    currentTempoRef.current = bpm;
    targetTempoRef.current = bpm;
    tempoTransitionStartTimeRef.current = null;

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

  // Handle BPM or time signature changes
  useEffect(() => {
    // Update target tempo when BPM changes
    targetTempoRef.current = bpm;

    if (isPlaying) {
      // For time signature changes, we need to reset completely
      if (timeSignature.beats !== scheduledBeats.current[0]?.beat) {
        // Stop the processing interval
        if (audioProcessingInterval.current) {
          clearInterval(audioProcessingInterval.current);
          audioProcessingInterval.current = null;
        }

        // Clear scheduled beats
        scheduledBeats.current = [];

        // Reset transition
        tempoTransitionStartTimeRef.current = null;
        currentTempoRef.current = bpm;

        // Schedule new beats with the updated time signature
        scheduleBeats();

        // Restart the processing interval
        audioProcessingInterval.current = setInterval(() => {
          processScheduledBeats();
        }, 10);
      }
      // For BPM changes, start a gradual transition
      else if (Math.abs(currentTempoRef.current - bpm) > 1) {
        // Start a new tempo transition
        tempoTransitionStartTimeRef.current = Date.now();

        // Don't clear scheduled beats - they'll be played with gradually changing tempo
        // Don't restart the processing interval - it's already running

        // The transition will happen in getCurrentTempo() which is called by scheduleBeats()
      }
    } else {
      // If not playing, just update the current tempo immediately
      currentTempoRef.current = bpm;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, timeSignature]);

  useEffect(() => {
    return () => {
      // Stop the metronome
      stopMetronome();

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

  // Modal for time signature selection
  const renderTimeSignatureModal = () => (
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
        onPress={() => setModalVisible(false)}
      >
        <View
          style={{
            backgroundColor: "#000000",
            borderRadius: 16,
            padding: 24,
            minWidth: 220,
            maxHeight: 700,
            elevation: 8,
          }}
        >
          <Text className="mb-3 text-lg text-white font-rBold">
            Choose Time Signature
          </Text>
          <FlatList
            data={TIME_SIGNATURES}
            keyExtractor={(item) => item.label}
            renderItem={({ item }) => (
              <TouchableOpacity
                className={`flex-row items-center py-4 justify-between px-5 my-[2px] rounded-lg ${item.label === timeSignature.label ? "bg-accent border-white border-[0.2px]" : "bg-white/10 border-white/30 border-[0.2px]"}`}
                onPress={() => {
                  setTimeSignature(item);
                  setModalVisible(false);
                }}
              >
                <Text
                  className={`text-base font-rMedium ${item.label === timeSignature.label ? "text-black text-3xl" : "text-white"}`}
                >
                  {item.label}
                </Text>
                {item.label === timeSignature.label && (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={18}
                    color="#000"
                    style={{ marginLeft: 8 }}
                  />
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
          />
        </View>
      </Pressable>
    </Modal>
  );

  // --- Beat Visuals ---
  // We'll show a row of circles, one for each beat, highlight the current one.
  const renderBeatVisuals = () => {
    const beats = [];
    for (let i = 0; i < timeSignature.beats; i++) {
      const isCurrent = i === currentBeat;
      beats.push(
        <View
          key={i}
          style={{
            width: 14,
            height: 14,
            borderRadius: 14,
            marginHorizontal: 7,
            backgroundColor: isCurrent
              ? i === 0
                ? "#08C192"
                : "#E6E6E6" // Accent beat is yellow, others green
              : "rgba(255,255,255,0.15)",
            borderWidth: isCurrent ? 3 : 1,
            borderColor: isCurrent
              ? i === 0
                ? "#08C192"
                : "#E6E6E6"
              : "rgba(255,255,255,0.25)",
            justifyContent: "center",
            alignItems: "center",
            shadowColor: isCurrent
              ? i === 0
                ? "#08C192"
                : "#E6E6E6" // Accent beat is yellow, others green
              : "rgba(255,255,255,0.15)",
            shadowOpacity: isCurrent ? 0.5 : 0,
            shadowRadius: isCurrent ? 8 : 0,
            elevation: isCurrent ? 6 : 0,
          }}
        ></View>
      );
    }
    return (
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          marginTop: 18,
          marginBottom: 8,
        }}
      >
        {beats}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 justify-start items-center bg-primary">
      <HeaderComponent />
      <View className="flex-1 justify-center items-center w-full">
        <View className="flex flex-col justify-center items-center mb-10">
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            className="px-3 py-2 w-full bg-white/10 rounded-xl border-[1.2px] border-black/40 flex flex-row justify-stretch items-center "
          >
            <View className="flex-row mr-2">
              <Image
                source={icons.timeSign}
                className="w-8 h-8"
                tintColor="#ffffff"
              />
            </View>
            <View className="w-[2px] h-8 bg-black/40 mr-3"></View>
            <Text className="text-lg text-white font-rBold ">
              {timeSignature.label}
            </Text>
          </TouchableOpacity>
        </View>
        <View className="flex items-center">
          <View className="flex flex-row justify-between items-end w-3/5">
            <TouchableOpacity
              onPress={handleDecrease}
              onLongPress={handleHoldDecrease}
              onPressOut={handleRelease}
              className="p-2 rounded-lg bg-white/10"
            >
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

            <TouchableOpacity
              onPress={handleIncrease}
              onLongPress={handleHoldIncrease}
              onPressOut={handleRelease}
              className="p-2 rounded-lg bg-white/10"
            >
              <AntDesign name="plus" size={30} color="white" />
            </TouchableOpacity>
          </View>
          <Text className="text-sm text-white font-rMedium">Beats per min</Text>
        </View>
        {/* Tap to set BPM button */}
        {/* Beat Visuals */}
        {renderBeatVisuals()}
        <TouchableOpacity
          className=" mt-10 p-2 rounded-full bg-accent border-2 border-[#098E6C]"
          onPress={handleTapTempo}
          activeOpacity={0.7}
        >
          <View className="p-4 rounded-full border-2 border-dashed border-black/30 bg-black/20">
            <MaterialCommunityIcons
              name="gesture-double-tap"
              size={30}
              color="black"
            />
          </View>
        </TouchableOpacity>

        <View className="relative justify-center items-center mt-6">
          <EclipseSvg />
          <View
            className="absolute inset-0 justify-center items-center"
            style={{ flex: 1 }}
          >
            <View className="absolute right-0 left-0 top-6 items-center">
              {/* <Text className="text-xl text-white font-cBold">{bpm}</Text>
              <Text className="text-sm text-white font-rMedium">Beats per min</Text> */}
            </View>
            <TouchableOpacity
              className="justify-center items-center"
              onPress={isPlaying ? stopMetronome : startMetronome}
            >
              <Text className="mt-2 text-white font-cBold">
                {isPlaying ? <PauseSvg /> : <PlaySvg />}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {renderTimeSignatureModal()}
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
}
// ---
// Summary: The app is slow and the metronome is inconsistent because JS timers and audio are not real-time. For a truly accurate metronome, use a native audio engine or a library with sample-accurate scheduling.
