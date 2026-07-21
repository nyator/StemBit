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
            title: "01. Telemetry Collection",
            body: "We collect device connection states, screen layout preferences, audio volume coefficients, and physical haptic engine feedback latency to optimize localized app performance.",
        },
        {
            title: "02. How We Process Data",
            body: "Your telemetry remains stored locally on your device storage by default. Syncing credentials are fully encrypted to compile anonymized performance statistics on our cloud network.",
        },
        {
            title: "03. Data Rights & Choice",
            body: "You retain complete control over your metrics. You can instantly disable haptic logging, toggle off telemetry transmission, or wipe all cached profile info from the app settings menu.",
        },
        {
            title: "04. Security Protocols",
            body: "We leverage secure transport layers and technical guardrails to prevent external tampering. Stembits never sells user interaction metrics or audio profiles to third-party ad networks.",
        },
    ];

const privacypolicy = () => {
    return (
        <SafeAreaView className="flex-1 bg-canvas">
            <StatusBar barStyle="light-content" />
            <ScreenHeader title="Privacy Policy" />

            <ScrollView className="flex-1 px-5">
                <View className="mb-10">
                    <Text className="self-stretch justify-start text-ink-muted text-center text-md font-light leading-10">
                        At Stembits, protecting your operational data and profile details is our topmost priority.
                        This policy outlines how we capture and store telemetry.
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

export default privacypolicy;
