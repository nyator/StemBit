import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { BeatDots, BpmDial } from "./instrument";
import SegmentedControl from "./segmentedControl";
import { useBpmControl } from "../../hooks/useBpmControl";
import { COLORS } from "../../constants/theme";

// What each onboarding slide shows isn't stock art -- it's the real instrument,
// the same components the Loop and Metronome screens are built from, just
// demonstrating themselves rather than answering to a live engine. Nothing
// here posts to a WebView or touches playback; useBpmControl only ever
// manages the number in the field, and BeatDots/BpmDial are pure UI.
//
// pointerEvents="none" throughout: a control that looks real enough to tap
// but does nothing when tapped reads as broken, not as a preview.

/** A slow four-count, so the dial and dots read as "on" without being manic. */
const DEMO_BEAT_MS = 560;
const DEMO_BEAT_COUNT = 4;

function useDemoBeat() {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setBeat((b) => (b + 1) % DEMO_BEAT_COUNT),
      DEMO_BEAT_MS
    );
    return () => clearInterval(id);
  }, []);
  return beat;
}

export function LoopsPreview() {
  const [bpm, setBpm] = useState(96);
  const controls = useBpmControl({ bpm, setBpm, minBpm: 40, maxBpm: 240 });
  const beat = useDemoBeat();

  return (
    <View pointerEvents="none">
      <BpmDial controls={controls} isPlaying beat={beat} isAccent={beat === 0} />
    </View>
  );
}

const SUBDIVISION_DEMO = [
  { value: "1x", label: "1x" },
  { value: "2x", label: "2x" },
  { value: "3x", label: "3x" },
] as const;

export function ToolsPreview() {
  const beat = useDemoBeat();

  return (
    <View pointerEvents="none" className="items-center w-full gap-8">
      <BeatDots
        count={DEMO_BEAT_COUNT}
        currentBeat={beat}
        isPlaying
        isAccent={beat === 0}
      />
      <View className="w-full">
        <SegmentedControl
          variant="row"
          options={SUBDIVISION_DEMO}
          value="2x"
          onChange={() => {}}
        />
      </View>
    </View>
  );
}

const DEMO_CUES = [
  { title: "Call to worship", meta: "Worship · 4/4", live: true },
  { title: "Praise medley", meta: "Praise · 3/4", live: false },
  { title: "Altar call", meta: "Funk · 4/4", live: false },
];

export function SessionsPreview() {
  return (
    <View pointerEvents="none" className="w-full gap-2">
      {DEMO_CUES.map((cue) => (
        <View
          key={cue.title}
          className="flex-row items-center p-3 border rounded-lg bg-surface border-hairline"
        >
          <View
            className="items-center justify-center mr-3 rounded-full"
            style={{
              width: 8,
              height: 8,
              backgroundColor: cue.live ? COLORS.brand : COLORS.textFaint,
            }}
          />
          <View className="flex-1">
            <Text
              className="text-title text-white font-satoshiBold"
              numberOfLines={1}
            >
              {cue.title}
            </Text>
            <Text className="mt-1 text-label font-satoshiRegular text-ink-muted">
              {cue.meta}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
