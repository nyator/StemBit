import { useState } from "react";
import { SafeAreaView, View, Text, TouchableOpacity } from "react-native";
import { StatusBar } from "react-native";

import FormField from "../../components/formField";
import CustomButton from "../../components/customButton";

import { Redirect } from "expo-router";

const ForgotPasswordScreen = () => {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 px-7">
        <View className="flex flex-row justify-center items-center my-10">
          <Text className="text-5xl text-white font-rBlack mb-4">Stem</Text>
          <Text className="text-5xl text-accent font-rBlack mb-4">Bits</Text>
        </View>
        <View className="flex items-start">
          <Text className="text-white text-3xl font-rBold">
            Forgot Password
          </Text>
          <View className="flex flex-col items-center gap-6 w-full">
            <FormField
              title="Email"
              value={form.email}
              handleChangeText={(e) => setForm({ ...form, email: e })}
              otherStyles="mt-10"
              placeholder="Enter Your Email"
              keyboardType="email-address"
            />

            <CustomButton
              title="Get Reset Code"
              containerStyles="w-full"
              handlePress={() => {}}
            />
          </View>
        </View>
        <View className="flex flex-row right-2/4 absolute bottom-0">
          <Text className="text-white/50 font-rMedium">by</Text>
          <Text className="text-accent font-rMedium"> oneha</Text>
        </View>
      </View>
      <StatusBar barStyle="light-content" />
      <Redirect href="/reset-password" />
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;
