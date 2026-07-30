import {SplashScreen, Stack} from "expo-router";
import {useFonts} from "expo-font";
import {useEffect} from "react";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import {BottomSheetModalProvider} from "@gorhom/bottom-sheet";
import {PreferencesProvider} from "../context/PreferencesContext";
import {PlaybackLockProvider} from "../context/PlaybackLockContext";
import {MetronomeProvider} from "../context/MetronomeContext";
import {UserLoopsProvider} from "../context/UserLoopsContext";
import {LoopPlaybackProvider} from "../context/LoopPlaybackContext";
import {PadPlaybackProvider} from "../context/PadPlaybackContext";
import FloatingEngineControls from "../components/floatingEngineControls";
import KeepAwakeWhilePlaying from "../components/keepAwakeWhilePlaying";
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
        <GestureHandlerRootView style={{flex: 1}}>
            <PreferencesProvider>
                <BottomSheetModalProvider>
                    {/*
                      The metronome and loop engines live here, above the Stack,
                      rather than inside (tabs). Their audio runs in hidden
                      WebViews; if they were mounted inside a navigator screen,
                      pushing a (settings)/(loops)/(pads) route would freeze or
                      detach that screen and suspend the WebView's audio clock,
                      stopping playback. Mounted above every navigator, they keep
                      ticking no matter where the user navigates. FloatingEngine-
                      Controls rides alongside so the running engine can always be
                      seen and stopped, even on non-tab screens.
                    */}
                    <PlaybackLockProvider>
                        <MetronomeProvider>
                            {/* Above the loop engine: it reads the user's
                                imported loops to preload them alongside the
                                shipped catalog. */}
                            <UserLoopsProvider>
                            <LoopPlaybackProvider>
                                <PadPlaybackProvider>
                                    <Stack>
                                        <Stack.Screen name="index" options={{headerShown: false, contentStyle: {backgroundColor: COLORS.canvas}}}/>
                                        <Stack.Screen name="(auths)" options={{headerShown: false}}/>
                                        <Stack.Screen name="(tabs)" options={{headerShown: false, gestureEnabled: false}}/>
                                        <Stack.Screen name="(settings)" options={{headerShown: false}}/>
                                        <Stack.Screen name="(loops)" options={{headerShown: false}}/>
                                        <Stack.Screen name="(pads)" options={{headerShown: false}}/>
                                    </Stack>
                                    <FloatingEngineControls />
                                    <KeepAwakeWhilePlaying />
                                </PadPlaybackProvider>
                            </LoopPlaybackProvider>
                            </UserLoopsProvider>
                        </MetronomeProvider>
                    </PlaybackLockProvider>
                </BottomSheetModalProvider>
            </PreferencesProvider>
        </GestureHandlerRootView>
    );
}

export default RootLayout;