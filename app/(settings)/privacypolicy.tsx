import { View, Text, ScrollView } from "react-native";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import { SUPPORT_EMAIL } from "../../constants/theme";

// What StemBits actually does with data, and nothing it doesn't.
//
// App Review reads this against the app and against the App Privacy answers in
// App Store Connect, and a policy that describes collection the app doesn't do
// (or misses some it does) is a 5.1.1 rejection. If a new service, SDK or
// upload is added, this page and those answers change in the same release.
// The same text must also be hosted at the public Privacy Policy URL.
const UPDATED = "28 September 2026";

const SECTIONS: {
    title: string;
    body: string;
}[] = [
        {
            title: "01. What we collect",
            body: "StemBits works without an account. If you create one, we store your email address, and optionally a display name and a profile photo you choose. Nothing else about you is collected.",
        },
        {
            title: "02. What stays on your device",
            body: "Loops and stems you import, loops you download, your setlists and your settings are stored only on your device. They are never uploaded to us.",
        },
        {
            title: "03. Services we use",
            body: "Accounts and sign-in codes are handled by Clerk. Loop store downloads come from Cloudflare, and app updates are delivered by Expo. Like any web request, these services receive technical details such as your IP address in order to respond.",
        },
        {
            title: "04. What we don't do",
            body: "StemBits has no advertising, no analytics and no tracking across apps or websites. We never sell or share your data with advertisers or data brokers.",
        },
        {
            title: "05. Photos",
            body: "StemBits only reads the single photo you pick as your profile picture. It is uploaded to your account so it appears on your profile, and removed when you remove it or delete your account.",
        },
        {
            title: "06. Deleting your data",
            body: "Settings → Profile → Delete account permanently deletes your account and everything StemBits has stored on your device. Without an account, deleting the app removes everything.",
        },
        {
            title: "07. Children",
            body: "StemBits is not directed at children under 13, and we do not knowingly collect their personal information.",
        },
        {
            title: "08. Contact",
            body: `Questions about this policy or your data: ${SUPPORT_EMAIL}. If this policy changes, the new version will appear here with a new date.`,
        },
    ];

const privacypolicy = () => {
    return (
        <Screen glows={["topLeft"]}>
            <ScreenHeader title="Privacy policy" />

            <ScrollView className="flex-1 px-screen">
                <View className="mb-10">
                    <Text className="self-stretch justify-start text-ink-muted text-center text-label font-satoshiRegular leading-10">
                        How StemBits handles your information. Last updated {UPDATED}.
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

export default privacypolicy;
