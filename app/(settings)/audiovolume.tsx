import { useState } from "react";
import { ScrollView, StatusBar, Text, TouchableOpacity, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import ScreenHeader from "../../components/ui/screenHeader";
import {
    SettingLink,
    SettingSwitch,
    SettingSection,
    SettingRadio,
    SettingSlider
} from "../../components/ui/settingRow";
import { usePreferences } from "../../context/PreferencesContext";
import { logoutUser } from "../../lib/appwrite";
import { APP_VERSION, SUPPORT_EMAIL } from "../../constants/theme";
import {
    VolumeHigh,
    Bluetooth,
    NotificationBing,
    Flash,
    USBDevice,
    Pad,
    Metromone,
    Loop,
    PhoneVibration
} from "../../components/icons";

// Figma lists three output devices. Which one is active is a choice, not a
// boolean, so it needs its own state rather than borrowing a preference flag.
// Local for now -- nothing routes audio to a specific device yet.
type OutputDevice = "phone" | "bluetooth" | "usb";

const AudioVolume = () => {
    const router = useRouter();
    const { prefs, setPref } = usePreferences();
    const [outputDevice, setOutputDevice] = useState<OutputDevice>("phone");

    // One level per engine, 0–1. Defaults are the positions Figma draws:
    // metronome 98/140, pad 119/140, loop 70/140.
    const [volumes, setVolumes] = useState({
        metronome: 0.7,
        pad: 0.85,
        loop: 0.5,
    });

    const setVolume = (engine: keyof typeof volumes) => (value: number) =>
        setVolumes((prev) => ({ ...prev, [engine]: value }));

    return (
        <SafeAreaView className="flex-1 bg-canvas">
            <StatusBar barStyle="light-content" />
            <ScreenHeader title="Audio Output / Volume" />

            <ScrollView className="flex-1 px-5 ">
                <SettingSection title="Output Devices">
                    <SettingRadio
                        icon={VolumeHigh}
                        label="Phone Speaker"
                        selected={outputDevice === "phone"}
                        onSelect={() => setOutputDevice("phone")}
                        border={true}
                    />
                    <SettingRadio
                        icon={Bluetooth}
                        label="Bluetooth Headphones"
                        selected={outputDevice === "bluetooth"}
                        onSelect={() => setOutputDevice("bluetooth")}
                        border={true}
                    />
                    <SettingRadio
                        icon={USBDevice}
                        label="USB Audio Device"
                        selected={outputDevice === "usb"}
                        onSelect={() => setOutputDevice("usb")}
                    />
                </SettingSection>

                <SettingSection title=" Volume">
                    <SettingSlider
                        icon={Metromone}
                        label="Metronome Volume"
                        value={volumes.metronome}
                        onValueChange={setVolume("metronome")}
                        border={true}
                    />
                    <SettingSlider
                        icon={Pad}
                        label="Pad Volume"
                        value={volumes.pad}
                        onValueChange={setVolume("pad")}
                        border={true}
                    />
                    <SettingSlider
                        icon={Loop}
                        label="Loop Volume"
                        value={volumes.loop}
                        onValueChange={setVolume("loop")}
                    />
                </SettingSection>

                <SettingSection title=" General">
                    <SettingSwitch
                        icon={PhoneVibration}
                        label="Vibrate on Ring"
                        sublabel="Set to Vibrate for phone calls and notifications"
                        value={prefs.haptics}
                        onValueChange={(value) => setPref("haptics", value)}
                    />
                </SettingSection>
            </ScrollView>
        </SafeAreaView>
    );
};

export default AudioVolume;
