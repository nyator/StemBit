import { useMemo } from "react";
import { Animated, Text, View } from "react-native";

import { COLORS } from "../../constants/theme";
import SetlistNav, { type NeighbourCue } from "./setlistNav";

// What a loop or pad cue is doing, in the block a stem song gets.
//
// Deliberately the same shape as TransportReadout, in the same place on the
// screen. Between songs you are not asking "is this one a loop cue" -- you are
// asking what is running, what is next, and where in the night you are. A cue
// that answered those in a different layout because of what happens to be
// inside it would make you read the screen instead of glance at it.
//
// What changes is the bar and the numbers, because a loop has no end to count
// down to. A song's bar crosses once and empties; a loop's fills and restarts
// on every pass, which is the more useful thing to watch anyway -- it is how
// you find the downbeat without counting.

type CueReadoutProps = {
  /** The cue's name on the night. */
  title: string;
  /** What it holds -- the loop's name, the pad's pack. */
  subtitle: string;
  /** Whether this cue is the one sounding. */
  isPlaying: boolean;
  /** 0–1 through the current loop pass, from LoopPlaybackContext. */
  phase: Animated.Value;
  /** The tempo it plays at, which for a loop cue is the cue's own or the loop's. */
  bpm?: number;
  /** "C maj", or undefined for a cue with no pad. */
  keyLabel?: string;
  /** Place in the running order, 1-based, and how long the set is. */
  position?: { index: number; total: number };
  prev?: NeighbourCue;
  next?: NeighbourCue;
};

export default function CueReadout({
  title,
  subtitle,
  isPlaying,
  phase,
  bpm,
  keyLabel,
  position,
  prev,
  next,
}: CueReadoutProps) {
  const width = useMemo(
    () =>
      phase.interpolate({
        inputRange: [0, 1],
        outputRange: ["0%", "100%"],
        // A tween can overshoot slightly at the top of a pass; without this the
        // fill would briefly run past the end of the bar.
        extrapolate: "clamp",
      }),
    [phase]
  );

  return (
    <View>
      <View className="flex-row items-center mb-1">
        <Text className="text-micro text-ink-muted font-spaceBold tracking-widest">
          NOW PLAYING
        </Text>
        {isPlaying && (
          <View
            className="ml-2 rounded-full"
            style={{ width: 6, height: 6, backgroundColor: COLORS.brand }}
          />
        )}
      </View>

      <Text className="text-heading text-white font-satoshiBold" numberOfLines={1}>
        {title}
      </Text>
      <Text
        className="mt-0.5 text-micro text-ink-muted font-satoshiRegular"
        numberOfLines={1}
      >
        {subtitle}
      </Text>

      {/* One pass of the loop. Empty rather than frozen mid-pass when nothing
          is sounding: a half-filled bar under a stopped transport claims the
          loop is somewhere, and it isn't anywhere. */}
      <View
        className="mt-3 overflow-hidden rounded-full"
        style={{ height: 3, backgroundColor: COLORS.track }}
      >
        {isPlaying && (
          <Animated.View
            style={{ width, height: "100%", backgroundColor: COLORS.brand }}
          />
        )}
      </View>

      <View className="flex-row items-start mt-3">
        {/* No elapsed or remaining here -- a loop has neither. Tempo takes the
            place they held, because it is the number you actually check on a
            loop cue and the one most likely to be wrong. */}
        <Cell label="TEMPO" value={bpm ? String(bpm) : "--"} />
        <Cell label="KEY" value={keyLabel ?? "--"} muted />

        {position && (
          <Cell
            label="IN SET"
            value={`${position.index} / ${position.total}`}
            muted
            align="end"
          />
        )}
      </View>

      <SetlistNav prev={prev} next={next} />
    </View>
  );
}

function Cell({
  label,
  value,
  muted,
  align,
}: {
  label: string;
  value: string;
  muted?: boolean;
  /** Pushed to the right edge, for the last cell in the row. */
  align?: "end";
}) {
  return (
    <View className={align === "end" ? "items-end flex-1" : "mr-4"}>
      <Text className="text-micro text-ink-muted font-spaceBold tracking-widest">
        {label}
      </Text>
      <Text
        className="mt-1 text-readout font-spaceBold"
        style={{
          color: muted ? COLORS.textMuted : COLORS.white,
          // Digits of equal width, so a counter doesn't shuffle its own
          // neighbours sideways every time it ticks.
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </View>
  );
}
