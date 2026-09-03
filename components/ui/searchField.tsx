import { Text, TextInput, TouchableOpacity, View } from "react-native";

import { COLORS, SIZES } from "../../constants/theme";
import { SearchNormal } from "../icons";

// A real filter, not just the pills: the loop and pad browsers narrow by a
// fixed set of axes (category, artist, meter...), which only gets you as far
// as the axes go. This is the other half -- find "that worship one with the
// drums" by typing it, combined with whatever pills are already set rather
// than replacing them.
//
// Same input surface as BrandInput (bg-surface-field, the same border and
// radius) so a text field reads as one thing across the app, but shorter and
// unlabelled -- this sits above a list being browsed, not a form being filled
// in, and doesn't need BrandInput's height or error slot.

/** Lighter than BrandInput's 55pt form field -- a browse bar, not a form. */
const FIELD_HEIGHT = SIZES.minTouch;

export default function SearchField({
  value,
  onChangeText,
  placeholder = "Search",
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
}) {
  return (
    <View
      className="flex-row items-center w-full px-4 border rounded-md bg-surface-field border-hairline"
      style={{ height: FIELD_HEIGHT }}
    >
      <SearchNormal size={SIZES.rowIcon} color={COLORS.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textFaint}
        selectionColor={COLORS.brand}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        className="flex-1 ml-2 text-white font-satoshiRegular text-body"
        style={{ height: "100%", padding: 0, textAlignVertical: "center" }}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText("")}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <View
            className="items-center justify-center rounded-full bg-white/10"
            style={{ width: 20, height: 20 }}
          >
            <Text className="text-ink-muted text-overline">✕</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}
