import React from "react";
import { Stack } from "expo-router";
import { StackNavigationState } from "@react-navigation/native";

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          contentStyle: { backgroundColor: "#101116" },
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
          contentStyle: { backgroundColor: "#101116" },
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          headerShown: false,
          contentStyle: { backgroundColor: "#101116" },
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          headerShown: false,
          contentStyle: { backgroundColor: "#101116" },
        }}
      />
      <Stack.Screen
        name="reset-password"
        options={{
          headerShown: false,
          contentStyle: { backgroundColor: "#101116" },
        }}
      />
      <Stack.Screen
        name="verification-code"
        options={{
          headerShown: false,
          contentStyle: { backgroundColor: "#101116" },
        }}
      />
    </Stack>
  );
}
