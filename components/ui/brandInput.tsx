import { forwardRef, useState, type ReactNode } from "react";
import {
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import { COLORS } from "../../constants/theme";


const FIELD_HEIGHT = 55;
const ERROR_SLOT_HEIGHT = 3;

type FocusHandler = NonNullable<TextInputProps["onFocus"]>;
type BlurHandler = NonNullable<TextInputProps["onBlur"]>;

type BrandInputProps = TextInputProps & {
  label?: string;
  error?: string;
  rightSlot?: ReactNode;
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
      <View className="w-full" style={containerStyle}>
        {label ? (
          <Text className="mb-2 text-ink font-spaceMedium text-label">
            {label}
          </Text>
        ) : null}

        {/* Height comes from the design (55pt) and nothing else sets one.
            `h-12` with `py-6` was 48pt of box holding 48pt of padding plus a
            2pt border, which left the field a content box of zero height — the
            input was still mounted but had no area to draw in or be tapped,
            so it read as a text field you could not type into. */}
        <View
          className="flex-row items-center w-full px-4 border-2 rounded-md bg-surface-field"
          style={{ height: FIELD_HEIGHT, borderColor }}
        >
          <TextInput
            ref={ref}
            className="flex-1 text-white font-satoshiBold text-body"
            placeholderTextColor={COLORS.textFaint}
            selectionColor={COLORS.brand}
            // Fills the field so the whole thing is a tap target rather than
            // just the line of text. padding:0 drops the inner padding Android
            // adds by default, which would otherwise push the text off-centre.
            style={{ height: "100%", padding: 0, textAlignVertical: "center" }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />
          {rightSlot}
        </View>
        <View
          className="justify-center mt-1"
          style={{ minHeight: ERROR_SLOT_HEIGHT }}
        >
          {error ? (
            <Text className="font-satoshiMedium text-label text-danger">
              {error}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }
);
