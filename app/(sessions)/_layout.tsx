import { Stack } from "expo-router";

import { COLORS } from "../../constants/theme";

// Below a session: its running order, and -- for a cue that holds stems -- the
// screen you actually perform that song from. Sessions themselves live in the
// tab bar, since that is where you reach for them.
export default function SessionsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.canvas },
      }}
    />
  );
}
