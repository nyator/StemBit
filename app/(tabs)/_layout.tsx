import { Tabs } from "expo-router";
import { View, Image, Text } from "react-native";
import icons from "../../constants/icons";

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
      className={`${focused ? "font-rBlack" : "font-rBold"} text-[12px]`}
      style={{ color }}
    >
      {name}
    </Text>
  </View>
);

export default function TabLayout() {
  return (
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
              color={focused ? "#57C785" : "#fff"}
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
              icon={icons.session}
              name="WPad"
              color={focused ? "#57C785" : "#fff"}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="session"
        options={{
          title: "session",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={icons.session}
              name="Session"
              color={focused ? "#57C785" : "#fff"}
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
              color={focused ? "#57C785" : "#fff"}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}
