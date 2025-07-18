import { TouchableOpacity, Text } from "react-native";
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
  isLoading = false,
}: CustomButtonProps) => {
  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={isLoading}
      className={`bg-accent rounded-xl min-h-[50px] flex justify-center items-center ${containerStyles} ${isLoading ? "opacity-50" : ""}`}
    >
      <Text className={`font-rBold text-white text-2xl ${textStyles}`}>{title}</Text>
    </TouchableOpacity>
  );
};

export default CustomButton;
