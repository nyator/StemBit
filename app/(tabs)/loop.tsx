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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";

import {
  useLoopPlayback,
  LOOP_MIN_BPM,
  LOOP_MAX_BPM,
} from "../../context/LoopPlaybackContext";

import HeaderComponent from "../../components/headerComponent";
import icons from "../../constants/icons";
import PlaySvg from "../../assets/icons/playSvg";
import PauseSvg from "../../assets/icons/pauseSvg";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AntDesign from "@expo/vector-icons/AntDesign";

const MIN_BPM = LOOP_MIN_BPM;
const MAX_BPM = LOOP_MAX_BPM;

export default function MetroScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const selectedTitle =
    typeof params.title === "string" ? params.title : undefined;
  const selectedLoopKey =
    typeof params.loopKey === "string" ? params.loopKey : undefined;
  // Changes on every explicit "Load" in the picker, even for the same loop,
  // so re-selecting the currently loaded loop still reloads it.
  const loadedAt =
    typeof params.loadedAt === "string" ? params.loadedAt : undefined;

  // Plays the selected backing loop track, warped to the current BPM. No
  // click here — just the loop audio. Shared/mounted above the tab
  // navigator (see context/LoopPlaybackContext.tsx) so it's visible/
  // stoppable from the floating control and stays mutually exclusive with
  // the Metronome tab.
  const {
    bpm,
    setBpm,
    isPlaying,
    isBlockedByOtherEngine,
    setSelectedLoopKey,
    startLoop,
    stopLoop,
  } = useLoopPlayback();

  useEffect(() => {
    setSelectedLoopKey(selectedLoopKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLoopKey, loadedAt]);

  // For tap tempo
  const tapTimesRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [modalVisible, setModalVisible] = useState(false);

  // Helper to clamp BPM between min and max
  const clampBpm = (value: number) => {
    return Math.max(MIN_BPM, Math.min(MAX_BPM, value));
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
        if (newBpm === MIN_BPM && holdInterval.current) {
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
        if (newBpm === MAX_BPM && holdInterval.current) {
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

  useEffect(() => {
    return () => {
      // Clean up all intervals and timeouts
      if (holdInterval.current) {
        clearInterval(holdInterval.current);
        holdInterval.current = null;
      }
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <SafeAreaView className="items-center justify-start flex-1 bg-primary">
      <HeaderComponent />
      <View className="items-center justify-start flex-1 w-full">
        <View className="flex items-center justify-center w-3/5 py-2">
          {/* <Text className="text-sm text-white font-rMedium">Select Loop</Text> */}
          <TouchableOpacity
            onPress={() => {
              router.push("/(loops)/sounds");
            }}
            className="px-3 py-2 mt-2 w-full bg-white/10 rounded-xl border-[1.2px] border-black/40 flex flex-row justify-stretch items-center "
          >
            <View className="flex-row mr-6">
              <Image
                source={icons.folder}
                className="w-8 h-8"
                tintColor="#ffffff"
              />
            </View>
            <View className="w-[2px] h-8 bg-black/40 mr-6"></View>
            <Text className="text-white font-cSemibold">{selectedTitle ? selectedTitle : "SELECT LOOP"}</Text>
          </TouchableOpacity>
        </View>

        <View className="flex items-center mt-20">
          <View className="flex flex-row items-end justify-between w-3/5">
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
          {/* <View className="flex-row items-center justify-between w-56 mt-6">
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
          <View className="p-4 border-2 border-dashed rounded-full border-black/30 bg-black/20">
            <MaterialCommunityIcons
              name="gesture-double-tap"
              size={60}
              color="black"
            />
          </View>
        </TouchableOpacity>

        <View
          className="absolute items-center justify-center w-2/6 bottom-20"
          style={{ flex: 1 }}
        >
          {isBlockedByOtherEngine && (
            <Text className="mb-2 text-xs text-center text-white/60 font-rMedium">
              Stop the Metronome first
            </Text>
          )}
          <TouchableOpacity
            className="justify-center items-center py-3 w-full rounded-[40rem] bg-black border-2 border-accent/50"
            onPress={isPlaying ? stopLoop : startLoop}
            disabled={!isPlaying && isBlockedByOtherEngine}
            style={
              !isPlaying && isBlockedByOtherEngine ? { opacity: 0.4 } : undefined
            }
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
