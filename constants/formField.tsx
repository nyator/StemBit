import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import React, { useState } from "react";

import Ionicons from "@expo/vector-icons/Ionicons";
import "../global.css";

type FormFieldProps = {
  title: string;
  value?: string;
  placeholder: string;
  handleChangeText?: (text: string) => void;
  otherStyles: string;
  [key: string]: any; // To allow other props
};

const FormField = ({
  title,
  value,
  placeholder,
  handleChangeText,
  otherStyles,
  ...props
}: FormFieldProps) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View className={`space-y-2 border-solid border-[5px] border-error ${otherStyles}`}>
      <Text className="text-2xl font-rBold text-white">{title}</Text>
      <View className="border-2 border-red-500 w-full h-16 px-4 bg-red-400 rounded-[10px] items-center flex-row">
        <TextInput
          className="flex-1 text-white font-rSemibold "
          placeholder={placeholder}
          keyboardType={title === "Email" ? "email-address" : "default"}
          placeholderTextColor="#7d7d8d"
          selectionColor="#08C192"
          value={value}
          onChangeText={handleChangeText}
          secureTextEntry={title === "Password" && !showPassword}
        />

        {title === "Password" && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            {!showPassword ? (
              <Ionicons name="eye-off-outline" size={18} color="white" />
            ) : (
              <Ionicons name="eye-outline" size={18} color="white" />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default FormField;
