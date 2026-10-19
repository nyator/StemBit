import { Alert } from "react-native";

import {
  MAX_PAD_LAYERS,
  findPadPackByKey,
  type PadKind,
  type PadPack,
} from "../constants/pads";
import { usePreferences } from "../context/PreferencesContext";

/** A strip on the mixer: one loaded pack, a pad or an ambience. */
export type MixerChannel = {
  /** PadPack.key. */
  id: string;
  kind: PadKind;
  title: string;
  subtitle: string;
  /**
   * Fader position, 0–1, and what the strip reads out. This is the channel's
   * own setting, not its share of the output — the engine still normalises the
   * summed voices so they can't clip (see padBusScale), but that's the desk's
   * business rather than something to show on the scale. A fader at the top
   * reads 100 whatever else is loaded, the way a fader should.
   */
  level: number;
  muted: boolean;
};

// The pad stack and the mixer's rules in one place: what can be loaded, what
// can be removed, and how a level, mute or share is worked out. The catalog
// list, the mixer and the pad screen all read the same stack, and when each
// derived its own view of it they were one edit away from disagreeing.
export function usePadLayers() {
  const { prefs, setPref } = usePreferences();
  const layers = prefs.padLayers;

  const layerFor = (packKey: string) =>
    layers.find((layer) => layer.pack === packKey);

  // Loaded packs resolved against the catalog. Keys with no matching pack are
  // dropped rather than rendered blank, so a pack retired between releases
  // can't leave a hole in the mixer.
  const loaded = layers.flatMap((layer) => {
    const pack = findPadPackByKey(layer.pack);
    return pack ? [{ pack, layer }] : [];
  });

  const channels: MixerChannel[] = loaded.map(({ pack, layer }) => ({
    id: pack.key,
    kind: pack.kind,
    title: pack.title,
    subtitle: pack.artist,
    level: layer.level,
    muted: layer.muted,
  }));

  const addLayer = (pack: PadPack) => {
    if (layerFor(pack.key)) return;

    if (layers.length >= MAX_PAD_LAYERS) {
      Alert.alert(
        "Mixer full",
        `You can load up to ${MAX_PAD_LAYERS} pads at once. Remove one to add another.`
      );
      return;
    }

    setPref("padLayers", [
      ...layers,
      { pack: pack.key, level: 1, muted: false },
    ]);
  };

  // Confirms before unloading, wherever it's called from. Removing sits next
  // to Mute on a narrow channel strip, so a mis-tap is easy and the cost is
  // losing a pack's place in the mix -- the dialog is what makes that
  // recoverable. Keeping the prompt here rather than at each call site is also
  // what stops the mixer and the catalog from confirming differently.
  const removeLayer = (packKey: string) => {
    const pack = findPadPackByKey(packKey);
    if (!layerFor(packKey) || !pack) return;

    // The instrument has no silent state -- a key press has to sound
    // something -- so the last pack can't be removed, only swapped. Muting is
    // the way to silence one without giving up its place.
    if (layers.length === 1) {
      Alert.alert(
        "Keep one pad",
        "The instrument needs at least one pad loaded. Load another before removing this one, or mute it instead."
      );
      return;
    }

    Alert.alert(
      "Unload Pad",
      `Remove "${pack.title}" from the mixer?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            setPref(
              "padLayers",
              layers.filter((layer) => layer.pack !== packKey)
            ),
        },
      ],
      { cancelable: true }
    );
  };

  const setLevel = (channelId: string, level: number) => {
    const clamped = Math.max(0, Math.min(1, level));

    setPref(
      "padLayers",
      layers.map((layer) =>
        layer.pack === channelId ? { ...layer, level: clamped } : layer
      )
    );
  };

  const toggleMute = (channelId: string) => {
    setPref(
      "padLayers",
      layers.map((layer) =>
        layer.pack === channelId ? { ...layer, muted: !layer.muted } : layer
      )
    );
  };

  return {
    layers,
    channels,
    loadedCount: layers.length,
    layerFor,
    addLayer,
    removeLayer,
    setLevel,
    toggleMute,
    isFull: layers.length >= MAX_PAD_LAYERS,
  };
}
