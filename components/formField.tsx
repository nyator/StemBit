import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import React, { useState } from "react";

import Ionicons from "@expo/vector-icons/Ionicons";

type FormFieldProps = {
  title?: string;
  value?: string;
  placeholder: string;
  handleChangeText?: (text: string) => void;
  otherStyles?: string;
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
    <View className={`space-y-2 ${otherStyles}`}>
      <Text className="mb-3 text-xl text-white font-rRegular">{title}</Text>
      <View className="border-[1.5px] border-[#454545]/40 w-full h-[50px] px-5 bg-primary rounded-2xl focus:border-accent items-center flex-row">
        <TextInput
          className="flex-1 text-white font-rRegular text-lg"
          placeholder={placeholder}
          keyboardType={title === "Email" ? "email-address" : "default"}
          placeholderTextColor="#7d7d8d"
          selectionColor="#08C192"
          value={value}
          onChangeText={handleChangeText}
          secureTextEntry={(title === "Password" || title === "Confirm Password") && !showPassword}
        />

        {(title === "Password" || title === "Confirm Password") && (
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
