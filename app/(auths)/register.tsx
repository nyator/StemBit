import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import { Link, router } from "expo-router";

import FormField from "../../components/formField";
import CustomButton from "../../components/customButton";
import CustomToast from "../../components/customToast";

import { createUser } from "../../lib/appwrite";

const RegisterScreen = () => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  // const p

  const passwordsMatch = () => {
    return form.password === form.confirmPassword;
  };

  const submit = async () => {
    if (!form.email || !form.password) {
      console.log("All fields (email, password, username) are required.");
      return;
    }
    if (!passwordsMatch()) {
      console.log("Passwords do not match");
      return;
    }
    try {
      setIsSubmitting(true);
      await createUser({ email: form.email, password: form.password });
      console.log("Submission successful");
      router.replace("/loop");
    } catch (error) {
      console.log("err message", error);
    }
    setIsSubmitting(false)
  }

  return (
    <SafeAreaView className="flex-1">
      {/* <CustomToast type="success" title="Sign successful" /> */}
      <View className="flex-1 px-5">
        <View className="flex flex-row justify-center items-center mt-10 mb-5">
          <Text className="mb-4 text-5xl text-white font-rBlack">Stem</Text>
          <Text className="mb-4 text-5xl text-accent font-rBlack">Bits</Text>
        </View>
        <View className="flex items-start">
          <Text className="text-3xl text-white font-rBold">Signup</Text>
          <View className="flex flex-col gap-5 items-center w-full">
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
            <View className="flex flex-row">
              <Text className="text-xl text-white font-rMedium">
                Already have an account?
              </Text>
              <TouchableOpacity>
                <Link
                  href="/login"
                  className="text-xl underline text-accent font-rMedium"
                >
                  {" "}
                  Login
                </Link>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View className="flex absolute bottom-0 right-2/4 flex-row">
          <Text className="text-white/50 font-rMedium">by</Text>
          <Text className="text-accent font-rMedium"> nehtek</Text>
        </View>
      </View>
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
}


export default RegisterScreen;
