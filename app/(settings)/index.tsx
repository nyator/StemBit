import { ScrollView, StatusBar, Text, TouchableOpacity, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import ScreenHeader from "../../components/ui/screenHeader";
import {
  SettingLink,
  SettingSwitch,
  SettingSection,
} from "../../components/ui/settingRow";
import { usePreferences } from "../../context/PreferencesContext";
import { logoutUser } from "../../lib/appwrite";
import { APP_VERSION, SUPPORT_EMAIL } from "../../constants/theme";

const SettingsScreen = () => {
  const router = useRouter();
  const { prefs, setPref } = usePreferences();

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            await logoutUser();
          } catch {
            // No active session (e.g. dev bypass) — proceed anyway.
          }
          router.replace("/(auths)/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Settings" />

      <ScrollView className="flex-1 px-5">
        <SettingSection title="Account">
          <SettingLink
            icon="person-outline"
            label="Profile"
            sublabel="Your account details"
            onPress={() => router.push("/user")}
          />
          <SettingLink
            icon="key-outline"
            label="Change Password"
            onPress={() => router.push("/(auths)/reset-password")}
          />
        </SettingSection>

        <SettingSection title="Playback">
          <SettingSwitch
            icon="pulse-outline"
            label="Meter Accents"
            sublabel="Accent group beats in 6/8, 7/8, 5/4 and other meters"
            value={prefs.meterAccents}
            onValueChange={(value) => setPref("meterAccents", value)}
          />
          <SettingSwitch
            icon="radio-button-on-outline"
            label="Haptic Feedback"
            sublabel="Vibrate on pad presses and tap tempo"
            value={prefs.haptics}
            onValueChange={(value) => setPref("haptics", value)}
          />
        </SettingSection>

        <SettingSection title="About">
          <SettingLink
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => router.push("/help")}
          />
          <SettingLink
            icon="mail-outline"
            label="Contact Us"
            sublabel={SUPPORT_EMAIL}
            onPress={() =>
              Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=StemBit`).catch(
                () => {}
              )
            }
          />
          <SettingLink
            icon="information-circle-outline"
            label="Version"
            value={APP_VERSION}
            onPress={() => {}}
          />
        </SettingSection>

        <TouchableOpacity
          className="items-center py-4 mb-10 border rounded-2xl border-error/40 bg-error/10"
          onPress={handleLogout}
        >
          <Text className="text-base text-error font-rBold">Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;
