import { useEffect, useState } from "react";
import { ScrollView, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ScreenHeader from "../../components/ui/screenHeader";
import {
    SettingLink,
    SettingSwitch,
    SettingSection,
    SettingRadio,
    SettingStatus,
    SettingSegmented,
    SettingSlider
} from "../../components/ui/settingRow";
import type { Preferences } from "../../context/PreferencesContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useAudioOutputs } from "../../hooks/useAudioOutputs";
import {
    selectOutput,
    showOutputPicker,
    type AudioOutputKind,
} from "../../modules/audio-routes";
import {
    VolumeHigh,
    Bluetooth,
    USBDevice,
    Musicnote,
    Pad,
    Metromone,
    Loop,
    PhoneVibration
} from "../../components/icons";

// The design drew three fixed rows (phone / bluetooth / USB). Those were a
// mockup, not a device list: they never reflected what was plugged in, and
// tapping one changed a local boolean and nothing else. They're replaced by the
// real routes reported by modules/audio-routes, which updates live as devices
// connect and disconnect.
const OUTPUT_ICONS: Record<AudioOutputKind, typeof VolumeHigh> = {
    speaker: VolumeHigh,
    receiver: VolumeHigh,
    wiredHeadset: Musicnote,
    bluetoothA2dp: Bluetooth,
    bluetoothSco: Bluetooth,
    usb: USBDevice,
    hdmi: USBDevice,
    dock: USBDevice,
    airplay: VolumeHigh,
    carAudio: VolumeHigh,
    unknown: VolumeHigh,
};

// Three-way stereo placement for the loop click. Typed off the preference so
// adding a position here without widening Preferences won't compile.
const PAN_OPTIONS: readonly { value: Preferences["loopClickPan"]; label: string }[] = [
    { value: "left", label: "Left" },
    { value: "center", label: "Center" },
    { value: "right", label: "Right" },
];

const AudioVolume = () => {
    const { prefs, setPref } = usePreferences();
    const outputs = useAudioOutputs();

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

    // The platform can still refuse a switch it advertised as selectable (the
    // audio session category can change under us between render and tap). Fall
    // through to the system picker rather than leaving the tap doing nothing.
    const handleSelect = async (id: string) => {
        const switched = await selectOutput(id);
        if (!switched) showOutputPicker();
    };

    return (
        <SafeAreaView className="flex-1 bg-canvas">
            <StatusBar barStyle="light-content" />
            <ScreenHeader title="Audio Output / Volume" />

            <ScrollView className="flex-1 px-5 ">
                <SettingSection title="Output Devices">
                    {outputs.map((output) => {
                        const Icon = OUTPUT_ICONS[output.kind] ?? VolumeHigh;

                        // Only iOS, and only in the right audio session mode,
                        // actually lets us move playback. Where it doesn't, the
                        // row reports the route instead of pretending to set it
                        // -- the picker below is the working control.
                        return output.isSelectable ? (
                            <SettingRadio
                                key={output.id}
                                icon={Icon}
                                label={output.name}
                                selected={output.isActive}
                                onSelect={() => handleSelect(output.id)}
                                border={true}
                            />
                        ) : (
                            <SettingStatus
                                key={output.id}
                                icon={Icon}
                                label={output.name}
                                value={output.isActive ? "Playing" : undefined}
                                border={true}
                            />
                        );
                    })}

                    <SettingLink
                        icon={Bluetooth}
                        label="Change output"
                        sublabel="Opens your device's audio switcher"
                        onPress={showOutputPicker}
                    />
                </SettingSection>

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
