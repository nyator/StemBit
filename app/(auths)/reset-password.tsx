import React, {useState} from "react";
import {View, Text, TouchableOpacity} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import {StatusBar} from "react-native";
import {useRouter} from 'expo-router';

import FormField from "../../components/formField";
import CustomButton from "../../components/customButton";
import Ionicons from "@expo/vector-icons/Ionicons";

const ResetPasswordScreen = () => {
    const router = useRouter()
    const [form, setForm] = useState({
        email: "",
        password: "",
    });

    const handleGoBack = () => {
        router.back();
    }

    const submitResetPassword = () => {
        router.push("/(tabs)/loop");
        // setForm({})
    }
    return (
        <SafeAreaView className="flex-1">
            <View className="flex-1 px-5">

                <View className="flex-row justify-between items-center mt-10 mb-5">
                    <TouchableOpacity
                        onPress={handleGoBack}
                        className="p-2 rounded-full bg-white/10"
                    >
                        <Ionicons name="arrow-back" size={24} color="white"/>
                    </TouchableOpacity>
                    {/*<Text className="text-2xl text-white font-rBold">Reset Password</Text>*/}
                    {/*<View className="flex flex-row justify-center items-center my-10">*/}
                    {/*  <Text className="mb-4 text-5xl text-white font-rBlack">Stem</Text>*/}
                    {/*  <Text className="mb-4 text-5xl text-accent font-rBlack">Bits</Text>*/}
                    {/*</View>*/}
                    <View style={{width: 32}}></View>{/* Empty view for alignment */}
                </View>

                <View className="flex items-start">
                    <Text className="text-xl text-accent font-rBold">Reset Password</Text>
                    <View className="flex flex-col gap-6 items-center w-full">
                        <FormField
                            // title="Email"
                            value={form.email}
                            handleChangeText={(e) => setForm({...form, email: e})}
                            // otherStyles="mt-10"
                            placeholder="Enter Reset Code "
                        />
                        <CustomButton
                            title="Reset Password"
                            containerStyles="w-full"
                            handlePress={submitResetPassword}
                        />
                    </View>
                </View>
                <View className="flex absolute bottom-0 right-2/4 flex-row">
                    <Text className="text-white/50 font-rMedium">by</Text>
                    <Text className="text-accent font-rMedium"> nehtek</Text>
                </View>
            </View>
            <StatusBar barStyle="light-content"/>
        </SafeAreaView>
    );
};

export default ResetPasswordScreen;

