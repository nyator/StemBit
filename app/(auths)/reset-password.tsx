import { useState } from "react";
import { View, Text, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import ScreenHeader from "../../components/ui/screenHeader";
import FormField from "../../components/formField";
import CustomButton from "../../components/customButton";

const ResetPasswordScreen = () => {
  const router = useRouter();
  const [form, setForm] = useState({
    code: "",
    password: "",
  });

  const submitResetPassword = () => {
    router.push("/(tabs)/loop");
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Reset Password" />

      <View className="flex-1 px-5">
        <Text className="mt-2 mb-1 text-sm leading-5 text-white/60 font-satoshiRegular">
          Enter the code from your email and choose a new password.
        </Text>
        <View className="flex flex-col items-center w-full gap-6">
          <FormField
            value={form.code}
            handleChangeText={(e) => setForm({ ...form, code: e })}
            otherStyles="mt-4"
            placeholder="Enter reset code"
            keyboardType="numeric"
          />
          <FormField
            title="Password"
            value={form.password}
            handleChangeText={(e) => setForm({ ...form, password: e })}
            placeholder="New password"
          />
          <CustomButton
            title="Reset Password"
            containerStyles="w-full"
            handlePress={submitResetPassword}
          />
        </View>

        <View className="absolute bottom-0 flex-row right-2/4">
          <Text className="text-white/50 font-satoshiMedium">by </Text>
          <Text className="text-brand font-satoshiMedium">nehtek</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ResetPasswordScreen;
