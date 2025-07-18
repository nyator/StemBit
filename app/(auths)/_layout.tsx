import { View, Text, BackHandler } from "react-native";
import React from "react";
import { Stack } from "expo-router";

const AuthLayout = () => {
  return (
    // <View>
    //   <Text>AuthLayout</Text>
    // </View>
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false, contentStyle: {backgroundColor: "#101116"} }}  />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      {/* <Stack.Screen name="change-password" options={{ headerShown: false }} /> */}
    </Stack>
  );
};

export default AuthLayout;
