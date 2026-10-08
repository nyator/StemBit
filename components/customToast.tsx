import { View, Text } from "react-native";
import React from "react";

import { TickCircle, Warning2 } from "./icons";
import { COLORS, SIZES } from "../constants/theme";

// A brief, non-blocking message.
//
// Not wired to anything yet -- the app says everything through Alert today --
// but it is kept on the design system so that whoever does wire it up starts
// from the right surface. It used to be a white panel with the semantic colours
// written out as hex, which on a dark app read as a notification from a
// different product.

const TONES = {
  success: { icon: TickCircle, color: COLORS.success },
  error: { icon: Warning2, color: COLORS.danger },
  warning: { icon: Warning2, color: COLORS.warning },
} as const;

type CustomToastProps = {
  type: keyof typeof TONES;
  title: string;
  /** Second line, when the title alone doesn't say what to do about it. */
  desc?: string;
};

export default function CustomToast({ type, title, desc }: CustomToastProps) {
  const { icon: Icon, color } = TONES[type];

  return (
    <View
      className="absolute z-30 flex-row items-start gap-3 p-4 border top-40 left-screen right-screen rounded-lg bg-surface-sheet border-hairline"
    >
      <Icon size={SIZES.rowIcon} color={color} />
      <View className="flex-1">
        <Text className="text-white text-body font-satoshiBold">{title}</Text>
        {desc ? (
          <Text className="mt-0.5 text-label text-ink-muted font-satoshiRegular">
            {desc}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
