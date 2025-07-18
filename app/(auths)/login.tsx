import { SafeAreaView, View, Text } from "react-native";
import { StatusBar } from "react-native";
import FormField from "../../constants/formField";
import { useState } from "react";

const LoginScreen = () => {
  const [passsword, setPasssword] = useState("");
  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 px-10">
        <View className="flex flex-row justify-center items-center my-10">
          <Text className="text-5xl text-white font-rBlack mb-4">Stem</Text>
          <Text className="text-5xl text-accent font-rBlack mb-4">Bits</Text>
        </View>
        <View className="flex items-start">
          <Text className="text-white text-2xl font-rBold">Login</Text>
          <FormField title="Password" placeholder="Enter your password"  otherStyles="my-4" />
        </View>
      </View>
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
};

export default LoginScreen;
