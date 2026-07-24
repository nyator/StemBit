import * as Haptics from "expo-haptics";

// Central gate for haptic feedback. Every buzz in the app goes through here so
// the single "Haptic Feedback" preference (settings) turns them all on/off.
//
// Note: haptics only fire on physical hardware — the iOS Simulator and most
// Android emulators produce nothing, so test on a real device. Failures (e.g.
// on web) are swallowed rather than surfaced as unhandled rejections.
const STYLES = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
} as const;

/** Fire an impact haptic, but only when the user has haptics enabled. */
export function hapticImpact(
  enabled: boolean,
  style: keyof typeof STYLES = "light"
) {
  if (!enabled) return;
  Haptics.impactAsync(STYLES[style]).catch(() => {});
}
