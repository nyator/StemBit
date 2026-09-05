import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import AuthFooter from "../../components/ui/authFooter";
import { BrandButton } from "../../components/ui/brandButton";
import { BrandInput } from "../../components/ui/brandInput";
import { usePreferences } from "../../context/PreferencesContext";

const ResetPasswordScreen = () => {
  const router = useRouter();
  const { prefs } = usePreferences();
  const [form, setForm] = useState({
    code: "",
    password: "",
  });

  const submitResetPassword = () => {
    // Settings -> Launch Screen, same as a fresh sign-in.
    router.push(`/(tabs)/${prefs.launchScreen}` as const);
  };

  return (
    <Screen glows={["topLeft"]}>
      <ScreenHeader title="Reset Password" />

      <View className="flex-1 px-screen">
        <Text className="mb-6 text-ink-soft font-satoshiRegular text-label leading-5">
          Enter the code from your email and choose a new password.
        </Text>

        <BrandInput
          label="Reset Code"
          placeholder="Enter reset code"
          keyboardType="numeric"
          value={form.code}
          onChangeText={(code) => setForm({ ...form, code })}
          returnKeyType="next"
        />

        <BrandInput
          label="New Password"
          placeholder="New password"
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          value={form.password}
          onChangeText={(password) => setForm({ ...form, password })}
          onSubmitEditing={submitResetPassword}
          returnKeyType="go"
        />

        <BrandButton label="Reset password" onPress={submitResetPassword} />
      </View>

      <AuthFooter />
    </Screen>
  );
};

export default ResetPasswordScreen;
