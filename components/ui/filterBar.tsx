import type { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { COLORS, SIZES } from "../../constants/theme";
import { Filter } from "../icons";
import GlassSurface from "./glassSurface";

// A screen's search and filter controls: the search field and a round filter
// button on one row, the button opening a FilterDrawer and carrying a count of
// what's set in it. Shared by every catalogue -- the Loop Store, Bits, the pad
// browser and the session's pickers -- so they look and behave as one control
// rather than several that drift apart.
//
// No row of pills under it any more. What's set is listed in the drawer, with
// its own clear and reset, and the count on the button says when to look --
// a second copy of the same list on the screen was only taking up room.

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
  /** Everything narrowing the list right now. Drawer filters make the badge. */
  pills: ActiveFilterPill[];
}) {
  // The search counts as narrowing the list, but it already shows itself in
  // its own field -- a badge of 1 over a drawer with nothing ticked would send
  // people looking for a filter that isn't there.
  const count = pills.filter((pill) => pill.key !== "query").length;
  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-1">{search}</View>
      <FilterButton count={count} onOpen={onOpen} />
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
