import {useState} from "react";
import {SafeAreaView, View, Text, TouchableOpacity} from "react-native";
import {StatusBar} from "react-native";

import FormField from "../../components/formField";
import CustomButton from "../../components/customButton";
import {Link, router} from "expo-router";

const LoginScreen = () => {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [form, setForm] = useState({
        email: "",
        password: "",
    });

    const submit = async () => {
        router.replace("/loop");
        // if (!form.email || !form.password) {
        //   console.log("All fields (email, password, username) are required.");
        //   return;
        // }
        // try {
        //   setIsSubmitting(true);
        //   // await createUser({ email: form.email, password: form.password });
        //   console.log("Submission successful");
        //   router.replace("/loop");
        // } catch (error) {
        //   console.log("err message", error);
        // }
        // setIsSubmitting(false)
    }

    return (
        <SafeAreaView className="flex-1">
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
                            handleChangeText={(e) => setForm({...form, email: e})}
                            otherStyles="mt-5"
                            placeholder="Enter Email"
                            keyboardType="email-address"
                        />

                        <FormField
                            title="Password"
                            value={form.password}
                            handleChangeText={(e) => setForm({...form, password: e})}
                            // otherStyles="mt-10"
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
            <StatusBar barStyle="light-content"/>
        </SafeAreaView>
    );
};

export default LoginScreen;
