import { useState } from "react";
import { View, Text, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import ScreenHeader from "../../components/ui/screenHeader";
import FormField from "../../components/formField";
import CustomButton from "../../components/customButton";

export default function VerificationCodeScreen() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [code, setCode] = useState("");

  const submit = async () => {
    setIsSubmitting(true);
    try {
      // TODO: verify the code against Appwrite once email verification is wired.
      router.replace("/login");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Verify Email" />

      <View className="flex-1 px-5">
        <Text className="mt-2 mb-1 text-sm leading-5 text-white/60 font-rRegular">
          A verification code has been sent to your email.
        </Text>
        <View className="flex flex-col items-center w-full gap-6">
          <FormField
            value={code}
            handleChangeText={setCode}
            otherStyles="mt-4"
            placeholder="Enter verification code"
            keyboardType="numeric"
          />
          <CustomButton
            title="Verify"
            containerStyles="w-full"
            handlePress={submit}
            isLoading={isSubmitting}
          />
        </View>

        <View className="absolute bottom-0 flex-row right-2/4">
          <Text className="text-white/50 font-rMedium">by </Text>
          <Text className="text-accent font-rMedium">nehtek</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
