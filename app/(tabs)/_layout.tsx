import { Tabs } from "expo-router";
import { View } from "react-native";
import { PlaybackLockProvider } from "../../context/PlaybackLockContext";
import { MetronomeProvider } from "../../context/MetronomeContext";
import { LoopPlaybackProvider } from "../../context/LoopPlaybackContext";
import FloatingEngineControls from "../../components/floatingEngineControls";
import FloatingTabBar from "../../components/ui/floatingTabBar";
import { COLORS } from "../../constants/theme";

export default function TabLayout() {
  return (
    <PlaybackLockProvider>
      <MetronomeProvider>
        <LoopPlaybackProvider>
          <TabsWithFloatingControl />
        </LoopPlaybackProvider>
      </MetronomeProvider>
    </PlaybackLockProvider>
  );
}

function TabsWithFloatingControl() {
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
        <Tabs.Screen name="loop" options={{ title: "Loop", headerShown: false }} />
        <Tabs.Screen name="pad" options={{ title: "pad", headerShown: false }} />
        <Tabs.Screen name="metro" options={{ title: "Metro", headerShown: false }} />
      </Tabs>
      <FloatingEngineControls />
    </View>
  );
}
