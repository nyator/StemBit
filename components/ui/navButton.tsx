import { TouchableOpacity, View } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { COLORS, SIZES } from "../../constants/theme";
import type { IconComponent } from "../icons";

// Real Liquid Glass on iOS 26+; every other platform (older iOS, Android, web)
// falls back to the flat circle these buttons have always been. A device's
// glass support can't change mid-session, so this is read once.
const HAS_LIQUID_GLASS = isLiquidGlassAvailable();
export const NAV_BUTTON_FOOTPRINT = SIZES.navIcon + 16;

type NavButtonProps = {
  icon: IconComponent;
  onPress: () => void;
  accessibilityLabel: string;
  tint?: "neutral" | "brand";
};

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
          // The interactive glow takes the glass's tint, and with none set it
          // falls back to the system's -- iOS blue -- so a neutral button (Back)
          // flashed blue on press. Only a brand button, where blue is the
          // point, keeps it; the TouchableOpacity dims the rest on press.
          isInteractive={tint === "brand"}
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
