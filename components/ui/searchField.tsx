import { useRef, useState } from "react";
import { Pressable, TextInput, TouchableOpacity } from "react-native";

import { COLORS, SIZES } from "../../constants/theme";
import { Close, SearchNormal } from "../icons";

// A real filter, not just the pills: the loop and pad browsers narrow by a
// fixed set of axes (category, artist, meter...), which only gets you as far
// as the axes go. This is the other half -- find "that worship one with the
// drums" by typing it, combined with whatever pills are already set rather
// than replacing them.
//
// A pill rather than BrandInput's squared form field: this sits above a list
// being browsed, not a form being filled in. Same height as the instrument
// controls, a glass fill that lets the screen's glow through, and the brand
// colour on the border and icon while it has focus -- the same focus signal
// BrandInput gives.

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
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    // The whole pill is the target, not just the text -- tapping the icon or
    // the padding focuses the field too.
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessible={false}
      className="flex-row items-center w-full px-4 rounded-full bg-white/5"
      style={{
        height: SIZES.control,
        // borderWidth: 1,
        borderColor: focused ? COLORS.brand : COLORS.borderGlass,
      }}
    >
      <SearchNormal
        size={SIZES.rowIcon}
        color={focused ? COLORS.brand : COLORS.textMuted}
      />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textFaint}
        selectionColor={COLORS.brand}
        keyboardAppearance="dark"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        className="flex-1 ml-3 text-white font-satoshiMedium text-body"
        style={{ height: "100%", padding: 0, textAlignVertical: "center" }}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText("")}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          className="items-center justify-center ml-2 rounded-full bg-white/15"
          style={{ width: 22, height: 22 }}
        >
          <Close size={12} color={COLORS.white} />
        </TouchableOpacity>
      )}
    </Pressable>
  );
}
