import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Extrapolation,
} from "react-native-reanimated";

import { COLORS } from "../../../constants/theme";

const HAS_LIQUID_GLASS = isLiquidGlassAvailable();

const GLASS_TINT = "rgba(225,225,225,0.1)";

export type TabRect = { x: number; width: number };

const INSET_X = 6;
const INSET_Y = 6;

const LEADING_EDGE = { stiffness: 320, damping: 26, mass: 0.8 } as const;
const TRAILING_EDGE = { stiffness: 160, damping: 20, mass: 1 } as const;

/** How much the pill thins while stretched, as a fraction of its height. */
const MAX_SQUASH = 0.22;

export function LiquidIndicator({ target }: { target: TabRect | null }) {
  const left = useSharedValue(0);
  const right = useSharedValue(0);
  const restWidth = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!target) return;
    const nextLeft = target.x - INSET_X;
    const nextRight = target.x + target.width + INSET_X;
    restWidth.value = nextRight - nextLeft;

    // First measurement: appear in place rather than flying in from x = 0.
    if (opacity.value === 0) {
      left.value = nextLeft;
      right.value = nextRight;
      opacity.value = withTiming(1, { duration: 180 });
      return;
    }

    const movingRight = nextLeft > left.value;
    left.value = withSpring(nextLeft, movingRight ? TRAILING_EDGE : LEADING_EDGE);
    right.value = withSpring(nextRight, movingRight ? LEADING_EDGE : TRAILING_EDGE);
  }, [target?.x, target?.width]);

  const animatedStyle = useAnimatedStyle(() => {
    const width = Math.max(right.value - left.value, 0);
    // 0 at rest, rising as the pill spans more than one tab's width.
    const stretch = width / restWidth.value - 1;
    const scaleY = interpolate(
      stretch,
      [0, 1.5],
      [1, 1 - MAX_SQUASH],
      Extrapolation.CLAMP
    );
    return {
      width,
      opacity: opacity.value,
      transform: [{ translateX: left.value }, { scaleY }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pill, !HAS_LIQUID_GLASS && styles.pillGlow, animatedStyle]}
    >
      {HAS_LIQUID_GLASS ? (
    
        <GlassView glassEffectStyle="regular" tintColor={GLASS_TINT} style={styles.body} />
      ) : (
        <Animated.View style={[styles.body, styles.fallbackBody]} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    left: 0,
    top: INSET_Y,
    bottom: INSET_Y,
    borderRadius: 999,
  },

  pillGlow: {
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  body: {
    flex: 1,
    borderRadius: 999,
    overflow: "hidden",
  },
  fallbackBody: {
    backgroundColor: "rgba(255,255,255,0.10)",
    // borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
});
