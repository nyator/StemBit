import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ArrowLeft } from "../icons";
import NavButton, { NAV_BUTTON_FOOTPRINT } from "./navButton";

type ScreenHeaderProps = {
  title: string;
  subTitle?: string;
  action?: ReactNode;
  onBack?: () => void; // defaults to router.back()
  showBack?: boolean;
};

export default function ScreenHeader({
  title,
  subTitle,
  action,
  onBack,
  showBack = true,
}: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between w-full px-screen mt-4 mb-5">
      {/* Left Back Anchor */}
      {showBack ? (
        <NavButton
          icon={ArrowLeft}
          onPress={onBack ?? (() => router.back())}
          accessibilityLabel="Go back"
        />
      ) : (
        <View style={{ width: NAV_BUTTON_FOOTPRINT }} />
      )}

      <View className="flex-1 items-center justify-center mx-2">
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          className="w-full text-center text-white text-heading font-spaceBold"
        >
          {title}
        </Text>
        {subTitle && (
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className="w-full text-center text-ink-muted text-label font-satoshiMedium"
          >
            {subTitle}
          </Text>
        )}
      </View>

      {/* Right Action Anchor */}
      <View style={{ width: NAV_BUTTON_FOOTPRINT, alignItems: "flex-end" }}>
        {action}
      </View>
    </View>
  );
}