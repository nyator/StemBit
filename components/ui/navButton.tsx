import { TouchableOpacity, View } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { COLORS, SIZES } from "../../constants/theme";
import type { IconComponent } from "../icons";

// Real Liquid Glass on iOS 26+; every other platform (older iOS, Android, web)
// falls back to the flat circle these buttons have always been. A device's
// glass support can't change mid-session, so this is read once.
const HAS_LIQUID_GLASS = isLiquidGlassAvailable();

/**
 * The footprint every header button shares: a 24pt icon inside 8pt of padding.
 *
 * Exported because ScreenHeader needs it for the spacer opposite the back
 * button -- that spacer is what keeps a title optically centred whether or not
 * the screen has a right-hand action, so it has to be the same width as the
 * button by construction rather than by a number that happens to match.
 */
export const NAV_BUTTON_FOOTPRINT = SIZES.navIcon + 16;

type NavButtonProps = {
  icon: IconComponent;
  onPress: () => void;
  accessibilityLabel: string;
  /**
   * "brand" for the one action on a header that is the primary thing to do
   * there -- the + that adds a loop, not the button beside it that goes and
   * looks at some. Under Liquid Glass this tints the glass rather than filling
   * it, so the hierarchy survives the material: still obviously the accented
   * button, still obviously made of the same stuff as its neighbours.
   */
  tint?: "neutral" | "brand";
};

/**
 * A circular icon button in a screen header.
 *
 * Written once because it had been written three times -- the back button, the
 * two on the tab header -- to the same geometry, and a fourth copy is how the
 * set starts drifting apart. They sit in the same corner of the screen on
 * different routes, so any drift reads as the header moving between screens.
 */
export default function NavButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  tint = "neutral",
}: NavButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {HAS_LIQUID_GLASS ? (
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          tintColor={tint === "brand" ? COLORS.brand : undefined}
          style={{
            width: NAV_BUTTON_FOOTPRINT,
            height: NAV_BUTTON_FOOTPRINT,
            borderRadius: NAV_BUTTON_FOOTPRINT / 2,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <Icon size={SIZES.navIcon} color={COLORS.white} />
        </GlassView>
      ) : (
        <View
          className={`p-2 rounded-full ${tint === "brand" ? "bg-brand" : "bg-white/10"}`}
        >
          <Icon size={SIZES.navIcon} color={COLORS.white} />
        </View>
      )}
    </TouchableOpacity>
  );
}
