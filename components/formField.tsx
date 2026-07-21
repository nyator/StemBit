import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import React, { useState } from "react";

import { COLORS } from "../constants/theme";
import { Eye, EyeSlash } from "./icons";

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
      <Text className="mb-3 text-xl text-white font-satoshiRegular">{title}</Text>
      <View className="border-[1.5px] border-[#454545]/40 w-full h-[45px] px-3 bg-canvas rounded-xl focus:border-brand items-center flex-row">
        <TextInput
          className="flex-1 text-white font-satoshiRegular text-lg text-left justify-center  "
          placeholder={placeholder}
          keyboardType={title === "Email" ? "email-address" : "default"}
          placeholderTextColor="#7d7d8d"
          selectionColor={COLORS.brand}
          value={value}
          onChangeText={handleChangeText}
          secureTextEntry={(title === "Password" || title === "Confirm Password") && !showPassword}
        />

        {(title === "Password" || title === "Confirm Password") && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            {!showPassword ? (
              <EyeSlash size={18} color="white" />
            ) : (
              <Eye size={18} color="white" />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default FormField;
