import { View, Text, StatusBar, ScrollView, TouchableOpacity, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ScreenHeader from "../../components/ui/screenHeader";
import { COLORS, SUPPORT_EMAIL } from "../../constants/theme";
import {
  Clipboard,
  Musicnote,
  Setting4,
  Sms,
  VideoCircle,
} from "../../components/icons";

const GUIDES: {
  title: string;
  body: string;
}[] = [
    {
      title: "01. Acceptance of Terms",
      body: "Stembits provides hardware metrics and interactive controller tools. By utilizing our mobile application, you explicitly consent to these terms. If you disagree, please discontinue use immediately.",
    },
    {
      title: "02. User Account Duty",
      body: "You are solely responsible for protecting your device profile, account credentials, and haptic preference configurations. Any security breaches or unauthorized activity must be reported to support.",
    },
    {
      title: "03. Prohibited Activities",
      body: "You agree not to bypass haptic limits, decode audio output streams, or deploy automated bots to simulate system triggers. Violating local frequency constraints will result in immediate profile suspension.",
    },
    {
      title: "04. Limitation of Liability",
      body: "Stembits is provided 'as is' without express warranty of absolute uptime. We are not liable for peripheral system failures, audio synchronization delays, or device overheating caused by maximum haptic feedback.",
    },
  ];

const termsOfService = () => {
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Terms Of Service" />

      <ScrollView className="flex-1 px-5">
        <View className="mb-10">
          <Text className="self-stretch justify-start text-ink-muted text-md text-center font-light leading-10">
            Please read these Terms of Service carefully before using Stembits.
            By accessing our services, you agree to be bound by these operating rules.
          </Text>
        </View>
        {GUIDES.map((guide) => (
          <View
            key={guide.title}
            className=""
          >
            <View className="flex-row items-center mb-2">
              <Text className="text-md uppercase text-ink-muted font-spaceBold">
                {guide.title}
              </Text>
            </View>
            <View className=" p-4 mb-5 rounded-2xl bg-surface">
              <Text className="text-md leading-5 text-white font-satoshiRegular">
                {guide.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default termsOfService;
