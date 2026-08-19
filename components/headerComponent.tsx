import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Setting2, VolumeHigh } from "./icons";
import { SIZES } from "../constants/theme";

// The header on the four tab screens: wordmark left, volume and settings right.
//
// Padded to the same x as ScreenHeader, so the wordmark on a tab screen and the
// title on a pushed screen start from the same edge. It used to sit at 32
// against everything else's 20, which read as the header sliding sideways every
// time you opened a sub-screen.
const HeaderComponent = () => {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between w-full px-screen mt-4 mb-5">
      <Text className="text-white font-wordmark text-wordmarkSm tracking-wordmark">
        stembits
      </Text>

      <View className="flex-row">
        <TouchableOpacity
          className="p-2 rounded-full"
          onPress={() => router.push("/(settings)/audiovolume")}
          accessibilityLabel="Audio output and volume"
        >
          <VolumeHigh size={SIZES.navIcon} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          className="p-2 rounded-full"
          onPress={() => router.push("/(settings)")}
          accessibilityLabel="Go to settings"
        >
          <Setting2 size={SIZES.navIcon} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default HeaderComponent;
