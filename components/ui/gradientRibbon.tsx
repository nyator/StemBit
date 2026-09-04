import { useId } from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { COLORS } from "../../constants/theme";

// A flowing band of the brand gradient, one gentle undulation across its
// width -- the graphic language behind each onboarding slide, in place of
// the illustrated-person artwork the layout used to carry.
//
// Built from a single cubic bezier for the centreline, offset vertically by
// half the thickness for the top and bottom edges. That offset isn't a true
// parallel curve (the ribbon reads very slightly thinner at the peaks of the
// curve than at its ends), which is the right trade for a decorative
// background shape -- a mathematically exact parallel curve needs the
// derivative at every point, and nothing here is precise enough to need it.
//
// Sized to the whole frame it sits in rather than to its own bounding box, so
// several of these can share one coordinate space and actually line up.

export default function GradientRibbon({
  width,
  height,
  y,
  amplitude,
  thickness,
  opacity = 1,
}: {
  /** The frame's full size -- every ribbon in it shares this. */
  width: number;
  height: number;
  /** The centreline's vertical position within that frame. */
  y: number;
  /** How far the curve bows up/down from its centreline. */
  amplitude: number;
  thickness: number;
  opacity?: number;
}) {
  const gradientId = `ribbon-${useId()}`;
  const half = thickness / 2;
  const topY = y - half;
  const bottomY = y + half;

  const path = [
    `M 0,${topY}`,
    `C ${width * 0.33},${topY - amplitude} ${width * 0.67},${topY + amplitude} ${width},${topY}`,
    `L ${width},${bottomY}`,
    `C ${width * 0.67},${bottomY + amplitude} ${width * 0.33},${bottomY - amplitude} 0,${bottomY}`,
    "Z",
  ].join(" ");

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", opacity }}
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset={0} stopColor={COLORS.brandFrom} />
          <Stop offset={1} stopColor={COLORS.brandTo} />
        </LinearGradient>
      </Defs>
      <Path d={path} fill={`url(#${gradientId})`} />
    </Svg>
  );
}
