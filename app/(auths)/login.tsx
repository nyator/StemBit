import { useState } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";

import Screen from "../../components/ui/screen";
import { BrandButton, GhostButton } from "../../components/ui/brandButton";
import { BrandInput } from "../../components/ui/brandInput";
import { useEmailCodeAuth } from "../../hooks/useEmailCodeAuth";
import { usePreferences } from "../../context/PreferencesContext";

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { sendCode, isLoaded } = useEmailCodeAuth();
  const { prefs, setPref } = usePreferences();

  // Every instrument works offline and on-device; the account only carries a
  // profile. So the way in without one is on this screen, not buried -- App
  // Store guideline 5.1.1(v) rejects a sign-in wall in front of features that
  // don't need it.
  const continueAsGuest = () => {
    setPref("guest", true);
    router.replace(`/(tabs)/${prefs.launchScreen}`);
  };

  // One field and one button, because there is no password to collect. An
  // address with no account gets one made for it -- see useEmailCodeAuth --
  // so this screen is the way in for everybody, new or returning.
  const submit = async () => {
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const mode = await sendCode(email, "sign_in");
      // The code screen has to know which flow it is completing: the two verify
      // through different Clerk calls and nothing on that screen could tell.
      router.push({
        pathname: "/(auths)/verification-code",
        params: { email: email.trim().toLowerCase(), mode },
      });
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Couldn't send a code. Try again."
      );
    } finally {
      setIsSubmitting(false);
    }
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
            returnKeyType="go"
            error={error}
          />

          {/* Disabled until Clerk's client has loaded -- calling into it before
              that throws, and a button that fails on the first tap of a cold
              start reads as a broken app. */}
          <BrandButton
            label="Continue"
            onPress={submit}
            loading={isSubmitting}
            disabled={!isLoaded}
          />

          <GhostButton
            label="Continue without an account"
            onPress={continueAsGuest}
          />

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
