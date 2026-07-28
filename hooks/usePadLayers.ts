import { Alert } from "react-native";

import {
  MAX_PAD_LAYERS,
  NATURE_CHANNEL,
  findPadPackByKey,
  padBusScale,
  type PadPack,
} from "../constants/pads";
import { usePreferences } from "../context/PreferencesContext";

/** A strip on the mixer: a loaded pad pack, or the nature bed. */
export type MixerChannel = {
  /** PadPack.key, or NATURE_CHANNEL.key. */
  id: string;
  title: string;
  subtitle: string;
  level: number;
  muted: boolean;
  /**
   * Fraction of the total output this channel occupies, 0–1. Not the same as
   * its level: the mix is normalised, so a channel at level 1 alongside another
   * at level 1 takes half the output, and a muted one takes none.
   */
  share: number;
  /** The nature bed is permanent; pad packs can be unloaded. */
  removable: boolean;
};

// The pad stack and the mixer's rules in one place: what can be loaded, what
// can be removed, and how a level, mute or share is worked out. The catalog
// list, the mixer and the pad screen all read the same stack, and when each
// derived its own view of it they were one edit away from disagreeing.
export function usePadLayers() {
  const { prefs, setPref } = usePreferences();
  const layers = prefs.padLayers;
  const nature = prefs.natureNoise;

  const layerFor = (packKey: string) =>
    layers.find((layer) => layer.pack === packKey);

  // Loaded packs resolved against the catalog. Keys with no matching pack are
  // dropped rather than rendered blank, so a pack retired between releases
  // can't leave a hole in the mixer.
  const loaded = layers.flatMap((layer) => {
    const pack = findPadPackByKey(layer.pack);
    return pack ? [{ pack, layer }] : [];
  });

  // The nature bed shares the output bus with the pads, so it has to be in the
  // scale — otherwise bringing it in would push the total past full scale and
  // clip everything.
  const busScale = padBusScale([...layers, nature]);

  const padChannels: MixerChannel[] = loaded.map(({ pack, layer }) => ({
    id: pack.key,
    title: pack.title,
    subtitle: pack.artist,
    level: layer.level,
    muted: layer.muted,
    share: layer.muted ? 0 : layer.level * busScale,
    removable: true,
  }));

  const natureChannel: MixerChannel = {
    id: NATURE_CHANNEL.key,
    title: NATURE_CHANNEL.title,
    subtitle: NATURE_CHANNEL.subtitle,
    level: nature.level,
    muted: nature.muted,
    share: nature.muted ? 0 : nature.level * busScale,
    removable: false,
  };

  const channels = [...padChannels, natureChannel];

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

    if (channelId === NATURE_CHANNEL.key) {
      setPref("natureNoise", { ...nature, level: clamped });
      return;
    }

    setPref(
      "padLayers",
      layers.map((layer) =>
        layer.pack === channelId ? { ...layer, level: clamped } : layer
      )
    );
  };

  const toggleMute = (channelId: string) => {
    if (channelId === NATURE_CHANNEL.key) {
      setPref("natureNoise", { ...nature, muted: !nature.muted });
      return;
    }

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
