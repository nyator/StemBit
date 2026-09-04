import { View } from "react-native";
import Animated, { clamp, useAnimatedStyle, type SharedValue } from "react-native-reanimated";

// A segment per slide, filling left to right as the carousel passes it --
// replaces the dot indicator that used to sit at the bottom. Each segment
// fills continuously with the drag rather than snapping full only once a
// page settles, the same "no separate trigger" idea the slides themselves
// use for their own motion.

export default function OnboardingProgressBar({
  count,
  scrollX,
  pageWidth,
}: {
  count: number;
  /** The carousel's raw scroll offset, in px. */
  scrollX: SharedValue<number>;
  /** One page's width, to turn that offset into a page position. */
  pageWidth: number;
}) {
  return (
    <View className="flex-row px-8 gap-1.5">
      {Array.from({ length: count }).map((_, index) => (
        <Segment key={index} index={index} scrollX={scrollX} pageWidth={pageWidth} />
      ))}
    </View>
  );
}

function Segment({
  index,
  scrollX,
  pageWidth,
}: {
  index: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
}) {
  const fillStyle = useAnimatedStyle(() => {
    const progress = pageWidth > 0 ? scrollX.value / pageWidth : 0;
    const fill = clamp(progress - index, 0, 1);
    return { width: `${fill * 100}%` };
  });

  return (
    <View
      className="flex-1 overflow-hidden bg-white/15"
      style={{ height: 4, borderRadius: 2 }}
    >
      <Animated.View
        className="h-full bg-white"
        style={[{ borderRadius: 2 }, fillStyle]}
      />
    </View>
  );
}
