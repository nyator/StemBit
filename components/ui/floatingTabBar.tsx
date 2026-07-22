import { Pressable, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { COLORS, SHADOWS } from "../../constants/theme";
import { VideoCircle, Clipboard, Grammerly, type IconComponent } from "../icons";

// Figma "floating-nav" (node 101:399): a pill that floats above the screen
// content rather than a flush full-width bar -- surfaceGlass/borderGlass/
// RADII.nav/SHADOWS.float exist in the theme specifically for this.
const TAB_ICONS: Record<string, IconComponent> = {
  loop: VideoCircle,
  pad: Clipboard,
  metro: Grammerly,
};

const TAB_LABELS: Record<string, string> = {
  loop: "LOOP",
  pad: "PAD",
  metro: "Metronome",
};

export default function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
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
        className="flex-row items-start justify-between px-[16px] py-[12px] rounded-nav bg-surface-glass border border-hairline-glass"
        style={{ width: 228, ...SHADOWS.float }}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const Icon = TAB_ICONS[route.name] ?? VideoCircle;
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
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              className="items-center"
              style={{ width: 60, gap: 4 }}
            >
              <Icon size={24} color={color} />
              <Text
                className="font-spaceBold"
                style={{ fontSize: 10, color }}
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
