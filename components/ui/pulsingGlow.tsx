import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import AmbientGlow from "./ambientGlow";

// The corner glow, breathing -- same beat-pulse identity on the launch gate
// and onboarding, so the two read as one continuous entrance rather than two
// screens that happen to share a background effect.

/** One pulse cycle -- a resting pace, not a metronome tick. */
const PULSE_MS = 900;

export default function PulsingGlow({ style }: { style: ViewStyle }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.7 + pulse.value * 0.3,
    transform: [{ scale: 1 + pulse.value * 0.08 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute" }, style, glowStyle]}
    >
      <AmbientGlow />
    </Animated.View>
  );
}
