import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import { Link, router, Redirect } from "expo-router";

import FormField from "../../components/formField";
import CustomButton from "../../components/customButton";
import CustomToast from "../../components/customToast";

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
    <SafeAreaView className="flex-1">
      <StatusBar barStyle="light-content" />
      {/* {error ? <CustomToast type="error" title={error} /> : null} */}
      <View className="flex-1 px-5">
        <View className="flex flex-row justify-center items-center mt-10 mb-5">
          <Text className="mb-4 text-5xl text-white font-satoshiBold">Stem</Text>
          <Text className="mb-4 text-5xl text-brand font-satoshiBold">Bits</Text>
        </View>
        <View className="flex items-start">
          <Text className="text-3xl text-white font-satoshiBold">Signup</Text>
          <View className="flex flex-col gap-6 items-center w-full">
            <FormField
              title="Email"
              value={form.email}
              handleChangeText={(e) => setForm({ ...form, email: e })}
              otherStyles="mt-10"
              placeholder="Enter Email"
              keyboardType="email-address"
            />

            <FormField
              title="Password"
              value={form.password}
              handleChangeText={(e) => setForm({ ...form, password: e })}
              placeholder="Enter your password"
            />

            <FormField
              title="Confirm Password"
              value={form.confirmPassword}
              handleChangeText={(e) => setForm({ ...form, confirmPassword: e })}
              placeholder="Re-enter password"
            />

            <CustomButton
              title="Signup"
              containerStyles="w-full"
              handlePress={submit}
              isLoading={isSubmitting}
            />

            {showToast && error && (
              <Text className="text-red-500 font-satoshiMedium py-3 text-center w-full absolute bottom-5">
                {error}
              </Text>
            )}

            <View className="flex flex-row mt-2">
              <Text className="text-xl text-white font-satoshiMedium">
                Already have an account?
              </Text>
              <TouchableOpacity>
                <Link
                  href="/login"
                  className="text-xl underline text-brand font-satoshiMedium"
                >
                  {" "}
                  Login
                </Link>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View className="flex absolute bottom-0 right-2/4 flex-row">
          <Text className="text-white/50 font-satoshiMedium">by</Text>
          <Text className="text-brand font-satoshiMedium"> nehtek</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default RegisterScreen;
