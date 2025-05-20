import { SplashScreen, Stack } from "expo-router";
import { useFonts } from "expo-font";
import { useEffect } from "react";



const RootLayout = () => {
  const [fontsLoaded, error] = useFonts({
    "Chillax-Bold": require("../assets/fonts/Chillax-Bold.otf"),
    "Chillax-Semibold": require("../assets/fonts/Chillax-Semibold.otf"),
    "Chillax-Medium": require("../assets/fonts/Chillax-Medium.otf"),
    "Chillax-Regular": require("../assets/fonts/Chillax-Regular.otf"),
    "Chillax-Extralight": require("../assets/fonts/Chillax-Extralight.otf"),
    "Chillax-Light": require("../assets/fonts/Chillax-Light.otf"),
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
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
};

export default RootLayout;