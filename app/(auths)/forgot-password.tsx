import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import AuthFooter from "../../components/ui/authFooter";
import { BrandButton } from "../../components/ui/brandButton";
import { BrandInput } from "../../components/ui/brandInput";

const ForgotPasswordScreen = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const getCodeSubmit = () => {
    router.push("/reset-password");
  };

  return (
    <Screen glows={["topLeft"]}>
      <ScreenHeader title="Forgot Password" />

      <View className="flex-1 px-screen">
        <Text className="mb-6 text-ink-soft font-satoshiRegular text-label leading-5">
          Enter the email on your account and we'll send you a reset code.
        </Text>

        <BrandInput
          label="Email Address"
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={getCodeSubmit}
          returnKeyType="go"
        />

        <BrandButton label="Get reset code" onPress={getCodeSubmit} />
      </View>

      <AuthFooter />
    </Screen>
  );
};

export default ForgotPasswordScreen;
