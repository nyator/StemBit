import { useState } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";

import Screen from "../../components/ui/screen";
import { BrandButton } from "../../components/ui/brandButton";
import { BrandInput } from "../../components/ui/brandInput";

// This screen captures only the email address ("Continue with email"); the
// password / verification step it hands off to is still to be wired up. The
// Figma node this is built from is named `continue-with-email` (124:842).

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// DEV BYPASS: skips authentication and jumps straight into the app. Set to
// false once the email hand-off / password step is in place.
const DEV_SKIP_AUTH = true;

const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (DEV_SKIP_AUTH) {
      router.replace("/(tabs)/loop");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    // TODO: hand `email` off to the password / verification step.
    router.push("/(tabs)/loop");
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
        <View className="justify-center flex-1 w-full gap-5">
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

          <Text className="text-center text-ink-faint font-satoshiMedium text-label leading-5">
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
