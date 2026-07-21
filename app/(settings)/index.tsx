import {
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";

import ScreenHeader from "../../components/ui/screenHeader";
import {
  SettingLink,
  SettingSwitch,
  SettingSection,
} from "../../components/ui/settingRow";
import { usePreferences } from "../../context/PreferencesContext";
import { logoutUser } from "../../lib/appwrite";
import {
  ProfileCircle,
  VolumeHigh,
  DocumentText,
  ShieldSecurity,
  NotificationBing,
  Flash,
  MessageQuestion,
} from "../../components/icons";

// Read from app.json via expo-constants rather than a hardcoded constant, so
// these can't drift from what actually ships.
//
// The build number is whatever the store sees: iOS calls it buildNumber,
// Android versionCode. Neither is set in app.json yet, so this renders an em
// dash until one is added (or until every build bumps it via EAS).
const VERSION = Constants.expoConfig?.version ?? "—";
const BUILD =
  Platform.select({
    ios: Constants.expoConfig?.ios?.buildNumber,
    android: Constants.expoConfig?.android?.versionCode?.toString(),
  }) ?? "—";

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
    <SafeAreaView className="flex-1 bg-canvas">
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Settings" />

      <ScrollView className="flex-1 px-5 ">
        <SettingSection title="Account">
          <SettingLink
            icon={ProfileCircle}
            label="Profile"
            onPress={() => router.push("/user")}
          />
        </SettingSection>

        <SettingSection title=" Audio / Playback">
          <SettingLink
            icon={VolumeHigh}
            label="Audio Output / Volume"
            onPress={() => router.push("/audiovolume")}
          />
        </SettingSection>

        <SettingSection title=" App">
          <SettingSwitch
            icon={NotificationBing}
            label="Notification"
            value={prefs.meterAccents}
            border={true}
            onValueChange={(value) => setPref("meterAccents", value)}
          />
          <SettingSwitch
            icon={Flash}
            label="Haptic Feedback"
            sublabel="Vibrate on pad presses and tap tempo"
            value={prefs.haptics}
            onValueChange={(value) => setPref("haptics", value)}
          />
        </SettingSection>

        <SettingSection title="About">
          <SettingLink
            icon={MessageQuestion}
            label="Help & Support"
            border={true}
            onPress={() => router.push("/help")}
          />
          <SettingLink
            icon={DocumentText}
            label="Terms of Service"
            border={true}
            onPress={() => router.push("/termsofservice")}
          />
          <SettingLink
            icon={ShieldSecurity}
            label="Privacy Policy"
            onPress={() => router.push("/privacypolicy")}
          />
        </SettingSection>

        <TouchableOpacity
          className="self-center items-center py-2 border rounded-2xl bg-white w-28"
          onPress={handleLogout}
        >
          <Text className="text-base font-spaceBold">Log Out</Text>
        </TouchableOpacity>

        <View className="items-center mt-3 mb-10">
          <Text className="text-sm text-ink-muted font-spaceRegular">
            version {VERSION}
          </Text>
          <Text className="text-overline text-sm text-ink-muted font-spaceRegular">
            build {BUILD}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;
