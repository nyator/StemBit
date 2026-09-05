import { ScrollView, Text, Alert, Linking, Platform, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";

import ScreenHeader from "../../components/ui/screenHeader";
import Screen from "../../components/ui/screen";
import { InverseButton } from "../../components/ui/brandButton";
import {
  SettingLink,
  SettingSwitch,
  SettingSection,
} from "../../components/ui/settingRow";
import { usePreferences, type Preferences } from "../../context/PreferencesContext";
import { useSessionCue } from "../../context/SessionCueContext";
import { useMetronome } from "../../context/MetronomeContext";
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

// Just the label for the current choice, shown as the link row's value text --
// the full options (with their icons) live on the sub-screen itself
// (launchscreen.tsx), which is the only place that needs to render all four.
const LAUNCH_SCREEN_LABELS: Record<Preferences["launchScreen"], string> = {
  loop: "Loops",
  pad: "Pad",
  metro: "Metronome",
  session: "Sessions",
};

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
  const { endSession } = useSessionCue();
  const { stopMetronome } = useMetronome();

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          // The engines behind a session (loop, pad, stems) and the standalone
          // metronome all live above the navigator specifically so they
          // survive normal screen changes -- signing out is the one screen
          // change that has to be the exception, or the next person to pick
          // up the phone hears whatever the last one left running.
          endSession();
          stopMetronome();
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
    <Screen glows={["topLeft"]}>
      <ScreenHeader title="Settings" />

      <ScrollView className="flex-1 px-screen">
        <SettingSection title="Account">
          <SettingLink
            icon={ProfileCircle}
            label="Profile"
            onPress={() => router.push("/user")}
          />
        </SettingSection>

        <SettingSection title="Audio / Playback">
          <SettingLink
            icon={VolumeHigh}
            label="Audio Output / Volume"
            onPress={() => router.push("/audiovolume")}
          />
        </SettingSection>

        <SettingSection title="App">
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
            border={true}
            onValueChange={(value) => setPref("haptics", value)}
          />
          <SettingLink
            label="Launch Screen"
            value={LAUNCH_SCREEN_LABELS[prefs.launchScreen]}
            onPress={() => router.push("/launchscreen")}
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

        {/* The same white button the profile screen signs out with, rather
            than a second one shaped like it. */}
        <InverseButton
          label="Log Out"
          onPress={handleLogout}
          style={{ alignSelf: "center" }}
        />

        <View className="items-center mt-3 mb-10">
          <Text className="text-label text-ink-muted font-spaceRegular">
            version {VERSION}
          </Text>
          <Text className="text-overline text-ink-muted font-spaceRegular">
            build {BUILD}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
};

export default SettingsScreen;
