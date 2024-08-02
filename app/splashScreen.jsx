import React from "react";
import { View, Text } from "react-native";
import { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";

import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

const SplashScreen = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000); // 3 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    showSplash && (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-5xl font-rblack text-white">
          Stem
          <Text className="text-primary">Bit</Text>
        </Text>
        <Text className="text-[12px] font-rlight absolute bottom-10 text-white">
          by
          <Text className="text-primary"> nehtek</Text>
        </Text>
        <StatusBar barStyle="auto" />
      </View>
    ) 
  );
};

export default SplashScreen;
