import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import { loginUser } from "../../lib/appwrite";
import CustomToast from "../../components/customToast";

import FormField from "../../components/formField";
import CustomButton from "../../components/customButton";
import { Link, router } from "expo-router";

const LoginScreen = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [showToast, setShowToast] = useState(false);

  // const submit = async () => {
  //   setError("");
  //   if (!form.email || !form.password) {
  //     setError("Both email and password are required.");
  //     setShowToast(true);
  //     setTimeout(() => setShowToast(false), 3000);
  //     return;
  //   }

  //   const isValidEmail = (email: string) => {
  //   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  //   return emailRegex.test(email);
  // };

  //   if (!isValidEmail(form.email)) {
  //     setError("Please enter a valid email address.");
  //     setShowToast(true);
  //     setTimeout(() => setShowToast(false), 3000);
  //     return;
  //   }

  //   setIsSubmitting(true);

  //   try {
  //     await loginUser({ email: form.email, password: form.password });
  //     router.replace("/(tabs)/loop");
  //   } catch (error: any) {
  //     let message = "Login failed. Please try again.";
  //     const errMsg = error?.message || error?.toString?.() || "";

  //     if (errMsg) {
  //       if (
  //         errMsg.toLowerCase().includes("invalid credentials") ||
  //         errMsg.toLowerCase().includes("incorrect")
  //       ) {
  //         message = "Invalid email or password.";
  //       } else if (errMsg.toLowerCase().includes("email")) {
  //         message = "Invalid email address.";
  //       } else if (errMsg.toLowerCase().includes("password")) {
  //         message = "Invalid password.";
  //       }
  //     }

  //     setError(message);
  //     setShowToast(true);
  //     setTimeout(() => setShowToast(false), 3000);
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };

  const submit = async () => {
    router.replace("/(tabs)/loop");
  };

  return (
    <SafeAreaView className="flex-1">
      <StatusBar barStyle="light-content" />
      <View className="flex-1 px-5">
        <View className="flex flex-row justify-center items-center mt-10 mb-5">
          <Text className="mb-4 text-5xl text-white font-rBlack">Stem</Text>
          <Text className="mb-4 text-5xl text-accent font-rBlack">Bits</Text>
        </View>
        <View className="flex items-start">
          <Text className="text-2xl text-white font-rBold">Login</Text>
          <View className="flex relative flex-col gap-6 items-center w-full">
            <FormField
              title="Email"
              value={form.email}
              handleChangeText={(e) => setForm({ ...form, email: e })}
              otherStyles="mt-5"
              placeholder="Enter Email"
              keyboardType="email-address"
            />
            <FormField
              title="Password"
              value={form.password}
              handleChangeText={(e) => setForm({ ...form, password: e })}
              placeholder="Enter your password"
            />

            <TouchableOpacity className="flex items-end w-full">
              <Link
                href="/forgot-password"
                className="text-xl text-white font-rRegular"
              >
                Forgot Password
              </Link>
            </TouchableOpacity>

            <CustomButton
              title="Login"
              containerStyles="w-full"
              handlePress={submit}
              isLoading={isSubmitting}
            />

            {showToast && error && (
              <Text className="absolute bottom-5 py-3 w-full text-center text-red-500 font-rMedium">
                {error}
              </Text>
            )}

            <View className="flex flex-row mt-2">
              <Text className="text-xl text-white font-rMedium">
                Don't have an account?
              </Text>
              <TouchableOpacity>
                <Link
                  href="/register"
                  className="text-xl underline text-accent font-rMedium"
                >
                  {" "}
                  Signup
                </Link>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View className="flex absolute bottom-0 right-2/4 flex-row">
          <Text className="text-white/50 font-rMedium">by </Text>
          <Text className="text-accent font-rMedium">nehtek</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;
