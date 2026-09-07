import {SplashScreen, Stack} from "expo-router";
import {useFonts} from "expo-font";
import {useEffect} from "react";
import {Text, View} from "react-native";
import {ClerkProvider} from "@clerk/expo";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import {tokenCache} from "../lib/tokenCache";
import {SafeAreaProvider, initialWindowMetrics} from "react-native-safe-area-context";
import {BottomSheetModalProvider} from "@gorhom/bottom-sheet";
import {PreferencesProvider} from "../context/PreferencesContext";
import {PlaybackLockProvider} from "../context/PlaybackLockContext";
import {MetronomeProvider} from "../context/MetronomeContext";
import {UserLoopsProvider} from "../context/UserLoopsContext";
import {LoopStoreProvider} from "../context/LoopStoreContext";
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

// Read at module scope so the value is inlined by Babel at build time. Clerk's
// own docs are explicit that the key must be passed to ClerkProvider rather
// than read inside the SDK: env vars are not inlined inside node_modules, so a
// production build would hand it undefined.
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function RootLayout() {
    // Every face is registered under its PostScript-style name, and those names
    // must match constants/theme.ts FONTS and the fontFamily keys in
    // tailwind.config.js exactly -- a typo here doesn't error, it silently
    // falls back to the system font, which is the hardest kind of type bug to
    // spot on a device.
    //
    // Satoshi ships as OTF; Space Grotesk and Gochi Hand stay TTF. React Native
    // loads both, so there is nothing to convert.
    const [fontsLoaded, error] = useFonts({
        "SpaceGrotesk-Bold": require("../assets/fonts/SpaceGrotesk-Bold.ttf"),
        "SpaceGrotesk-Medium": require("../assets/fonts/SpaceGrotesk-Medium.ttf"),
        "SpaceGrotesk-Regular": require("../assets/fonts/SpaceGrotesk-Regular.ttf"),

        "Satoshi-Light": require("../assets/fonts/Satoshi-Light.otf"),
        "Satoshi-LightItalic": require("../assets/fonts/Satoshi-LightItalic.otf"),
        "Satoshi-Regular": require("../assets/fonts/Satoshi-Regular.otf"),
        "Satoshi-Italic": require("../assets/fonts/Satoshi-Italic.otf"),
        "Satoshi-Medium": require("../assets/fonts/Satoshi-Medium.otf"),
        "Satoshi-MediumItalic": require("../assets/fonts/Satoshi-MediumItalic.otf"),
        "Satoshi-Bold": require("../assets/fonts/Satoshi-Bold.otf"),
        "Satoshi-BoldItalic": require("../assets/fonts/Satoshi-BoldItalic.otf"),
        "Satoshi-Black": require("../assets/fonts/Satoshi-Black.otf"),
        "Satoshi-BlackItalic": require("../assets/fonts/Satoshi-BlackItalic.otf"),

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

    if (!CLERK_PUBLISHABLE_KEY) {
        // A missing key otherwise surfaces as a Clerk internal error with no
        // hint about what to do, so it is caught here where the fix can be
        // stated. Dev-only in practice -- a release build without the key would
        // fail the moment anyone opened it.
        return (
            <View style={{flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.canvas, padding: 24}}>
                <Text className="text-body text-white text-center font-satoshiRegular">
                    Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env, then restart
                    with{"\n"}npx expo start --dev-client -c
                </Text>
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={{flex: 1}}>
            {/*
              Clerk owns the session and has to sit above everything that can
              read it -- the Stack, and the settings screens that show who is
              signed in. tokenCache puts the session in the Keychain/Keystore
              rather than memory, which is what makes a cold start still signed
              in.
            */}
            <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
            {/*
              Our own SafeAreaProvider, seeded with the metrics the native side
              already knows at launch.

              expo-router mounts one above this, but passes initialMetrics only
              on web and under test -- on a device it is undefined, so the first
              render reports zero insets and the real ones arrive a frame later.
              Every screen therefore drew once flush to the top of the display
              and then dropped by the status bar's height, which is the flicker
              on switching tabs. initialWindowMetrics is a synchronous native
              constant, so seeded with it the first frame is already right.

              Nesting is supported and the inner provider wins for everything
              below it; expo-router's own is left alone.
            */}
            <SafeAreaProvider initialMetrics={initialWindowMetrics}>
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
                            {/* Below UserLoopsProvider, which is where a
                                finished download is filed -- the store fetches
                                the audio and hands it straight over, so it has
                                to be able to see that context. Above the Stack
                                so the catalogue is fetched once at launch
                                rather than every time the store screen is
                                pushed. */}
                            <LoopStoreProvider>
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
                                    {/* Inside SessionPlaybackProvider, not
                                        below it: it reads all four engines,
                                        and the session one is the whole point
                                        -- a set runs longest with nobody
                                        touching the phone. */}
                                    <KeepAwakeWhilePlaying />
                                    </SessionPlaybackProvider>
                                </PadPlaybackProvider>
                            </LoopPlaybackProvider>
                            </LoopStoreProvider>
                            </UserLoopsProvider>
                            </SessionsProvider>
                        </MetronomeProvider>
                    </PlaybackLockProvider>
                </BottomSheetModalProvider>
            </PreferencesProvider>
            </SafeAreaProvider>
            </ClerkProvider>
        </GestureHandlerRootView>
    );
}

export default RootLayout;