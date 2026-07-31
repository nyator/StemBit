import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import ScreenHeader from "../../components/ui/screenHeader";
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
import AmbientGlow from "../../components/ui/ambientGlow";
import { GLOW_PLACEMENTS } from "../../components/ui/screen";
import { Add } from "../../components/icons";
import { COLORS } from "../../constants/theme";

type BrowseMode = "categories" | "artists";

const BROWSE_MODES: { key: BrowseMode; label: string }[] = [
  { key: "categories", label: "Categories" },
  { key: "artists", label: "Artists" },
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
    <SafeAreaView className="flex-1 bg-canvas">
      <StatusBar barStyle="light-content" />

      <AmbientGlow style={GLOW_PLACEMENTS.topLeftFar} />
      <AmbientGlow style={GLOW_PLACEMENTS.bottomLeft} />

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
        <View className="flex-row bg-white/10 rounded-xl p-1">
          {BROWSE_MODES.map((mode) => (
            <TouchableOpacity
              key={mode.key}
              accessibilityLabel={`Browse by ${mode.label}`}
              onPress={() => switchMode(mode.key)}
              className={`px-6 py-2 rounded-lg ${browseMode === mode.key ? "bg-ink border-ink-muted" : ""
                }`}
            >
              <Text
                className={`text-sm font-satoshiMedium ${browseMode === mode.key ? "text-black" : "text-white"
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
            label={`All (${allLoops.length})`}
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
    className={`px-4 py-2 rounded-full border ${selected ? "bg-ink border-ink-muted" : "bg-white/10 border-white/20"
      }`}
  >
    <Text
      className={`text-sm font-satoshiMedium ${selected ? "text-black" : "text-white"
        }`}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export default LoopBrowserScreen;
