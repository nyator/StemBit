import React from "react";
import { View, Text, TouchableOpacity, useWindowDimensions } from "react-native";

import { useRouter } from "expo-router";
import LaunchPadComponent from "../../components/launchPad";
import HeaderComponent from "../../components/headerComponent";

import { usePreferences } from "../../context/PreferencesContext";
import {
  usePadPlayback,
  KEYS,
  KEY_DISPLAY_LABELS,
  type PadMode,
} from "../../context/PadPlaybackContext";
import { findPadPackByKey, type PadPack } from "../../constants/pads";
import { hapticImpact } from "../../utils/haptics";
import { COLORS, LAYOUT } from "../../constants/theme";
import { SortPad } from "../../components/icons";
import Screen from "../../components/ui/screen";
import SegmentedControl, {
  type SegmentedOption,
} from "../../components/ui/segmentedControl";

// Module scope: a fresh array every render would give the control a new
// `options` identity on every pad press.
const MODE_OPTIONS: readonly SegmentedOption<PadMode>[] = [
  { value: "major", label: "Maj", accessibilityLabel: "Major" },
  { value: "minor", label: "Min", accessibilityLabel: "Minor" },
];

// The pad instrument's audio lives in PadPlaybackContext (mounted at the app
// root) so a held drone keeps sounding while the user navigates away. This
// screen is just its control surface: it reads what's playing and forwards
// taps to the engine.
export default function PadScreen() {
  const router = useRouter();
  const { prefs } = usePreferences();
  const { activeKeyIndex, mode, setMode, togglePad } = usePadPlayback();

  const isMinor = mode === "minor";
  // Names the stack in the space of one line: the first pack, plus a count of
  // whatever else is layered under it. Unknown keys are dropped rather than
  // rendered blank, so a pack removed from the catalog between releases can't
  // leave a gap in the label.
  const stackedPads = prefs.padLayers
    .map((layer) => findPadPackByKey(layer.pack))
    .filter((pack): pack is PadPack => !!pack);
  const padStackLabel =
    stackedPads.length === 0
      ? "Select Pad"
      : stackedPads.length === 1
        ? stackedPads[0].title
        : `${stackedPads[0].title} +${stackedPads.length - 1}`;

  const handlePadPress = (idx: number) => {
    hapticImpact(prefs.haptics);
    togglePad(idx);
  };

  // The pad grid, in points rather than percentages.
  //
  // Three across, each 30% wide with a 1.5% gap either side -- the same
  // proportions the design draws, but resolved here against the window instead
  // of by Yoga against a parent it has to measure first. That measurement is
  // what made this tab flash: display:none discards a screen's layout, so
  // coming back it laid the pads out once at the wrong size and again at the
  // right one.
  const { width: windowWidth } = useWindowDimensions();
  const gridWidth = windowWidth - LAYOUT.screenPaddingX * 2;
  const padSize = Math.floor(gridWidth * 0.3);
  const padGap = Math.floor(gridWidth * 0.015);

  return (
    <Screen glows={["topLeftFar"]} className="items-center justify-start">
      <HeaderComponent />
      {/* px-screen rather than the instrument padding the metronome and loop
          screens use: the grid below is measured against LAYOUT.screenPaddingX,
          and the two have to be the same number or the pads sit off-centre. */}
      <View className="items-center justify-start flex-1 w-full px-screen">
        <View className="flex-row items-center justify-center w-full gap-3 mt-2">
          {/* The shared one-of-N, the same control the subdivision rows on the
              instrument screens are. It was written to take this toggle over
              and then this screen kept its hand-rolled copy, which had drifted
              a shade lighter on the track and a step down on the label. The
              accent still carries the mode, as it did before. */}
          <SegmentedControl
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
            accent={isMinor ? COLORS.danger : COLORS.brand}
          />

          {/* What's loaded, and the control that changes it — one target, so
              the name isn't a label sitting next to a button that means the
              same thing. Shrinks (and the title ellipsises) rather than
              pushing the Maj/Min toggle off-centre on a narrow screen. */}
          <TouchableOpacity
            className="flex-row items-center gap-2 px-3 py-3 rounded-full bg-white/5 shrink"
            onPress={() => router.push("/(pads)/sounds")}
            activeOpacity={0.7} 
            accessibilityLabel={
              stackedPads.length > 0
                ? `Select pads, currently ${stackedPads
                    .map((pack) => pack.title)
                    .join(", ")}`
                : "Select pads"
            }
          >
            <SortPad size={20} color={COLORS.white} />
            <Text
              className="text-white shrink text-label font-satoshiMedium"
              numberOfLines={1}
            >
              {padStackLabel}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex flex-row flex-wrap items-center justify-center w-full mt-5">
          {KEYS.map((key, idx) => (
            <LaunchPadComponent
              key={key}
              isPlaying={activeKeyIndex === idx}
              activeColor={isMinor ? COLORS.danger : COLORS.brand}
              selectKey={KEY_DISPLAY_LABELS[key] ?? key}
              size={padSize}
              gap={padGap}
              onPress={() => handlePadPress(idx)}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}
