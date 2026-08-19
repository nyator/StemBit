import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

import { useRouter } from "expo-router";
import LaunchPadComponent from "../../components/launchPad";
import HeaderComponent from "../../components/headerComponent";

import { usePreferences } from "../../context/PreferencesContext";
import {
  usePadPlayback,
  KEYS,
  KEY_DISPLAY_LABELS,
} from "../../context/PadPlaybackContext";
import { findPadPackByKey, type PadPack } from "../../constants/pads";
import { hapticImpact } from "../../utils/haptics";
import { COLORS } from "../../constants/theme";
import { SortPad } from "../../components/icons";
import Screen from "../../components/ui/screen";
import SegmentedControl from "../../components/ui/segmentedControl";

// Major and minor are the two halves of the same pad, so they are one control
// rather than two buttons -- and the accent says which half you are in from
// across a stage, matching the colour the pads themselves light up.
const PAD_MODES = [
  { value: "major" as const, label: "Maj" },
  { value: "minor" as const, label: "Min" },
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

  return (
    <Screen glows={["topLeftFar"]} className="items-center justify-start">
      <HeaderComponent />
      <View className="items-center justify-start flex-1 w-full px-instrument">
        <View className="flex-row items-center justify-center w-full gap-3 mt-2">
          <SegmentedControl
            options={PAD_MODES}
            value={mode}
            onChange={setMode}
            accent={isMinor ? COLORS.danger : COLORS.brand}
            className="bg-white/5"
          />

          {/* What's loaded, and the control that changes it — one target, so
              the name isn't a label sitting next to a button that means the
              same thing. Shrinks (and the title ellipsises) rather than
              pushing the Maj/Min toggle off-centre on a narrow screen. */}
          <TouchableOpacity
            className="flex-row items-center gap-2 px-3 py-2 rounded-full bg-white/5 shrink"
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
              onPress={() => handlePadPress(idx)}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}
