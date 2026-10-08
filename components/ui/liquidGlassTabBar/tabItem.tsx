import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { COLORS, FONTS, SIZES } from "../../../constants/theme";
import type { IconComponent } from "../../icons";
import type { TabRect } from "./liquidIndicator";

const ACTIVE_COLOR = COLORS.white;
const INACTIVE_COLOR = "rgba(255,255,255,0.55)";

/** Fixed, so the pill has a stable rect to measure and labels never shift it. */
const TAB_WIDTH = 60;

// Quick in, springy out: the press should feel like it gives under the finger
// and then pushes back.
const PRESS_IN = { stiffness: 500, damping: 30, mass: 0.6 } as const;
const PRESS_OUT = { stiffness: 260, damping: 14, mass: 0.7 } as const;

type WindowRect = { x: number; y: number; width: number; height: number };

type TabItemProps = {
  label: string;
  icons: { active: IconComponent; inactive: IconComponent };
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  /** Local rect inside the bar's row -- where the indicator slides to. */
  onRowLayout: (rect: TabRect) => void;
  /** Rect on screen -- for the feature tour's spotlight. */
  onWindowLayout?: (rect: WindowRect) => void;
};

/**
 * One tab: icon over label, measuring itself for the sliding indicator.
 *
 * The active/inactive change is a crossfade rather than a swap. Both icons are
 * rendered stacked and their opacities follow one progress value, so the
 * outline-to-filled change and the colour change land together, on the UI
 * thread, instead of popping on the render that changes `isFocused`.
 */
export function TabItem({
  label,
  icons,
  isFocused,
  onPress,
  onLongPress,
  onRowLayout,
  onWindowLayout,
}: TabItemProps) {
  const ref = useRef<View>(null);
  const progress = useSharedValue(isFocused ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(isFocused ? 1 : 0, { duration: 220 });
  }, [isFocused]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    onRowLayout({ x, width });

    if (onWindowLayout) {
      ref.current?.measureInWindow((wx, wy, ww, wh) => {
        if (ww > 0 && wh > 0) onWindowLayout({ x: wx, y: wy, width: ww, height: wh });
      });
    }
  };

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const activeIconStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const inactiveIconStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [INACTIVE_COLOR, ACTIVE_COLOR]),
  }));

  const ActiveIcon = icons.active;
  const InactiveIcon = icons.inactive;

  return (
    <Pressable
      ref={ref}
      onLayout={handleLayout}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        scale.value = withSpring(0.88, PRESS_IN);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_OUT);
      }}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={styles.tab}
    >
      <Animated.View style={[styles.content, contentStyle]}>
        <View style={styles.iconSlot}>
          <Animated.View style={[StyleSheet.absoluteFill, inactiveIconStyle]}>
            <InactiveIcon size={SIZES.navIcon} color={INACTIVE_COLOR} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, activeIconStyle]}>
            <ActiveIcon size={SIZES.navIcon} color={ACTIVE_COLOR} />
          </Animated.View>
        </View>
        <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: {
    width: TAB_WIDTH,
    alignItems: "center",
    paddingVertical: 2
  },
  content: {
    alignItems: "center",
    gap: 2
  },
  iconSlot: {
    width: SIZES.navIcon,
    height: SIZES.navIcon,
  },
  // The text-nav tier: Space Grotesk Bold at 10pt.
  label: {
    fontFamily: FONTS.spaceBold,
    fontSize: 10,
  },
});
