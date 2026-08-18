import { useEffect, useState } from "react";
import { View, Text, StatusBar, Image, TouchableOpacity, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import {
  useLoopPlayback,
  LOOP_MIN_BPM,
  LOOP_MAX_BPM,
} from "../../context/LoopPlaybackContext";
import { useBpmControl } from "../../hooks/useBpmControl";
import { usePreferences } from "../../context/PreferencesContext";
import { hapticImpact } from "../../utils/haptics";

import { PLAYBACK_FEELS } from "../../context/MetronomeContext";

import HeaderComponent from "../../components/headerComponent";
import {
  BpmInputAccessory,
  BPM_ACCESSORY_ID,
} from "../../components/ui/bpmInputAccessory";
import AmbientGlow from "../../components/ui/ambientGlow";
import { GLOW_PLACEMENTS } from "../../components/ui/screen";
import { DialGlowRings } from "../../components/ui/dialGlowRing";
import BeatGlow, { BEAT_GLOW_SIZE } from "../../components/ui/beatGlow";
import icons from "../../constants/icons";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import {
  AddCircle,
  MinusCircle,
  PlayFilled,
  Stop,
  Folder,
  MetronomeFill,
  MetronomeOutline,
  Reset,
} from "../../components/icons";
import InfoButton from "../../components/ui/infoButton";

export default function LoopScreen() {
  const router = useRouter();

  // Plays the selected backing loop track, warped to the current BPM,
  // optionally with a metronome click layered in time with it (opt-in via
  // Settings -> Audio Output / Volume; see the click subsystem in
  // constants/loopEngine.ts). Shared/mounted above the tab navigator (see
  // context/LoopPlaybackContext.tsx) so it's visible/stoppable from the
  // floating control and stays mutually exclusive with the Metronome tab.
  const {
    bpm,
    setBpm,
    isPlaying,
    isBlockedByOtherEngine,
    selectedTitle,
    nativeBpm,
    beatsPerBar,
    feelIndex,
    setFeelIndex,
    resetBpm,
    subscribeBeat,
    startLoop,
    stopLoop,
  } = useLoopPlayback();

  // The beat dots pulse a single bar of the loop's time signature (e.g. 3
  // dots for a 3/4 loop), downbeat accented -- one bar, not the whole loop.
  const loopBeats = beatsPerBar;

  // Reset is available once a loop is selected and its tempo has been nudged
  // off the recorded value.
  const canResetBpm = nativeBpm !== null && bpm !== nativeBpm;
  const { prefs, setPref } = usePreferences();


  // Which beat the dots and the pulse are on, announced by the engine as each
  // one lands -- the same grid cursor that schedules the click's accents and
  // beats, so what you see and what you hear are one event.
  //
  // This was a setInterval here, ticking at 60000 / (bpm * feel). It knew the
  // tempo and still drifted, because knowing the tempo is not the hard part:
  // setInterval only promises "no sooner than", so every tick that lands late
  // is time the dots never get back, and the error only ever grows. Nothing
  // measured on this side of the bridge can fix that -- the audio clock is the
  // only one that knows when a beat actually happened.
  //
  // Whether the beat is an accent comes from the engine too, rather than being
  // inferred from the dot's position. It is the engine that decides which beats
  // get the accent sample, so it should be the engine that decides which dot
  // flares.
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isAccent, setIsAccent] = useState(true);
  useEffect(() => {
    if (!isPlaying) {
      setCurrentBeat(0);
      setIsAccent(true);
      return;
    }
    return subscribeBeat((beat, accent) => {
      setCurrentBeat(beat ?? 0);
      setIsAccent(accent);
    });
  }, [isPlaying, subscribeBeat]);

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
    for (let i = 0; i < loopBeats; i++) {
      const isCurrent = i === currentBeat;
      const activeColor = i === 0 ? COLORS.brand : COLORS.text;
      const size = isCurrent ? 12 : 8;
      // The halo goes on whichever beat the engine accented, rather than on
      // whichever dot is first. The two agree today; if they ever stopped, the
      // sound is the one that's right. Gated on isPlaying: currentBeat sits at
      // 0 while stopped, and without this the downbeat would glow at rest.
      const showGlow = isPlaying && isCurrent && isAccent;
      beats.push(
        <View
          key={i}
          style={{
            marginHorizontal: 3,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {showGlow && (
            <BeatGlow
              color={activeColor}
              // Centres the painted box on the dot without it joining layout.
              style={{
                left: (size - BEAT_GLOW_SIZE) / 2,
                top: (size - BEAT_GLOW_SIZE) / 2,
              }}
            />
          )}
          <View
            style={{
              width: size,
              height: size,
              borderRadius: 6,
              backgroundColor: isCurrent ? activeColor : "rgba(255,255,255,0.15)",
            }}
          />
        </View>
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
            <InfoButton topic="selectLoop" />
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(loops)/sounds")}
            style={{ maxWidth: 220 }}
            className="flex-row items-center justify-center gap-[10px] px-[20px] py-[7px] bg-white rounded-sm"
          >
            <Folder size={24} color={COLORS.black} />
            <View style={{ width: 1, height: 18, backgroundColor: "rgba(0,0,0,0.2)" }} />
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
          {/* Flares on the beats the engine accented, told by the engine. */}
          <DialGlowRings
            beat={currentBeat}
            isAccent={isAccent}
            isPlaying={isPlaying}
          />
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
              inputAccessoryViewID={BPM_ACCESSORY_ID}
            />
            <Text className="uppercase text-label text-ink-muted font-satoshiBold">
              BPM
            </Text>
          </View>
        </View>

        {renderBeatVisuals()}

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
            // onPressIn, not onPress: onPress fires when the finger LIFTS, so
            // the loop (and its haptic) waited on the release rather than the
            // tap. Transport should answer the moment you touch it.
            onPressIn={() => {
              hapticImpact(prefs.haptics, "medium");
              if (isPlaying) stopLoop();
              else startLoop();
            }}
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
        {/* Fixed-height slot so the notice appearing doesn't shift the
            controls below it. */}
        <View className="justify-center w-full mt-2 h-4">
          {isBlockedByOtherEngine && (
            <Text
              numberOfLines={1}
              className="text-xs text-center text-white/60 font-satoshiMedium"
            >
              Stop the Metronome first
            </Text>
          )}
        </View>

        {/* Reset tempo | Tap tempo (center) | loop click */}
        <View className="flex-row items-center justify-center gap-[10px] mt-[18px]">
          <TouchableOpacity
            accessibilityLabel="Reset loop tempo"
            onPress={() => {
              hapticImpact(prefs.haptics, "light");
              resetBpm();
            }}
            disabled={!canResetBpm}
            style={!canResetBpm ? { opacity: 0.4 } : undefined}
            className="items-center justify-center px-[12px] py-[10px] rounded-sm border-2 border-hairline-strong"
          >
            <Reset size={20} color={COLORS.white} />
          </TouchableOpacity>

          <TouchableOpacity
            // Tap tempo has to be onPressIn. The beat is where the finger
            // lands, not where it lifts — timing off the release both felt
            // late and measured the wrong thing, since how long a tap is held
            // varies far more than when it starts.
            onPressIn={handleTapTempo}
            className="items-center justify-center px-[12px] py-[10px] border-2 border-hairline-strong rounded-sm"
          >
            <Text className="text-white text-title font-spaceBold">TAP TEMPO</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel={prefs.loopClick ? "Disable loop click" : "Enable loop click"}
            onPress={() => setPref("loopClick", !prefs.loopClick)}
            className={`items-center justify-center px-[12px] py-[10px] rounded-sm border-2 ${prefs.loopClick ? "bg-white border-white" : "border-hairline-strong"
              }`}
          >
            {prefs.loopClick ? (
              <MetronomeFill size={20} color={COLORS.black} />
            ) : (
              <MetronomeOutline size={20} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>


        {/* Subdivision */}
        <View className="items-start w-full mt-[18px]">
          <View className="flex-row items-center gap-[5px] mb-[10px]">
            <Text className="text-white text-label font-spaceBold">Subdivision</Text>
            <InfoButton topic="loopSubdivision" />
          </View>
          <View className="flex-row items-center justify-between w-full">
            {PLAYBACK_FEELS.map((feel, index) => {
              const selected = index === feelIndex;
              return (
                <TouchableOpacity
                  key={feel.label}
                  accessibilityLabel={feel.label}
                  onPressIn={() => setFeelIndex(index)}
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

      <BpmInputAccessory />

      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
}
