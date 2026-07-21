import { Stack } from "expo-router";

import { COLORS } from "../../constants/theme";

// Every auth screen shares the same chrome, so the options live on
// screenOptions rather than being repeated per screen. Routes are picked up
// from the filesystem; they only need listing here to override something.
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.canvas },
      }}
    />
  );
}
