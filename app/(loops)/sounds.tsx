import React, { useMemo, useState } from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";

import { useRouter } from "expo-router";

import ScreenHeader from "../../components/ui/screenHeader";
import Screen from "../../components/ui/screen";
import Chip from "../../components/ui/chip";
import SegmentedControl from "../../components/ui/segmentedControl";
import SelectLoopView from "../../components/selectLoopView";
import {
  LOOP_CATEGORIES,
  getAllLoops,
  getArtists,
  getLoopsByArtist,
  getLoopsByCategory,
  type LoopCategory,
} from "../../constants/loops";
import { useUserLoops } from "../../context/UserLoopsContext";
import { Add } from "../../components/icons";
import { COLORS, LAYOUT } from "../../constants/theme";

type BrowseMode = "categories" | "artists";

const BROWSE_MODES = [
  { value: "categories" as const, label: "Categories" },
  { value: "artists" as const, label: "Artists" },
];

const LoopBrowserScreen = () => {
  const router = useRouter();
  const [browseMode, setBrowseMode] = useState<BrowseMode>("categories");
  // null = "All" — no filter applied within the current browse mode.
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  // The shipped catalog plus the user's imports. Re-derived when the imports
  // change so a loop added (or deleted) shows up here immediately; every filter
  // below works off this one list, which is what keeps a chip's count and its
  // contents from disagreeing.
  const { userLoops } = useUserLoops();
  const allLoops = useMemo(() => getAllLoops(), [userLoops]);

  const filters =
    browseMode === "categories" ? [...LOOP_CATEGORIES] : getArtists(allLoops);

  const filteredLoops = useMemo(() => {
    if (!selectedFilter) return allLoops;
    return browseMode === "categories"
      ? getLoopsByCategory(selectedFilter as LoopCategory, allLoops)
      : getLoopsByArtist(selectedFilter, allLoops);
  }, [browseMode, selectedFilter, allLoops]);

  const switchMode = (mode: BrowseMode) => {
    setBrowseMode(mode);
    setSelectedFilter(null); // filters don't carry across modes
  };

  const countFor = (filter: string) =>
    browseMode === "categories"
      ? getLoopsByCategory(filter as LoopCategory, allLoops).length
      : getLoopsByArtist(filter, allLoops).length;

  return (
    <Screen glows={["topLeftFar", "bottomLeft"]}>
      {/* The way in to importing a loop of your own. Sits in the header rather
          than in the list: it isn't one of the loops, it's what makes another
          one. */}
      <ScreenHeader
        title="Bits"
        action={
          <TouchableOpacity
            onPress={() => router.push("/(loops)/import")}
            accessibilityLabel="Add your own loop"
            className="p-2 rounded-full bg-brand"
          >
            <Add size={22} color={COLORS.white} />
          </TouchableOpacity>
        }
      />

      {/* Browse mode: Categories / Artists */}
      <View className="items-center mb-4">
        <SegmentedControl
          options={BROWSE_MODES}
          value={browseMode}
          onChange={switchMode}
        />
      </View>

      {/* Filter chips: All + each category/artist */}
      <View className="mb-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: LAYOUT.screenPaddingX,
            gap: 8,
          }}
        >
          <Chip
            label={`All (${allLoops.length})`}
            selected={selectedFilter === null}
            onPress={() => setSelectedFilter(null)}
          />
          {filters.map((filter) => (
            <Chip
              key={filter}
              label={`${filter} (${countFor(filter)})`}
              selected={selectedFilter === filter}
              onPress={() => setSelectedFilter(filter)}
            />
          ))}
        </ScrollView>
      </View>

      <SelectLoopView loops={filteredLoops} />
    </Screen>
  );
};

export default LoopBrowserScreen;
