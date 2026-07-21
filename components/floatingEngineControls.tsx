import { View, Text, TouchableOpacity, Image } from "react-native";
import { useRouter, usePathname } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { useMetronome } from "../context/MetronomeContext";
import { useLoopPlayback } from "../context/LoopPlaybackContext";
import icons from "../constants/icons";
import { COLORS } from "../constants/theme";

type PillProps = {
  onPress: () => void;
  onStop: () => void;
  accentColor: string;
  label: string;
};

function EnginePill({ onPress, onStop, accentColor, label }: PillProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="flex-row items-center px-4 py-3 border rounded-full shadow-lg bg-canvas border-white/20"
      style={{ elevation: 8 }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 8,
          marginRight: 10,
          backgroundColor: accentColor,
        }}
      />
      <Image
        source={icons.metronome}
        className="w-5 h-5 mr-2"
        tintColor="#ffffff"
      />
      <Text className="mr-3 text-white font-satoshiBold">{label}</Text>
      <TouchableOpacity
        accessibilityLabel="Stop"
        onPress={onStop}
        hitSlop={8}
        className="p-1 rounded-full bg-white/10"
      >
        <MaterialCommunityIcons name="stop" size={18} color="white" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// Small persistent indicators shown on other tabs while a metronome/click
// engine keeps ticking in the background, so it's never silently running
// with no way to see or stop it. Stacked in one positioned container so the
// Metronome and Bits/Loop pills don't overlap if both happen to be playing.
export default function FloatingEngineControls() {
  const router = useRouter();
  const pathname = usePathname();
  const metronome = useMetronome();
  const loop = useLoopPlayback();

  const showMetronome = metronome.isPlaying && pathname !== "/metro";
  const showLoop = loop.isPlaying && pathname !== "/loop";

  if (!showMetronome && !showLoop) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "15%",
        alignItems: "center",
        gap: 10,
      }}
    >
      {showLoop && (
        <EnginePill
          onPress={() => router.push("/(tabs)/loop")}
          onStop={loop.stopLoop}
          accentColor={COLORS.brand}
          label={`${loop.bpm} BPM`}
        />
      )}
      {showMetronome && (
        <EnginePill
          onPress={() => router.push("/(tabs)/metro")}
          onStop={metronome.stopMetronome}
          accentColor={metronome.currentBeat === 0 ? COLORS.brand : COLORS.textOnBrand}
          label={`${metronome.bpm} BPM`}
        />
      )}
    </View>
  );
}
