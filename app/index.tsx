import { Text, View } from "react-native";
import '../global.css'
import { useRouter } from "expo-router";
import { Redirect } from "expo-router";

export default function Page() {
  const router = useRouter();

  return (
    <View className="mx-auto max-w-sm flex-1 justify-center gap-4 px-8 py-4">
      <View className="flex-1 flex justify-center max-w-3xl mx-auto items-center">
        <Text
          className="font-cBold text-[62px] text-gray-900 text-center"
        >
          Stem World
        </Text>
        {/* <Text className="text-2xl underline font-cSemibold text-blue-500"  onPress={() => router.replace("/(tabs)/loop")}> Tabs </Text> */}
        <Redirect href="/(tabs)/loop" />
      </View>
    </View>
  );
}
