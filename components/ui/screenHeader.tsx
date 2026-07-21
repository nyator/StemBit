import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ArrowLeft } from "../icons";

type ScreenHeaderProps = {
  title: string;
  // Right-side action (e.g. a + button). Width-balanced against the back button.
  action?: ReactNode;
  onBack?: () => void; // defaults to router.back()
  showBack?: boolean;
};

// The one header used by every pushed screen: back button, centered title,
// optional right action. Keeps titles aligned identically across the app.
export default function ScreenHeader({
  title,
  action,
  onBack,
  showBack = true,
}: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between w-full px-5 mt-4 mb-5">
      {showBack ? (
        <TouchableOpacity
          onPress={onBack ?? (() => router.back())}
          className="p-2 rounded-full bg-white/10"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color="white" />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 38 }} />
      )}
      <Text className="text-2xl text-white font-spaceBold">{title}</Text>
      <View style={{ minWidth: 38, alignItems: "flex-end" }}>{action}</View>
    </View>
  );
}
