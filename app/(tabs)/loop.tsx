import { useEffect, useState } from "react";
import { View } from "react-native";
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
import { BpmInputAccessory } from "../../components/ui/bpmInputAccessory";
import Screen from "../../components/ui/screen";
import SegmentedControl from "../../components/ui/segmentedControl";
import {
  BeatDots,
  BpmDial,
  ControlLabel,
  EngineNotice,
  InstrumentIconButton,
  PickerButton,
  TapTempoButton,
  TransportRow,
} from "../../components/ui/instrument";
import { COLORS, SIZES } from "../../constants/theme";
import {
  Folder,
  MetronomeFill,
  MetronomeOutline,
  Reset,
} from "../../components/icons";

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

  // Passed whole to the dial and the transport -- see the metronome, which
  // builds the same bundle from the same hook.
  const controls = useBpmControl({
    bpm,
    setBpm,
    minBpm: LOOP_MIN_BPM,
    maxBpm: LOOP_MAX_BPM,
  });

  // Indexed like the metronome's, so the two subdivision rows are one control.
  const feelOptions = PLAYBACK_FEELS.map((feel, index) => ({
    value: index,
    label: feel.short,
    accessibilityLabel: feel.label,
  }));

  return (
    <Screen glows={["topLeftFar"]} className="items-center justify-start">
      <HeaderComponent />

      {/* Fixed, not scrolling, and the same container the metronome uses.
          An instrument surface is played by muscle memory: every control has to
          stay where it was last time you reached for it, and a view that can
          slide under the thumb is one where the tempo dial has moved by the
          time you get there. Content that doesn't fit is a layout problem to
          solve at this size, not something to hand to a scroll bar. */}
      <View className="items-center justify-center flex-1 w-full px-instrument">
          {/* Which loop is loaded, and the way to change it */}
          <View className="items-center gap-3 mb-5">
            <ControlLabel text="Select Loop" topic="selectLoop" />
            <PickerButton
              icon={Folder}
              label={selectedTitle ? selectedTitle : "SELECT LOOP"}
              onPress={() => router.push("/(loops)/sounds")}
              accessibilityLabel={
                selectedTitle
                  ? `Select loop, currently ${selectedTitle}`
                  : "Select a loop"
              }
              style={{ maxWidth: 220 }}
            />
          </View>

          <BpmDial
            controls={controls}
            isPlaying={isPlaying}
            beat={currentBeat}
            isAccent={isAccent}
          />

          {/* One bar of the loop's own time signature, downbeat accented. No
              meter here, so no group accents to pass. */}
          <BeatDots
            count={beatsPerBar}
            currentBeat={currentBeat}
            isPlaying={isPlaying}
            isAccent={isAccent}
          />

          <TransportRow
            controls={controls}
            isPlaying={isPlaying}
            blocked={isBlockedByOtherEngine}
            playLabel="Start loop"
            stopLabel="Stop loop"
            onToggle={() => {
              hapticImpact(prefs.haptics, "medium");
              if (isPlaying) stopLoop();
              else startLoop();
            }}
          />

          <EngineNotice
            show={isBlockedByOtherEngine}
            message="Stop the Metronome first"
          />

          {/* Reset tempo | tap tempo | click on/off */}
          <View className="flex-row items-center justify-center gap-3 mt-5">
            <InstrumentIconButton
              accessibilityLabel="Reset loop tempo"
              disabled={!canResetBpm}
              onPress={() => {
                hapticImpact(prefs.haptics, "light");
                resetBpm();
              }}
            >
              <Reset size={SIZES.rowIcon} color={COLORS.white} />
            </InstrumentIconButton>

            <TapTempoButton onPress={controls.handleTapTempo} />

            <InstrumentIconButton
              accessibilityLabel={
                prefs.loopClick ? "Disable loop click" : "Enable loop click"
              }
              active={prefs.loopClick}
              onPress={() => setPref("loopClick", !prefs.loopClick)}
            >
              {prefs.loopClick ? (
                <MetronomeFill size={SIZES.rowIcon} color={COLORS.black} />
              ) : (
                <MetronomeOutline size={SIZES.rowIcon} color={COLORS.white} />
              )}
            </InstrumentIconButton>
          </View>

          {/* Subdivision */}
          <View className="items-start w-full mt-5">
            <ControlLabel
              text="Subdivision"
              topic="loopSubdivision"
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

      <BpmInputAccessory />
    </Screen>
  );
}
