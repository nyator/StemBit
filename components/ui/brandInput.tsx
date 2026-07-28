import { forwardRef, useState, type ReactNode } from "react";
import {
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import { COLORS } from "../../constants/theme";

// 55pt, per the Figma. Same figure as SIZES.buttonHeight, but kept separate —
// a field and a button matching in the design isn't a reason for one to change
// when the other does.
const FIELD_HEIGHT = 55;

// One line of the 14pt label type the error is set in, so the space a message
// will need is already there before it arrives.
const ERROR_SLOT_HEIGHT = 18;

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

    // Explicit margins rather than `gap` on the wrapper, so the error slot
    // below can own its own spacing and stay a fixed size whether or not it
    // currently has text in it.
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

        {/* The slot is always here, so an error appearing colours it in rather
            than pushing every field below it down the screen — which on a form
            mid-validation moves the control the user is reaching for.
            minHeight, not height: one line is reserved because that's what
            almost every message is, but a longer one grows instead of being
            clipped. An error you can't read in full is worse than a shift. */}
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
