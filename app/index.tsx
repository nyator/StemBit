import { Text, View, StatusBar } from "react-native";
import { Redirect } from "expo-router";

import { usePreferences } from "../context/PreferencesContext";
import AmbientGlow, { GLOW_WIDTH } from "../components/ui/ambientGlow";

import "../global.css";

// Launch gate: brand splash while preferences load, then route — first-time
// users see onboarding, returning users go straight to login.
//
// Figma places the glow's painted box at (139, -127) on a 390-wide frame, so
// its centre sits 21pt inside the right edge and 100pt below the top. Pinning
// to the right with these offsets keeps that relationship on any screen width,
// which a percentage would not.
const GLOW_TOP = -127;
const GLOW_RIGHT = -(GLOW_WIDTH - 251);

export default function Page() {
  const { prefs, isLoaded } = usePreferences();

  return (
    <View className="flex-1 overflow-hidden bg-canvas">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <AmbientGlow style={{ top: GLOW_TOP, right: GLOW_RIGHT }} />

      <View className="items-center justify-center flex-1">
        <Text className="font-wordmark text-wordmarkLg tracking-wordmark text-ink">
          stembits
        </Text>
      </View>

      {isLoaded && (
        <Redirect href={prefs.seenOnboarding ? "/(auths)/login" : "/(auths)"} />
      )}
    </View>
  );
}
