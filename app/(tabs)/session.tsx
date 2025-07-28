import { SafeAreaView, View, Text, StatusBar, TouchableOpacity, ScrollView } from "react-native";
import HeaderComponent from "../../components/headerComponent";

import AntDesign from '@expo/vector-icons/AntDesign';

export default function SessionScreen() {
  return (
    <SafeAreaView className="flex-1 justify-start items-center bg-primary">
      <HeaderComponent />
      <View className="flex-1 justify-start items-center px-5 w-full">
        <View className="flex flex-row w-full">
          <TouchableOpacity className="p-2 rounded-lg bg-white/10">
            <AntDesign name="plus" size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        <ScrollView className="mt-5">

        <View className="flex flex-row justify-between py-5 w-full rounded-lg bg-white/10">
          <View className="px-3 py-5 w-3/4 bg-stone-300 rounded-e-2xl">
            <Text className="font-rBold">SetList Name</Text>
            <Text className="text-sm font-rMedium">SetList Details</Text>
          </View>
          <View className="px-1 py-5 rounded-l-lg bg-accent">
          </View>
        </View>

        
        </ScrollView>

      </View>
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
}