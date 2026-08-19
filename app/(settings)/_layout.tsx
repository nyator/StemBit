import { Stack } from "expo-router";

import { COLORS } from "../../constants/theme";

// Settings and everything under it. Every screen here draws its own header
// (components/ui/screenHeader), so the navigator's is off and the options live
// once on screenOptions -- the same shape as the other three groups.
//
// This used to carry headerLeft/headerStyle/headerBackTitle on three of the
// screens. All of them sat beside `headerShown: false`, so they were dressing a
// header that never rendered.
export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.canvas },
      }}
    />
  );
}
