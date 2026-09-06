import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ArrowLeft } from "../icons";
import NavButton, { NAV_BUTTON_FOOTPRINT } from "./navButton";

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
    <View className="flex-row items-center justify-between w-full px-screen mt-4 mb-5">
      {showBack ? (
        <NavButton
          icon={ArrowLeft}
          onPress={onBack ?? (() => router.back())}
          accessibilityLabel="Go back"
        />
      ) : (
        <View style={{ width: NAV_BUTTON_FOOTPRINT }} />
      )}
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        className="flex-1 mx-2 text-center text-white text-heading font-spaceBold"
      >
        {title}
      </Text>
      <View style={{ minWidth: NAV_BUTTON_FOOTPRINT, alignItems: "flex-end" }}>
        {action}
      </View>
    </View>
  );
}
