import { useRef, type ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { Tabs } from "expo-router";

import { useFeatureTour } from "../../context/FeatureTourContext";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import { PlayCircleOutline, PlayCircle, Pad, PadFill, MetronomeFill, MetronomeOutline, SortPad, SortPadFill, type IconComponent } from "../icons";

// Each tab shows its outline icon when idle and the filled variant when active.
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

// Pulled from <Tabs>'s own `tabBar` prop rather than imported from a types
// module directly: expo-router (SDK 57) ships its own copy of this shape --
// not the same nominal type as @react-navigation/bottom-tabs's own
// BottomTabBarProps -- and doesn't re-export it from its own package root
// either, so there is no name to import here that both exists and is
// guaranteed to match what <Tabs tabBar={...}> actually calls this with. This
// stays correct however that shape moves around internally.
type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

export default function FloatingTabBar({ state, navigation }: TabBarProps) {
  // Each tab reports where it landed so the first-run tour can spotlight it.
  // Null outside the provider, which is the case in tests -- the tab bar still
  // has to render there.
  const tour = useFeatureTour();
  const tabRefs = useRef<Record<string, View | null>>({});

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
      <View
        className="flex-row items-start justify-between px-4 py-3 rounded-nav bg-surface-glass border border-hairline-glass"
        style={SHADOWS.float}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const icons = TAB_ICONS[route.name] ?? TAB_ICONS.loop;
          const Icon = isFocused ? icons.active : icons.inactive;
          const label = TAB_LABELS[route.name] ?? route.name;
          const color = isFocused ? COLORS.brand : COLORS.white;

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
              // measureInWindow rather than onLayout's own coordinates: those
              // are relative to the parent pill, and the overlay draws in window
              // space. A zero-sized frame means the measure raced the layout --
              // skip it and let the next layout pass report real numbers.
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
              <Icon size={SIZES.navIcon} color={color} />
              <Text
                className="text-nav font-spaceBold"
                style={{ color }}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
