import { useEffect, useState } from "react";
import { Text } from "react-native";
import { Redirect } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { usePreferences } from "../context/PreferencesContext";
import Screen, { GLOW_PLACEMENTS } from "../components/ui/screen";
import PulsingGlow from "../components/ui/pulsingGlow";

import "../global.css";

// Launch gate: brand splash while preferences load, then route -- first-time
// users see onboarding, returning users go straight to login.
//
// No safe-area insets: this is the one screen that is nothing but the wordmark
// centred on the canvas, and a notch inset would push it off centre.

/**
 * How long the entrance holds the redirect off.
 *
 * Preferences usually finish loading well inside this, which used to mean the
 * wordmark's own entrance never got to play -- Redirect fired mid-animation
 * and the gate just vanished. A short floor guarantees the entrance is always
 * seen to completion, without turning a fast load into a slow one: it's a
 * beat, not a delay.
 */
const MIN_DISPLAY_MS = 700;

export default function Page() {
  const { prefs, isLoaded } = usePreferences();
  const [minDisplayElapsed, setMinDisplayElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinDisplayElapsed(true), MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Entrance: the wordmark settles in once, on mount -- not looping, so it
  // never competes with the glow behind it for attention.
  const entrance = useSharedValue(0);
  useEffect(() => {
    entrance.value = withTiming(1, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [entrance]);

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ scale: 0.85 + entrance.value * 0.15 }],
  }));

  return (
    <Screen edges={[]} className="items-center justify-center">
      <PulsingGlow style={GLOW_PLACEMENTS.topRight} />

      <Animated.View style={wordmarkStyle}>
        {/* wordmarkLg, matching sign-in and register. The splash had been drawing
            this at the 48pt display size, which is the tier the BPM readout owns
            -- a number, in Space Grotesk. The logotype has its own two sizes and
            this is the large one. */}
        <Text className="font-wordmark text-wordmarkLg tracking-wordmark text-ink">
          stembits
        </Text>
      </Animated.View>

      {isLoaded && minDisplayElapsed && (
        // TEMP: forced to onboarding to preview it -- revert to
        // `prefs.seenOnboarding ? "/(auths)/login" : "/(auths)"` before shipping.
        <Redirect href="/(auths)" />
      )}
    </Screen>
  );
}
