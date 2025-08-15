import { View, Text } from "react-native";
import React from "react";

import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type customToastProps = {
  type: "success" | "error" | "warning";
  title: string;
  desc?: string;
};

export default function CustomToast({ type, title, desc }: customToastProps) {
  return (
    <View
      className={`absolute right-0 top-40 z-30 py-2 pr-2 pl-1 bg-white border-white rounded-l-[20px] border-l-[1px] border-t-[1px] border-b-[1px]`}
    >
      <View className={`flex flex-row justify-center items-center gap-[2px]`}>
        {type === "success" && (
          <Ionicons name="checkmark-done-circle" size={22} color="#10B981" />
        )}
        {type === "error" && (
          <MaterialIcons name="error" size={22} color="#EF4444" />
        )}
        {type === "warning" && (
          <Ionicons name="warning" size={22} color="#F59E0B" />
        )}
        <Text className="text-[15px] text-black font-rMedium">
          {title ? title : "title"}
        </Text>
        {/* <View className={` rounded-xl px-2 py-[2px] ${type === "success" && "bg-success"} ${type === "error" && "bg-error"} ${type === "warning" && "bg-warning"}`}> */}
        {/* <Text className='text-[15px] text-white font-cMedium'>{desc ? desc : "desc"}</Text> */}
        {/* </View> */}
      </View>
    </View>
  );
}
