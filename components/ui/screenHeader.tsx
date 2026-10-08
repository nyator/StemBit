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
  /**
   * "left" puts the title beside the back button and lets the action slot
   * take as many buttons as it holds. For a screen with more than one action,
   * where a centred title between one back button and two actions sits
   * visibly off-centre anyway.
   */
  titleAlign?: "center" | "left";
};

export default function ScreenHeader({
  title,
  subTitle,
  action,
  onBack,
  showBack = true,
  titleAlign = "center",
}: ScreenHeaderProps) {
  const router = useRouter();
  const left = titleAlign === "left";

  return (
    <View className="flex-row items-center justify-between w-full px-screen mt-4 mb-5">
      {/* Left Back Anchor */}
      {showBack ? (
        <NavButton
          icon={ArrowLeft}
          onPress={onBack ?? (() => router.back())}
          accessibilityLabel="Go back"
        />
      ) : left ? null : (
        <View style={{ width: NAV_BUTTON_FOOTPRINT }} />
      )}

      <View
        className={`flex-1 justify-center ${left ? "items-start ml-3 mr-2" : "items-center mx-2"}`}
      >
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          className={`w-full text-white text-heading font-spaceBold ${left ? "text-left" : "text-center"}`}
        >
          {title}
        </Text>
        {subTitle && (
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className={`w-full text-ink-muted text-label font-satoshiMedium ${left ? "text-left" : "text-center"}`}
          >
            {subTitle}
          </Text>
        )}
      </View>

      {/* Right Action Anchor */}
      <View
        style={
          left
            ? { alignItems: "flex-end" }
            : { width: NAV_BUTTON_FOOTPRINT, alignItems: "flex-end" }
        }
      >
        {action}
      </View>
    </View>
  );
}