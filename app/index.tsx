import { Text, SafeAreaView, View } from "react-native";
import { Redirect } from "expo-router";
import { StatusBar } from "react-native";

import "../global.css";

export default function Page() {
  return (
    <SafeAreaView className="flex-1 justify-center items-center mx-auto max-w-sm">
      <View className="flex flex-row justify-center items-center w-full">
        <Text className="pt-5 text-7xl tracking-tighter text-white font-rBlack">
          Stem
        </Text>
        <Text className="pt-5 text-7xl tracking-tighter font-rBlack text-accent">
          Bits
        </Text>
        {/* <Text className="text-2xl text-blue-500 underline font-cSemibold"  onPress={() => router.replace("/(tabs)/loop")}> Tabs </Text> */}
      </View>
      <StatusBar barStyle="light-content" />
      <Redirect href="/(tabs)/metro" />
      {/* <Redirect href="/(auths)/register" /> */}
    </SafeAreaView>
  );
}
