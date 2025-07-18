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
          width: 24,
          height: 24,
        }}
        tintColor={color}
      />
      <Text
        className={`${focused ? "font-rBold" : "font-rSemiBold"} text-sm`}
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
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottomRightRadius: 20,
          borderBottomLeftRadius: 20,
          alignSelf: "center",
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 2,
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
