import { View, Text, StatusBar, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

const Help = () => {
  const handleGoBack = () => {
    router.back();
  };
  return (
    <SafeAreaView>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View className="flex-row justify-between items-center px-5 mt-7 mb-5">
        <TouchableOpacity
          onPress={handleGoBack}
          className="p-2 rounded-full bg-white/10"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-2xl text-white font-rBold">Help & Support</Text>
        <View style={{ width: 32 }}></View> {/* Empty view for alignment */}
      </View>
    </SafeAreaView>
  );
};

export default Help;
