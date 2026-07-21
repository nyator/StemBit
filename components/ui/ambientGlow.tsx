import { View, type ViewStyle } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

import { COLORS } from "../../constants/theme";

// The soft teal bloom that sits in a corner of nearly every screen in the
// design (Figma calls it "Ellipse 8").
//
// In Figma it's a 260x254 ellipse of #00415B at 26% opacity with a Gaussian
// blur of stdDeviation 50. A blur spreads roughly 2x its stdDeviation in each
// direction, which is why the painted box is 460x454 rather than 260x254 --
// callers position the *painted* box, so those are the numbers exported below.
//
// We approximate the blur with a radial gradient instead of running a real
// SVG filter. Two reasons: the glow appears on every screen and twice on the
// metronome, and filters are re-rasterised on Android where a gradient is a
// cheap GPU fill.
//
// The stops aren't eyeballed -- they're the disc-convolved-with-Gaussian
// profile evaluated numerically at eight even offsets and scaled by the 26%
// base opacity. Worst deviation from a true feGaussianBlur is ~1/255 alpha
// levels, i.e. below what a display can show. The final stop is forced to 0 so
// the box edge leaves no seam.
export const GLOW_WIDTH = 460;
export const GLOW_HEIGHT = 454;

const STOPS = [
  { offset: 0, opacity: 0.2512 },
  { offset: 0.125, opacity: 0.2459 },
  { offset: 0.25, opacity: 0.2276 },
  { offset: 0.375, opacity: 0.1914 },
  { offset: 0.5, opacity: 0.1393 },
  { offset: 0.625, opacity: 0.0837 },
  { offset: 0.75, opacity: 0.04 },
  { offset: 0.875, opacity: 0.0148 },
  { offset: 1, opacity: 0 },
];

type AmbientGlowProps = {
  /** Position the 460x454 painted box; it is absolutely positioned. */
  style?: ViewStyle;
};

export default function AmbientGlow({ style }: AmbientGlowProps) {
  return (
    <View
      pointerEvents="none"
      style={[{ position: "absolute", width: GLOW_WIDTH, height: GLOW_HEIGHT }, style]}
    >
      <Svg width={GLOW_WIDTH} height={GLOW_HEIGHT} viewBox="0 0 460 454">
        <Defs>
          <RadialGradient id="ambientGlow" cx="50%" cy="50%" r="50%">
            {STOPS.map(({ offset, opacity }) => (
              <Stop
                key={offset}
                offset={offset}
                stopColor={COLORS.glow}
                stopOpacity={opacity}
              />
            ))}
          </RadialGradient>
        </Defs>
        <Ellipse cx={230} cy={227} rx={230} ry={227} fill="url(#ambientGlow)" />
      </Svg>
    </View>
  );
}
