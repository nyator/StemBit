import type { ComponentType } from "react";
import { View, Text, TouchableOpacity, Switch } from "react-native";

import Radio from "./radio";
import Slider from "./slider";
import { ArrowRight } from "../icons";
import { COLORS, CONTROL, SIZES } from "../../constants/theme";

// Icons arrive as components from components/icons (Iconsax, lifted from the
// Figma) rather than as glyph-name strings: callers get compile-time checking,
// and there's no icon font to ship.
type IconComponent = ComponentType<{ size?: number; color?: string }>;

type BaseProps = {
  icon?: IconComponent;
  label: string;
  sublabel?: string;
  danger?: boolean;
  border?: boolean;
};

type LinkRowProps = BaseProps & {
  onPress: () => void;
  value?: string; // right-aligned value text (e.g. current setting)
};

type SwitchRowProps = BaseProps & {
  value: boolean;
  onValueChange: (value: boolean) => void;
};

// A radio is a choice within a group, not an independent on/off, so it takes
// `selected` plus a bare `onSelect` -- the parent owns which one is picked.
type RadioRowProps = BaseProps & {
  selected: boolean;
  onSelect: () => void;
};

// Same shape as a switch row but the value is continuous, 0–1.
type SliderRowProps = BaseProps & {
  value: number;
  onValueChange: (value: number) => void;
};

const RowShell = ({
  icon: Icon,
  label,
  sublabel,
  danger,
  right,
  border = false
}: BaseProps & { right: React.ReactNode }) => (
  <View className={`flex-row items-center py-4 ${border ? "border-b" : ""} border-white/10`}>
    {Icon && (
      <View className="items-center justify-center w-8 h-8 mr-3 rounded-lg">
        <Icon
          size={SIZES.rowIcon}
          color={danger ? COLORS.danger : COLORS.white}
        />
      </View>
    )}
    <View className="flex-1">
      <Text
        className={`text-lg font-satoshiRegular ${danger ? "text-danger" : "text-white"}`}
      >
        {label}
      </Text>
      {sublabel && (
        <Text className="text-sm text-white/50 font-satoshiRegular">
          {sublabel}
        </Text>
      )}
    </View>
    {right}
  </View>
);

// Tappable settings row (navigates or triggers an action).
export function SettingLink({ onPress, value, ...base }: LinkRowProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <RowShell
        {...base}
        right={
          <View className="flex-row items-center">
            {value && (
              <Text className="mr-2 text-sm text-white/50 font-satoshiRegular">
                {value}
              </Text>
            )}
            <ArrowRight size={SIZES.rowIcon} color={COLORS.textMuted} />
          </View>
        }
      />
    </TouchableOpacity>
  );
}

// Tappable settings row (navigates or triggers an action).
export function SettingNoLink({ onPress, value, ...base }: LinkRowProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <RowShell
        {...base}
        right={
          <View className="flex-row items-center">
            {value && (
              <Text className="mr-2 text-sm text-white/50 font-satoshiRegular">
                {value}
              </Text>
            )}
          </View>
        }
      />
    </TouchableOpacity>
  );
}

// Toggle settings row.
export function SettingSwitch({ value, onValueChange, ...base }: SwitchRowProps) {
  return (
    <RowShell
      {...base}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: CONTROL.idle, true: CONTROL.active }}
          thumbColor={CONTROL.knob}
        />
      }
    />
  );
}

// Continuous-value row -- a volume level rather than an on/off.
export function SettingSlider({ value, onValueChange, ...base }: SliderRowProps) {
  return (
    <RowShell
      {...base}
      right={
        <Slider
          value={value}
          onChange={onValueChange}
          accessibilityLabel={base.label}
        />
      }
    />
  );
}

// Radio settings row -- one option within a mutually exclusive group.
// The whole row is the target, not just the dot.
export function SettingRadio({ selected, onSelect, ...base }: RadioRowProps) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <RowShell {...base} right={<Radio selected={selected} />} />
    </TouchableOpacity>
  );
}

// Section wrapper: accent-colored heading + card of rows.
export function SettingSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-7">
      {/* text-overline is the design's 12px group header; `text-md` is not a
          Tailwind size and silently produced no font-size at all. */}
      <Text className="mb-4 uppercase text-overline tracking-widest text-ink-muted font-spaceBold">
        {title}
      </Text>
      <View className="px-4 bg-hairline-dial rounded-lg">{children}</View>
    </View>
  );
}
