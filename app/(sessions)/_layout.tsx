import { Stack } from "expo-router";

// One screen below a session: its running order. Sessions themselves live in the
// tab bar, since that is where you reach for them.
export default function SessionsLayout() {
  return (
    <Stack>
      <Stack.Screen name="setlist" options={{ headerShown: false }} />
    </Stack>
  );
}
