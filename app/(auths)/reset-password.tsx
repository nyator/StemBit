import { useState } from "react";
import { SafeAreaView, View, Text } from "react-native";
import { StatusBar } from "react-native";

import FormField from "../../components/formField";
import CustomButton from "../../components/customButton";

const ResetPasswordScreen = () => {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 px-7">
        <View className="flex flex-row justify-center items-center my-10">
          <Text className="mb-4 text-5xl text-white font-rBlack">Stem</Text>
          <Text className="mb-4 text-5xl text-accent font-rBlack">Bits</Text>
        </View>
        <View className="flex items-start">
          <Text className="text-3xl text-white font-rBold">Reset Password</Text>
          <View className="flex flex-col gap-6 items-center w-full">
            <FormField
              // title="Email"
              value={form.email}
              handleChangeText={(e) => setForm({ ...form, email: e })}
              // otherStyles="mt-10"
              placeholder="Enter Reset Code "
            />
            <CustomButton
              title="Reset Password"
              containerStyles="w-full"
              handlePress={() => {}}
            />
          </View>
        </View>
        <View className="flex absolute bottom-0 right-2/4 flex-row">
          <Text className="text-white/50 font-rMedium">by</Text>
          <Text className="text-accent font-rMedium"> nehtek</Text>
        </View>
      </View>
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
};

export default ResetPasswordScreen;

