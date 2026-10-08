import type { ReactNode } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { COLORS, SIZES } from "../../constants/theme";
import { Close, Filter } from "../icons";
import GlassSurface from "./glassSurface";

// A screen's search and filter controls: the search field and a round filter
// button with a count on one row, opening a FilterDrawer, then one removable pill per
// active filter (or search) on the row below. Shared by Bits and the Loop Store, so the two filters
// look and behave as one control rather than two that drift apart.

export type ActiveFilterPill = {
  key: string;
  label: string;
  onRemove: () => void;
  accessibilityLabel: string;
};

export default function FilterBar({
  search,
  onOpen,
  pills,
}: {
  /** The screen's search field. It takes the row; the button sits at its end. */
  search: ReactNode;
  onOpen: () => void;
  /** Everything narrowing the list right now; its length is the badge. */
  pills: ActiveFilterPill[];
}) {
  const count = pills.length;
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <View className="flex-1">{search}</View>
        <FilterButton count={count} onOpen={onOpen} />
      </View>

      {/* On a row of their own, so however many there are they never squeeze
          the search. */}
      {count > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, alignItems: "center" }}
        >
          {pills.map(({ key, ...pill }) => (
            <ActivePill key={key} {...pill} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function FilterButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    // Icon only: a circle as tall as the search field beside it, with the same
    // glass fill and the same size of icon as its magnifier, so the two read
    // as one control bar. The count sits on the corner, where an icon button
    // carries one.
    <TouchableOpacity
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Filters, ${count} active` : "Filters"}
      activeOpacity={0.8}
    >
      {/* Glass where there is glass; the search field's fill where there isn't. */}
      <GlassSurface
        fallbackClassName="bg-white/5"
        style={{
          width: SIZES.control,
          height: SIZES.control,
          borderRadius: SIZES.control / 2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Filter size={SIZES.rowIcon} color={count > 0 ? COLORS.brand : COLORS.white} />
      </GlassSurface>
      {/* Outside the glass, which clips to its circle. */}
      {count > 0 && (
        <View
          className="absolute items-center justify-center rounded-full bg-brand"
          style={{ top: -2, right: -2, minWidth: 18, height: 18, paddingHorizontal: 4 }}
        >
          <Text className="text-white text-micro font-spaceBold">{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// One applied filter (or the search text), removable on its own. Styled like
// the search field -- glass pill, the same small round clear button -- so
// everything narrowing the list looks like it belongs to the search.
function ActivePill({
  label,
  onRemove,
  accessibilityLabel,
}: Omit<ActiveFilterPill, "key">) {
  return (
    <TouchableOpacity
      onPress={onRemove}
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.8}
      className="flex-row items-center gap-2 pl-4 pr-2 rounded-full bg-white/5"
      style={{ height: SIZES.control }}
    >
      <Text className="text-white text-label font-satoshiMedium" numberOfLines={1}>
        {label}
      </Text>
      <View
        className="items-center justify-center rounded-full bg-white/15"
        style={{ width: 22, height: 22 }}
      >
        <Close size={12} color={COLORS.white} />
      </View>
    </TouchableOpacity>
  );
}
