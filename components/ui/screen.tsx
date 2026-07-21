import type { ReactNode } from "react";
import { StatusBar, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import AmbientGlow, { GLOW_HEIGHT, GLOW_WIDTH } from "./ambientGlow";

// Every screen in the design is the same dark canvas with one or two ambient
// glows bleeding in from the edges, clipped by the screen bounds.
//
// Positions are given as the offset of the glow's *painted* 460x454 box on the
// 390x844 Figma frame, converted to edge-anchored offsets so they hold their
// relationship to the corner on any screen size. See ambientGlow.tsx for why
// the painted box is larger than the ellipse Figma reports.
export const GLOW_PLACEMENTS = {
  /** Splash. Centre sits 21pt inside the right edge, 100pt below the top. */
  topRight: { top: -127, right: -(GLOW_WIDTH - 251) },
  /** Sign in, onboarding, get started. */
  bottomLeft: { bottom: -(GLOW_HEIGHT - 227), left: -35 },
  /** Settings, profile, and the other list screens. */
  topLeft: { top: -81, left: -171 },
  /** Metronome's upper glow, pushed further off-canvas than topLeft. */
  topLeftFar: { top: -58, left: -177 },
} as const;

export type GlowPlacement = keyof typeof GLOW_PLACEMENTS;

type ScreenProps = {
  children: ReactNode;
  /** Which ambient glows to paint. Most screens have one; a few have two. */
  glows?: GlowPlacement[];
  /** Safe-area edges to inset. Glows always bleed past them. */
  edges?: readonly Edge[];
  /** Extra classes on the content container. */
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
