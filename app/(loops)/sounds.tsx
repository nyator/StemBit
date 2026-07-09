import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import ScreenHeader from "../../components/ui/screenHeader";
import SelectLoopView from "../../components/selectLoopView";
import {
  LOOPS,
  LOOP_CATEGORIES,
  getArtists,
  getLoopsByArtist,
  getLoopsByCategory,
  type LoopCategory,
} from "../../constants/loops";

type BrowseMode = "categories" | "artists";

const BROWSE_MODES: { key: BrowseMode; label: string }[] = [
  { key: "categories", label: "Categories" },
  { key: "artists", label: "Artists" },
];

const LoopBrowserScreen = () => {
  const [browseMode, setBrowseMode] = useState<BrowseMode>("categories");
  // null = "All" — no filter applied within the current browse mode.
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  const filters =
    browseMode === "categories" ? [...LOOP_CATEGORIES] : getArtists();

  const filteredLoops = useMemo(() => {
    if (!selectedFilter) return LOOPS;
    return browseMode === "categories"
      ? getLoopsByCategory(selectedFilter as LoopCategory)
      : getLoopsByArtist(selectedFilter);
  }, [browseMode, selectedFilter]);

  const switchMode = (mode: BrowseMode) => {
    setBrowseMode(mode);
    setSelectedFilter(null); // filters don't carry across modes
  };

  const countFor = (filter: string) =>
    browseMode === "categories"
      ? getLoopsByCategory(filter as LoopCategory).length
      : getLoopsByArtist(filter).length;

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <StatusBar barStyle="light-content" />

      <ScreenHeader title="Loops" />

      {/* Browse mode: Categories / Artists */}
      <View className="items-center mb-4">
        <View className="flex-row bg-white/10 rounded-xl p-1">
          {BROWSE_MODES.map((mode) => (
            <TouchableOpacity
              key={mode.key}
              accessibilityLabel={`Browse by ${mode.label}`}
              onPress={() => switchMode(mode.key)}
              className={`px-6 py-2 rounded-lg ${
                browseMode === mode.key ? "bg-accent" : ""
              }`}
            >
              <Text
                className={`text-sm font-rMedium ${
                  browseMode === mode.key ? "text-black" : "text-white"
                }`}
              >
                {mode.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Filter chips: All + each category/artist */}
      <View className="mb-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          <FilterChip
            label={`All (${LOOPS.length})`}
            selected={selectedFilter === null}
            onPress={() => setSelectedFilter(null)}
          />
          {filters.map((filter) => (
            <FilterChip
              key={filter}
              label={`${filter} (${countFor(filter)})`}
              selected={selectedFilter === filter}
              onPress={() => setSelectedFilter(filter)}
            />
          ))}
        </ScrollView>
      </View>

      <SelectLoopView loops={filteredLoops} />
    </SafeAreaView>
  );
};

type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

const FilterChip = ({ label, selected, onPress }: FilterChipProps) => (
  <TouchableOpacity
    onPress={onPress}
    className={`px-4 py-2 rounded-full border ${
      selected ? "bg-accent border-accent" : "bg-white/10 border-white/20"
    }`}
  >
    <Text
      className={`text-sm font-rMedium ${
        selected ? "text-black" : "text-white"
      }`}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export default LoopBrowserScreen;
