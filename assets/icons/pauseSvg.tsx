import * as React from "react";
import Svg, { Path, Rect } from "react-native-svg";
const PauseSvg = (props: any) => (
  <Svg
    width={49}
    height={49}
    viewBox="0 0 49 49"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <Path
      d="M8.16699 8.125C8.16699 7.02043 9.06242 6.125 10.167 6.125H18.417C19.5216 6.125 20.417 7.02043 20.417 8.125V40.875C20.417 41.9796 19.5216 42.875 18.417 42.875H10.167C9.06242 42.875 8.16699 41.9796 8.16699 40.875V8.125Z"
      fill="#08C192"
      stroke="#098E6C"
      strokeWidth={2}
    />
    <Rect
      x={28.583}
      y={6.125}
      width={12.25}
      height={36.75}
      rx={2}
      fill="#08C192"
      stroke="#098E6C"
      strokeWidth={2}
    />
  </Svg>
);
export default PauseSvg;
