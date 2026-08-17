import { Stack } from "expo-router";

// Below a session: its running order, and -- for a cue that holds stems -- the
// screen you actually perform that song from. Sessions themselves live in the
// tab bar, since that is where you reach for them.
export default function SessionsLayout() {
  return (
    <Stack>
      <Stack.Screen name="setlist" options={{ headerShown: false }} />
      <Stack.Screen name="performance" options={{ headerShown: false }} />
    </Stack>
  );
}
