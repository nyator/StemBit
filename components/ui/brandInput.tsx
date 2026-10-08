import {
  forwardRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import { COLORS } from "../../constants/theme";
import { Eye, EyeSlash } from "../icons";

const FIELD_HEIGHT = 55;
const ERROR_SLOT_HEIGHT = 3;

type FocusHandler = NonNullable<TextInputProps["onFocus"]>;
type BlurHandler = NonNullable<TextInputProps["onBlur"]>;

type BrandInputProps = TextInputProps & {
  label?: string;
  error?: string;
  /**
   * Masks the field and puts a reveal toggle in the trailing slot.
   *
   * A prop rather than a separate password component, and read from the prop
   * rather than inferred from the label: the field this replaced decided it was
   * a password by comparing its own label to the string "Password", so renaming
   * a label silently unmasked it.
   */
  secure?: boolean;
  rightSlot?: ReactNode;
  containerStyle?: ViewStyle;
  /**
   * The text input to render inside the field. Defaults to React Native's.
   *
   * Exists for @gorhom/bottom-sheet: a sheet only lifts itself clear of the
   * keyboard for inputs it knows about, and a plain TextInput never reports its
   * focus to the sheet -- so a field inside one sits under the keyboard as soon
   * as it's tapped. Passing BottomSheetTextInput fixes that while keeping every
   * bit of the styling here.
   */
  InputComponent?: ComponentType<TextInputProps>;
};

export const BrandInput = forwardRef<TextInput, BrandInputProps>(
  function BrandInput(
    {
      label,
      error,
      secure,
      rightSlot,
      containerStyle,
      onFocus,
      onBlur,
      InputComponent,
      ...props
    },
    ref
  ) {
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);
    // Cast so the forwarded ref still typechecks. The prop is declared loosely
    // (ComponentType<TextInputProps>) because gorhom's input arrives wrapped in
    // memo + forwardRef and so isn't literally `typeof TextInput` -- but it does
    // forward a TextInput ref, which is the part that has to hold here.
    const Input = (InputComponent ?? TextInput) as typeof TextInput;

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
        <View
          className="flex-row items-center w-full px-4 border-2 rounded-md bg-surface-field"
          style={{ height: FIELD_HEIGHT, borderColor }}
        >
          <Input
            ref={ref}
            className="flex-1 text-white font-satoshiBold text-body"
            placeholderTextColor={COLORS.textFaint}
            selectionColor={COLORS.brand}
            style={{ height: "100%", padding: 0, textAlignVertical: "center" }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
            secureTextEntry={secure ? !revealed : props.secureTextEntry}
          />
          {secure ? (
            <TouchableOpacity
              onPress={() => setRevealed((shown) => !shown)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={revealed ? "Hide password" : "Show password"}
            >
              {revealed ? (
                <Eye size={20} color={COLORS.textMuted} />
              ) : (
                <EyeSlash size={20} color={COLORS.textMuted} />
              )}
            </TouchableOpacity>
          ) : null}
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
