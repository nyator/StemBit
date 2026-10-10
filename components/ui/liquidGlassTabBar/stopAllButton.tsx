import { TouchableOpacity, View } from "react-native";
import { GlassView } from "expo-glass-effect";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import { COLORS } from "../../../constants/theme";

// Stop everything, docked beside the tab bar while anything is sounding.
//
// Built for a stage rather than a desk:
//   - Where the thumb already is, and always in the same place: the tab bar
//     never moves and is on every tab, so finding this is muscle memory, not a
//     search. And it sits in the dock the screens already lay out around, so
//     it never covers a control you need mid-song.
//   - The bar's glass, tinted red to an extent: it says "stop" at a glance but
//     still reads as part of the bar rather than an alert stuck to it.
//   - Fires on touch-down, with no confirmation: a stop that waits for the
//     finger to lift, or asks "are you sure?", is a stop that comes late.
//   - A heavy haptic (the tab bar fires it), so it can be felt to have worked.
//
// It morphs out of the bar (see bulgeStyle in the tab bar for the bar's half
// of that). At progress 0 it is nothing, at the bar's right end; it grows out
// of the bulge the bar pushes towards it and is pinched off as that retracts.
//
// Never faded: UIKit skips a glass effect it first meets at low opacity and
// never installs it again (see expo-glass-effect's GlassView). Scale does the
// hiding instead -- to zero, so nothing shows through the bar's glass.

const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

/** How far the button sits clear of the bar. */
export const STOP_GAP = 8;

/** The bar's tint. */
export const BAR_GLASS_TINT = COLORS.surfaceGlass;
/**
 * Red, but only to an extent: enough to say "stop" at a glance, thin enough
 * that it's still the bar's glass and not an alert stuck to it. The fallback's
 * fill is the same red, flat.
 */
const STOP_GLASS_TINT = "rgba(239,68,68,0.42)";
const STOP_FALLBACK_FILL = "rgba(239,68,68,0.32)";
const STOP_FALLBACK_EDGE = "rgba(239,68,68,0.55)";

/**
 * On Liquid Glass the button is drawn in two parts, as the bar is: `glass`,
 * and `face` -- the stop square and the touch -- over it as a sibling, never
 * inside. Siblings in the same parent, so they share one frame exactly. Content placed inside a glass view doesn't render
 * reliably (the square vanished under it), which is why the bar's own icons
 * sit over its glass rather than in it. Both parts share one motion, so they
 * move as one. Without glass there's one part, `whole`.
 */
export default function StopAllButton({
  part,
  progress,
  barWidth,
  barHeight,
  size,
  onPress,
}: {
  part: "glass" | "face" | "whole";
  progress: SharedValue<number>;
  barWidth: number;
  barHeight: number;
  size: number;
  onPress: () => void;
}) {
  const motion = useAnimatedStyle(() => ({
    // From the bar's right end -- its centre on the bar's edge -- out to its
    // place beside it.
    left: interpolate(
      progress.value,
      [0, 1],
      [barWidth - size / 2, barWidth + STOP_GAP]
    ),
    transform: [
      {
        // Nothing at rest; most of its size by the time it clears the bulge,
        // so it is the bulge's tip that becomes the button.
        scale: interpolate(progress.value, [0, 0.45, 1], [0, 0.8, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  const frame = {
    position: "absolute" as const,
    top: (barHeight - size) / 2,
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  // The stop square, drawn rather than taken from the icon set: the Stop icon
  // there is gradient artwork for the transport, not a glyph for a button.
  const square = size * 0.5;
  const content = (
    <TouchableOpacity
      onPressIn={onPress}
      activeOpacity={0.6}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Stop everything that's playing"
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: square,
          height: square,
          borderRadius: square * 0.2,
          backgroundColor: COLORS.white,
        }}
      />
    </TouchableOpacity>
  );

  if (part === "glass") {
    return (
      <AnimatedGlassView
        glassEffectStyle="regular"
        tintColor={STOP_GLASS_TINT}
        style={[frame, motion]}
      />
    );
  }

  if (part === "face") {
    return <Animated.View style={[frame, motion]}>{content}</Animated.View>;
  }

  // The fallback bar's own fill and edge.
  return (
    <Animated.View
      style={[
        frame,
        {
          backgroundColor: STOP_FALLBACK_FILL,
          borderWidth: 1,
          borderColor: STOP_FALLBACK_EDGE,
        },
        motion,
      ]}
    >
      {content}
    </Animated.View>
  );
}
