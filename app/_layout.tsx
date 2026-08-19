import {SplashScreen, Stack} from "expo-router";
import {useFonts} from "expo-font";
import {useEffect} from "react";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import {BottomSheetModalProvider} from "@gorhom/bottom-sheet";
import {PreferencesProvider} from "../context/PreferencesContext";
import {PlaybackLockProvider} from "../context/PlaybackLockContext";
import {MetronomeProvider} from "../context/MetronomeContext";
import {UserLoopsProvider} from "../context/UserLoopsContext";
import {SessionsProvider} from "../context/SessionsContext";
import {LoopPlaybackProvider} from "../context/LoopPlaybackContext";
import {PadPlaybackProvider} from "../context/PadPlaybackContext";
import {FeatureTourProvider} from "../context/FeatureTourContext";
import {SessionCueProvider} from "../context/SessionCueContext";
import {SessionPlaybackProvider} from "../context/SessionPlaybackContext";
import FloatingEngineControls from "../components/floatingEngineControls";
import FeatureTour from "../components/ui/featureTour";
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
                            <SessionsProvider>
                            <UserLoopsProvider>
                            <LoopPlaybackProvider>
                                <PadPlaybackProvider>
                                    {/* The session's own engine: a third hidden
                                        WebView, holding a stem cue's tracks on
                                        one AudioContext so they stay locked to
                                        each other. Mounted here for the same
                                        reason the others are -- its audio has to
                                        survive navigating anywhere -- and left
                                        out of FloatingEngineControls, so a
                                        running set never shows up on another
                                        tab. */}
                                    <SessionPlaybackProvider>
                                    {/* Above the Stack because a running
                                        setlist outlives the screen that started
                                        it: (sessions)/setlist unmounts when the
                                        user goes to a tab, and which cue is live
                                        has to survive that the way the audio
                                        does. */}
                                    <SessionCueProvider>
                                    {/* Wraps the Stack so the tab bar (deep
                                        inside it) can register where each tab
                                        sits, and FeatureTour -- a sibling of
                                        the navigator, like the engine controls
                                        -- can draw its spotlight over the top. */}
                                    <FeatureTourProvider>
                                        {/* Every screen in the app draws its
                                            own header, so the chrome is off
                                            once here rather than per route.
                                            Only (tabs) overrides anything. */}
                                        <Stack
                                            screenOptions={{
                                                headerShown: false,
                                                contentStyle: {backgroundColor: COLORS.canvas},
                                            }}
                                        >
                                            {/* No swipe back out of the tabs:
                                                behind them is the auth stack,
                                                and a stray edge swipe on an
                                                instrument screen should not
                                                sign anyone out of the app. */}
                                            <Stack.Screen name="(tabs)" options={{gestureEnabled: false}}/>
                                        </Stack>
                                        <FloatingEngineControls />
                                        <FeatureTour />
                                    </FeatureTourProvider>
                                    </SessionCueProvider>
                                    </SessionPlaybackProvider>
                                    <KeepAwakeWhilePlaying />
                                </PadPlaybackProvider>
                            </LoopPlaybackProvider>
                            </UserLoopsProvider>
                            </SessionsProvider>
                        </MetronomeProvider>
                    </PlaybackLockProvider>
                </BottomSheetModalProvider>
            </PreferencesProvider>
        </GestureHandlerRootView>
    );
}

export default RootLayout;