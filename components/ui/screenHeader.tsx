import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ArrowLeft } from "../icons";
import { SIZES } from "../../constants/theme";

// The back button's footprint: a 24pt icon inside 8pt of padding. The spacer
// opposite it is the same width, which is what keeps the title optically
// centred whether or not there is a right-hand action.
const BACK_FOOTPRINT = SIZES.navIcon + 16;

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
        <TouchableOpacity
          onPress={onBack ?? (() => router.back())}
          className="p-2 rounded-full bg-white/10"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={SIZES.navIcon} color="white" />
        </TouchableOpacity>
      ) : (
        <View style={{ width: BACK_FOOTPRINT }} />
      )}
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        className="flex-1 mx-2 text-center text-white text-heading font-spaceBold"
      >
        {title}
      </Text>
      <View style={{ minWidth: BACK_FOOTPRINT, alignItems: "flex-end" }}>
        {action}
      </View>
    </View>
  );
}
