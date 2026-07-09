import { useState } from "react";
import { View, Text, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import ScreenHeader from "../../components/ui/screenHeader";
import FormField from "../../components/formField";
import CustomButton from "../../components/customButton";

const ForgotPasswordScreen = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const getCodeSubmit = () => {
    router.push("/reset-password");
  };

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Forgot Password" />

      <View className="flex-1 px-5">
        <Text className="mt-2 mb-1 text-sm leading-5 text-white/60 font-rRegular">
          Enter the email on your account and we'll send you a reset code.
        </Text>
        <View className="flex flex-col items-center w-full gap-6">
          <FormField
            title="Email"
            value={email}
            handleChangeText={setEmail}
            otherStyles="mt-4"
            placeholder="Enter your email"
            keyboardType="email-address"
          />
          <CustomButton
            title="Get Reset Code"
            containerStyles="w-full"
            handlePress={getCodeSubmit}
          />
        </View>

        <View className="absolute bottom-0 flex-row right-2/4">
          <Text className="text-white/50 font-rMedium">by </Text>
          <Text className="text-accent font-rMedium">nehtek</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;
