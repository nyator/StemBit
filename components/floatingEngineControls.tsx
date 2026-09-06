import type { ReactNode } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { useMetronome } from "../context/MetronomeContext";
import { useLoopPlayback } from "../context/LoopPlaybackContext";
import { usePadPlayback } from "../context/PadPlaybackContext";
import { PlayCircle, Metromone, PadFill, Stop, MetronomeFill } from "./icons";
import { COLORS, RADII } from "../constants/theme";

// Real Liquid Glass on iOS 26+; every other platform (older iOS, Android,
// web) falls back to the flat surface-glass pill this control already had. A
// device's glass support can't change mid-session, so this is read once.
const HAS_LIQUID_GLASS = isLiquidGlassAvailable();

// The Stop button's footprint: an 18pt icon inside 4pt of padding, on the
// same "icon + fixed padding, radius is half the result" formula as every
// other circular icon button in the app.
const STOP_BUTTON_FOOTPRINT = 18 + 8;

type PillProps = {
  onPress: () => void;
  onStop: () => void;
  accentColor: string;
  label: string;
  icon: ReactNode;
};

function EnginePill({ onPress, onStop, accentColor, label, icon }: PillProps) {
  const content = (
    <>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 8,
          marginRight: 10,
          backgroundColor: accentColor,
        }}
      />
      <View className="mr-2">{icon}</View>
      <Text className="mr-3 text-white font-satoshiBold">{label}</Text>
      <TouchableOpacity accessibilityLabel="Stop" onPress={onStop} hitSlop={8}>
        {HAS_LIQUID_GLASS ? (
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            style={{
              width: STOP_BUTTON_FOOTPRINT,
              height: STOP_BUTTON_FOOTPRINT,
              borderRadius: STOP_BUTTON_FOOTPRINT / 2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Stop size={18} />
          </GlassView>
        ) : (
          <View className="p-1 rounded-full bg-white/10">
            <Stop size={18} />
          </View>
        )}
      </TouchableOpacity>
    </>
  );

  if (HAS_LIQUID_GLASS) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          tintColor={COLORS.surfaceGlass}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: RADII.nav,
          }}
        >
          {content}
        </GlassView>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="flex-row items-center px-4 py-3 shadow-lg rounded-nav bg-surface-glass border border-hairline-glass"
      style={{ elevation: 8 }}
    >
      {content}
    </TouchableOpacity>
  );
}

// Small persistent indicators shown on the *other* tabs while a playback
// engine keeps running in the background, so an engine is never silently
// playing with no way to see or stop it. Mounted at the app root
// (app/_layout.tsx), but only rendered while on one of the three tab screens
// -- hidden on Settings, the loop/pad pickers, and auth screens. Laid out in
// a single positioned row so the Metronome, Loop and Pad pills sit side by
// side (wrapping if they don't fit) when more than one happens to be playing.
const TAB_PATHS = ["/loop", "/pad", "/metro"];

export default function FloatingEngineControls() {
  const router = useRouter();
  const pathname = usePathname();
  const metronome = useMetronome();
  const loop = useLoopPlayback();
  const pad = usePadPlayback();

  const isOnTabScreen = TAB_PATHS.includes(pathname);

  const showMetronome = isOnTabScreen && metronome.isPlaying && pathname !== "/metro";
  const showLoop = isOnTabScreen && loop.isPlaying && pathname !== "/loop";
  const showPad = isOnTabScreen && pad.isPlaying && pathname !== "/pad";

  if (!showMetronome && !showLoop && !showPad) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "13%",
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 16,
        gap: 10,
      }}
    >
      {showLoop && (
        <EnginePill
          onPress={() => router.push("/(tabs)/loop")}
          onStop={loop.stopLoop}
          accentColor={COLORS.brand}
          label={`${loop.bpm} BPM`}
          icon={<PlayCircle size={18}/>}
        />
      )}
      {showPad && (
        <EnginePill
          onPress={() => router.push("/(tabs)/pad")}
          onStop={pad.stopPad}
          accentColor={pad.mode === "minor" ? COLORS.danger : COLORS.brand}
          label={pad.activeLabel ?? "Pad"}
          icon={<PadFill size={18} />}
        />
      )}
      {showMetronome && (
        <EnginePill
          onPress={() => router.push("/(tabs)/metro")}
          onStop={metronome.stopMetronome}
          accentColor={metronome.currentBeat === 0 ? COLORS.brand : COLORS.textOnBrand}
          label={`${metronome.bpm} BPM`}
          icon={<MetronomeFill size={18} />}
        />
      )}
    </View>
  );
}
