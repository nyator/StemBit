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
import { previewVolume, settleVolumePreview } from "../../utils/volumePreview";
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
    // No drag state here: each SettingSlider holds its own while the thumb
    // moves, so a drag re-renders one row rather than this whole screen. The
    // engines still follow the drag, through utils/volumePreview.ts; only the
    // release is saved.
    return (
        <Screen glows={["topLeft"]}>
            <ScreenHeader title="Audio output / volume" />

            <ScrollView className="flex-1 px-screen">
                <SettingSection title="Volume">
                    <SettingSlider
                        icon={Loop}
                        label="Loops"
                        value={prefs.loopVolume}
                        onValueChange={(v) => previewVolume("loop", v)}
                        onComplete={(v) => {
                            settleVolumePreview("loop", v);
                            setPref("loopVolume", v);
                        }}
                        defaultValue={DEFAULT_LOOP_VOLUME}
                        border={true}
                    />
                    <SettingSlider
                        icon={Pad}
                        label="Pad"
                        value={prefs.padVolume}
                        onValueChange={(v) => previewVolume("pad", v)}
                        onComplete={(v) => {
                            settleVolumePreview("pad", v);
                            setPref("padVolume", v);
                        }}
                        defaultValue={DEFAULT_PAD_VOLUME}
                        border={true}
                    />
                    
                    <SettingSlider
                        icon={Metromone}
                        label="Metronome"
                        // sublabel="100% is the click as recorded"
                        value={prefs.metronomeVolume}
                        onValueChange={(v) => previewVolume("metronome", v)}
                        onComplete={(v) => {
                            settleVolumePreview("metronome", v);
                            setPref("metronomeVolume", v);
                        }}
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
            </ScrollView>
        </Screen>
    );
};

export default AudioVolume;
