import { useEffect, useState } from "react";
import { View, Text, StatusBar, Image, TouchableOpacity, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";

import {
  useLoopPlayback,
  LOOP_MIN_BPM,
  LOOP_MAX_BPM,
} from "../../context/LoopPlaybackContext";
import { useBpmControl } from "../../hooks/useBpmControl";

import { PLAYBACK_FEELS, DEFAULT_FEEL_INDEX } from "../../context/MetronomeContext";

import HeaderComponent from "../../components/headerComponent";
import AmbientGlow from "../../components/ui/ambientGlow";
import { GLOW_PLACEMENTS } from "../../components/ui/screen";
import { GlowRing } from "../../components/ui/dialGlowRing";
import icons from "../../constants/icons";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import { AddCircle, MinusCircle, Information, PlayFilled, Stop } from "../../components/icons";

// Loops have no time-signature concept -- the beat visuals just assume a
// steady 4-beat cycle to pulse against.
const LOOP_BEATS = 4;

export default function LoopScreen() {
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

  // UI-only for now -- LoopPlaybackContext has no playback-rate multiplier to
  // wire this into yet (see getPlaybackRate in LoopPlaybackContext.tsx).
  const [feelIndex, setFeelIndex] = useState(DEFAULT_FEEL_INDEX);

  useEffect(() => {
    setSelectedLoopKey(selectedLoopKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLoopKey, loadedAt]);

  // The loop engine (a WebView Web Audio graph) doesn't report its playhead
  // back to React, so there's no real beat position to visualize like the
  // Metronome's currentBeat. This just pulses a fixed 4-beat cycle locally at
  // the current BPM -- a tempo-synced approximation, not a sample-accurate one.
  const [currentBeat, setCurrentBeat] = useState(0);
  useEffect(() => {
    if (!isPlaying) {
      setCurrentBeat(0);
      return;
    }
    const timer = setInterval(() => {
      setCurrentBeat((beat) => (beat + 1) % LOOP_BEATS);
    }, (60 * 1000) / bpm);
    return () => clearInterval(timer);
  }, [isPlaying, bpm]);

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
  } = useBpmControl({
    bpm,
    setBpm,
    minBpm: LOOP_MIN_BPM,
    maxBpm: LOOP_MAX_BPM,
  });

  // A row of dots, one per beat of the simulated cycle above. The downbeat
  // lights up brand blue, the rest white -- same treatment as the
  // Metronome's beat visuals, minus accent grouping (no time signature here).
  const renderBeatVisuals = () => {
    const beats = [];
    for (let i = 0; i < LOOP_BEATS; i++) {
      const isCurrent = i === currentBeat;
      const activeColor = i === 0 ? COLORS.brand : COLORS.text;
      beats.push(
        <View
          key={i}
          style={{
            width: isCurrent ? 12 : 8,
            height: isCurrent ? 12 : 8,
            borderRadius: 6,
            marginHorizontal: 3,
            backgroundColor: isCurrent ? activeColor : "rgba(255,255,255,0.15)",
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
        {/* Select Loop */}
        <View className="items-center gap-[10px] mb-[18px]">
          <View className="flex-row items-center gap-[5px]">
            <Text className="text-white text-label font-spaceBold">Select Loop</Text>
            <Information size={16} />
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(loops)/sounds")}
            style={{ maxWidth: 220 }}
            className="flex-row items-center justify-center gap-[10px] px-[20px] py-[7px] bg-white rounded-sm"
          >
            <Image
              source={icons.folder}
              style={{ width: 24, height: 24 }}
              tintColor={COLORS.black}
            />
            <Text
              className="text-black text-title font-spaceBold"
              numberOfLines={1}
            >
              {selectedTitle ? selectedTitle : "SELECT LOOP"}
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
            accessibilityLabel={isPlaying ? "Stop loop" : "Start loop"}
            onPress={isPlaying ? stopLoop : startLoop}
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
            Stop the Metronome first
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
                  className={`items-center justify-center py-[7px] rounded-sm ${selected
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

      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
}
