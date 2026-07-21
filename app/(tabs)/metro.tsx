import { useState } from "react";
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
import { useBpmControl } from "../../hooks/useBpmControl";

import HeaderComponent from "../../components/headerComponent";
import icons from "../../constants/icons";
import { COLORS } from "../../constants/theme";
import EclipseSvg from "../../assets/icons/eclipseSvg";
import PlaySvg from "../../assets/icons/playSvg";
import PauseSvg from "../../assets/icons/pauseSvg";
import { AddCircle, MinusCircle, Musicnote, TickCircle } from "../../components/icons";

export default function MetroScreen() {
  const {
    bpm,
    setBpm,
    isPlaying,
    currentBeat,
    timeSignature,
    setTimeSignature,
    accents,
    feelIndex,
    setFeelIndex,
    isBlockedByOtherEngine,
    startMetronome,
    stopMetronome,
  } = useMetronome();

  const [modalVisible, setModalVisible] = useState(false);

  const {
    bpmText,
    handleBpmTextChange,
    commitBpmText,
    increase,
    decrease,
    startHoldIncrease,
    startHoldDecrease,
    endHold,
    handleTapTempo,
  } = useBpmControl({ bpm, setBpm, minBpm: MIN_BPM, maxBpm: MAX_BPM });

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
          <Text className="mb-3 text-lg text-white font-satoshiBold">
            Choose Time Signature
          </Text>
          <FlatList
            data={TIME_SIGNATURES}
            keyExtractor={(item) => item.label}
            renderItem={({ item }) => (
              <TouchableOpacity
                className={`flex-row items-center py-4 justify-between px-5 my-[2px] rounded-lg ${item.label === timeSignature.label ? "bg-brand border-white border-[0.2px]" : "bg-white/10 border-white/30 border-[0.2px]"}`}
                onPress={() => {
                  setTimeSignature(item);
                  setModalVisible(false);
                }}
              >
                <Text
                  className={`text-base font-satoshiMedium ${item.label === timeSignature.label ? "text-black text-3xl" : "text-white"}`}
                >
                  {item.label}
                </Text>
                {item.label === timeSignature.label && (
                  <TickCircle size={18}
                    color="#000"
                    style={{ marginLeft: 8 }} />
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
  // A row of circles, one per beat. The downbeat lights up green, secondary
  // group accents (e.g. beat 4 of 6/8) light a dimmer green, other beats
  // white. Idle group-accent dots are slightly brighter so the meter's
  // grouping is visible even before pressing play.
  const renderBeatVisuals = () => {
    const beats = [];
    for (let i = 0; i < timeSignature.beats; i++) {
      const isCurrent = i === currentBeat;
      const isSecondaryAccent = i !== 0 && accents.includes(i);
      const activeColor =
        i === 0 ? COLORS.brand : isSecondaryAccent ? COLORS.brandFrom : COLORS.textOnBrand;
      const idleColor = isSecondaryAccent
        ? "rgba(8,193,146,0.3)"
        : "rgba(255,255,255,0.15)";
      beats.push(
        <View
          key={i}
          style={{
            width: 14,
            height: 14,
            borderRadius: 14,
            marginHorizontal: 7,
            backgroundColor: isCurrent ? activeColor : idleColor,
            borderWidth: isCurrent ? 3 : 1,
            borderColor: isCurrent ? activeColor : "rgba(255,255,255,0.25)",
            justifyContent: "center",
            alignItems: "center",
            shadowColor: isCurrent ? activeColor : idleColor,
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
    <SafeAreaView className="items-center justify-start flex-1 bg-canvas">
      <HeaderComponent />
      <View className="items-center justify-center flex-1 w-full">
        <View className="flex flex-col items-center justify-center mb-10">
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
            <Text className="text-lg text-white font-satoshiBold ">
              {timeSignature.label}
            </Text>
          </TouchableOpacity>
        </View>
        <View className="flex items-center">
          <View className="flex flex-row items-end justify-between w-3/5">
            <TouchableOpacity
              accessibilityLabel="Decrease BPM"
              onPress={decrease}
              onLongPress={startHoldDecrease}
              onPressOut={endHold}
              className="p-2 rounded-lg bg-white/10"
            >
              <MinusCircle size={30} color="white" />
            </TouchableOpacity>

            <TextInput
              className="w-20 text-4xl text-center text-white font-spaceBold"
              value={bpmText}
              onChangeText={handleBpmTextChange}
              onEndEditing={commitBpmText}
              keyboardType="numeric"
              maxLength={3}
              selectTextOnFocus
              underlineColorAndroid="transparent"
            />

            <TouchableOpacity
              accessibilityLabel="Increase BPM"
              onPress={increase}
              onLongPress={startHoldIncrease}
              onPressOut={endHold}
              className="p-2 rounded-lg bg-white/10"
            >
              <AddCircle size={30} color="white" />
            </TouchableOpacity>
          </View>
          <Text className="text-sm text-white font-satoshiMedium">Beats per min</Text>
        </View>
        {/* Playback feel: normal / double time */}
        <View className="flex-row mt-4 bg-white/10 rounded-xl p-1">
          {PLAYBACK_FEELS.map((feel, index) => (
            <TouchableOpacity
              key={feel.label}
              accessibilityLabel={feel.label}
              onPress={() => setFeelIndex(index)}
              className={`px-4 py-2 rounded-lg ${index === feelIndex ? "bg-brand" : ""}`}
            >
              <Text
                className={`text-sm font-satoshiMedium ${index === feelIndex ? "text-black" : "text-white"}`}
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
          className=" mt-10 p-2 rounded-full bg-brand border-2 border-brand-to"
          onPress={handleTapTempo}
          activeOpacity={0.7}
        >
          <View className="p-4 border-2 border-dashed rounded-full border-black/30 bg-black/20">
            <Musicnote size={30}
              color="black" />
          </View>
        </TouchableOpacity>

        <View className="relative items-center justify-center mt-6">
          <EclipseSvg />
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ flex: 1 }}
          >
            <View className="absolute left-0 right-0 items-center top-6">
              {isBlockedByOtherEngine && (
                <Text className="text-xs text-center text-white/60 font-satoshiMedium">
                  Stop the Loop click track first
                </Text>
              )}
            </View>
            <TouchableOpacity
              className="items-center justify-center"
              onPress={isPlaying ? stopMetronome : startMetronome}
              disabled={!isPlaying && isBlockedByOtherEngine}
              style={
                !isPlaying && isBlockedByOtherEngine ? { opacity: 0.4 } : undefined
              }
            >
              <Text className="mt-2 text-white font-spaceBold">
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
