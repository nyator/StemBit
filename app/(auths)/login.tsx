import { useState } from "react";
import { useRef } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import { createUser, loginUser } from "../../lib/appwrite";
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

  const submit = async () => {
    setError("");
    if (!form.email || !form.password) {
      setError("Both email and password are required.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
      return;
    }

    try {
      setIsSubmitting(true);
      await loginUser({ email: form.email, password: form.password });
      router.replace("/loop");
    } catch (err: any) {
      let message = "Login failed. Please try again.";
      const errMsg =
        typeof err === "string" ? err : err?.message || err?.toString?.() || "";
      if (errMsg) {
        if (
          errMsg.toLowerCase().includes("invalid credentials") ||
          errMsg.toLowerCase().includes("incorrect")
        ) {
          message = "Invalid email or password.";
        } else if (errMsg.toLowerCase().includes("email")) {
          message = "Invalid email address.";
        } else if (errMsg.toLowerCase().includes("password")) {
          message = "Invalid password.";
        }
      }
      setError(message);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1">
      {showToast && error && <CustomToast type="error" title={error} />}
      {/* {showToast && error && <Text className="text-red-500 bg-white/55 w-full p-5 absolute bottom-16">{error}</Text>} */}
      <View className="flex-1 px-5">
        <View className="flex flex-row justify-center items-center mt-10 mb-5">
          <Text className="mb-4 text-5xl text-white font-rBlack">Stem</Text>
          <Text className="mb-4 text-5xl text-accent font-rBlack">Bits</Text>
        </View>
        <View className="flex items-start">
          <Text className="text-2xl text-white font-rBold">Login</Text>
          <View className="flex flex-col gap-6 items-center w-full">
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
            <TouchableOpacity className="flex items-end mt-3 w-full">
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
            <View className="flex flex-row">
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
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
};

export default LoginScreen;
