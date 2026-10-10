import {
  useCallback,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useFeatureTour } from "../../../context/FeatureTourContext";
import { usePreferences } from "../../../context/PreferencesContext";
import { hapticImpact } from "../../../utils/haptics";
import { useStopAll } from "../../../hooks/useStopAll";
import { COLORS, RADII, SHADOWS, SIZES } from "../../../constants/theme";
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
import StopAllButton, { BAR_GLASS_TINT, STOP_GAP } from "./stopAllButton";
import { TAB_WIDTH, TabItem } from "./tabItem";

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

const TAB_GAP = 8;
const BAR_PADDING_X = 16;
/** The bar's height before it has been measured: 12 + a tab + 12. */
const ESTIMATED_BAR_HEIGHT = 68;
/** Stop all's size on a phone with room for it. */
const STOP_MAX = 56;
/** What's kept clear at either edge of the screen. */
const DOCK_GUTTER = 16;
// Out with a little overshoot, so it reads as something squeezed out of the
// bar; back in without one, settling under it.
const MORPH_OUT = { damping: 15, stiffness: 190, mass: 0.9 } as const;
const MORPH_IN = { damping: 22, stiffness: 220, mass: 0.9 } as const;

// Real Liquid Glass on iOS 26+; a dark blur everywhere else. A device's glass
// support can't change mid-session, so this is read once.
const HAS_LIQUID_GLASS = isLiquidGlassAvailable();
// The bar's glass bulges toward Stop all as it comes out (see bulgeStyle).
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

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
  const { stopAll, playingCount } = useStopAll();
  const { width: windowWidth } = useWindowDimensions();
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

  // The bar's measured size. The dock is drawn around it at a fixed size --
  // the bar and Stop all are positioned in it rather than laid out -- so it
  // has to be known; until the first layout, the size it is drawn to give.
  const [bar, setBar] = useState({
    width: state.routes.length * TAB_WIDTH + (state.routes.length - 1) * TAB_GAP + BAR_PADDING_X * 2,
    height: ESTIMATED_BAR_HEIGHT,
  });
  const onBarLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBar((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  // Stop all, morphing out of the bar while anything plays. It takes what's
  // left of the screen width, up to a stage-sized 56 and never under a touch
  // target's 44. The bar keeps its spacing: the dock simply re-centres on the
  // pair, so the tabs (and the pill riding them) never shuffle.
  const showStop = playingCount > 0;
  const stopSize = Math.max(
    SIZES.minTouch,
    Math.min(STOP_MAX, windowWidth - DOCK_GUTTER * 2 - bar.width - STOP_GAP)
  );

  // 0 tucked under the bar, 1 out beside it. Mounted for the way out as well
  // as while showing, and unmounted only once it's back under the bar.
  const progress = useSharedValue(showStop ? 1 : 0);
  const [stopMounted, setStopMounted] = useState(showStop);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (showStop) {
      setStopMounted(true);
      progress.value = reduceMotion ? 1 : withSpring(1, MORPH_OUT);
    } else {
      const done = (finished?: boolean) => {
        "worklet";
        if (finished) runOnJS(setStopMounted)(false);
      };
      if (reduceMotion) {
        progress.value = 0;
        setStopMounted(false);
      } else {
        progress.value = withSpring(0, MORPH_IN, done);
      }
    }
  }, [showStop, reduceMotion, progress]);

  // The pair's width, which is what the dock centres: the bar alone at rest,
  // bar + gap + button out. Animating it is what slides the bar aside.
  const pairStyle = useAnimatedStyle(() => ({
    width: bar.width + progress.value * (STOP_GAP + stopSize),
  }));

  // The bar's half of the morph. Its glass pushes out to the right, the
  // button grows out of the tip, and the bulge snaps back -- pinching the
  // button off, rather than the button simply sliding out from behind. Run
  // backwards it is the bar reaching out and swallowing it. Clamped, so the
  // spring's overshoot past 1 doesn't push a second bulge out.
  const bulgeReach = STOP_GAP + stopSize * 0.5;
  const bulgeStyle = useAnimatedStyle(() => ({
    width:
      bar.width +
      interpolate(
        progress.value,
        [0, 0.4, 0.75, 1],
        [0, bulgeReach, 0, 0],
        Extrapolation.CLAMP
      ),
  }));
  // The same reach for the flat fallback's bulge, which starts at the bar's
  // right cap rather than its left edge.
  const fallbackBulgeStyle = useAnimatedStyle(() => ({
    width:
      bar.height +
      interpolate(
        progress.value,
        [0, 0.4, 0.75, 1],
        [0, bulgeReach, 0, 0],
        Extrapolation.CLAMP
      ),
  }));

  const onStopAll = () => {
    hapticImpact(prefs.haptics, "heavy");
    stopAll();
  };

  const stopButton = (part: "glass" | "face" | "whole") =>
    stopMounted && (
      <StopAllButton
        part={part}
        progress={progress}
        barWidth={bar.width}
        barHeight={bar.height}
        size={stopSize}
        onPress={onStopAll}
      />
    );

  return (
    <View pointerEvents="box-none" style={styles.dock}>
      <Animated.View style={[{ height: bar.height }, pairStyle]}>
        {HAS_LIQUID_GLASS ? (
          <>
            {/* Plain siblings, no GlassContainer: the morph is the bulge
                below, not the system's merge, and a container positioned its
                glass apart from Stop all's square drawn outside it. */}
            <AnimatedGlassView
              glassEffectStyle="regular"
              tintColor={BAR_GLASS_TINT}
              style={[
                {
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: bar.height,
                  borderRadius: RADII.nav,
                },
                bulgeStyle,
              ]}
            />
            {stopButton("glass")}
            {/* The row sits over the glass in a plain view -- not inside it.
                Glass nested in another glass view's content is flattened by
                the system, so the active-tab pill (itself a GlassView) would
                render as nothing if it lived in there. */}
            <View
              onLayout={onBarLayout}
              style={[styles.bar, styles.pinned, { overflow: "visible" }]}
            >
              {row}
            </View>
            {/* Stop all's square and touch, over its glass for the same
                reason the row is over the bar's. */}
            {stopButton("face")}
          </>
        ) : (
          <>
            {/* Behind the bar: the bulge, then the button growing out of it.
                The bulge covers only the bar's right cap and what's past it,
                so it doesn't darken the bar it's drawn under. */}
            <Animated.View
              style={[
                {
                  position: "absolute",
                  left: bar.width - bar.height,
                  top: 0,
                  height: bar.height,
                  borderRadius: RADII.nav,
                  backgroundColor: COLORS.surfaceGlass,
                  borderWidth: 1,
                  borderColor: COLORS.borderGlass,
                },
                fallbackBulgeStyle,
              ]}
            />
            {stopButton("whole")}
            <View style={[styles.pinned, { borderRadius: RADII.nav }, SHADOWS.float]}>
              <BlurView
                intensity={40}
                tint="dark"
                blurMethod={Platform.OS === "android" ? "none" : undefined}
                onLayout={onBarLayout}
                style={[styles.bar, styles.fallbackBar]}
              >
                {row}
              </BlurView>
            </View>
          </>
        )}
      </Animated.View>
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
    gap: TAB_GAP,
    paddingHorizontal: BAR_PADDING_X,
    paddingVertical: 12,
    borderRadius: RADII.nav,
    overflow: "hidden",
  },
  // At the pair's left edge; the pair's width grows to its right.
  pinned: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  fallbackBar: {
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: COLORS.surfaceGlass,
  },
});
