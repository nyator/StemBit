import { useState } from "react";
import { SafeAreaView, View, Text, TouchableOpacity } from "react-native";
import { StatusBar } from "react-native";
import { Link } from "expo-router";

import FormField from "../../components/formField";
import CustomButton from "../../components/customButton";

const RegisterScreen = () => {
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 px-7">
        <View className="flex flex-row justify-center items-center my-10">
          <Text className="text-5xl text-white font-rBlack mb-4">Stem</Text>
          <Text className="text-5xl text-accent font-rBlack mb-4">Bits</Text>
        </View>
        <View className="flex items-start">
          <Text className="text-white text-3xl font-rBold">Signup</Text>
          <View className="flex flex-col items-center gap-6 w-full">
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
              handlePress={() => {}}
            />
            <View className="flex flex-row">
              <Text className="text-white font-rMedium text-xl ">
                Already have an account?
              </Text>
              <TouchableOpacity>
                <Link
                  href="/login"
                  className="text-accent font-rMedium text-xl underline"
                >
                  {" "}
                  Login
                </Link>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View className="flex flex-row right-2/4 absolute bottom-0">
          <Text className="text-white/50 font-rMedium">by</Text>
          <Text className="text-accent font-rMedium"> oneha</Text>
        </View>
      </View>
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
};

export default RegisterScreen;
