import { useState } from "react";
import { View, Text } from "react-native";
import { Link, router } from "expo-router";

import Screen from "../../components/ui/screen";
import { BrandButton } from "../../components/ui/brandButton";
import { BrandInput } from "../../components/ui/brandInput";

import { createUser } from "../../lib/appwrite";

const RegisterScreen = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [showToast, setShowToast] = useState(false);

  const passwordsMatch = () => {
    return form.password === form.confirmPassword;
  };

  const showError = (message: string) => {
    setError(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  const submit = async () => {
    setError("");
    if (!form.email || !form.password) {
      showError("All fields (email and password) are required.");
      return;
    }
    if (!passwordsMatch()) {
      showError("Passwords do not match");
      return;
    }
    try {
      setIsSubmitting(true);
      await createUser({ email: form.email, password: form.password });
      router.replace("/verification-code");
    } catch (error: any) {
      const errMsg = (error?.message || "").toLowerCase();
      let message = "Signup failed. Please try again.";
      if (errMsg.includes("already exists")) {
        message = "An account with this email already exists.";
      } else if (errMsg.includes("password")) {
        message = "Password must be at least 8 characters.";
      } else if (errMsg.includes("email")) {
        message = "Please enter a valid email address.";
      }
      showError(message);
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

          <BrandInput
            label="Email Address"
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            value={form.email}
            onChangeText={(email) => setForm({ ...form, email })}
            returnKeyType="next"
          />

          <BrandInput
            label="Password"
            placeholder="Enter your password"
            secure
            autoCapitalize="none"
            autoComplete="new-password"
            value={form.password}
            onChangeText={(password) => setForm({ ...form, password })}
            returnKeyType="next"
          />

          <BrandInput
            label="Confirm Password"
            placeholder="Re-enter password"
            secure
            autoCapitalize="none"
            value={form.confirmPassword}
            onChangeText={(confirmPassword) =>
              setForm({ ...form, confirmPassword })
            }
            onSubmitEditing={submit}
            returnKeyType="go"
          />

          {/* In flow rather than absolutely positioned, so it pushes the button
              down instead of landing on top of whatever is beneath it. */}
          {showToast && error ? (
            <Text className="mb-3 text-center text-danger font-satoshiMedium text-label">
              {error}
            </Text>
          ) : null}

          <BrandButton
            label="Sign up"
            onPress={submit}
            loading={isSubmitting}
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
