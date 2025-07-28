import { SplashScreen, Stack } from "expo-router";
import { useFonts } from "expo-font";
import { useEffect } from "react";

import ProfileScreen from "./(profile)/index";
import { createDrawerNavigator } from '@react-navigation/drawer';
const Drawer = createDrawerNavigator();

const RootLayout = () => {
  const [fontsLoaded, error] = useFonts({
    "Chillax-Bold": require("../assets/fonts/Chillax-Bold.otf"),
    "Chillax-Semibold": require("../assets/fonts/Chillax-Semibold.otf"),
    "Chillax-Medium": require("../assets/fonts/Chillax-Medium.otf"),
    "Chillax-Regular": require("../assets/fonts/Chillax-Regular.otf"),
    "Chillax-Extralight": require("../assets/fonts/Chillax-Extralight.otf"),
    "Chillax-Light": require("../assets/fonts/Chillax-Light.otf"),
    "Raleway-Black": require("../assets/fonts/Raleway-Black.ttf"),
    "Raleway-Bold": require("../assets/fonts/Raleway-Bold.ttf"),
    "Raleway-Medium": require("../assets/fonts/Raleway-Medium.ttf"),
    "Raleway-Regular": require("../assets/fonts/Raleway-Regular.ttf"),
    "Raleway-SemiBold": require("../assets/fonts/Raleway-SemiBold.ttf"),
    "Raleway-Thin": require("../assets/fonts/Raleway-Thin.ttf"),
  });

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);

  useEffect(() => {
    if (error) throw error;

    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error]);
  if (!fontsLoaded && !error) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auths)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false, contentStyle: { backgroundColor: "#101116" } }} />
      <Stack.Screen name="(profile)" options={{ headerShown: false}} />
    </Stack>



  );
};

export default RootLayout;