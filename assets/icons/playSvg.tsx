import * as React from "react";
import Svg, { Path } from "react-native-svg";
const PlaySvg = (props: any) => (
  <Svg
    width={49}
    height={49}
    viewBox="0 0 49 49"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <Path
      d="M40.124 20.2363C43.3086 22.1869 43.3086 26.8131 40.124 28.7637L17.6113 42.5527C14.2797 44.5932 10.0001 42.1959 10 38.2891L10 10.7109C10.0001 6.80414 14.2797 4.40683 17.6113 6.44727L40.124 20.2363Z"
      fill="#08C192"
      stroke="#098E6C"
      strokeWidth={2}
    />
  </Svg>
);
export default PlaySvg;
