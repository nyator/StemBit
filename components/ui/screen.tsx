import type { ReactNode } from "react";
import { StatusBar, View } from "react-native";
import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context";

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
  // The insets as a plain style, rather than letting SafeAreaView apply them.
  //
  // SafeAreaView is a native view that pads itself once it has been laid out,
  // which is a frame after its children first draw. A tab hidden with
  // display:none is laid out from scratch every time it comes back, so that
  // frame happened on every switch: the screen appeared flush to the top of the
  // display and then dropped by the status bar's height. Top-aligned screens
  // (the pad grid, the session list) moved by the whole inset and flickered
  // visibly; the centred ones moved by half and read as clean, which is why
  // this looked like it was only wrong on two of the four tabs.
  //
  // Read through the hook instead and it is an ordinary style in the same
  // render as the content -- there is no second pass to see.
  // Only the edges actually asked for get a padding, rather than the others
  // being set to zero. An inline style beats a className, so zeroing them
  // silently overrode any horizontal padding a caller had set that way -- which
  // is how the auth screens lost their px-instrument and ran edge to edge.
  const insets = useSafeAreaInsets();
  const padding = {
    ...(edges.includes("top") && { paddingTop: insets.top }),
    ...(edges.includes("bottom") && { paddingBottom: insets.bottom }),
    ...(edges.includes("left") && { paddingLeft: insets.left }),
    ...(edges.includes("right") && { paddingRight: insets.right }),
  };

  return (
    <View className="flex-1 overflow-hidden bg-canvas">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {glows.map((placement) => (
        <AmbientGlow key={placement} style={GLOW_PLACEMENTS[placement]} />
      ))}

      <View className={`flex-1 ${className}`} style={padding}>
        {children}
      </View>
    </View>
  );
}
