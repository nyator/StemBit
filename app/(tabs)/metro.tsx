
import { useState, useRef, useEffect } from "react";
import { SafeAreaView, View, Text, StatusBar, Image, TouchableOpacity, TextInput, Modal, Pressable, FlatList, Animated } from "react-native";

import { useAudioPlayer } from "expo-audio";
import audio from "../../constants/audio";

import HeaderComponent from "../../components/headerComponent";
import icons from "../../constants/icons";
import EclipseSvg from "../../assets/icons/eclipseSvg"
import PlaySvg from "../../assets/icons/playSvg"
import PauseSvg from "../../assets/icons/pauseSvg"
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AntDesign from '@expo/vector-icons/AntDesign';

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

  // Instead of setInterval, use a single timeout and reschedule on bpm change
  const nextBeatTimeout = useRef<NodeJS.Timeout | null>(null);
  const nextBeatTimeRef = useRef<number | null>(null); // for drift correction

  // Use expo-audio's useAudioPlayer for metronome sounds
  const beatPlayer = useAudioPlayer(audio.metronome_low);
  const accentPlayer = useAudioPlayer(audio.metronome_bright);

  // For tap tempo
  const tapTimesRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Time signature state
  const [timeSignature, setTimeSignature] = useState(TIME_SIGNATURES[2]); // Default 4/4
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

  // Metronome logic
  const playBeat = (beat: number) => {
    if (beat === 0) {
      accentPlayer.seekTo(0);
      accentPlayer.play();
    } else {
      beatPlayer.seekTo(0);
      beatPlayer.play();
    }
  };

  // --- NEW: Gradual tempo adaptation logic ---
  // Instead of setInterval, use setTimeout and reschedule on bpm change
  const scheduleNextBeat = (fromTime?: number) => {
    // Clear any previous timeout
    if (nextBeatTimeout.current) {
      clearTimeout(nextBeatTimeout.current);
      nextBeatTimeout.current = null;
    }

    // Calculate interval for current bpm
    const interval = (60 * 1000) / bpm;

    // If fromTime is provided, use it to correct drift
    let now = Date.now();
    let nextTime = fromTime ? fromTime + interval : now + interval;
    let delay = Math.max(0, nextTime - now);

    nextBeatTimeRef.current = nextTime;

    nextBeatTimeout.current = setTimeout(() => {
      // Advance beat
      currentBeatRef.current = (currentBeatRef.current + 1) % timeSignature.beats;
      setCurrentBeat(currentBeatRef.current);
      playBeat(currentBeatRef.current);

      // Schedule next beat, using the expected time for drift correction
      scheduleNextBeat(nextBeatTimeRef.current as number);
    }, delay);
  };

  const startMetronome = () => {
    if (isPlaying) return;
    setIsPlaying(true);
    currentBeatRef.current = 0;
    setCurrentBeat(0);
    playBeat(0);

    // Schedule first beat
    let now = Date.now();
    let interval = (60 * 1000) / bpm;
    nextBeatTimeRef.current = now + interval;
    nextBeatTimeout.current = setTimeout(() => {
      currentBeatRef.current = (currentBeatRef.current + 1) % timeSignature.beats;
      setCurrentBeat(currentBeatRef.current);
      playBeat(currentBeatRef.current);
      scheduleNextBeat(nextBeatTimeRef.current as number);
    }, interval);
  };

  const stopMetronome = () => {
    setIsPlaying(false);
    currentBeatRef.current = 0;
    setCurrentBeat(0);
    if (nextBeatTimeout.current) {
      clearTimeout(nextBeatTimeout.current);
      nextBeatTimeout.current = null;
    }
    nextBeatTimeRef.current = null;
  };

  // Gradually adapt to new tempo: when bpm changes, reschedule next beat with new interval, but do not reset beat count or metronome
  useEffect(() => {
    if (isPlaying) {
      // If metronome is running, reschedule next beat with new bpm
      if (nextBeatTimeout.current && nextBeatTimeRef.current) {
        // Calculate how much time is left until next beat, and adjust for new bpm
        const now = Date.now();
        const timeSinceLastBeat = now - (nextBeatTimeRef.current - (60 * 1000) / bpm);
        const newInterval = (60 * 1000) / bpm;
        const nextTime = now + (newInterval - timeSinceLastBeat);

        clearTimeout(nextBeatTimeout.current);
        nextBeatTimeout.current = setTimeout(() => {
          currentBeatRef.current = (currentBeatRef.current + 1) % timeSignature.beats;
          setCurrentBeat(currentBeatRef.current);
          playBeat(currentBeatRef.current);
          scheduleNextBeat(Date.now());
        }, Math.max(0, nextTime - now));
        nextBeatTimeRef.current = nextTime;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, timeSignature]);

  useEffect(() => {
    return () => {
      stopMetronome();
      if (holdInterval.current) {
        clearInterval(holdInterval.current);
        holdInterval.current = null;
      }
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      if (nextBeatTimeout.current) {
        clearTimeout(nextBeatTimeout.current);
        nextBeatTimeout.current = null;
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
            backgroundColor: "#232323",
            borderRadius: 16,
            padding: 24,
            minWidth: 220,
            maxHeight: 500,
            elevation: 8,
          }}
        >
          <Text className="mb-3 text-lg text-white font-rBold">Choose Time Signature</Text>
          <FlatList
            data={TIME_SIGNATURES}
            keyExtractor={item => item.label}
            renderItem={({ item }) => (
              <TouchableOpacity
                className={`flex-row items-center py-2 px-5 rounded-lg ${item.label === timeSignature.label ? "bg-accent" : "bg-white/10"}`}
                onPress={() => {
                  setTimeSignature(item);
                  setModalVisible(false);
                }}
              >
                <Text className={`text-base font-rMedium ${item.label === timeSignature.label ? "text-black text-3xl" : "text-white"}`}>
                  {item.label}
                </Text>
                {item.label === timeSignature.label && (
                  <MaterialCommunityIcons name="check-circle" size={18} color="#000" style={{ marginLeft: 8 }} />
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
              ? (i === 0 ? "#08C192" : "#E6E6E6") // Accent beat is yellow, others green
              : "rgba(255,255,255,0.15)",
            borderWidth: isCurrent ? 3 : 1,
            borderColor: isCurrent
              ? (i === 0 ? "#08C192" : "#E6E6E6")
              : "rgba(255,255,255,0.25)",
            justifyContent: "center",
            alignItems: "center",
            shadowColor: isCurrent
              ? (i === 0 ? "#08C192" : "#E6E6E6") // Accent beat is yellow, others green
              : "rgba(255,255,255,0.15)",
            shadowOpacity: isCurrent ? 0.5 : 0,
            shadowRadius: isCurrent ? 8 : 0,
            elevation: isCurrent ? 6 : 0,
          }}
        >
          {/* <Text
            style={{
              color: isCurrent ? "#232323" : "#fff",
              fontWeight: isCurrent ? "bold" : "normal",
              fontSize: 8,
              opacity: i === 0 ? 1 : 0.8,
            }}
          >
            {i + 1}
          </Text> */}
        </View>
      );
    }
    return (
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 18, marginBottom: 8 }}>
        {beats}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 justify-start items-center bg-primary">
      <HeaderComponent />
      <View className="flex-1 justify-start items-center w-full">
        <View className="flex flex-col justify-center items-center mb-10">
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            className="px-3 py-2 w-full bg-white/10 rounded-xl border-[1.2px] border-black/40 flex flex-row justify-stretch items-center "
          >
            <View className="flex-row mr-2">
              <Image source={icons.timeSign} className="w-8 h-8" tintColor="#ffffff" />
            </View>
            <View className="w-[2px] h-8 bg-black/40 mr-3"></View>
            <Text className="text-lg text-white font-rMedium">{timeSignature.label}</Text>
          </TouchableOpacity>
        </View>
        <View className="flex items-center">
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
            <MaterialCommunityIcons name="gesture-double-tap" size={30} color="black" />
          </View>
        </TouchableOpacity>


        <View className="relative justify-center items-center mt-6 mb-8">
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
