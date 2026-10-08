import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

// The fill behind a glass control that isn't a NavButton or BrandButton -- a
// pill, a circle of another size. Real Liquid Glass on iOS 26+; everywhere else
// the flat fill `fallbackClassName` describes, which is what these controls
// looked like before glass. Read once: a device's support can't change.
//
// Not interactive, for the reason NavButton's neutral buttons aren't: with no
// tint the press glow falls back to iOS blue. The touchable around it dims on
// press instead.
const HAS_LIQUID_GLASS = isLiquidGlassAvailable();

export default function GlassSurface({
  style,
  fallbackClassName = "bg-white/10",
  children,
}: {
  /** Size, radius and layout. Radius matters: the glass is clipped to it. */
  style: StyleProp<ViewStyle>;
  fallbackClassName?: string;
  children: ReactNode;
}) {
  if (HAS_LIQUID_GLASS) {
    return (
      <GlassView glassEffectStyle="regular" style={[{ overflow: "hidden" }, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <View className={fallbackClassName} style={style}>
      {children}
    </View>
  );
}
