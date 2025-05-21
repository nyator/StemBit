import { Tabs } from "expo-router";
import { View, Image, Text } from "react-native";
import icons from "../../constants/icons";

type TabIconProps = {
  icon: any;
  name: string;
  color: string;
  focused: boolean;
};

const TabIcon = ({ icon, name, color, focused }: TabIconProps) => {
  return (
    <View className="min-w-[6rem] items-center h-full">
      <Image
        source={icon}
        resizeMode="contain"
        style={{
          width: 30,
          height: 30,
        }}
        tintColor={color}
      />
      <Text
        className={`${focused ? "font-cSemibold" : "font-cSemibold"} text-sm`}
        style={{ color }}
      >
        {name}
      </Text>
    </View>
  );
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          left: "50%",
          transform: [{ translateX: 20 }],
          backgroundColor: "#000",
          borderTopWidth: 10,
          height: 80,
          width: "90%",
          borderTopColor: "#000",
          borderTopLeftRadius: 50,
          borderTopRightRadius: 50,
          borderBottomRightRadius: 50,
          borderBottomLeftRadius: 50,
          alignSelf: "center",
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 10,
          },
          shadowOpacity: 0.25,
          shadowRadius: 3.5,
          marginBottom: 30,
          paddingHorizontal: 24,
        },
        tabBarItemStyle: {
          justifyContent: "center",
          alignItems: "center",
          flex: 1,
          minWidth: 80,
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
              icon={icons.wavesound}
              name="Loop"
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
              icon={icons.drum}
              name="Metronome"
              color={focused ? "#4493CF" : "#fff"}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}
