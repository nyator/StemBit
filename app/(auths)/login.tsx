import { useState } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";

import Screen from "../../components/ui/screen";
import { BrandButton } from "../../components/ui/brandButton";
import { BrandInput } from "../../components/ui/brandInput";
import { usePreferences } from "../../context/PreferencesContext";

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const DEV_SKIP_AUTH = true;

const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const { prefs } = usePreferences();
  // Settings -> Launch Screen. Read once per submit rather than at import
  // time, so a change takes effect on the very next sign-in.
  const launchRoute = `/(tabs)/${prefs.launchScreen}` as const;

  const submit = () => {
    if (DEV_SKIP_AUTH) {
      router.replace(launchRoute);
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    router.push(launchRoute);
  };

  return (
    <Screen glows={["topRight", "bottomLeft"]} className="px-instrument">
      <View className="flex-1">
        {/* Brand header */}
        <View className="items-center pt-28 pb-2">
          <Text className="text-white font-wordmark text-wordmarkLg tracking-wordmark">
            stembits
          </Text>
        </View>

        {/* Form area */}
        <View className="justify-center flex-1 w-full gap-1">
          <BrandInput
            label="Email Address"
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError("");
            }}
            onSubmitEditing={submit}
            returnKeyType="next"
            error={error}
          />

          <BrandButton label="Continue" onPress={submit} />

          <Text className="text-center text-ink-faint font-satoshiMedium text-label leading-5 mt-3">
            By continuing, I agree to the{" "}
            <Text
              className="text-white underline"
              onPress={() => router.push("/termsofservice")}
            >
              Terms of Service
            </Text>
            {" and "}
            <Text
              className="text-white underline"
              onPress={() => router.push("/privacypolicy")}
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
      </View>
    </Screen>
  );
};

export default LoginScreen;
