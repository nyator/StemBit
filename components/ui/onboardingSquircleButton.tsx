import { Pressable, View } from "react-native";

import { COLORS, SHADOWS } from "../../constants/theme";
import { ArrowRight } from "../icons";

// The forward action on every slide but the last: a solid white squircle
// floating on the dark canvas with a real drop shadow, standing in for the
// arrow-and-label Back/Next row the layout doesn't otherwise call for. White
// rather than the brand gradient -- InverseButton (Log out, segmented
// selection) is already this app's "solid light surface, dark ink" treatment
// elsewhere, so this reads as the same family of control rather than a new
// one invented just for this screen.

const SIZE = 56;

export default function OnboardingSquircleButton({
  onPress,
  accessibilityLabel,
}: {
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
    >
      <View
        className="items-center justify-center bg-white"
        style={{ width: SIZE, height: SIZE, borderRadius: 18, ...SHADOWS.float }}
      >
        <ArrowRight size={22} color={COLORS.textInverse} />
      </View>
    </Pressable>
  );
}
