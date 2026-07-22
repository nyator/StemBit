import { useState } from "react";
import {
  View,
  Text,
  StatusBar,
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
import AmbientGlow from "../../components/ui/ambientGlow";
import { GLOW_PLACEMENTS } from "../../components/ui/screen";
import { GlowRing } from "../../components/ui/dialGlowRing";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import {
  AddCircle,
  MinusCircle,
  Information,
  PlayFilled,
  Stop,
  TickCircle,
} from "../../components/icons";

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
  // A row of dots, one per beat. The downbeat lights up brand blue; secondary
  // group accents (e.g. beat 4 of 6/8) light a dimmer blue, other beats
  // white. Idle group-accent dots are slightly brighter so the meter's
  // grouping is visible even before pressing play.
  const renderBeatVisuals = () => {
    const beats = [];
    for (let i = 0; i < timeSignature.beats; i++) {
      const isCurrent = i === currentBeat;
      const isSecondaryAccent = i !== 0 && accents.includes(i);
      const activeColor =
        i === 0 ? COLORS.brand : isSecondaryAccent ? COLORS.brandFrom : COLORS.text;
      const idleColor = isSecondaryAccent
        ? "rgba(0,139,194,0.3)"
        : "rgba(255,255,255,0.15)";
      beats.push(
        <View
          key={i}
          style={{
            width: isCurrent ? 12 : 8,
            height: isCurrent ? 12 : 8,
            borderRadius: 6,
            marginHorizontal: 3,
            backgroundColor: isCurrent ? activeColor : idleColor,
          }}
        />
      );
    }
    return (
      <View className="flex-row items-center justify-center" style={{ height: 12 }}>
        {beats}
      </View>
    );
  };

  return (
    <SafeAreaView className="items-center justify-start flex-1 overflow-hidden bg-canvas">
      <AmbientGlow style={GLOW_PLACEMENTS.topLeftFar} />
      {/* <AmbientGlow style={GLOW_PLACEMENTS.bottomLeft} /> */}

      <HeaderComponent />

      <View className="items-center justify-center flex-1 w-full px-instrument">
        {/* Time Signature */}
        <View className="items-center gap-[10px] mb-[18px]">
          <View className="flex-row items-center gap-[5px]">
            <Text className="text-white text-label font-spaceBold">Time Signature</Text>
            <Information size={16} />
          </View>
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={{ width: SIZES.segmentWidth }}
            className="items-center justify-center py-[7px] bg-white rounded-sm"
          >
            <Text className="text-black text-title font-spaceBold">
              {timeSignature.label}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dial */}
        <View
          className="items-center justify-center w-full mb-[18px]"
          style={{ height: 249 }}
        >
          <GlowRing size={288} radius={119.5} strokeWidth={1} blur={12} opacity={0.15} />
          <GlowRing size={244} radius={109} strokeWidth={2} blur={6} opacity={0.3} />
          <View
            className="items-center justify-center bg-surface-sunken border-hairline-dial rounded-dial"
            style={{
              width: SIZES.dial,
              height: SIZES.dial,
              borderWidth: 3,
              ...SHADOWS.glow,
            }}
          >
            <TextInput
              className="p-0 text-center font-spaceBold"
              style={{
                minWidth: 110,
                fontSize: 48,
                color: isPlaying ? COLORS.brand : COLORS.white,
              }}
              value={bpmText}
              onChangeText={handleBpmTextChange}
              onEndEditing={commitBpmText}
              keyboardType="numeric"
              maxLength={3}
              selectTextOnFocus
              underlineColorAndroid="transparent"
            />
            <Text className="uppercase text-label text-ink-muted font-satoshiBold">
              BPM
            </Text>
          </View>
        </View>

        {renderBeatVisuals()}

        {/* Tap tempo */}
        <TouchableOpacity
          onPress={handleTapTempo}
          className="items-center justify-center mt-[18px] px-[12px] py-[6px] border-2 border-hairline-strong rounded-sm"
        >
          <Text className="text-white text-title font-spaceBold">TAP TEMPO</Text>
        </TouchableOpacity>

        {/* Transport: -/play-stop/+ */}
        <View className="flex-row items-center gap-[10px] mt-[10px]">
          <TouchableOpacity
            accessibilityLabel="Decrease BPM"
            onPress={decrease}
            onLongPress={startHoldDecrease}
            onPressOut={endHold}
            className="p-2 rounded-lg bg-white/10"
          >
            <MinusCircle size={SIZES.transportSecondary} color={COLORS.white} />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel={isPlaying ? "Stop metronome" : "Start metronome"}
            onPress={isPlaying ? stopMetronome : startMetronome}
            disabled={!isPlaying && isBlockedByOtherEngine}
            style={
              !isPlaying && isBlockedByOtherEngine ? { opacity: 0.4 } : undefined
            }
          >
            {isPlaying ? (
              <Stop size={SIZES.transportPrimary} />
            ) : (
              <PlayFilled size={SIZES.transportPrimary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel="Increase BPM"
            onPress={increase}
            onLongPress={startHoldIncrease}
            onPressOut={endHold}
            className="p-2 rounded-lg bg-white/10"
          >
            <AddCircle size={SIZES.transportSecondary} color={COLORS.white} />
          </TouchableOpacity>
        </View>
        {isBlockedByOtherEngine && (
          <Text className="mt-2 text-xs text-center text-white/60 font-satoshiMedium">
            Stop the Loop click track first
          </Text>
        )}

        {/* Subdivision */}
        <View className="items-start w-full mt-[18px]">
          <View className="flex-row items-center gap-[5px] mb-[10px]">
            <Text className="text-white text-label font-spaceBold">Subdivision</Text>
            <Information size={16} />
          </View>
          <View className="flex-row items-center justify-between w-full">
            {PLAYBACK_FEELS.map((feel, index) => {
              const selected = index === feelIndex;
              return (
                <TouchableOpacity
                  key={feel.label}
                  accessibilityLabel={feel.label}
                  onPress={() => setFeelIndex(index)}
                  style={{ width: SIZES.segmentWidth }}
                  className={`items-center justify-center py-[7px] rounded-sm ${
                    selected
                      ? "bg-white"
                      : "bg-surface-muted border border-hairline-segment"
                  }`}
                >
                  <Text
                    className={`text-title font-spaceBold ${selected ? "text-black" : "text-white"}`}
                  >
                    {feel.short}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {renderTimeSignatureModal()}
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
}
