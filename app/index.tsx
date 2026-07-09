import { Text, View, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect } from "expo-router";

import { usePreferences } from "../context/PreferencesContext";

import "../global.css";

// Launch gate: brand splash while preferences load, then route — first-time
// users see onboarding, returning users go straight to login.
export default function Page() {
  const { prefs, isLoaded } = usePreferences();

  return (
    <SafeAreaView className="items-center justify-center flex-1 max-w-sm mx-auto">
      <View className="flex flex-row items-center justify-center w-full">
        <Text className="pt-5 tracking-tighter text-white text-7xl font-rBlack">
          Stem
        </Text>
        <Text className="pt-5 tracking-tighter text-7xl font-rBlack text-accent">
          Bits
        </Text>
      </View>
      <StatusBar barStyle="light-content" />
      {isLoaded && (
        <Redirect href={prefs.seenOnboarding ? "/(auths)/login" : "/(auths)"} />
      )}
    </SafeAreaView>
  );
}
