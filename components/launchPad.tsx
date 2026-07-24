import { useId } from "react";
import { Text, TouchableOpacity } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { COLORS } from "../constants/theme";

type LaunchPadComponentProp = {
  selectKey: string;
  isPlaying: boolean;
  /** Border/glow tint while playing -- major vs. minor mode. */
  activeColor?: string;
  onPress: () => void;
};

function withAlpha(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function LaunchPadComponent({
  selectKey,
  isPlaying,
  activeColor = COLORS.glow,
  onPress,
}: LaunchPadComponentProp) {
  const gradientId = `padGlow-${useId()}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="w-[30%] m-[1.5%] items-center justify-center overflow-hidden rounded-[15px] border active:scale-95"
      style={{
        aspectRatio: 1,
        borderColor: isPlaying ? withAlpha(activeColor, 0.5) : "rgba(25,25,25,0.5)",
        backgroundColor: isPlaying ? undefined : "rgba(0,0,0,0.5)",
        boxShadow: isPlaying
          ? `inset 3px 4px 4px ${withAlpha(activeColor, 0.4)}`
          : "inset 2px 4px 5px rgba(42,42,42,0.7)",
      }}
    >
      {isPlaying && (
        <Svg
          style={{ position: "absolute", width: "100%", height: "100%" }}
          pointerEvents="none"
        >
          <Defs>
            <RadialGradient id={gradientId} cx="50%" cy="50%" r="70%">
              <Stop offset={0} stopColor={activeColor} stopOpacity={1} />
              <Stop offset={1} stopColor={activeColor} stopOpacity={0.33} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      )}
      <Text
        className="text-center font-satoshiBold"
        style={{
          fontSize: 20,
          letterSpacing: -0.3,
          color: isPlaying ? COLORS.white : COLORS.textSoft,
        }}
      >
        {selectKey || "•"}
      </Text>
    </TouchableOpacity>
  );
}
