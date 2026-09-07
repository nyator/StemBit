import { useState } from "react";
import { View, Text } from "react-native";
import { Link, router } from "expo-router";

import Screen from "../../components/ui/screen";
import { BrandButton } from "../../components/ui/brandButton";
import { BrandInput } from "../../components/ui/brandInput";
import { useEmailCodeAuth } from "../../hooks/useEmailCodeAuth";

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// Email and nothing else.
//
// The password and confirm-password fields are gone because there is no
// password any more -- proof of identity is a code sent to the address, so a
// second field to type it twice would be collecting something nothing checks.
// That also removes the whole class of "passwords do not match" errors this
// screen used to spend most of its code on.
const RegisterScreen = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const { sendCode, isLoaded } = useEmailCodeAuth();

  const submit = async () => {
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      // Prefers sign-up, but falls back to sign-in when the address already has
      // an account -- so somebody who forgot they had one gets signed in rather
      // than told off.
      const mode = await sendCode(email, "sign_up");
      router.push({
        pathname: "/(auths)/verification-code",
        params: { email: email.trim().toLowerCase(), mode },
      });
    } catch (signUpError) {
      setError(
        signUpError instanceof Error
          ? signUpError.message
          : "Couldn't create an account. Try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen glows={["topRight", "bottomLeft"]} className="px-instrument">
      <View className="flex-1">
        {/* Same wordmark as sign-in, rather than this screen's own two-tone
            "StemBits" lockup -- one brand mark, set one way. */}
        <View className="items-center pt-20 pb-2">
          <Text className="text-white font-wordmark text-wordmarkLg tracking-wordmark">
            stembits
          </Text>
        </View>

        <View className="justify-center flex-1 w-full">
          <Text className="mb-6 text-white font-satoshiBold text-heading">
            Create account
          </Text>

          <Text className="mb-4 text-ink-soft font-satoshiRegular text-label leading-5">
            We&apos;ll email you a 6-digit code. No password to remember.
          </Text>

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

          <BrandButton
            label="Send code"
            onPress={submit}
            loading={isSubmitting}
            disabled={!isLoaded}
          />

          <View className="flex-row justify-center mt-4">
            <Text className="text-ink-soft font-satoshiMedium text-body">
              Already have an account?{" "}
            </Text>
            <Link
              href="/login"
              className="underline text-brand font-satoshiMedium text-body"
            >
              Log in
            </Link>
          </View>
        </View>

        <View className="flex-row justify-center pb-2">
          <Text className="text-ink-faint font-satoshiMedium text-label">by </Text>
          <Text className="text-brand font-satoshiMedium text-label">nehtek</Text>
        </View>
      </View>
    </Screen>
  );
};

export default RegisterScreen;
