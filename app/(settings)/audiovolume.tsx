import { useEffect, useState } from "react";
import { ScrollView, StatusBar, Text, TouchableOpacity, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import ScreenHeader from "../../components/ui/screenHeader";
import {
    SettingLink,
    SettingSwitch,
    SettingSection,
    SettingRadio,
    SettingSegmented,
    SettingSlider
} from "../../components/ui/settingRow";
import type { Preferences } from "../../context/PreferencesContext";
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

// Three-way stereo placement for the loop click. Typed off the preference so
// adding a position here without widening Preferences won't compile.
const PAN_OPTIONS: readonly { value: Preferences["loopClickPan"]; label: string }[] = [
    { value: "left", label: "Left" },
    { value: "center", label: "Center" },
    { value: "right", label: "Right" },
];

const AudioVolume = () => {
    const router = useRouter();
    const { prefs, setPref } = usePreferences();
    const [outputDevice, setOutputDevice] = useState<OutputDevice>("phone");

    // Local mirrors of the persisted per-engine volumes. The slider drives
    // these live for a smooth thumb; we persist to preferences (which pushes to
    // the engine) only on release, avoiding a file write on every drag tick.
    const [volumes, setVolumes] = useState({
        metronome: prefs.metronomeVolume,
        pad: prefs.padVolume,
        loop: prefs.loopVolume,
    });
    useEffect(() => {
        setVolumes({
            metronome: prefs.metronomeVolume,
            pad: prefs.padVolume,
            loop: prefs.loopVolume,
        });
    }, [prefs.metronomeVolume, prefs.padVolume, prefs.loopVolume]);

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
                        onComplete={(v) => setPref("metronomeVolume", v)}
                        border={true}
                    />
                    <SettingSlider
                        icon={Pad}
                        label="Pad Volume"
                        value={volumes.pad}
                        onValueChange={setVolume("pad")}
                        onComplete={(v) => setPref("padVolume", v)}
                        border={true}
                    />
                    <SettingSlider
                        icon={Loop}
                        label="Loop Volume"
                        value={volumes.loop}
                        onValueChange={setVolume("loop")}
                        onComplete={(v) => setPref("loopVolume", v)}
                    />
                </SettingSection>

                <SettingSection title="Loop Click">
                    <SettingSwitch
                        icon={Loop}
                        label="Loop Click"
                        sublabel="Play a metronome click along with loops"
                        value={prefs.loopClick}
                        onValueChange={(value) => setPref("loopClick", value)}
                        border={true}
                    />
                    <SettingSegmented
                        label="Pan"
                        sublabel="Stereo placement of the click"
                        value={prefs.loopClickPan}
                        options={PAN_OPTIONS}
                        onChange={(pan) => setPref("loopClickPan", pan)}
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
