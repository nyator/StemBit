import { useEffect, useState } from "react";
import { ScrollView } from "react-native";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import {
    SettingSwitch,
    SettingSection,
    SettingSegmented,
    SettingSlider
} from "../../components/ui/settingRow";
import type { Preferences } from "../../context/PreferencesContext";
import { isNativeAudioAvailable } from "../../utils/nativeAudio";
import {
    DEFAULT_LOOP_VOLUME,
    DEFAULT_METRONOME_VOLUME,
    DEFAULT_PAD_VOLUME,
    METRONOME_MAX_VOLUME,
    usePreferences,
} from "../../context/PreferencesContext";
import {
    Pad,
    Metromone,
    Loop,
    Musicnote,
} from "../../components/icons";

// No output-device section here on purpose. Listing and switching audio outputs
// needs custom native code, which rules out Expo Go, and the half of it users
// actually asked for -- tapping a device to route to it -- isn't permitted on
// iOS at all. The OS already auto-routes to headphones and interfaces when they
// connect, and its own output switcher handles the rest, so the app doesn't try
// to duplicate either.

// Three-way stereo placement for the loop click. Typed off the preference so
// adding a position here without widening Preferences won't compile.

// Fixed for the life of the binary, so read once.
const nativeAudioAvailable = isNativeAudioAvailable();

const PAN_OPTIONS: readonly { value: Preferences["loopClickPan"]; label: string }[] = [
    { value: "left", label: "Left" },
    { value: "center", label: "Center" },
    { value: "right", label: "Right" },
];

const AudioVolume = () => {
    const { prefs, setPref } = usePreferences();
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
        <Screen glows={["topLeft"]}>
            <ScreenHeader title="Audio output / volume" />

            <ScrollView className="flex-1 px-screen">
                <SettingSection title="Volume">
                    <SettingSlider
                        icon={Loop}
                        label="Loops"
                        value={volumes.loop}
                        onValueChange={setVolume("loop")}
                        onComplete={(v) => setPref("loopVolume", v)}
                        defaultValue={DEFAULT_LOOP_VOLUME}
                        border={true}
                    />
                    <SettingSlider
                        icon={Pad}
                        label="Pad"
                        value={volumes.pad}
                        onValueChange={setVolume("pad")}
                        onComplete={(v) => setPref("padVolume", v)}
                        defaultValue={DEFAULT_PAD_VOLUME}
                        border={true}
                    />
                    
                    <SettingSlider
                        icon={Metromone}
                        label="Metronome"
                        // sublabel="100% is the click as recorded"
                        value={volumes.metronome}
                        onValueChange={setVolume("metronome")}
                        onComplete={(v) => setPref("metronomeVolume", v)}
                        defaultValue={DEFAULT_METRONOME_VOLUME}
                        max={METRONOME_MAX_VOLUME}
                    />
                </SettingSection>

                <SettingSection title="Loop click">
                    <SettingSwitch
                        icon={Loop}
                        label="Loop click"
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

                <SettingSection title="General">
                    {/* Loops, the metronome and sessions can either take the
                        audio (heard even on silent) or share it with other
                        apps (muted by the silent switch). iOS offers them no
                        way to do both; pads always mix. */}
                    <SettingSwitch
                        icon={Musicnote}
                        label="Play alongside other apps"
                        sublabel="Keep YouTube or music playing under loops and the metronome. The silent switch will mute them."
                        value={prefs.mixWithOthers}
                        onValueChange={(value) => setPref("mixWithOthers", value)}
                        border={true}
                    />
                    {/* Experimental: the same engines on the app's own audio
                        session instead of WebViews'. Here so the two can be
                        compared on a real phone before either is chosen. */}
                    <SettingSwitch
                        icon={Musicnote}
                        label="Native audio (beta)"
                        sublabel={
                            nativeAudioAvailable
                                ? "Runs the metronome, loops and sessions on native audio, so they keep playing in the background and ignore the silent switch."
                                : "Not available in this build of the app. Install a newer build to try it."
                        }
                        value={nativeAudioAvailable && prefs.nativeAudio}
                        onValueChange={(value) => {
                            if (nativeAudioAvailable) setPref("nativeAudio", value);
                        }}
                    />
                </SettingSection>
            </ScrollView>
        </Screen>
    );
};

export default AudioVolume;
