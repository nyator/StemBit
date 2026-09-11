import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import {
  useMetronome,
  TIME_SIGNATURES,
  TIME_SIGNATURE_CATEGORIES,
  PLAYBACK_FEELS,
  MIN_BPM,
  MAX_BPM,
} from "../../context/MetronomeContext";
import { useBpmControl } from "../../hooks/useBpmControl";
import {
  DEFAULT_ACCENT_VOLUME,
  DEFAULT_BEAT_VOLUME,
  usePreferences,
} from "../../context/PreferencesContext";
import { hapticImpact } from "../../utils/haptics";

import HeaderComponent from "../../components/headerComponent";
// The instrument furniture, shared with the Loop screen. Everything below the
// header is one of these on both, in the same order, so the two read as the
// same instrument with a different engine behind it.
import {
  BeatDots,
  BpmDial,
  EngineNotice,
  PickerButton,
  TapTempoButton,
  TransportRow,
} from "../../components/ui/instrument";
import SegmentedControl from "../../components/ui/segmentedControl";
import { BpmInputAccessory } from "../../components/ui/bpmInputAccessory";
import Screen from "../../components/ui/screen";
import Slider from "../../components/ui/slider";
import { COLORS, SIZES, SPACING } from "../../constants/theme";
import { Musicnote } from "../../components/icons";
import {
  SHEET_BACKGROUND,
  SHEET_CONTENT,
  SHEET_HANDLE_INDICATOR,
  useSheetBackdrop,
} from "../../components/ui/sheet";

// The picker sheet opens to ~60% of the screen; content scrolls within.
const SHEET_SNAP_POINTS = ["50%"];

/**
 * One meter chip, held to a fixed width rather than sized to its label.
 *
 * "4/4" and "12/8" are different widths of text, and left to themselves the
 * chips make a ragged grid that is harder to scan than the six meters in it
 * deserve. They still wrap, so a narrow phone gets three to a row instead of
 * four rather than a row that overflows.
 */
const METER_CHIP_WIDTH = 71;

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

  // Kept as the object rather than destructured: the shared dial and transport
  // take the whole of it, the same way the Loop screen hands over its own.
  const controls = useBpmControl({
    bpm,
    setBpm,
    minBpm: MIN_BPM,
    maxBpm: MAX_BPM,
  });

  // The beat now sounding is an accent if the meter groups on it -- beat 0
  // always, plus the group starts in compound and odd meters (6/8 is 3+3).
  const isAccentBeat = accents.includes(currentBeat);

  // Built the same way the Loop screen builds its own, so the two subdivision
  // rows are one control rather than two that resemble each other.
  const feelOptions = PLAYBACK_FEELS.map((feel, index) => ({
    value: index,
    label: feel.short,
    accessibilityLabel: feel.label,
  }));

  // One row of the beat-grid: a labelled voice with a volume slider.
  // Figma node 102:724.
  const renderVolumeRow = (
    voice: "accent" | "beat",
    badge: string,
    value: number,
    onSlide: (v: number) => void,
    onCommit: (v: number) => void
  ) => (
    <View className="flex-row items-center w-full gap-2 px-3 py-4 bg-surface-muted rounded-lg">
      <View className="items-center justify-center px-2 py-1 rounded-sm bg-surface-badge">
        <Text className="text-white text-overline font-spaceBold">{badge}</Text>
      </View>
      <Slider
        width="fill"
        value={value}
        onChange={onSlide}
        onComplete={onCommit}
        defaultValue={
          voice === "accent" ? DEFAULT_ACCENT_VOLUME : DEFAULT_BEAT_VOLUME
        }
        accessibilityLabel={`${badge} volume`}
      />
    </View>
  );

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
          ...SHEET_CONTENT,
          alignItems: "center",
          gap: SPACING["2xl"],
        }}
      >
        {/* Time signature categories: tap a chip to pick the meter. */}
        <View className="w-full gap-3">
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
                        style={{ width: METER_CHIP_WIDTH }}
                        className={`items-center justify-center px-2 py-2 rounded-sm border ${selected
                          ? "bg-white border-white"
                          : "border-hairline-segment"
                          }`}
                      >
                        <Text
                          className={`text-label font-spaceBold ${selected ? "text-[#151515]" : "text-white"
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
        <View className="w-full gap-1">
          {renderVolumeRow("accent", "Accent", accentVol, setAccentVol, setAccentVolume)}
          {renderVolumeRow("beat", "BEATS", beatVol, setBeatVol, setBeatVolume)}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );

  return (
    <Screen glows={["topLeftFar"]} className="items-center justify-start">
      <HeaderComponent />

      <View className="items-center justify-center flex-1 w-full px-instrument">
        {/* Time Signature — the same picker the Loop screen names its loop
            with, kept to segmentWidth so it lines up with the dial above it. */}
        <View className="items-center gap-1 mb-5">
          {/* <Text className="text-white text-label font-spaceBold">Time Signature</Text> */}
          <PickerButton
            icon={Musicnote}
            label={timeSignature.label}
            onPress={openSheet}
            style={{ width: SIZES.segmentWidth }}
            accessibilityLabel={`Time signature, currently ${timeSignature.label}`}
          />
        </View>

        <BpmDial
          controls={controls}
          isPlaying={isPlaying}
          beat={currentBeat}
          isAccent={isAccentBeat}
        />

        <BeatDots
          count={timeSignature.beats}
          currentBeat={currentBeat}
          isPlaying={isPlaying}
          isAccent={isAccentBeat}
          accents={accents}
        />

        <TransportRow
          controls={controls}
          isPlaying={isPlaying}
          blocked={isBlockedByOtherEngine}
          playLabel="Start metronome"
          stopLabel="Stop metronome"
          onToggle={() => {
            hapticImpact(prefs.haptics, "medium");
            if (isPlaying) stopMetronome();
            else startMetronome();
          }}
        />

        {/* Directly under the transport, as on the Loop screen: the notice is
            about the transport being blocked, so it belongs next to it rather
            than below the tap tempo. Fixed height, so it appearing doesn't
            shift everything under it. */}
        <EngineNotice
          show={isBlockedByOtherEngine}
          message="Stop the Loop click track first"
        />

        {/* Tap tempo sits in a centred row at the same offset the Loop screen
            puts its own -- there it is flanked by reset-tempo and click-toggle
            buttons, which the metronome has no equivalent of, so here it stands
            alone in the same slot. */}
        <View className="flex-row items-center justify-center gap-3 mt-5">
          <TapTempoButton onPress={controls.handleTapTempo} />
        </View>

        {/* Subdivision */}
        <View className="items-start w-full gap-1 mt-5">
          <Text className="text-white text-label font-spaceBold">Subdivision</Text>
          <SegmentedControl
            variant="row"
            options={feelOptions}
            value={feelIndex}
            onChange={setFeelIndex}
            respondOnPressIn
          />
        </View>
      </View>

      {renderTimeSignatureModal()}
      <BpmInputAccessory />
    </Screen>
  );
}
