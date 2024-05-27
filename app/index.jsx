import { Link } from "expo-router";
import { Text, View } from "react-native";
import { StatusBar } from "react-native";

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className='text-3xl font-rblack'>StemBit</Text>
      <Link href='/home' className="text-blue-500">Home</Link>
      <StatusBar style="auto" />
    </View>
  );
}

