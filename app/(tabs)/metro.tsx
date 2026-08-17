import { useEffect, useRef, useState } from "react";
import { View, Text, StatusBar, TouchableOpacity, TextInput } from "react-native";
import NativeSlider from "@react-native-community/slider";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Picker } from "@react-native-picker/picker";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useMetronome,
  TIME_SIGNATURES,
  TIME_SIGNATURE_CATEGORIES,
  METRONOME_SOUNDS,
  PLAYBACK_FEELS,
  MIN_BPM,
  MAX_BPM,
} from "../../context/MetronomeContext";
import { useBpmControl } from "../../hooks/useBpmControl";
import { usePreferences } from "../../context/PreferencesContext";
import { hapticImpact } from "../../utils/haptics";

import HeaderComponent from "../../components/headerComponent";
import {
  BpmInputAccessory,
  BPM_ACCESSORY_ID,
} from "../../components/ui/bpmInputAccessory";
import AmbientGlow from "../../components/ui/ambientGlow";
import { GLOW_PLACEMENTS } from "../../components/ui/screen";
import { DialGlowRings } from "../../components/ui/dialGlowRing";
import BeatGlow, { BEAT_GLOW_SIZE } from "../../components/ui/beatGlow";
import { COLORS, CONTROL, SHADOWS, SIZES } from "../../constants/theme";
import {
  AddCircle,
  MinusCircle,
  PlayFilled,
  Stop,
  ChevronDown,
  Musicnote,
} from "../../components/icons";
import InfoButton from "../../components/ui/infoButton";
import {
  SHEET_BACKGROUND,
  SHEET_HANDLE_INDICATOR,
  useSheetBackdrop,
} from "../../components/ui/sheet";

// Human label for a sound id, from the METRONOME_SOUNDS registry.
const soundLabel = (id: string) =>
  METRONOME_SOUNDS.find((s) => s.id === id)?.label ?? id;

