import { Link } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { StatusBar } from "react-native";
import SplashScreen from "./splashScreen";


export default function App() {

  const [isShowSplash, setIsShowSplash] = useState(false)

  return (
    <SplashScreen />
    // <View className="flex-1 items-center justify-center bg-background">
    //   <Text className='text-5xl font-rblack text-white'>Stem
    //     <Text className="text-primary">Bit</Text></Text>
    //   <Link href='/home' className="text-blue-500">Home</Link>
    //   <StatusBar barStyle="auto" />
    // </View>
  );
}

