import { forwardRef, useState, type ReactNode } from "react";
import {
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import { COLORS } from "../../constants/theme";

// Focus/blur handler types, derived from TextInputProps so they track whatever
// event shape the installed React Native version uses.
type FocusHandler = NonNullable<TextInputProps["onFocus"]>;
type BlurHandler = NonNullable<TextInputProps["onBlur"]>;

// The design's text field (Figma node 124:870). A #17181F fill inside a 2pt
// teal-navy hairline, 14pt radius, 55pt tall, with a Space Grotesk label above.
// The border picks up the brand accent on focus and the danger colour when the
// field carries an error, so the same component covers every auth input.

type BrandInputProps = TextInputProps & {
  /** Label rendered above the field. Omit for an unlabelled input. */
  label?: string;
  /** Validation message shown beneath the field; also reddens the border. */
  error?: string;
  /** Element pinned to the right of the input, e.g. a password reveal toggle. */
  rightSlot?: ReactNode;
  /** Styles for the outer wrapper (label + field + error). */
  containerStyle?: ViewStyle;
};

export const BrandInput = forwardRef<TextInput, BrandInputProps>(
  function BrandInput(
    { label, error, rightSlot, containerStyle, onFocus, onBlur, ...props },
    ref
  ) {
    const [focused, setFocused] = useState(false);

    const handleFocus: FocusHandler = (e) => {
      setFocused(true);
      onFocus?.(e);
    };

    const handleBlur: BlurHandler = (e) => {
      setFocused(false);
      onBlur?.(e);
    };

    const borderColor = error
      ? COLORS.danger
      : focused
        ? COLORS.brand
        : COLORS.border;

    return (
      <View className="w-full gap-2" style={containerStyle}>
        {label ? (
          <Text className="text-ink font-spaceMedium text-label">
            {label}
          </Text>
        ) : null}

        <View
          className="flex-row items-center w-full px-4 py-6 border-2 h-12 rounded-md bg-surface-field"
          style={{ borderColor }}
        >
          <TextInput
            ref={ref}
            className="flex-1 text-white font-satoshiBold text-body"
            placeholderTextColor={COLORS.textFaint}
            selectionColor={COLORS.brand}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />
          {rightSlot}
        </View>

        {error ? (
          <Text className="font-satoshiMedium text-label text-danger">
            {error}
          </Text>
        ) : null}
      </View>
    );
  }
);