// The picker sheet opens to ~60% of the screen; content scrolls within.
const SHEET_SNAP_POINTS = ["50%"];

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
    accentVolume,
    setAccentVolume,
    beatVolume,
    setBeatVolume,
    accentSound,
    setAccentSound,
    beatSound,
    setBeatSound,
    isBlockedByOtherEngine,
    startMetronome,
    stopMetronome,
  } = useMetronome();
  const { prefs } = usePreferences();

  // @gorhom/bottom-sheet handles the sheet's slide, the fading backdrop, and
  // swipe-to-dismiss natively; we just present/dismiss it via this ref.
  const sheetRef = useRef<BottomSheetModal>(null);
  const openSheet = () => sheetRef.current?.present();
  const closeSheet = () => sheetRef.current?.dismiss();

  // Which voice's sound picker is open, if any.
  const [editingSound, setEditingSound] = useState<"accent" | "beat" | null>(
    null
  );
  const soundSheetRef = useRef<BottomSheetModal>(null);

  // The sheet is driven imperatively and this screen thinks in state, so the
  // two are bridged here. Dismissing an already-dismissed sheet is a no-op,
  // which is what makes this safe to run on any change.
  useEffect(() => {
    if (editingSound) soundSheetRef.current?.present();
    else soundSheetRef.current?.dismiss();
  }, [editingSound]);

  // Local mirrors of the persisted volumes. The slider drives these live so its
  // thumb stays put across the re-renders the metronome triggers every beat;
  // we persist + push to the engine only on release (onSlidingComplete),
  // avoiding a file write on every drag tick.
  const [accentVol, setAccentVol] = useState(accentVolume);
  const [beatVol, setBeatVol] = useState(beatVolume);
  useEffect(() => setAccentVol(accentVolume), [accentVolume]);
  useEffect(() => setBeatVol(beatVolume), [beatVolume]);

  // Backdrop that fades in as the sheet opens and out as it closes; tapping it
  // dismisses the sheet. Shared, so every sheet in the app dims by the same
  // amount and closes the same way.
  const renderBackdrop = useSheetBackdrop();

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

  // One row of the beat-grid: a labelled voice with a volume slider and a
  // tappable sound selector that opens that voice's picker. Figma node 102:724.
  const renderVolumeRow = (
    voice: "accent" | "beat",
    badge: string,
    value: number,
    onSlide: (v: number) => void,
    onCommit: (v: number) => void,
    soundId: string
  ) => (
    <View className="flex-row items-center w-full gap-[9px] px-[10px] py-4 bg-surface-muted rounded-lg">
      <View className="items-center justify-center px-2 py-1 rounded-[8px] bg-[rgba(25,25,25,0.5)]">
        <Text className="text-white text-overline font-spaceBold">{badge}</Text>
      </View>
      <NativeSlider
        style={{ flex: 1, height: 32 }}
        value={value}
        onValueChange={onSlide}
        onSlidingComplete={onCommit}
        minimumValue={0}
        maximumValue={1}
        minimumTrackTintColor={CONTROL.active}
        maximumTrackTintColor={CONTROL.track}
        thumbTintColor={COLORS.white}
        accessibilityLabel={`${badge} volume`}
      />
      <TouchableOpacity
        onPress={() => setEditingSound(voice)}
        accessibilityLabel={`${badge} sound`}
        className="flex-row items-center justify-center gap-1 px-2 py-[6px] rounded-[8px] bg-surface-muted border border-hairline-segment"
        style={{ width: 92 }}
      >
        <Text
          className="text-[13px] font-satoshiMedium"
          style={{ color: "#D3D3D3" }}
          numberOfLines={1}
        >
          {soundLabel(soundId)}
        </Text>
        <ChevronDown size={15} color="#D3D3D3" />
      </TouchableOpacity>
    </View>
  );

  // A voice's sound picker. Reused for both the accent and beat voices
  // depending on `editingSound`, and on the same sheet as everything else that
  // comes up from the bottom of this app.
  //
  // The voice is held past the point it is cleared, so the sheet still knows
  // what it is showing while it slides away. Read straight off `editingSound`
  // the content would blank the instant dismissal starts and the sheet would
  // animate out empty.
  const lastVoiceRef = useRef<"accent" | "beat">("accent");
  if (editingSound) lastVoiceRef.current = editingSound;

  const renderSoundPickerModal = () => {
    const voice = editingSound ?? lastVoiceRef.current;
    const currentId = voice === "accent" ? accentSound : beatSound;
    const setSound = voice === "accent" ? setAccentSound : setBeatSound;
    return (
      <BottomSheetModal
        ref={soundSheetRef}
        // Sized to the picker rather than to a snap point: the wheel has an
        // intrinsic height on iOS and collapses to a dropdown button on
        // Android, so any fixed fraction of the screen is wrong on one of them.
        enableDynamicSizing
        // The wheel scrolls vertically and so does the sheet. Without this they
        // read the same drag and spinning the picker pulls the sheet shut; the
        // handle still drags it.
        enableContentPanningGesture={false}
        onDismiss={() => setEditingSound(null)}
        backdropComponent={renderBackdrop}
        backgroundStyle={SHEET_BACKGROUND}
        handleIndicatorStyle={SHEET_HANDLE_INDICATOR}
      >
        <BottomSheetView style={{ paddingBottom: 40 }}>
          <View className="flex-row items-center justify-between px-5 py-2">
            <Text
              className="uppercase text-overline font-spaceBold text-white/70"
              style={{ letterSpacing: 0.72 }}
            >
              {voice === "accent" ? "Accent sound" : "Beat sound"}
            </Text>
            <TouchableOpacity onPress={() => setEditingSound(null)}>
              <Text className="text-brand text-body font-spaceBold">Done</Text>
            </TouchableOpacity>
          </View>
          <Picker
            selectedValue={currentId}
            onValueChange={(id) => setSound(id)}
            itemStyle={{ color: "#fff" }}
            dropdownIconColor="#fff"
            style={{ width: "100%", color: "#fff" }}
          >
            {METRONOME_SOUNDS.map((s) => (
              <Picker.Item
                key={s.id}
                label={s.label}
                value={s.id}
                color="#fff"
              />
            ))}
          </Picker>
        </BottomSheetView>
      </BottomSheetModal>
    );
  };

  // Bottom-sheet time-signature picker (Figma node 93:534): meters grouped
  // into Standard / Compound / Odd chips, plus per-voice volume controls.
  // @gorhom/bottom-sheet gives the native slide, fading backdrop, drag handle
  // and swipe-to-dismiss.
  const renderTimeSignatureModal = () => (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SHEET_SNAP_POINTS}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={SHEET_BACKGROUND}
      handleIndicatorStyle={SHEET_HANDLE_INDICATOR}
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 40,
          gap: 25,
        }}
      >
        {/* Time signature categories: tap a chip to pick the meter. */}
        <View className="w-full gap-[10px]">
          {TIME_SIGNATURE_CATEGORIES.map((cat) => (
            <View key={cat.key} className="w-full gap-2">
              <Text
                className="uppercase text-overline font-spaceBold text-white/70"
                style={{ letterSpacing: 0.72 }}
              >
                {cat.label}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {TIME_SIGNATURES.filter((ts) => ts.category === cat.key).map(
                  (ts) => {
                    const selected = ts.label === timeSignature.label;
                    return (
                      <TouchableOpacity
                        key={ts.label}
                        onPress={() => {
                          setTimeSignature(ts);
                          closeSheet();
                        }}
                        style={{ width: 71 }}
                        className={`items-center justify-center px-[9px] py-[7px] rounded-[10px] border ${
                          selected
                            ? "bg-white border-white"
                            : "border-hairline-segment"
                        }`}
                      >
                        <Text
                          className={`text-label font-spaceBold ${
                            selected ? "text-[#151515]" : "text-white"
                          }`}
                        >
                          {ts.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Beat grid: accent + beat volumes */}
        <View className="w-full gap-[5px]">
          {renderVolumeRow("accent", "Accent", accentVol, setAccentVol, setAccentVolume, accentSound)}
          {renderVolumeRow("beat", "BEATS", beatVol, setBeatVol, setBeatVolume, beatSound)}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
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
      const isAccent = i === 0 || isSecondaryAccent;
      const activeColor =
        i === 0 ? COLORS.brand : isSecondaryAccent ? COLORS.brandFrom : COLORS.text;
      const idleColor = isSecondaryAccent
        ? "rgba(0,139,194,0.3)"
        : "rgba(255,255,255,0.15)";
      const size = isCurrent ? 12 : 8;
      // The halo marks the accent that is sounding, so it pulses along with
      // the click rather than sitting on the accent dots permanently. Gated on
      // isPlaying too: currentBeat resets to 0 on stop, and without this the
      // downbeat would glow at a stopped metronome.
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
              backgroundColor: isCurrent ? activeColor : idleColor,
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
        {/* Time Signature */}
        <View className="items-center gap-[10px] mb-[18px]">
          <View className="flex-row items-center gap-[5px]">
            <Text className="text-white text-label font-spaceBold">Time Signature</Text>
            <InfoButton topic="timeSignature" />
          </View>
          <TouchableOpacity
            onPress={openSheet}
            style={{ width: SIZES.segmentWidth }}
            className="flex-row items-center justify-center gap-[8px] py-[7px] bg-white rounded-sm"
          >
            <Musicnote size={20} color={COLORS.black} />
            <View style={{ width: 1, height: 18, backgroundColor: "rgba(0,0,0,0.2)" }} />
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
          <DialGlowRings
            beat={currentBeat}
            isAccent={accents.includes(currentBeat)}
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
            accessibilityLabel={isPlaying ? "Stop metronome" : "Start metronome"}
            // onPressIn, not onPress: onPress fires when the finger LIFTS, so
            // the click (and its haptic) waited on the release rather than the
            // tap. Transport should answer the moment you touch it.
            onPressIn={() => {
              hapticImpact(prefs.haptics, "medium");
              if (isPlaying) stopMetronome();
              else startMetronome();
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

        {/* Tap tempo */}
        <TouchableOpacity
          // Tap tempo has to be onPressIn. The beat is where the finger lands,
          // not where it lifts — timing off the release both felt late and
          // measured the wrong thing, since how long a tap is held varies far
          // more than when it starts.
          onPressIn={handleTapTempo}
          className="items-center justify-center mt-[18px] px-[12px] py-[10px] border-2 border-hairline-strong rounded-sm"
        >
          <Text className="text-white text-title font-spaceBold">TAP TEMPO</Text>
        </TouchableOpacity>


        {/* Fixed-height slot so the notice appearing doesn't shift the
            controls below it. */}
        <View className="justify-center w-full mt-2 h-4">
          {isBlockedByOtherEngine && (
            <Text
              numberOfLines={1}
              className="text-xs text-center text-white/60 font-satoshiMedium"
            >
              Stop the Loop click track first
            </Text>
          )}
        </View>

        {/* Subdivision */}
        <View className="items-start w-full mt-[18px]">
          <View className="flex-row items-center gap-[5px] mb-[10px]">
            <Text className="text-white text-label font-spaceBold">Subdivision</Text>
            <InfoButton topic="metroSubdivision" />
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

      {renderTimeSignatureModal()}
      {renderSoundPickerModal()}
      <BpmInputAccessory />
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
}
