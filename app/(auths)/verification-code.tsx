import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import AuthFooter from "../../components/ui/authFooter";
import { BrandButton } from "../../components/ui/brandButton";
import { BrandInput } from "../../components/ui/brandInput";

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
    <Screen glows={["topLeft"]}>
      <ScreenHeader title="Verify Email" />

      <View className="flex-1 px-screen">
        <Text className="mb-6 text-ink-soft font-satoshiRegular text-label leading-5">
          A verification code has been sent to your email.
        </Text>

        <BrandInput
          label="Verification Code"
          placeholder="Enter verification code"
          keyboardType="numeric"
          value={code}
          onChangeText={setCode}
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        <BrandButton label="Verify" onPress={submit} loading={isSubmitting} />
      </View>

      <AuthFooter />
    </Screen>
  );
}
