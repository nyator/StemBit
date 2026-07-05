import { useState, useRef } from "react";
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
import {
  useMetronome,
  TIME_SIGNATURES,
  PLAYBACK_FEELS,
  MIN_BPM,
  MAX_BPM,
} from "../../context/MetronomeContext";

import HeaderComponent from "../../components/headerComponent";
import icons from "../../constants/icons";
import EclipseSvg from "../../assets/icons/eclipseSvg";
import PlaySvg from "../../assets/icons/playSvg";
import PauseSvg from "../../assets/icons/pauseSvg";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AntDesign from "@expo/vector-icons/AntDesign";

export default function MetroScreen() {
  const {
    bpm,
    setBpm,
    isPlaying,
    currentBeat,
    timeSignature,
    setTimeSignature,
    feelIndex,
    setFeelIndex,
    startMetronome,
    stopMetronome,
  } = useMetronome();

  const [modalVisible, setModalVisible] = useState(false);

  // For tap tempo
  const tapTimesRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    <SafeAreaView className="items-center justify-start flex-1 bg-primary">
      <HeaderComponent />
      <View className="items-center justify-center flex-1 w-full">
        <View className="flex flex-col items-center justify-center mb-10">
          {/* <Text className="text-sm text-white font-rMedium">
            Time Signature
          </Text> */}
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
          <View className="flex flex-row items-end justify-between w-3/5">
            <TouchableOpacity
              accessibilityLabel="Decrease BPM"
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
              accessibilityLabel="Increase BPM"
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
        {/* Playback feel: normal / double time */}
        <View className="flex-row mt-4 bg-white/10 rounded-xl p-1">
          {PLAYBACK_FEELS.map((feel, index) => (
            <TouchableOpacity
              key={feel.label}
              accessibilityLabel={feel.label}
              onPress={() => setFeelIndex(index)}
              className={`px-4 py-2 rounded-lg ${index === feelIndex ? "bg-accent" : ""}`}
            >
              <Text
                className={`text-sm font-rMedium ${index === feelIndex ? "text-black" : "text-white"}`}
              >
                {feel.short}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Tap to set BPM button */}
        {/* Beat Visuals */}
        {renderBeatVisuals()}
        <TouchableOpacity
          className=" mt-10 p-2 rounded-full bg-accent border-2 border-[#098E6C]"
          onPress={handleTapTempo}
          activeOpacity={0.7}
        >
          <View className="p-4 border-2 border-dashed rounded-full border-black/30 bg-black/20">
            <MaterialCommunityIcons
              name="gesture-double-tap"
              size={30}
              color="black"
            />
          </View>
        </TouchableOpacity>

        <View className="relative items-center justify-center mt-6">
          <EclipseSvg />
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ flex: 1 }}
          >
            <View className="absolute left-0 right-0 items-center top-6">
              {/* <Text className="text-xl text-white font-cBold">{bpm}</Text>
              <Text className="text-sm text-white font-rMedium">Beats per min</Text> */}
            </View>
            <TouchableOpacity
              className="items-center justify-center"
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
