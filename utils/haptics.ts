import * as Haptics from "expo-haptics";


const STYLES = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
} as const;

/** Fire an impact haptic, but only when the user has haptics enabled. */
export function hapticImpact(
  enabled: boolean,
  style: keyof typeof STYLES = "medium"
) {
  if (!enabled) return;
  Haptics.impactAsync(STYLES[style]).catch(() => { });
}
