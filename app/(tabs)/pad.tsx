import React from "react";
import { View, Text, StatusBar, TouchableOpacity } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import LaunchPadComponent from "../../components/launchPad";
import HeaderComponent from "../../components/headerComponent";

import { usePreferences } from "../../context/PreferencesContext";
import {
  usePadPlayback,
  KEYS,
  KEY_DISPLAY_LABELS,
} from "../../context/PadPlaybackContext";
import { hapticImpact } from "../../utils/haptics";
import { COLORS } from "../../constants/theme";
import { SortPad } from "../../components/icons";
import AmbientGlow from "../../components/ui/ambientGlow";
import { GLOW_PLACEMENTS } from "../../components/ui/screen";

// The pad instrument's audio lives in PadPlaybackContext (mounted at the app
// root) so a held drone keeps sounding while the user navigates away. This
// screen is just its control surface: it reads what's playing and forwards
// taps to the engine.
export default function PadScreen() {
  const router = useRouter();
  const { prefs } = usePreferences();
  const { activeKeyIndex, mode, setMode, togglePad } = usePadPlayback();

  const isMinor = mode === "minor";

  const handlePadPress = (idx: number) => {
    hapticImpact(prefs.haptics);
    togglePad(idx);
  };

  return (
    <SafeAreaView className="items-center justify-start flex-1 bg-canvas">
      <AmbientGlow style={GLOW_PLACEMENTS.topLeftFar} />
      {/* <AmbientGlow style={GLOW_PLACEMENTS.topRight} /> */}

      <HeaderComponent />
      <View className="items-center justify-start flex-1 w-full px-5">
        <View>
          <View className="flex flex-row items-center justify-center gap-6 mt-2">
            <View className="flex-row p-1 rounded-xl bg-white/5">
              <TouchableOpacity
                accessibilityLabel="Major"
                onPress={() => setMode("major")}
                className="px-4 py-2 rounded-lg"
                style={{ backgroundColor: !isMinor ? COLORS.brand : "transparent" }}
              >
                <Text
                  className="text-md font-satoshiMedium"
                  style={{ color: !isMinor ? COLORS.white : COLORS.white }}
                >
                  Maj
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityLabel="Minor"
                onPress={() => setMode("minor")}
                className="px-4 py-2 rounded-lg"
                style={{ backgroundColor: isMinor ? COLORS.danger : "transparent" }}
              >
                <Text
                  className="text-md font-satoshiMedium"
                  style={{ color: isMinor ? COLORS.white : COLORS.white }}
                >
                  Min
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              className="items-center justify-center border-white/20 rounded-full w-9 h-9 bg-white/5"
              onPress={() => router.push("/(pads)/sounds")}
              activeOpacity={0.7}
              accessibilityLabel="Select pad"
            >
              <SortPad size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
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
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
}
