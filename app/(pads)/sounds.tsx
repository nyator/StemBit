import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ScreenHeader from "../../components/ui/screenHeader";
import AmbientGlow from "../../components/ui/ambientGlow";
import { GLOW_PLACEMENTS } from "../../components/ui/screen";
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
    <SafeAreaView className="items-center justify-start flex-1 overflow-hidden bg-canvas">
      <StatusBar barStyle="light-content" />

      <AmbientGlow style={GLOW_PLACEMENTS.topLeftFar} />
      <AmbientGlow style={GLOW_PLACEMENTS.bottomLeft} />

      <ScreenHeader title="Select Pad" />

      <View className="flex-1 w-full px-5">
        {/* Filters: All / By Artist */}
        <View className="flex-row gap-2 mb-4">
          <TouchableOpacity
            onPress={() => setBrowseMode("all")}
            className="items-center justify-center px-[16px] py-[8px] rounded-[20px]"
            style={{
              backgroundColor: browseMode === "all" ? "#FFFFFF" : "rgba(26,31,41,0.5)",
            }}
          >
            <Text
              className="text-md font-satoshiBold"
              style={{ color: browseMode === "all" ? "#000000" : "#808A9E" }}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setBrowseMode("byArtist")}
            className="items-center justify-center px-[16px] py-[8px] rounded-[20px]"
            style={{
              backgroundColor: browseMode === "byArtist" ? "#FFFFFF" : "rgba(26,31,41,0.5)",
            }}
          >
            <Text
              className="text-md font-satoshiBold"
              style={{ color: browseMode === "byArtist" ? "#000000" : "#808A9E" }}
            >
              By Artist
            </Text>
          </TouchableOpacity>
        </View>

        <SelectPadView packs={packs} groupByArtist={browseMode === "byArtist"} />

        {/* Below the catalog, where a console sits under what feeds it: the
            list adds channels, this balances them. Nature Noises used to be a
            switch here — it's a mixer channel now, since it's a sound that
            plays over the pads rather than a setting. */}
        <PadMixer />
      </View>
    </SafeAreaView>
  );
}
