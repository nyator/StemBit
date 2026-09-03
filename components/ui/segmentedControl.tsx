import { Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../../constants/theme";

// One-of-N, in the two shapes the design uses for it.
//
// The app had grown four of these by hand -- Maj/Min on the pad, Categories/
// Artists in the loop browser, and the subdivision selector on both instrument
// screens -- each with its own radii, padding and type. They are the same
// control, so they are one component with two variants:
//
//   "track"  a compact group riding on a sunken track. For two or three short
//            options that sit beside other controls in a row.
//   "row"    full width, one column per option. For the instrument screens,
//            where the choice is the only thing on its line and the targets
//            should be as big as the screen allows.
//
// The row variant sizes its columns with flex rather than the fixed 105pt the
// instrument screens used to hard-code: three of those overflow a 320pt phone,
// and the fixed width was only ever the 390pt design frame written down.

export type SegmentedOption<T extends string | number> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

type SegmentedControlProps<T extends string | number> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: "track" | "row";
  /**
   * Fill behind the selected option. White is the design default; the pad
   * passes brand or red so the mode you are in is legible from the colour
   * alone.
   */
  accent?: string;
  /**
   * Answer on touch-down rather than on release.
   *
   * On for the instrument screens: subdivision changes what the next beat
   * sounds like, and a control the player has to finish a tap to hear reads as
   * lag. Off elsewhere, where the release is the safer commit.
   */
  respondOnPressIn?: boolean;
  /** Extra classes on the outer container. */
  className?: string;
};

export default function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  variant = "track",
  accent = COLORS.white,
  respondOnPressIn = false,
  className = "",
}: SegmentedControlProps<T>) {
  const isRow = variant === "row";

  // Three "track" segments at the two-option padding overflow a 320pt phone --
  // "Categories / Artists / Meter" comes to about 313pt of content in a 320pt
  // window, and the labels start truncating. Tightening the padding past two
  // options buys the room back without touching how a pair looks.
  const trackPaddingX = options.length > 2 ? "px-4" : "px-6";

  const container = isRow
    ? `flex-row items-center w-full gap-2 ${className}`
    : `flex-row p-1 rounded-xl bg-white/10 ${className}`;

  return (
    <View className={container}>
      {options.map((option) => {
        const selected = option.value === value;
        const handler = () => onChange(option.value);

        // White is the only accent the design pairs with dark text; a coloured
        // one (the pad's red and blue) stays white-on-colour.
        const selectedText = accent === COLORS.white ? "text-ink-inverse" : "text-white";

        const segment = isRow
          ? `flex-1 items-center justify-center py-2 rounded-sm ${
              selected ? "" : "bg-surface-muted border border-hairline-segment"
            }`
          : `${trackPaddingX} py-2 rounded-lg items-center justify-center`;

        return (
          <TouchableOpacity
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            onPress={respondOnPressIn ? undefined : handler}
            onPressIn={respondOnPressIn ? handler : undefined}
            className={segment}
            style={selected ? { backgroundColor: accent } : undefined}
          >
            <Text
              numberOfLines={1}
              className={`${isRow ? "text-title font-spaceBold" : "text-label font-satoshiMedium"} ${
                selected ? selectedText : "text-white"
              }`}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
