import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import React from "react";

import { GestureResponderEvent } from "react-native";

type CustomButtonProps = {
  title: string;
  handlePress: (event: GestureResponderEvent) => void;
  containerStyles?: string;
  textStyles?: string;
  isLoading?: boolean;
};

const CustomButton = ({
  title,
  handlePress,
  containerStyles,
  textStyles,
  isLoading,
}: CustomButtonProps) => {
  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={isLoading}
      className={`flex justify-center items-center rounded-2xl bg-accent min-h-[50px] ${containerStyles}`}
    >
      {isLoading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className={`text-2xl text-white font-rBold ${textStyles}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

export default CustomButton;
