import { View } from "react-native";

import GradientRibbon from "./gradientRibbon";
import { COLORS, SHADOWS } from "../../constants/theme";
import type { IconComponent } from "../icons";

// Each onboarding slide's graphic: a couple of the brand gradient's ribbons
// flowing behind a single large icon, rather than an illustration of a
// person using the app. The ribbons are the one piece of this that's really
// artwork -- everything else (the icon's circular backing, its glow) is the
// same surface/shadow/border the dial's own circle already uses elsewhere,
// so the "instrument" identity carries through even though this isn't
// literally the dial anymore.

export const ONBOARDING_FRAME_HEIGHT = 220;
const ICON_BACKING = 104;

export default function OnboardingGraphic({
  icon: Icon,
  width,
}: {
  icon: IconComponent;
  width: number;
}) {
  return (
    <View style={{ width, height: ONBOARDING_FRAME_HEIGHT }}>
      <GradientRibbon
        width={width}
        height={ONBOARDING_FRAME_HEIGHT}
        y={ONBOARDING_FRAME_HEIGHT * 0.32}
        amplitude={14}
        thickness={16}
        opacity={0.55}
      />
      <GradientRibbon
        width={width}
        height={ONBOARDING_FRAME_HEIGHT}
        y={ONBOARDING_FRAME_HEIGHT * 0.68}
        amplitude={18}
        thickness={20}
        opacity={0.85}
      />

      <View className="items-center justify-center flex-1">
        <View
          className="items-center justify-center border-2 rounded-full bg-surface-sunken border-hairline-dial"
          style={{
            width: ICON_BACKING,
            height: ICON_BACKING,
            ...SHADOWS.glow,
          }}
        >
          <Icon size={48} color={COLORS.brand} />
        </View>
      </View>
    </View>
  );
}
