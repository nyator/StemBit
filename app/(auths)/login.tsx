import { useState } from "react";
import { SafeAreaView, View, Text, TouchableOpacity } from "react-native";
import { StatusBar } from "react-native";

import FormField from "../../components/formField";
import CustomButton from "../../components/customButton";
import { Link } from "expo-router";

const LoginScreen = () => {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 px-7">
        <View className="flex flex-row justify-center items-center my-10">
          <Text className="text-5xl text-white font-rBlack mb-4">Stem</Text>
          <Text className="text-5xl text-accent font-rBlack mb-4">Bits</Text>
        </View>
        <View className="flex items-start">
          <Text className="text-white text-3xl font-rBold">Login</Text>
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
              // otherStyles="mt-10"
              placeholder="Enter your password"
            />

            <TouchableOpacity className="flex w-full items-end mt-3">
              <Link
                href="/forgot-password"
                className="text-white text-xl font-rRegular"
              >
                Forgot Password
              </Link>
            </TouchableOpacity>
            <CustomButton
              title="Login"
              containerStyles="w-full"
              handlePress={() => {}}
            />
            <View className="flex flex-row">
              <Text className="text-white font-rMedium text-xl ">
                Don't have an account?
              </Text>
              <TouchableOpacity>
                <Link
                  href="/register"
                  className="text-accent font-rMedium text-xl underline"
                >
                  {" "}
                  Signup
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

export default LoginScreen;
