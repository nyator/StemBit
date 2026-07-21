import Svg, { Circle } from "react-native-svg";

import { COLORS, CONTROL } from "../../constants/theme";

// React Native ships no radio primitive, so this draws the one from the design.
//
// Figma (Audio Output / Volume, node 117:795): selected is a filled disc with a
// 1pt white ring; unselected is a 2pt #4F4F4F ring and no fill. The two states
// have different radii -- 9.5 vs 9 -- because the selected ring is drawn
// thinner, so both end up 20pt across.
//
// The fill comes from CONTROL so it stays in step with the switch and slider.
type RadioProps = {
  selected: boolean;
  size?: number;
};

export default function Radio({ selected, size = 20 }: RadioProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      {selected ? (
        <Circle
          cx={10}
          cy={10}
          r={9.5}
          fill={CONTROL.active}
          stroke={CONTROL.ring}
        />
      ) : (
        <Circle cx={10} cy={10} r={9} stroke={COLORS.borderIdle} strokeWidth={2} />
      )}
    </Svg>
  );
}
