import { ScrollView } from "react-native";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import { SettingRadio, SettingSection } from "../../components/ui/settingRow";
import { usePreferences, type Preferences } from "../../context/PreferencesContext";
import {
  PlayCircle,
  PadFill,
  MetronomeFill,
  SortPadFill,
} from "../../components/icons";

// The same four tabs FloatingTabBar renders, in the same filled icon
// treatment it uses for whichever tab is active -- there's no "idle" state
// to speak of here, so every row gets the bold version.
const LAUNCH_SCREEN_OPTIONS: {
  value: Preferences["launchScreen"];
  label: string;
  icon: typeof PlayCircle;
}[] = [
  { value: "loop", label: "Loops", icon: PlayCircle },
  { value: "pad", label: "Pad", icon: PadFill },
  { value: "metro", label: "Metronome", icon: MetronomeFill },
  { value: "session", label: "Sessions", icon: SortPadFill },
];

export default function LaunchScreenSettingsScreen() {
  const { prefs, setPref } = usePreferences();

  return (
    <Screen glows={["topLeft"]}>
      <ScreenHeader title="Launch Screen" />

      <ScrollView className="flex-1 px-screen">
        <SettingSection title="Screens">
          {LAUNCH_SCREEN_OPTIONS.map((option, index) => (
            <SettingRadio
              key={option.value}
              icon={option.icon}
              label={option.label}
              border={index < LAUNCH_SCREEN_OPTIONS.length - 1}
              selected={prefs.launchScreen === option.value}
              onSelect={() => setPref("launchScreen", option.value)}
            />
          ))}
        </SettingSection>
      </ScrollView>
    </Screen>
  );
}
