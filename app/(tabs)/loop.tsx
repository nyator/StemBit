import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

import {
  useLoopPlayback,
  LOOP_MIN_BPM,
  LOOP_MAX_BPM,
} from "../../context/LoopPlaybackContext";
import { useBpmControl } from "../../hooks/useBpmControl";
import { usePreferences } from "../../context/PreferencesContext";
import { hapticImpact } from "../../utils/haptics";
import { confirm } from "../../utils/confirm";
import { findLoopByKey } from "../../constants/loops";
import { useSaveLoopAsMine } from "../../hooks/useSaveLoopAsMine";

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
  Edit2,
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
    selectedKey,
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

  // The loaded loop itself, not just its title: whether it is one of ours or
  // one of theirs decides what the button beside the picker does.
  const selectedLoop = findLoopByKey(selectedKey ?? undefined);
  const { saveAsMine } = useSaveLoopAsMine();

  /**
   * Edit the loaded loop -- taking a copy first when it is one the app ships.
   *
   * A shipped loop cannot be renamed or re-metered; the only thing an edit can
   * move is its tempo and trim. So the copy is not an extra step on the way to
   * editing, it is the only way to get at the rest -- and it is asked for
   * rather than done quietly, because it puts a second row in the browser.
   */
  const editThisLoop = async () => {
    if (!selectedLoop) return;

    if (!selectedLoop.userAdded) {
      const ok = await confirm({
        title: `Save ${selectedLoop.title} as your own?`,
        message:
          "You get your own copy to rename and re-tempo. The original stays in the catalogue as it is.",
        confirmLabel: "Save a copy",
      });
      if (!ok) return;
    }

    hapticImpact(prefs.haptics, "light");
    saveAsMine(selectedLoop);
  };

  return (
    <Screen glows={["topLeftFar"]} className="items-center justify-start">
      <HeaderComponent />

      <View className="items-center justify-center flex-1 w-full px-instrument">
        {/* Which loop is loaded, and the two things you can do to it: swap it,
            or make it your own. */}
        <View className="items-center gap-1 mb-5">
          {/* <ControlLabel text="Select Loop" topic="selectLoop" /> */}
          {/* <Text className="text-white text-label font-spaceBold">Select Loop</Text> */}
          <View className="flex-row items-center gap-2">
            <PickerButton
              icon={Folder}
              label={selectedTitle ? selectedTitle : "SELECT LOOP"}
              onPress={() => router.push("/(loops)/sounds")}
              accessibilityLabel={
                selectedTitle
                  ? `Select loop, currently ${selectedTitle}`
                  : "Select a loop"
              }
              // Shrinks rather than pushing the button beside it off the row --
              // a long title ellipsises instead.
              style={{ maxWidth: 220, flexShrink: 1 }}
            />

            {/* The same thing the browser's long press offers, where you are
                actually listening to the loop -- which is where wanting your
                own version of it tends to occur, not while scrolling a list. */}
            {selectedLoop && (
              <TouchableOpacity
                onPress={editThisLoop}
                accessibilityLabel={
                  selectedLoop.userAdded
                    ? `Edit ${selectedLoop.title}`
                    : `Save ${selectedLoop.title} as my loop`
                }
                className="p-2 rounded-full bg-white/10"
              >
                <Edit2 size={SIZES.rowIcon} color={COLORS.white} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <BpmDial
          controls={controls}
          isPlaying={isPlaying}
          beat={currentBeat}
          isAccent={isAccent}
        />

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
        <View className="items-start w-full gap-1 mt-5">
          {/* <ControlLabel
            text="Subdivision"
            topic="loopSubdivision"
            className="mb-3"
          /> */}
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

      <BpmInputAccessory />
    </Screen>
  );
}
