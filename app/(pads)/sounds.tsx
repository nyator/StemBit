import React, { useMemo, useState } from "react";
import { View } from "react-native";

import ScreenHeader from "../../components/ui/screenHeader";
import Screen from "../../components/ui/screen";
import Chip from "../../components/ui/chip";
import SelectPadView from "../../components/selectPadView";
import PadMixer from "../../components/padMixer";
import { PAD_PACKS } from "../../constants/pads";

type BrowseMode = "all" | "byArtist";

export default function PadSoundsScreen() {
  const [browseMode, setBrowseMode] = useState<BrowseMode>("all");

  const packs = useMemo(() => {
    if (browseMode === "all") return PAD_PACKS;
    return [...PAD_PACKS].sort((a, b) => a.artist.localeCompare(b.artist));
  }, [browseMode]);

  return (
    <Screen glows={["topLeftFar", "bottomLeft"]} className="items-center justify-start">
      <ScreenHeader title="Select Pad" />

      <View className="flex-1 w-full px-screen">
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

        <SelectPadView packs={packs} groupByArtist={browseMode === "byArtist"} />
        <PadMixer />
      </View>
    </Screen>
  );
}
