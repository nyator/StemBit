import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import NavButton from "./ui/navButton";
import { Setting2, VolumeHigh } from "./icons";

// The header on the four tab screens: wordmark left, volume and settings right.
//
// Padded to the same x as ScreenHeader, so the wordmark on a tab screen and the
// title on a pushed screen start from the same edge. It used to sit at 32
// against everything else's 20, which read as the header sliding sideways every
// time you opened a sub-screen.
//
// The buttons are NavButton for the same reason: they land in the same corner
// as ScreenHeader's back button on the routes either side of a push, so they
// have to be the same button -- footprint, material and all.
const HeaderComponent = () => {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between w-full px-screen mt-4 mb-5">
      <Text className="text-white font-wordmark text-wordmarkSm tracking-wordmark">
        stembits
      </Text>

      <View className="flex-row gap-2">
        <NavButton
          icon={VolumeHigh}
          onPress={() => router.push("/(settings)/audiovolume")}
          accessibilityLabel="Audio output and volume"
        />
        <NavButton
          icon={Setting2}
          onPress={() => router.push("/(settings)")}
          accessibilityLabel="Go to settings"
        />
      </View>
    </View>
  );
};

export default HeaderComponent;
