import { Stack } from "expo-router";

import { COLORS } from "../../constants/theme";

// The pad catalogue.
export default function PadSoundsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.canvas },
      }}
    />
  );
}
