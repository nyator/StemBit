import { useCallback, useState, type ComponentProps, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { useFeatureTour } from "../../../context/FeatureTourContext";
import { usePreferences } from "../../../context/PreferencesContext";
import { hapticImpact } from "../../../utils/haptics";
import { COLORS, RADII, SHADOWS } from "../../../constants/theme";
import {
  PlayCircleOutline,
  PlayCircle,
  Pad,
  PadFill,
  MetronomeFill,
  MetronomeOutline,
  SortPad,
  SortPadFill,
  type IconComponent,
} from "../../icons";
import { LiquidIndicator, type TabRect } from "./liquidIndicator";
import { TabItem } from "./tabItem";

const TAB_ICONS: Record<string, { active: IconComponent; inactive: IconComponent }> = {
  loop: { active: PlayCircle, inactive: PlayCircleOutline },
  pad: { active: PadFill, inactive: Pad },
  metro: { active: MetronomeFill, inactive: MetronomeOutline },
  session: { active: SortPadFill, inactive: SortPad },
};

const TAB_LABELS: Record<string, string> = {
  loop: "BITS",
  pad: "PAD",
  metro: "CLICK",
  session: "SET",
};

// Real Liquid Glass on iOS 26+; a dark blur everywhere else. A device's glass
// support can't change mid-session, so this is read once.
const HAS_LIQUID_GLASS = isLiquidGlassAvailable();

/** Exactly what expo-router's <Tabs tabBar> hands a custom bar. */
type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

/**
 * The floating tab bar, with a liquid-glass pill that slides to the active tab.
 *
 * The bar itself is unchanged from the design -- a glass capsule floating over
 * the screen. What's added is the indicator: each tab measures its own rect,
 * and the pill springs between them (see LiquidIndicator for the stretch).
 *
 * Tab rects live in state, but they only change on layout -- mount, rotation,
 * font scaling -- so switching tabs never re-renders anything but the tabs'
 * own focus, and the motion itself runs entirely on the UI thread.
 */
export default function LiquidGlassTabBar({ state, navigation }: TabBarProps) {
  const tour = useFeatureTour();
  const { prefs } = usePreferences();
  const [rects, setRects] = useState<Record<string, TabRect>>({});

  const recordRect = useCallback((key: string, rect: TabRect) => {
    setRects((prev) => {
      const old = prev[key];
      if (old && old.x === rect.x && old.width === rect.width) return prev;
      return { ...prev, [key]: rect };
    });
  }, []);

  const activeKey = state.routes[state.index]?.key;
  const activeRect = activeKey ? rects[activeKey] ?? null : null;

  const tabs = state.routes.map((route, index) => {
    const isFocused = state.index === index;

    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        hapticImpact(prefs.haptics, "light");
        navigation.navigate(route.name);
      }
    };

    const onLongPress = () => {
      navigation.emit({ type: "tabLongPress", target: route.key });
    };

    return (
      <TabItem
        key={route.key}
        label={TAB_LABELS[route.name] ?? route.name}
        icons={TAB_ICONS[route.name] ?? TAB_ICONS.loop}
        isFocused={isFocused}
        onPress={onPress}
        onLongPress={onLongPress}
        onRowLayout={(rect) => recordRect(route.key, rect)}
        onWindowLayout={(rect) => tour?.registerTarget(route.name, rect)}
      />
    );
  });

  // The pill goes first so it paints behind the icons and labels.
  const row: ReactNode = (
    <>
      <LiquidIndicator target={activeRect} />
      {tabs}
    </>
  );

  return (
    <View pointerEvents="box-none" style={styles.dock}>
      {HAS_LIQUID_GLASS ? (
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          tintColor={COLORS.surfaceGlass}
          style={styles.bar}
        >
          {row}
        </GlassView>
      ) : (
        <View style={[{ borderRadius: RADII.nav }, SHADOWS.float]}>
          <BlurView
            intensity={40}
            tint="dark"
            blurMethod={Platform.OS === "android" ? "none" : undefined}
            style={[styles.bar, styles.fallbackBar]}
          >
            {row}
          </BlurView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 8,
  },
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    // A little air between tabs, so the pill has room to reach past each one
    // without touching its neighbour's icon.
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: RADII.nav,
    overflow: "hidden",
  },
  fallbackBar: {
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: COLORS.surfaceGlass,
  },
});
