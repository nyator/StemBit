import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View, type ViewStyle } from "react-native";

import { COLORS, GRADIENTS, RADII, SIZES } from "../../constants/theme";

// The design's three button treatments.
//
// A note on the primary button: the Figma draws it three slightly different
// ways across screens -- Sign In uses a teal hairline border with #E7E7E7 Bold
// text, while Get Started and Notifications use a flat #4F4F4F border with
// white Medium text. That's drift between screens rather than three intended
// variants, so this standardises on the Sign In treatment: its border is the
// same teal the rest of the design system uses for separators, where #4F4F4F
// is a one-off grey that appears nowhere else.

type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

/** Filled gradient button. The primary action on any screen. */
export function BrandButton({
  label,
  onPress,
  disabled,
  style,
  accessibilityLabel,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        { width: "100%", opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <LinearGradient
        colors={GRADIENTS.brand.colors}
        start={GRADIENTS.brand.start}
        end={GRADIENTS.brand.end}
        style={{
          height: SIZES.buttonHeight,
          borderRadius: RADII.md,
          borderWidth: 1,
          borderColor: COLORS.borderBrand,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text className="font-spaceBold text-body text-ink-onBrand">{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/** Text-only button. Secondary actions -- "Maybe Later", "Continue with email". */
export function GhostButton({
  label,
  onPress,
  disabled,
  style,
  accessibilityLabel,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        { width: "100%", opacity: disabled ? 0.5 : pressed ? 0.6 : 1 },
        style,
      ]}
    >
      <View
        style={{ height: SIZES.buttonHeight }}
        className="items-center justify-center"
      >
        <Text className="font-spaceMedium text-body tracking-wordmark text-ink">
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/** Solid white button with dark text. Used for "Log out" and segmented selection. */
export function InverseButton({
  label,
  onPress,
  disabled,
  style,
  accessibilityLabel,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [{ opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }, style]}
    >
      <View className="items-center justify-center px-5 py-2 bg-white h-9 rounded-md">
        <Text className="font-spaceBold text-body text-ink-inverse">{label}</Text>
      </View>
    </Pressable>
  );
}
