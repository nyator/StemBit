import React from "react";
import { Stack } from "expo-router";

const PadSoundsLayout = () => {
  return (
    <Stack>
      <Stack.Screen name="sounds" options={{ headerShown: false }} />
    </Stack>
  );
};

export default PadSoundsLayout;
