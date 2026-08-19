import type { ReactNode } from "react";
import { StatusBar, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import AmbientGlow, { GLOW_HEIGHT, GLOW_WIDTH } from "./ambientGlow";

export const GLOW_PLACEMENTS = {
  topRight: { top: -127, right: -(GLOW_WIDTH - 251) },
  bottomLeft: { bottom: -(GLOW_HEIGHT - 227), left: -35 },
  topLeft: { top: -81, left: -171 },
  topLeftFar: { top: -58, left: -177 },
} as const;

export type GlowPlacement = keyof typeof GLOW_PLACEMENTS;

type ScreenProps = {
  children: ReactNode;
  glows?: GlowPlacement[];
  edges?: readonly Edge[];
  className?: string;
};

export default function Screen({
  children,
  glows = [],
  edges = ["top", "bottom"],
  className = "",
}: ScreenProps) {
  return (
    <View className="flex-1 overflow-hidden bg-canvas">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {glows.map((placement) => (
        <AmbientGlow key={placement} style={GLOW_PLACEMENTS[placement]} />
      ))}

      <SafeAreaView edges={edges} className={`flex-1 ${className}`}>
        {children}
      </SafeAreaView>
    </View>
  );
}
