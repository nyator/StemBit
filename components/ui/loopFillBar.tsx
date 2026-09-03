import { Animated, View } from "react-native";

import { COLORS } from "../../constants/theme";

// The live cue's row, filling in time with the loop and starting again on every
// pass -- so a running song reads as running from across a stage, in the dark,
// without reading any text.
//
// Two layers, because one thing has to work at two distances. The wash across
// the whole row is the "this one is playing" signal, readable from anywhere in
// the room. The solid bar along the bottom edge is the position, readable when
// you actually look down at the phone. Both move together off the same value.
//
// Driven by the engine's reported playhead rather than a timer. A loop's length
// is only known inside the WebView (a bundled loop's region is found there by
// silence trim and a snap to whole beats), so anything timed in JS would drift
// against the audio -- which, for something that claims to show loop position,
// is the one unacceptable failure.
//
// Holds no state and runs no effects. The phase arrives as an Animated.Value
// already smoothed and wrap-corrected by LoopPlaybackContext, so this renders
// once and animates with no React involvement at all.

/** Thick enough to read at a glance from standing height. */
const BAR_HEIGHT = 6;

// Cancels the padding of the row this sits in (p-3 in the setlist, 12pt).
//
// Unlike web CSS, Yoga positions absolutely positioned children against the
// parent's CONTENT box, so `left: 0` starts inside the padding rather than at
// the row's edge -- the fill stopped 12pt short at both ends and never looked
// like it reached the end of the row. Pulling the insets out by the same amount
// puts it edge to edge; the row's overflow-hidden clips it to the corners.
const ROW_PADDING = 12;

type LoopFillBarProps = {
  /** 0–1 through the current pass, from LoopPlaybackContext. */
  phase: Animated.Value;
};

export default function LoopFillBar({ phase }: LoopFillBarProps) {
  const width = phase.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
    // A tween can overshoot slightly at the top of a pass; without this the
    // fill would briefly run past the row's edge.
    extrapolate: "clamp",
  });

  return (
    <View
      // Decorative, and it sits under the row's own controls.
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: "absolute",
        left: -ROW_PADDING,
        right: -ROW_PADDING,
        top: -ROW_PADDING,
        bottom: -ROW_PADDING,
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width,
          backgroundColor: COLORS.glow,
          // opacity: 0.14,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: BAR_HEIGHT,
          backgroundColor: COLORS.progressTrack,
        }}
      >
        <Animated.View
          style={{
            height: "100%",
            width,
            backgroundColor: COLORS.brandFrom,
          }}
        />
      </View>
    </View>
  );
}
