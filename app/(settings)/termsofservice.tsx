import { View, Text, ScrollView } from "react-native";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import { SUPPORT_EMAIL } from "../../constants/theme";

// Plain terms for what Stembits is: a practice and performance tool. On the App
// Store, Apple's standard EULA also applies unless a custom one is set in App
// Store Connect, so these sit alongside it rather than replacing it.
const UPDATED = "28 September 2026";

const SECTIONS: {
  title: string;
  body: string;
}[] = [
    {
      title: "01. Using Stembits",
      body: "Stembits is a practice and performance tool: loops, pads, a metronome and setlists. By using the app you agree to these terms. If you don't agree, please stop using it.",
    },
    {
      title: "02. Your account",
      body: "An account is optional. If you create one, keep access to your email secure, since sign-in codes are sent there. You can delete your account at any time from Settings → Profile.",
    },
    {
      title: "03. Your content",
      body: "Audio you import stays yours and stays on your device. Only import audio you own or have the right to use.",
    },
    {
      title: "04. Loops and sounds",
      body: "The loops, pads and sounds included in or downloaded through Stembits are licensed to you for your own practice, rehearsal and live performance. Don't resell or redistribute the audio files themselves.",
    },
    {
      title: "05. Availability",
      body: "Stembits is provided as is. We work to keep it reliable, but we can't guarantee it will be free of errors or that the loop store will always be available. Always rehearse with your setup before performing.",
    },
    {
      title: "06. Changes and contact",
      body: `We may update these terms; the new version will appear here with a new date. Questions: ${SUPPORT_EMAIL}.`,
    },
  ];

const termsOfService = () => {
  return (
    <Screen glows={["topLeft"]}>
      <ScreenHeader title="Terms of service" />

      <ScrollView className="flex-1 px-screen">
        <View className="mb-10">
          <Text className="self-stretch justify-start text-ink-muted text-label text-center font-satoshiRegular leading-10">
            The terms for using Stembits. Last updated {UPDATED}.
          </Text>
        </View>
        {SECTIONS.map((section) => (
          <View key={section.title}>
            <View className="flex-row items-center mb-2">
              <Text className="text-label uppercase text-ink-muted font-spaceBold">
                {section.title}
              </Text>
            </View>
            <View className=" p-4 mb-5 rounded-2xl bg-surface">
              <Text className="text-label leading-5 text-white font-satoshiRegular">
                {section.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
};

export default termsOfService;
