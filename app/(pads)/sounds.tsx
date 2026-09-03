import React, { useMemo, useState } from "react";
import { View } from "react-native";

import ScreenHeader from "../../components/ui/screenHeader";
import Screen from "../../components/ui/screen";
import Chip from "../../components/ui/chip";
import SearchField from "../../components/ui/searchField";
import SelectPadView from "../../components/selectPadView";
import PadMixer from "../../components/padMixer";
import { PAD_PACKS } from "../../constants/pads";

type BrowseMode = "all" | "byArtist";

export default function PadSoundsScreen() {
  const [browseMode, setBrowseMode] = useState<BrowseMode>("all");
  const [query, setQuery] = useState("");

  const packs = useMemo(() => {
    const sorted =
      browseMode === "all"
        ? PAD_PACKS
        : [...PAD_PACKS].sort((a, b) => a.artist.localeCompare(b.artist));

    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;

    // Finds a pack by name, artist or genre -- combined with the All/By Artist
    // sort above rather than replacing it, so a search still groups by artist
    // when that's the view you're in.
    return sorted.filter(
      (pack) =>
        pack.title.toLowerCase().includes(needle) ||
        pack.artist.toLowerCase().includes(needle) ||
        pack.genre.toLowerCase().includes(needle)
    );
  }, [browseMode, query]);

  return (
    <Screen glows={["topLeftFar", "bottomLeft"]} className="items-center justify-start">
      <ScreenHeader title="Select Pad" />

      <View className="flex-1 w-full px-screen">
        {/* Find one by name, artist or genre -- combined with All/By Artist
            below rather than replacing it. The same field the loop browser
            searches with, so the two catalogues are searched the same way. */}
        <View className="mb-4">
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search pads"
            accessibilityLabel="Search pads by name, artist or genre"
          />
        </View>

        {/* Filters: All / By Artist. The same chip the loop browser filters
            with, so the two catalogues are browsed the same way. */}
        <View className="flex-row gap-2 mb-4">
          <Chip
            label="All"
            selected={browseMode === "all"}
            onPress={() => setBrowseMode("all")}
          />
          <Chip
            label="By Artist"
            selected={browseMode === "byArtist"}
            onPress={() => setBrowseMode("byArtist")}
          />
        </View>

        <SelectPadView
          packs={packs}
          groupByArtist={browseMode === "byArtist"}
          emptyMessage={
            query.trim().length > 0
              ? `No pads match "${query.trim()}".`
              : undefined
          }
        />
        <PadMixer />
      </View>
    </Screen>
  );
}
