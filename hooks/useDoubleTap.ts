import { useCallback, useRef } from "react";

// Two taps this close together count as one double tap. 300ms is what both
// platforms use for their own double-tap recognisers, so it matches what a
// finger already expects rather than being a number picked here.
const DOUBLE_TAP_MS = 300;
// A double tap is two taps in one place, not a quick reposition. If the second
// landed further than this from the first the user was aiming somewhere, and
// the control should go there instead of resetting.
const DOUBLE_TAP_SLOP = 28;

type TapPoint = { x: number; y: number };

// Double-tap detection for controls that own their own touch handling.
//
// Separate from a `TouchableOpacity`/`Pressable` because none of the things
// that need this are pressable: a fader is dragged, and wrapping one in a
// press target would mean deciding between the drag and the tap on the first
// touch, before there is any way to know which it is. Instead the control
// calls `registerTap` from the gesture it already has, on touch-down, and gets
// back whether that touch completed a double tap -- so a drag stays a drag and
// only the second of two quick stationary taps means anything extra.
//
// The point is optional: controls whose whole hit box is the same target (the
// horizontal setting slider) don't need the slop check, only the ones where
// position is the value (faders, the pan bar).
export function useDoubleTap() {
  const lastRef = useRef<{ time: number; point?: TapPoint } | null>(null);

  return useCallback((point?: TapPoint) => {
    const now = Date.now();
    const previous = lastRef.current;
    const inTime = previous != null && now - previous.time < DOUBLE_TAP_MS;
    const inPlace =
      point == null ||
      previous?.point == null ||
      (Math.abs(point.x - previous.point.x) < DOUBLE_TAP_SLOP &&
        Math.abs(point.y - previous.point.y) < DOUBLE_TAP_SLOP);

    if (inTime && inPlace) {
      // Cleared, so a third tap starts a fresh pair instead of resetting again.
      lastRef.current = null;
      return true;
    }

    lastRef.current = { time: now, point };
    return false;
  }, []);
}
