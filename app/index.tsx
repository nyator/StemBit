import { Text, SafeAreaView, View } from "react-native";
import { Redirect } from "expo-router";
import { StatusBar } from "react-native";

import "../global.css";

export default function Page() {
  return (
    <SafeAreaView className="mx-auto max-w-sm flex-1 justify-center items-center">
      <View className="flex justify-center items-center w-full flex-row">
        <Text className="font-rBlack text-7xl text-white pt-5 tracking-tighter">
          Stem
        </Text>
        <Text className="font-rBlack text-7xl text-accent pt-5 tracking-tighter">
          Bits
        </Text>
        {/* <Text className="text-2xl underline font-cSemibold text-blue-500"  onPress={() => router.replace("/(tabs)/loop")}> Tabs </Text> */}
      </View>
      <StatusBar barStyle="light-content" />
      {/* <Redirect href="/(tabs)/loop" /> */}
      <Redirect href="/(auths)" />
    </SafeAreaView>
  );
}
