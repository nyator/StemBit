import { Image, Text, View } from "react-native";
import { useRouter } from "expo-router";

import Screen from "../../components/ui/screen";
import { BrandButton, GhostButton } from "../../components/ui/brandButton";

// Notification permission prompt, shown after onboarding and before sign-in.
//
// Figma tilts the mail artwork 21 degrees inside a 229pt box; the heading sits
// 209pt down from the top of that group with 3pt to the supporting line.
const ARTWORK = 177;
const ARTWORK_TILT = "21.02deg";

export default function NotificationsScreen() {
  const router = useRouter();

  // Both paths route onward -- declining is a valid choice, not a dead end.
  // Wire the accept path to expo-notifications when that dependency lands.
  const continueToSignIn = () => router.replace("/login");

  return (
    <Screen glows={["topLeft", "bottomLeft"]}>
      <View className="items-center justify-center flex-1 px-8">
        <View
          style={{
            width: ARTWORK,
            height: ARTWORK,
            transform: [{ rotate: ARTWORK_TILT }],
          }}
          className="items-center justify-center"
        >
          <Image
            source={require("../../assets/images/notification-mail.png")}
            resizeMode="contain"
            style={{ width: "100%", height: "100%" }}
          />
        </View>

        <View className="items-center gap-[3px] mt-12">
          <Text className="text-[20px] tracking-wordmark font-spaceBold text-ink">
            Turn on Notifications
          </Text>
          <Text className="max-w-[274px] text-center text-body tracking-wordmark font-satoshiRegular text-ink-soft">
            Get notifications about updates, products and promotions
          </Text>
        </View>
      </View>

      <View className="gap-[10px] px-7 pb-4">
        <BrandButton label="Allow Notifications" onPress={continueToSignIn} />
        <GhostButton label="Maybe Later" onPress={continueToSignIn} />
      </View>
    </Screen>
  );
}
