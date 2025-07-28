import * as React from "react";
import Svg, { Path, Line } from "react-native-svg";

const EclipseSvg = (props: any) => (
  <Svg
    width={305}
    height={305}
    viewBox="0 0 305 305"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <Path
      d="M152.5 0.5C236.447 0.5 304.5 68.5527 304.5 152.5C304.5 172.805 299.601 183.799 291.32 190.884C287.163 194.44 282.127 197.037 276.356 199.321C270.58 201.608 264.109 203.567 257.072 205.872C243.014 210.477 226.811 216.43 209.915 229.021C193.019 241.612 175.455 260.823 158.631 291.918C154.51 299.534 146.683 304.631 138.142 303.831C60.9284 296.597 0.5 231.605 0.5 152.5C0.5 68.5527 68.5527 0.5 152.5 0.5Z"
      fill="black"
      stroke="#262525"
    />
    <Line
      x1={75.5}
      y1={146.481}
      x2={75.5}
      y2={159.481}
      stroke="#262525"
      strokeLinecap="round"
    />
    <Line
      x1={81.5}
      y1={146.481}
      x2={81.5}
      y2={159.481}
      stroke="#262525"
      strokeLinecap="round"
    />
    <Line
      x1={224.5}
      y1={146.481}
      x2={224.5}
      y2={159.481}
      stroke="#262525"
      strokeLinecap="round"
    />
    <Line
      x1={230.5}
      y1={146.481}
      x2={230.5}
      y2={159.481}
      stroke="#262525"
      strokeLinecap="round"
    />
  </Svg>
);
export default EclipseSvg;