import { Stack } from "expo-router";

import { COLORS } from "../../constants/theme";

// The loop catalogue and the importer that adds to it.
export default function LoopSoundsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.canvas },
      }}
    />
  );
}
