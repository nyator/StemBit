import React, {useState} from 'react';
import {View, Text, Switch, TouchableOpacity, SafeAreaView, StatusBar, ScrollView} from 'react-native';
import {useRouter} from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

const IndexScreen = () => {
    const router = useRouter();
    const [notifications, setNotifications] = useState(true);
    const [darkMode, setDarkMode] = useState(true);
    const [soundEffects, setSoundEffects] = useState(true);

    const handleGoBack = () => {
        router.back();
    }

    return (
        <SafeAreaView className="flex-1 bg-primary justify-center">
            <StatusBar barStyle="light-content"/>

            {/* Header */}
            <View className="flex-row justify-between items-center px-5 mt-7  mb-5">
                <TouchableOpacity
                    onPress={handleGoBack}
                    className="p-2 rounded-full bg-white/10"
                >
                    <Ionicons name="arrow-back" size={24} color="white"/>
                </TouchableOpacity>
                <Text className="text-2xl text-white font-rBold">Settings</Text>
                <View style={{width: 32}}></View>{/* Empty view for alignment */}
            </View>

            <ScrollView className="flex-1 px-5">

                {/* Account Section */}
                <View className="mb-8">
                    <Text className="text-xl text-accent font-rBold mb-4">Account</Text>

                    <TouchableOpacity
                        onPress={() => router.push("/user")}
                        className="flex-row justify-between items-center py-4 border-b border-white/10"
                    >
                        <Text className="text-white text-lg font-rMedium">Profile</Text>
                        <Ionicons name="chevron-forward" size={20} color="white"/>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push("/(auths)/reset-password")}
                        className="flex-row justify-between items-center py-4 border-b border-white/10"
                    >
                        <Text className="text-white text-lg font-rMedium">Change Password</Text>
                        <Ionicons name="chevron-forward" size={20} color="white"/>
                    </TouchableOpacity>
                </View>

                {/* Preferences Section */}
                <View className="mb-8">
                    <Text className="text-xl text-accent font-rBold mb-4">Preferences</Text>

                    <View className="flex-row justify-between items-center py-4 border-b border-white/10">
                        <Text className="text-white text-lg font-rMedium">Notifications</Text>
                        <Switch
                            value={notifications}
                            onValueChange={setNotifications}
                            trackColor={{false: "#767577", true: "#098F6D"}}
                            thumbColor="#f4f3f4"
                        />
                    </View>

                    <View className="flex-row justify-between items-center py-4 border-b border-white/10">
                        <Text className="text-white text-lg font-rMedium">Dark Mode</Text>
                        <Switch
                            value={darkMode}
                            onValueChange={setDarkMode}
                            trackColor={{false: "#767577", true: "#098F6D"}}
                            thumbColor="#f4f3f4"
                        />
                    </View>

                    <View className="flex-row justify-between items-center py-4 border-b border-white/10">
                        <Text className="text-white text-lg font-rMedium">Sound Effects</Text>
                        <Switch
                            value={soundEffects}
                            onValueChange={setSoundEffects}
                            trackColor={{false: "#767577", true: "#098F6D"}}
                            thumbColor="#f4f3f4"
                        />
                    </View>
                </View>

                {/* About Section */}
                <View className="mb-8">
                    <Text className="text-xl text-accent font-rBold mb-4">About</Text>

                    <TouchableOpacity
                        onPress={() => router.push("/help")}
                        className="flex-row justify-between items-center py-4 border-b border-white/10"
                    >
                        <Text className="text-white text-lg font-rMedium">Help & Support</Text>
                        <Ionicons name="chevron-forward" size={20} color="white"/>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-row justify-between items-center py-4 border-b border-white/10"
                    >
                        <Text className="text-white text-lg font-rMedium">Privacy Policy</Text>
                        <Ionicons name="chevron-forward" size={20} color="white"/>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-row justify-between items-center py-4 border-b border-white/10"
                    >
                        <Text className="text-white text-lg font-rMedium">Terms of Service</Text>
                        <Ionicons name="chevron-forward" size={20} color="white"/>
                    </TouchableOpacity>

                    <View className="py-4">
                        <Text className="text-white/10 text-lg font-rMedium">Version 1.0.0</Text>
                    </View>
                </View>

                {/* Logout Button */}
                <TouchableOpacity
                    className="py-4 mb-10 bg-red-600 rounded-xl"
                    onPress={() => router.replace("/(auths)/")}
                >
                    <Text className="text-white text-center text-lg font-rBold">Logout</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

export default IndexScreen;