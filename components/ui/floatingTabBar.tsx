import { Pressable, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { COLORS, SHADOWS } from "../../constants/theme";
import { PlayCircleOutline, PlayCircle, Pad, PadFill, MetronomeFill, MetronomeOutline, type IconComponent } from "../icons";

// Each tab shows its outline icon when idle and the filled variant when active.
const TAB_ICONS: Record<string, { active: IconComponent; inactive: IconComponent }> = {
  loop: { active: PlayCircle, inactive: PlayCircleOutline },
  pad: { active: PadFill, inactive: Pad },
  metro: { active: MetronomeFill, inactive: MetronomeOutline },
};

const TAB_LABELS: Record<string, string> = {
  loop: "BITS",
  pad: "PAD",
  metro: "CLICK",
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
