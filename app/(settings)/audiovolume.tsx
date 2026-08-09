import { useEffect, useState } from "react";
import { ScrollView, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ScreenHeader from "../../components/ui/screenHeader";
import {
    SettingSwitch,
    SettingSection,
    SettingSegmented,
    SettingSlider
} from "../../components/ui/settingRow";
import type { Preferences } from "../../context/PreferencesContext";
import { usePreferences } from "../../context/PreferencesContext";
import {
    Pad,
    Metromone,
    Loop,
    PhoneVibration
} from "../../components/icons";

// No output-device section here on purpose. Listing and switching audio outputs
// needs custom native code, which rules out Expo Go, and the half of it users
// actually asked for -- tapping a device to route to it -- isn't permitted on
// iOS at all. The OS already auto-routes to headphones and interfaces when they
// connect, and its own output switcher handles the rest, so the app doesn't try
// to duplicate either.

// Three-way stereo placement for the loop click. Typed off the preference so
// adding a position here without widening Preferences won't compile.
const PAN_OPTIONS: readonly { value: Preferences["loopClickPan"]; label: string }[] = [
    { value: "left", label: "Left" },
    { value: "center", label: "Center" },
    { value: "right", label: "Right" },
];

const AudioVolume = () => {
    const { prefs, setPref } = usePreferences();

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
                <SettingSection title=" Volume">
                    <SettingSlider
                        icon={Loop}
                        label="Loop Volume"
                        value={volumes.loop}
                        onValueChange={setVolume("loop")}
                        onComplete={(v) => setPref("loopVolume", v)}
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
                        icon={Metromone}
                        label="Metronome Volume"
                        value={volumes.metronome}
                        onValueChange={setVolume("metronome")}
                        onComplete={(v) => setPref("metronomeVolume", v)}
                        border={true}
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
