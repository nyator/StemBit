import { useRef, type ComponentProps } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { useFeatureTour } from "../../context/FeatureTourContext";
import { COLORS, RADII, SHADOWS, SIZES } from "../../constants/theme";
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
} from "../icons";

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

const HAS_LIQUID_GLASS = isLiquidGlassAvailable();

type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

export default function FloatingTabBar({ state, navigation }: TabBarProps) {
  const tour = useFeatureTour();
  const tabRefs = useRef<Record<string, View | null>>({});

  const tabs = state.routes.map((route, index) => {
    const isFocused = state.index === index;
    const icons = TAB_ICONS[route.name] ?? TAB_ICONS.loop;
    const Icon = isFocused ? icons.active : icons.inactive;
    const label = TAB_LABELS[route.name] ?? route.name;

    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return (
      <Pressable
        key={route.key}
        ref={(node) => {
          tabRefs.current[route.name] = node;
        }}
        onLayout={() => {
          tabRefs.current[route.name]?.measureInWindow(
            (x, y, width, height) => {
              if (width > 0 && height > 0) {
                tour?.registerTarget(route.name, { x, y, width, height });
              }
            }
          );
        }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        className="items-center"
        style={{ width: 60, gap: 4 }}
      >
        <Icon size={SIZES.navIcon} color={COLORS.white} />
        <Text
          className="text-nav font-spaceBold"
          style={{ color: COLORS.white }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    );
  });

  return (
    <View
      pointerEvents="box-none"
      style={{
        height: 150,
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 8,
      }}
    >
      {HAS_LIQUID_GLASS ? (
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          tintColor={COLORS.surfaceGlass}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: RADII.nav,
            overflow: "hidden",
          }}
        >
          {tabs}
        </GlassView>
      ) : (
        <View style={[{ borderRadius: RADII.nav }, SHADOWS.float]}>
          <BlurView
            intensity={40}
            tint="dark"
            blurMethod={Platform.OS === "android" ? "none" : undefined}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: RADII.nav,
              borderWidth: 1,
              borderColor: COLORS.borderGlass,
              backgroundColor: COLORS.surfaceGlass,
              overflow: "hidden",
            }}
          >
            {tabs}
          </BlurView>
        </View>
      )}
    </View>
  );
}