import { View, type DimensionValue } from "react-native";

import { COLORS, SHADOWS } from "../../constants/theme";
import type { IconComponent } from "../icons";

// One slide's illustration: a single badged icon as the centrepiece, a
// couple of smaller unbadged glyphs floating near it -- the same "one big
// object, a few smaller related ones nearby" composition a still-life
// illustration uses, built from this app's own icon set rather than drawn
// artwork. The centrepiece gets the dial's own circular surface/border/glow
// treatment; the accents are plain and dim, so they read as motifs rather
// than competing for the same attention.

const PRIMARY_BADGE = 128;
const PRIMARY_ICON = 56;

export type IllustrationAccent = {
  icon: IconComponent;
  size: number;
  /** Percentage strings, positioned against the frame this sits in. */
  top: DimensionValue;
  left: DimensionValue;
  rotate?: string;
};

export default function OnboardingIllustration({
  icon: Primary,
  accents,
  height,
}: {
  icon: IconComponent;
  accents: IllustrationAccent[];
  height: number;
}) {
  return (
    <View style={{ height }} className="items-center justify-center">
      {accents.map((accent, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            top: accent.top,
            left: accent.left,
            transform: accent.rotate ? [{ rotate: accent.rotate }] : undefined,
          }}
        >
          <accent.icon size={accent.size} color={COLORS.textFaint} />
        </View>
      ))}

      <View
        className="items-center justify-center border-2 rounded-full bg-surface-sunken border-hairline-dial"
        style={{ width: PRIMARY_BADGE, height: PRIMARY_BADGE, ...SHADOWS.glow }}
      >
        <Primary size={PRIMARY_ICON} color={COLORS.brand} />
      </View>
    </View>
  );
}
