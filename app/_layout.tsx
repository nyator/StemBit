import {SplashScreen, Stack} from "expo-router";
import {useFonts} from "expo-font";
import {useEffect} from "react";
import {PreferencesProvider} from "../context/PreferencesContext";
import {COLORS} from "../constants/theme";

function RootLayout() {
    const [fontsLoaded, error] = useFonts({
        // Names must match constants/theme.ts FONTS and the fontFamily keys in
        // tailwind.config.js.
        "SpaceGrotesk-Bold": require("../assets/fonts/SpaceGrotesk-Bold.ttf"),
        "SpaceGrotesk-Medium": require("../assets/fonts/SpaceGrotesk-Medium.ttf"),
        "SpaceGrotesk-Regular": require("../assets/fonts/SpaceGrotesk-Regular.ttf"),
        "Satoshi-Bold": require("../assets/fonts/Satoshi-Bold.ttf"),
        "Satoshi-Medium": require("../assets/fonts/Satoshi-Medium.ttf"),
        "Satoshi-Regular": require("../assets/fonts/Satoshi-Regular.ttf"),
        "GochiHand-Regular": require("../assets/fonts/GochiHand-Regular.ttf"),
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
        <PreferencesProvider>
            <Stack>
                <Stack.Screen name="index" options={{headerShown: false, contentStyle: {backgroundColor: COLORS.canvas}}}/>
                <Stack.Screen name="(auths)" options={{headerShown: false}}/>
                <Stack.Screen name="(tabs)" options={{headerShown: false}}/>
                <Stack.Screen name="(settings)" options={{headerShown: false}}/>
                <Stack.Screen name="(loops)" options={{headerShown: false}}/>
            </Stack>
        </PreferencesProvider>
    );
}

export default RootLayout;