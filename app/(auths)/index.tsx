import { View, Text, TouchableOpacity, Image } from "react-native";
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import { useRouter } from "expo-router";

import icons from "../../constants/icons";

import Ionicons from "@expo/vector-icons/Ionicons";

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

const IndexScreen = () => {
  const router = useRouter();
  const [page, setPage] = useState(0);

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
        <Text className="text-white text-center my-5 font-rMedium">
          {splashPages[page].id} | {splashPages.length}
        </Text>
        <View className="mb-6 w-[28rem] h-[28rem] justify-start items-center overflow-hidden">
          <Image
            source={splashPages[page].image}
            // style={{ width: 200, height: 200, borderRadius: 100 }}
            className="object-contain w-full h-full"
          />
        </View>
        <View className="mb-4 w-screen px-5 flex justify-center items-start ">
          <Text className="text-white text-[40px] max-w-[26rem] text-start font-rBold text-nowrap">
            {splashPages[page].title}
          </Text>
        </View>
        <Text className="text-white text-lg mb-6">
          {splashPages[page].subtitle}
        </Text>
        <View className="flex flex-row  w-full justify-between items-center px-10 absolute bottom-10 mt-8 gap-6">
          {page < 2 && (
            <TouchableOpacity
              className="px-6 py-2 flex justify-center rounded"
              onPress={handleGetStarted}
            >
              <Text className="text-white text-xl font-rRegular underline">
                Skip
              </Text>
            </TouchableOpacity>
          )}

          {splashPages[page].id === "1" ? (
            <TouchableOpacity
              className="p-2 bg-[#098F6D] rounded-full"
              onPress={handleBack}
            >
              <View className="flex-row items-center p-2 bg-red-500 rounded-full"></View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className="p-2 bg-[#098F6D] rounded-full"
              disabled
            ></TouchableOpacity>
          )}

          {page < splashPages.length - 1 ? (
            <TouchableOpacity
              className="p-2 bg-[#098F6D] rounded-full"
              onPress={handleNext}
            >
              <View className="flex-row items-center p-2 bg-accent rounded-full">
                <Ionicons name="chevron-forward" size={24} color="#CFFCE8" />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className="p-2 w-full items-end"
              onPress={handleGetStarted}
            >
              <View className="flex-row items-center bg-accent rounded-full ">
                <Image
                  source={icons.logoButton}
                  style={{ width: 50, height: 50 }}
                  className="object-cover"
                />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default IndexScreen;
