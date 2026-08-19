import { useMemo, useRef } from "react";
import {
  View,
  PanResponder,
  type AccessibilityActionInfo,
} from "react-native";

import { COLORS, CONTROL } from "../../constants/theme";
import { useDoubleTap } from "../../hooks/useDoubleTap";

// A console fader: vertical throw, travelling cap, scale markings beside the
// track.
//
// Not @react-native-community/slider rotated 90°, which is the usual shortcut.
// A rotated slider keeps its horizontal hit box, so the touch target ends up at
// right angles to the thing you can see, and the platform thumb can't be made
// to look like a fader cap. Drawing it means the grip, the travel and the
// scale are all the real geometry.
const FADER_HEIGHT = 132;
const CAP_HEIGHT = 20;
const CAP_WIDTH = 34;
const TRACK_WIDTH = 5;
// Where the scale is marked, top (unity) to bottom. Evenly spaced rather than
// logarithmic: the value driving them is a linear 0–1 mix level, and ticks
// that don't match the numbers they sit next to would be decoration pretending
// to be a scale.
const TICKS = [0, 0.25, 0.5, 0.75, 1];

const TRAVEL = FADER_HEIGHT - CAP_HEIGHT;

// A screen reader can't drag, so the fader publishes the two actions that let
// one be set without a drag. Without these the control is readable but not
// operable -- "adjustable" describes it, it doesn't do anything.
export const ADJUST_ACTIONS: AccessibilityActionInfo[] = [
  { name: "increment" },
  { name: "decrement" },
];
// How far one nudge moves it. 5% of the throw, which is the smallest step that
// changes the number the fader announces by a whole point.
const NUDGE = 0.05;

type VerticalFaderProps = {
  /** Position, 0 (bottom) to 1 (top). */
  value: number;
  onChange: (value: number) => void;
  /** Fires once when the grip is released — persist here, not on every move. */
  onComplete?: (value: number) => void;
  accessibilityLabel?: string;
  /**
   * Where a double tap puts the fader. Without one, a double tap is just two
   * taps and the second wins, which is what a fader with no meaningful home
   * position should do.
   */
  defaultValue?: number;
};

export default function VerticalFader({
  value,
  onChange,
  onComplete,
  defaultValue,
  accessibilityLabel,
}: VerticalFaderProps) {
  // The responder is built once, so it reads the live callbacks and the latest
  // dragged value through refs rather than closing over a stale render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const latestRef = useRef(value);
  latestRef.current = value;
  const defaultRef = useRef(defaultValue);
  defaultRef.current = defaultValue;
  // Latched for the rest of the gesture once a double tap has reset the fader,
  // so a finger that lingers and slides doesn't drag it straight back off the
  // value it was just asked to return to.
  const resetRef = useRef(false);
  const registerTap = useDoubleTap();

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          const home = defaultRef.current;
          if (registerTap({ x: locationX, y: locationY }) && home != null) {
            resetRef.current = true;
            latestRef.current = home;
            onChangeRef.current(home);
            return;
          }
          resetRef.current = false;
          handleTouch(locationY);
        },
        onPanResponderMove: (event) => {
          if (resetRef.current) return;
          handleTouch(event.nativeEvent.locationY);
        },
        onPanResponderRelease: () => {
          onCompleteRef.current?.(latestRef.current);
        },
        onPanResponderTerminate: () => {
          onCompleteRef.current?.(latestRef.current);
        },
      }),
    []
  );

  // An accessibility nudge has no release to wait for, so unlike a drag it
  // commits as it goes.
  const nudge = (delta: number) => {
    const next = Math.max(0, Math.min(1, latestRef.current + delta));
    latestRef.current = next;
    onChangeRef.current(next);
    onCompleteRef.current?.(next);
  };

  // Touch y is measured to the middle of the cap, so the grip lands under the
  // finger instead of jumping by half its height on the first touch.
  const handleTouch = (locationY: number) => {
    const offset = Math.max(0, Math.min(TRAVEL, locationY - CAP_HEIGHT / 2));
    const next = 1 - offset / TRAVEL;
    latestRef.current = next;
    onChangeRef.current(next);
  };

  const capOffset = (1 - value) * TRAVEL;
  const filledHeight = value * TRAVEL;

  return (
    <View
      {...panResponder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      accessibilityActions={ADJUST_ACTIONS}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === "increment") nudge(NUDGE);
        if (nativeEvent.actionName === "decrement") nudge(-NUDGE);
      }}
      style={{
        height: FADER_HEIGHT,
        width: CAP_WIDTH + 22,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Scale markings, offset to the left of the track. */}
      {TICKS.map((tick) => (
        <View
          key={tick}
          pointerEvents="none"
          style={{
            position: "absolute",
            top: CAP_HEIGHT / 2 + (1 - tick) * TRAVEL,
            left: 0,
            width: tick === 1 || tick === 0 ? 10 : 6,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.25)",
          }}
        />
      ))}

      {/* Track, and the travelled portion filled behind the cap. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: CAP_HEIGHT / 2,
          height: TRAVEL,
          width: TRACK_WIDTH,
          borderRadius: TRACK_WIDTH / 2,
          backgroundColor: COLORS.track,
          overflow: "hidden",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            height: filledHeight,
            width: "100%",
            backgroundColor: CONTROL.active,
          }}
        />
      </View>

      {/* Cap, with the centre line a console fader is read against. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: capOffset,
          width: CAP_WIDTH,
          height: CAP_HEIGHT,
          borderRadius: 4,
          // The same near-white every other control's thumb uses -- a fader cap
          // and a switch knob are the same object in two orientations.
          backgroundColor: CONTROL.knob,
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.35)",
          alignItems: "center",
          justifyContent: "center",
          // Lifts the cap off the track the way a real one sits proud.
          shadowColor: COLORS.black,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.45,
          shadowRadius: 3,
          elevation: 4,
        }}
      >
        <View
          style={{
            width: CAP_WIDTH - 10,
            height: 2,
            borderRadius: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        />
      </View>
    </View>
  );
}
