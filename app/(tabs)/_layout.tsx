import { Tabs } from "expo-router";
import { View, Image, Text } from "react-native";
import icons from "../../constants/icons";
import { COLORS } from "../../constants/theme";
import { PlaybackLockProvider } from "../../context/PlaybackLockContext";
import { MetronomeProvider } from "../../context/MetronomeContext";
import { LoopPlaybackProvider } from "../../context/LoopPlaybackContext";
import FloatingEngineControls from "../../components/floatingEngineControls";

type TabIconProps = {
  icon: any;
  name: string;
  color: string;
  focused: boolean;
};

const TabIcon = ({ icon, name, color, focused }: TabIconProps) => (
  <View className="min-w-[6rem] gap-2 items-center h-full">
    <Image
      source={icon}
      resizeMode="contain"
      style={{ width: 34, height: 34 }}
      tintColor={color}
    />
    <Text
      className={`${focused ? "font-satoshiBold" : "font-satoshiBold"} text-[12px]`}
      style={{ color }}
    >
      {name}
    </Text>
  </View>
);

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
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: "#000000",
            width: "100%",
            paddingTop: 10,
            height: "13%",
            alignSelf: "center",
            borderColor: "#000000",
          },
          tabBarItemStyle: {
            justifyContent: "center",
            alignItems: "center",
            flex: 1,
          },
        }}
      >
        <Tabs.Screen
          name="loop"
          options={{
            title: "Loop",
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon
                icon={icons.play}
                name="Bits"
                color={focused ? COLORS.brand : COLORS.white}
                focused={focused}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="pad"
          options={{
            title: "pad",
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon
                icon={icons.wpad}
                name="WPad"
                color={focused ? COLORS.brand : COLORS.white}
                focused={focused}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="metro"
          options={{
            title: "Metro",
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon
                icon={icons.metronome}
                name="Metronome"
                color={focused ? COLORS.brand : COLORS.white}
                focused={focused}
              />
            ),
          }}
        />
      </Tabs>
      <FloatingEngineControls />
    </View>
  );
}
