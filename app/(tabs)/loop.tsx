import { SafeAreaView, View, Text, StatusBar } from "react-native";
import HeaderComponent from "../../components/headerComponent";

export default function LoopScreen() {
  return (
    <SafeAreaView className="flex-1 justify-start items-center bg-primary">
      <HeaderComponent />
      <View className="flex-1 justify-center items-center w-full">
        <Text className="text-2xl text-white font-cBold">loop Tab</Text>
      </View>
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
}
