import { useEffect } from "react";
import {
  View,
  Text,
  StatusBar,
  Image,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";

import {
  useLoopPlayback,
  LOOP_MIN_BPM,
  LOOP_MAX_BPM,
} from "../../context/LoopPlaybackContext";
import { useBpmControl } from "../../hooks/useBpmControl";

import HeaderComponent from "../../components/headerComponent";
import icons from "../../constants/icons";
import PlaySvg from "../../assets/icons/playSvg";
import PauseSvg from "../../assets/icons/pauseSvg";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AntDesign from "@expo/vector-icons/AntDesign";

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

  useEffect(() => {
    setSelectedLoopKey(selectedLoopKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLoopKey, loadedAt]);

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

  return (
    <SafeAreaView className="items-center justify-start flex-1 bg-canvas">
      <HeaderComponent />
      <View className="items-center justify-start flex-1 w-full">
        <View className="flex items-center justify-center w-3/5 py-2">
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
            <Text className="text-white font-spaceBold">{selectedTitle ? selectedTitle : "SELECT LOOP"}</Text>
          </TouchableOpacity>
        </View>

        <View className="flex items-center mt-20">
          <View className="flex flex-row items-end justify-between w-3/5">
            <TouchableOpacity
              accessibilityLabel="Decrease BPM"
              onPress={decrease}
              onLongPress={startHoldDecrease}
              onPressOut={endHold}
              className="p-2 rounded-lg bg-white/10"
            >
              <AntDesign name="minus" size={30} color="white" />
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
              <AntDesign name="plus" size={30} color="white" />
            </TouchableOpacity>
          </View>
          <Text className="text-sm text-white font-satoshiMedium">Beats per min</Text>
        </View>
        {/* Tap to set BPM button */}
        <TouchableOpacity
          className=" mt-20 p-2 rounded-full bg-brand border-2 border-brand-to"
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
            <Text className="mb-2 text-xs text-center text-white/60 font-satoshiMedium">
              Stop the Metronome first
            </Text>
          )}
          <TouchableOpacity
            className="justify-center items-center py-3 w-full rounded-[40rem] bg-black border-2 border-brand/50"
            onPress={isPlaying ? stopLoop : startLoop}
            disabled={!isPlaying && isBlockedByOtherEngine}
            style={
              !isPlaying && isBlockedByOtherEngine ? { opacity: 0.4 } : undefined
            }
          >
            <Text className="text-white font-spaceBold">
              {isPlaying ? <PauseSvg /> : <PlaySvg />}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
}
