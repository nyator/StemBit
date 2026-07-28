import { useId } from "react";
import type { ViewStyle } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

// Soft halo behind an accented beat dot, so the downbeat — and the secondary
// accents that carry compound and odd meters — is seen as well as heard.
//
// Same technique as AmbientGlow: a radial gradient standing in for a Gaussian
// blur, which Android rasterises far more cheaply than a real SVG filter. The
// halo belongs to the accent *currently sounding*, so only one is ever
// mounted at a time and the cost doesn't multiply with the meter — a 12/8 bar
// paints one of these, not twelve.
//
// Stops are exp(-4.6r²) sampled at even offsets: a Gaussian falloff that
// reaches the rim at ~1% and is then forced to 0, since a non-zero final stop
// leaves a visible disc edge against the canvas.
const STOPS = [
  { offset: 0, opacity: 1 },
  { offset: 0.125, opacity: 0.931 },
  { offset: 0.25, opacity: 0.75 },
  { offset: 0.375, opacity: 0.524 },
  { offset: 0.5, opacity: 0.317 },
  { offset: 0.625, opacity: 0.166 },
  { offset: 0.75, opacity: 0.075 },
  { offset: 0.875, opacity: 0.03 },
  { offset: 1, opacity: 0 },
];

/** Diameter of the painted box. Sized to leave ~11px of halo around a 12px dot. */
export const BEAT_GLOW_SIZE = 34;

type BeatGlowProps = {
  /** Diameter of the painted box; defaults to BEAT_GLOW_SIZE. */
  size?: number;
  /** Halo colour — pass the dot's own colour so the two read as one light. */
  color: string;
  /** Opacity at the centre of the halo. */
  intensity?: number;
  /**
   * Positions the painted box, which is absolutely positioned. Callers offset
   * it by half the difference against the dot so the halo centres on the dot
   * without the box taking part in layout.
   */
  style?: ViewStyle;
};

export default function BeatGlow({
  size = BEAT_GLOW_SIZE,
  color,
  intensity = 0.55,
  style,
}: BeatGlowProps) {
  // Gradient ids share a document across every SVG in the tree, so a fixed
  // one would have two glows of different colours fighting over the same def.
  const gradientId = useId();
  const radius = size / 2;

  return (
    <Svg
      width={size}
      height={size}
      pointerEvents="none"
      style={[{ position: "absolute" }, style]}
    >
      <Defs>
        <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          {STOPS.map((stop) => (
            <Stop
              key={stop.offset}
              offset={stop.offset}
              stopColor={color}
              stopOpacity={stop.opacity * intensity}
            />
          ))}
        </RadialGradient>
      </Defs>
      <Circle cx={radius} cy={radius} r={radius} fill={`url(#${gradientId})`} />
    </Svg>
  );
}
