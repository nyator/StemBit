import { View, Text, TouchableOpacity, Image } from "react-native";
import React, { useState, useRef, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import { useRouter } from "expo-router";

import icons from "../../constants/icons";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Animated } from 'react-native';

const splashPages = [
  {
    id: "1",
    title: "The Breakdown 🎧",
    subtitle:
      "Lorem ipsum dolor sit amet consectetur. Aliquet hac arcu sed pellentesque nunc eget.",
    image: require("../../assets/images/splash1.png"),
  },
  {
    id: "2",
    title: "Practice And Performances 🎛️",
    subtitle:
      "Lorem ipsum dolor sit amet consectetur. Aliquet hac arcu sed pellentesque nunc eget.",
    image: require("../../assets/images/splash2.png"),
  },
  {
    id: "3",
    title: "Buckle Up 🚀‍",
    subtitle:
      "Lorem ipsum dolor sit amet consectetur. Aliquet hac arcu sed pellentesque nunc eget.",
    image: require("../../assets/images/splash3.png"),
  },
];

export default function IndexScreen() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  // Create animated values for each dot
  const dotAnimations = useRef(
    splashPages.map(() => ({
      width: new Animated.Value(8),
      backgroundColor: new Animated.Value(0)
    }))
  ).current;

  // Update animations when page changes
  useEffect(() => {
    splashPages.forEach((_, idx) => {
      Animated.parallel([
        Animated.timing(dotAnimations[idx].width, {
          toValue: page === idx ? 25 : 8,
          duration: 300,
          useNativeDriver: false
        }),
        Animated.timing(dotAnimations[idx].backgroundColor, {
          toValue: page === idx ? 1 : 0,
          duration: 300,
          useNativeDriver: false
        })
      ]).start();
    });
  }, [page]);

  const handleNext = () => {
    if (page < splashPages.length - 1) {
      setPage(page + 1);
    }
  };
  const handleBack = () => {
    if (page > 0) {
      setPage(page - 1);
    }
  };

  const handleGetStarted = () => {
    router.replace("/login");
  };

  return (
    <SafeAreaView className="flex-1 justify-center items-center bg-primary">
      <StatusBar barStyle="light-content" />
      <View className="flex-1 items-center px-5">
        <View className="flex-row justify-center items-center py-7 w-screen">
          <Text className="text-center text-white font-rMedium">
            {splashPages[page].id} | {splashPages.length}
          </Text>
          {page < 2 && (
            <TouchableOpacity
              className="flex absolute right-7 rounded text-end"
              onPress={handleGetStarted}
            >
              <Text className="text-xl text-white underline font-rRegular">
                Skip
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View className="mb-6 w-[28rem] h-[28rem] justify-start items-center overflow-hidden">
          <Image
            source={splashPages[page].image}
            // style={{ width: 200, height: 200, borderRadius: 100 }}
            className="object-contain w-full h-full"
          />
        </View>
        <View className="flex justify-center items-start px-5 mb-4 w-screen">
          <Text className="text-white text-[40px] max-w-[26rem] text-start font-rBold text-nowrap">
            {splashPages[page].title}
          </Text>
        </View>
        <Text className="mb-6 text-lg text-white">
          {splashPages[page].subtitle}
        </Text>

        <View className="flex absolute bottom-10 flex-row justify-between items-center px-24 mt-8 w-screen">
          <View className="flex-row justify-end items-end">
            {splashPages.map((_, idx) => (
              <Animated.View
                key={idx}
                style={{
                  height: 8,
                  width: dotAnimations[idx].width,
                  borderRadius: 4,
                  marginHorizontal: 4,
                  backgroundColor: dotAnimations[idx].backgroundColor.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['rgba(255,255,255,0.3)', '#fff']
                  })
                }}
              />
            ))}
          </View>
          {page < splashPages.length - 1 ? (
            <TouchableOpacity
              className="p-2 bg-[#098F6D] rounded-full "
              onPress={handleNext}
            >
              <View className="flex-row items-center p-2 rounded-full bg-accent">
                <Ionicons name="chevron-forward" size={24} color="#CFFCE8" />
              </View>
            </TouchableOpacity>
          ) : (
            // <View className="flex items-end">
            <TouchableOpacity
              onPress={handleGetStarted}
            // className=""
            >
              <Image
                source={icons.logoButton}
                style={{ width: 50, height: 50 }}
                className="object-contain"
              />
            </TouchableOpacity>
            // </View>
          )}
        </View>
        <View className="flex absolute bottom-0 right-2/4 flex-row">
          <Text className="text-white/50 font-rMedium">by </Text>
          <Text className="text-accent font-rMedium">nehtek</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};
