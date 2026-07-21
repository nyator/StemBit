import Svg, { Circle, Defs, FeGaussianBlur, Filter } from "react-native-svg";

import { COLORS } from "../../constants/theme";

// The metronome dial's two halo rings (Figma: glow-ring / glow-ring-outer) --
// a brand-blue circle stroke blurred with feGaussianBlur, exactly as drawn.
// Unlike the corner ambient glow, this appears once per screen rather than on
// every screen, so a real SVG filter is cheap enough here to be worth the
// exact match over a gradient approximation. Shared between the Metronome and
// Loop screens, which use the same dial treatment.
export function GlowRing({
  size,
  radius,
  strokeWidth,
  blur,
  opacity,
}: {
  size: number;
  radius: number;
  strokeWidth: number;
  blur: number;
  opacity: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: "absolute" }}
    >
      <Defs>
        <Filter id="ringBlur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur stdDeviation={blur} />
        </Filter>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={COLORS.brand}
        strokeWidth={strokeWidth}
        opacity={opacity}
        filter="url(#ringBlur)"
      />
    </Svg>
  );
}
