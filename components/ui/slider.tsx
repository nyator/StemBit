import NativeSlider from "@react-native-community/slider";
import { useRef, useState } from "react";
import { View, type GestureResponderEvent } from "react-native";

import { COLORS, CONTROL } from "../../constants/theme";
import { useDoubleTap } from "../../hooks/useDoubleTap";

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

// Double tap is timed off the capture phase of the responder system rather than
// from the widget's own callbacks or from a gesture handler over the top.
//
// Not the widget's callbacks, because the platforms disagree about what a tap
// on a slider is: Android jumps the thumb to it, iOS ignores it entirely.
//
// Not a gesture handler, because the widget takes the touch before an ancestor
// handler can claim it -- which is the whole point of using the real control,
// and is why wrapping this in one silently did nothing. `Capture` runs before
// the target is chosen, so it sees every touch-down; returning false from it
// declines the gesture, and the slider goes on dragging as if nothing looked.
//
// What it costs: on Android the tap that resets the control has already moved
// it, and that move lands at about the same moment. So for a beat afterwards
// the widget's own events are ignored, and it is remounted, which redraws the
// thumb from the value React holds instead of leaving it where the tap landed.
const RESET_SETTLE_MS = 250;

type SliderProps = {
  /** Current position, within min–max. */
  value: number;
  onChange: (value: number) => void;
  /** Fires once when the drag ends -- use this to persist, not onChange. */
  onComplete?: (value: number) => void;
  /**
   * Where a double tap puts the thumb, persisted through `onComplete` the same
   * way a drag would be. Without one, a double tap is just two taps.
   */
  defaultValue?: number;
  /**
   * Top of the throw. 1 is full scale for most things; the metronome runs to 2
   * because its click has to cut through a band rather than sit in a mix.
   */
  max?: number;
  /** Fixed width, or "fill" to take whatever the row has left. */
  width?: number | "fill";
  /** Announced by screen readers, e.g. "Metronome volume". */
  accessibilityLabel?: string;
};

export default function Slider({
  value,
  onChange,
  onComplete,
  defaultValue,
  max = 1,
  width = TRACK_WIDTH,
  accessibilityLabel,
}: SliderProps) {
  const registerTap = useDoubleTap();
  const resetAtRef = useRef(0);
  // Bumped on reset purely to change the widget's key and remount it.
  const [resetCount, setResetCount] = useState(0);
  const isSettling = () => Date.now() - resetAtRef.current < RESET_SETTLE_MS;

  const handleTouchCapture = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    if (defaultValue != null && registerTap({ x: pageX, y: pageY })) {
      resetAtRef.current = Date.now();
      setResetCount((count) => count + 1);
      onChange(defaultValue);
      onComplete?.(defaultValue);
    }
    return false;
  };

  const fill = width === "fill";

  return (
    <View
      style={fill ? { flex: 1 } : { width }}
      onStartShouldSetResponderCapture={handleTouchCapture}
    >
      <NativeSlider
        key={resetCount}
        value={value}
        onValueChange={(next) => {
          if (!isSettling()) onChange(next);
        }}
        onSlidingComplete={(next) => {
          if (!isSettling()) onComplete?.(next);
        }}
        minimumValue={0}
        maximumValue={max}
        minimumTrackTintColor={CONTROL.active}
        maximumTrackTintColor={CONTROL.track}
        thumbTintColor={COLORS.white}
        accessibilityLabel={accessibilityLabel}
        // iOS insets the track inside the component box; stretching it
        // vertically keeps the width usable without clipping the thumb.
        style={{ width: fill ? "100%" : width, height: 32 }}
      />
    </View>
  );
}
