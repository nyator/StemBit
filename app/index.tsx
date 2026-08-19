import { Text } from "react-native";
import { Redirect } from "expo-router";

import { usePreferences } from "../context/PreferencesContext";
import Screen from "../components/ui/screen";

import "../global.css";

// Launch gate: brand splash while preferences load, then route -- first-time
// users see onboarding, returning users go straight to login.
//
// No safe-area insets: this is the one screen that is nothing but the wordmark
// centred on the canvas, and a notch inset would push it off centre.
export default function Page() {
  const { prefs, isLoaded } = usePreferences();

  return (
    <Screen glows={["topRight"]} edges={[]} className="items-center justify-center">
      {/* wordmarkLg, matching sign-in and register. The splash had been drawing
          this at the 48pt display size, which is the tier the BPM readout owns
          -- a number, in Space Grotesk. The logotype has its own two sizes and
          this is the large one. */}
      <Text className="font-wordmark text-wordmarkLg tracking-wordmark text-ink">
        stembits
      </Text>

      {isLoaded && (
        <Redirect href={prefs.seenOnboarding ? "/(auths)/login" : "/(auths)"} />
      )}
    </Screen>
  );
}
