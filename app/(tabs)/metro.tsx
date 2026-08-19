import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Picker } from "@react-native-picker/picker";
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
import {
  DEFAULT_ACCENT_VOLUME,
  DEFAULT_BEAT_VOLUME,
  usePreferences,
} from "../../context/PreferencesContext";
import { hapticImpact } from "../../utils/haptics";

import HeaderComponent from "../../components/headerComponent";
import { BpmInputAccessory } from "../../components/ui/bpmInputAccessory";
import Screen from "../../components/ui/screen";
import SegmentedControl from "../../components/ui/segmentedControl";
import {
  BeatDots,
  BpmDial,
  ControlLabel,
  EngineNotice,
  PickerButton,
  TapTempoButton,
  TransportRow,
} from "../../components/ui/instrument";
import Slider from "../../components/ui/slider";
import { COLORS, LAYOUT, SIZES } from "../../constants/theme";
import { ChevronDown, Musicnote } from "../../components/icons";
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

  // Passed whole to the dial and the transport rather than picked apart here:
  // they are the same set of controls on both instrument screens, and the shared
  // components take the bundle.
  const controls = useBpmControl({ bpm, setBpm, minBpm: MIN_BPM, maxBpm: MAX_BPM });

  // The subdivision selector is indexed, so the options carry the index as
  // their value and the long name as what a screen reader announces.
  const feelOptions = PLAYBACK_FEELS.map((feel, index) => ({
    value: index,
    label: feel.short,
    accessibilityLabel: feel.label,
  }));

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
    <View className="flex-row items-center w-full gap-2 px-3 py-4 bg-surface-muted rounded-lg">
      <View className="items-center justify-center px-2 py-1 rounded-sm bg-black/50">
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
      <TouchableOpacity
        onPress={() => setEditingSound(voice)}
        accessibilityLabel={`${badge} sound`}
        className="flex-row items-center justify-center gap-1 px-2 py-1.5 rounded-sm bg-surface-muted border border-hairline-segment"
        style={{ width: 92 }}
      >
        <Text
          className="text-label text-ink-muted font-satoshiMedium"
          numberOfLines={1}
        >
          {soundLabel(soundId)}
        </Text>
        <ChevronDown size={SIZES.rowIcon} color={COLORS.textMuted} />
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
          <View className="flex-row items-center justify-between px-screen py-2">
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
            itemStyle={{ color: COLORS.white }}
            dropdownIconColor={COLORS.white}
            style={{ width: "100%", color: COLORS.white }}
          >
            {METRONOME_SOUNDS.map((s) => (
              <Picker.Item
                key={s.id}
                label={s.label}
                value={s.id}
                color={COLORS.white}
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
          paddingHorizontal: LAYOUT.screenPaddingX,
          paddingTop: 4,
          paddingBottom: 40,
          gap: 25,
        }}
      >
        {/* Time signature categories: tap a chip to pick the meter. */}
        <View className="w-full gap-2.5">
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
                        className={`items-center justify-center px-2 py-2 rounded-sm border ${
                          selected
                            ? "bg-white border-white"
                            : "border-hairline-segment"
                        }`}
                      >
                        <Text
                          className={`text-label font-spaceBold ${
                            selected ? "text-ink-inverse" : "text-white"
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
        <View className="w-full gap-1.5">
          {renderVolumeRow("accent", "Accent", accentVol, setAccentVol, setAccentVolume, accentSound)}
          {renderVolumeRow("beat", "BEATS", beatVol, setBeatVol, setBeatVolume, beatSound)}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );

  return (
    <Screen glows={["topLeftFar"]} className="items-center justify-start">
      <HeaderComponent />

      {/* Scrolls only when it has to. The instrument is one screenful on a
          modern phone and centres itself there; on a short one the content used
          to be clipped by the tab bar with no way to reach it. flexGrow plus a
          centred content container is what gives both behaviours from one
          layout. */}
      <ScrollView
        className="w-full"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center justify-center w-full px-instrument">
          {/* Time signature */}
          <View className="items-center gap-3 mb-5">
            <ControlLabel text="Time Signature" topic="timeSignature" />
            <PickerButton
              icon={Musicnote}
              label={timeSignature.label}
              onPress={openSheet}
              accessibilityLabel={`Time signature, currently ${timeSignature.label}`}
              style={{ width: SIZES.segmentWidth }}
            />
          </View>

          <BpmDial
            controls={controls}
            isPlaying={isPlaying}
            beat={currentBeat}
            isAccent={accents.includes(currentBeat)}
          />

          <BeatDots
            count={timeSignature.beats}
            currentBeat={currentBeat}
            isPlaying={isPlaying}
            isAccent={accents.includes(currentBeat)}
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

          <TapTempoButton onPress={controls.handleTapTempo} className="mt-5" />

          <EngineNotice
            show={isBlockedByOtherEngine}
            message="Stop the Loop click track first"
          />

          {/* Subdivision */}
          <View className="items-start w-full mt-5">
            <ControlLabel
              text="Subdivision"
              topic="metroSubdivision"
              className="mb-3"
            />
            <SegmentedControl
              variant="row"
              options={feelOptions}
              value={feelIndex}
              onChange={setFeelIndex}
              respondOnPressIn
            />
          </View>
        </View>
      </ScrollView>

      {renderTimeSignatureModal()}
      {renderSoundPickerModal()}
      <BpmInputAccessory />
    </Screen>
  );
}
