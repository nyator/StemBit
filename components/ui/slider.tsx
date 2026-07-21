import NativeSlider from "@react-native-community/slider";
import { View } from "react-native";

import { COLORS, CONTROL } from "../../constants/theme";

// Horizontal volume slider from the Audio Output / Volume screen (node 117:810).
//
// Wraps @react-native-community/slider so the control is the real platform
// widget -- it gets native drag physics, accessibility, and the OS's own
// pointer handling for free, which a hand-rolled PanResponder only approximates.
//
// Figma: a 140x6 track at #2D3332 filled to the current value in #2563EB, with
// a white thumb. Track thickness and thumb size are set by the platform, so
// those two dimensions are close rather than exact; the colours and the fixed
// 140pt width match the design.
export const TRACK_WIDTH = 140;

type SliderProps = {
  /** Current position, 0–1. */
  value: number;
  onChange: (value: number) => void;
  width?: number;
  /** Announced by screen readers, e.g. "Metronome volume". */
  accessibilityLabel?: string;
};

export default function Slider({
  value,
  onChange,
  width = TRACK_WIDTH,
  accessibilityLabel,
}: SliderProps) {
  return (
    <View style={{ width }}>
      <NativeSlider
        value={value}
        onValueChange={onChange}
        minimumValue={0}
        maximumValue={1}
        minimumTrackTintColor={CONTROL.active}
        maximumTrackTintColor={CONTROL.track}
        thumbTintColor={COLORS.white}
        accessibilityLabel={accessibilityLabel}
        // iOS insets the track inside the component box; stretching it
        // vertically keeps the 140pt width usable without clipping the thumb.
        style={{ width, height: 32 }}
      />
    </View>
  );
}
