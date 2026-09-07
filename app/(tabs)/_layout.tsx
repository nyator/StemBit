import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@clerk/expo";
import FloatingTabBar from "../../components/ui/floatingTabBar";
import { COLORS } from "../../constants/theme";

// The playback engines (PlaybackLock/Metronome/Loop) and FloatingEngineControls
// are mounted at the app root (app/_layout.tsx), above every navigator, so their
// audio survives navigating to non-tab screens. This layout is just the tabs.
export default function TabLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  // The gate for the whole instrument surface.
  //
  // It lives here rather than on each of the four tabs because this is the one
  // layout every one of them mounts through -- and because the sub-stacks
  // ((loops), (pads), (sessions), (settings)) are all pushed from inside a tab,
  // so guarding the entrance guards everything behind it.
  //
  // Nothing renders until Clerk has read the stored session. Returning the
  // signed-out redirect during that window would bounce a returning user to the
  // sign-in screen on every cold start, a frame before their session loads.
  if (!isLoaded) {
    return <View style={{ flex: 1, backgroundColor: COLORS.canvas }} />;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auths)/login" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        // Keep every tab's scene attached in the view hierarchy. Left to the
        // defaults, inactive tabs are detached (Android) and mounted lazily, so
        // switching to one re-attaches/re-mounts its scene -- a blank frame and
        // layout settle that reads as a glitchy transition. The three screens
        // are light and their audio state already lives in the providers above,
        // so keeping them warm just makes tab switches instant.
        detachInactiveScreens={false}
        screenOptions={{
          headerShown: false,
          animation: "none",
          lazy: false,
          freezeOnBlur: false,
          sceneStyle: { backgroundColor: COLORS.canvas },
          tabBarStyle: {
            width: "100%",
            paddingTop: 10,
            height: "13%",
            alignSelf: "center",
          },
        }}
      >
        <Tabs.Screen name="session" options={{ title: "Session", headerShown: false }} />
        <Tabs.Screen name="loop" options={{ title: "Loop", headerShown: false }} />
        <Tabs.Screen name="pad" options={{ title: "pad", headerShown: false }} />
        <Tabs.Screen name="metro" options={{ title: "Metro", headerShown: false }} />
      </Tabs>
    </View>
  );
}
