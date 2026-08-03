import type { ComponentType } from "react";
import { View, Text, TouchableOpacity, Switch } from "react-native";

import Radio from "./radio";
import Slider from "./slider";
import { ArrowRight } from "../icons";
import { COLORS, CONTROL, RADII, SIZES } from "../../constants/theme";

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

// A segmented group is the same "one of N" choice a radio makes, but the
// options are short enough to sit side by side, so they get one control
// instead of N rows. Generic over the value union so the caller's own type
// (e.g. Preferences["loopClickPan"]) survives into `onChange`.
type SegmentOption<T extends string> = { value: T; label: string };

type SegmentedRowProps<T extends string> = BaseProps & {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
};

// Same shape as a switch row but the value is continuous, 0–1.
type SliderRowProps = BaseProps & {
  value: number;
  onValueChange: (value: number) => void;
  /** Fires once when the drag ends -- persist here, not on every tick. */
  onComplete?: (value: number) => void;
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

// Read-only row: states something rather than offering a control. Used for
// hardware the app can observe but not change -- an audio output the system
// routes to on its own, for instance. Deliberately not a TouchableOpacity, so
// it doesn't invite a tap that would do nothing.
export function SettingStatus({
  value,
  ...base
}: BaseProps & { value?: string }) {
  return (
    <RowShell
      {...base}
      right={
        value ? (
          <Text className="text-sm text-white/50 font-satoshiRegular">
            {value}
          </Text>
        ) : null
      }
    />
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
export function SettingSlider({
  value,
  onValueChange,
  onComplete,
  ...base
}: SliderRowProps) {
  return (
    <RowShell
      {...base}
      right={
        <Slider
          value={value}
          onChange={onValueChange}
          onComplete={onComplete}
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

// Segmented settings row -- the label sits on its own line and the options
// span the row's full width beneath it, split evenly. Wide enough for three
// word labels (Left / Center / Right), which won't fit right-aligned next to
// the label the way a switch or slider does.
export function SettingSegmented<T extends string>({
  value,
  options,
  onChange,
  border = false,
  ...base
}: SegmentedRowProps<T>) {
  return (
    <View className={`${border ? "border-b" : ""} border-white/10`}>
      <RowShell {...base} right={null} />
      <View
        accessibilityRole="radiogroup"
        className="flex-row p-1 mb-4 -mt-2 bg-white/5"
        style={{ borderRadius: RADII.md }}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onChange(option.value)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              className="items-center justify-center flex-1 py-[10px]"
              style={{
                borderRadius: RADII.sm,
                backgroundColor: selected ? CONTROL.active : "transparent",
              }}
            >
              <Text
                numberOfLines={1}
                className="text-sm font-satoshiMedium"
                style={{ color: selected ? COLORS.white : COLORS.textMuted }}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
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
