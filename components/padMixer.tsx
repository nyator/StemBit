import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";

import { MAX_PAD_LAYERS, NATURE_CHANNEL } from "../constants/pads";
import { COLORS } from "../constants/theme";
import {
  DEFAULT_NATURE_LEVEL,
  DEFAULT_PAD_LEVEL,
} from "../context/PreferencesContext";
import { usePadLayers, type MixerChannel } from "../hooks/usePadLayers";
import { MinusCircle } from "./icons";
import VerticalFader from "./ui/verticalFader";

// The loaded stack as a console: one channel strip per pad pack, plus the
// nature bed, laid out the way a hardware mixer is. Loading a pack from the
// catalog fills the next channel; empty channels stay on the panel so the
// capacity is visible rather than something you discover by hitting it.
//
// The percentage is the fader's own position, top of the throw being 100 on
// every channel regardless of what else is loaded. The engine still normalises
// the summed voices so they can't clip (see padBusScale), but that's the
// desk's internal business — a fader that stopped reading 100 because you
// loaded a second pack would just look broken.

function ChannelStrip({ channel }: { channel: MixerChannel }) {
  const { setLevel, removeLayer, toggleMute } = usePadLayers();

  const [draftLevel, setDraftLevel] = useState<number | null>(null);
  const isNature = channel.id === NATURE_CHANNEL.key;

  return (
    <View
      className="items-center px-1 pt-2 pb-2 rounded-lg"
      style={{
        flex: 1,
        minWidth: 64,
        backgroundColor: isNature ? "" : "rgba(0,0,0,0.25)",
      }}
    >
      {channel.removable && (
        <TouchableOpacity
          onPress={() => removeLayer(channel.id)}
          hitSlop={10}
          accessibilityLabel={`Unload ${channel.title} from the mixer`}
          style={{ position: "absolute", top: 4, right: 3, zIndex: 1 }}
        >
          <MinusCircle size={18} color="rgba(255,255,255,0.35)" />
        </TouchableOpacity>
      )}

      <Text
        className="text-white text-micro font-satoshiMedium"
        numberOfLines={1}
        style={{ paddingHorizontal: 16 }}
      >
        {channel.title}
      </Text>
      <Text
        className="text-nav font-spaceBold mb-2"
        style={{ color: channel.muted ? COLORS.danger : COLORS.textMuted }}
      >
        {channel.muted
          ? "MUTED"
          : `${Math.round((draftLevel ?? channel.level) * 100)}%`}
      </Text>

      <View style={channel.muted ? { opacity: 0.45 } : undefined}>
        <VerticalFader
          value={draftLevel ?? channel.level}
          onChange={setDraftLevel}
          onComplete={(level) => {
            setDraftLevel(null);
            setLevel(channel.id, level);
          }}
          defaultValue={isNature ? DEFAULT_NATURE_LEVEL : DEFAULT_PAD_LEVEL}
          accessibilityLabel={`${channel.title} level`}
        />
      </View>

      {/* Mute is the strip's frequent control, so it gets the whole width. */}
      <TouchableOpacity
        onPress={() => toggleMute(channel.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: channel.muted }}
        accessibilityLabel={`${channel.muted ? "Unmute" : "Mute"} ${channel.title
          }`}
        className="items-center justify-center w-full py-1.5 mt-3 rounded"
        style={{
          backgroundColor: channel.muted
            ? COLORS.danger
            : "rgba(255,255,255,0.1)",
        }}
      >
        <Text className="text-white text-nav font-spaceBold">MUTE</Text>
      </TouchableOpacity>
    </View>
  );
}

// An unfilled pad channel. Deliberately inert — loading happens in the catalog
// above, and a second way in would just be a shortcut to the same list.
function EmptyStrip() {
  return (
    <View
      className="items-center justify-center px-1 py-2 rounded-lg bg-black/10"
      style={{
        flex: 1,
        minWidth: 64,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <Text className="text-white/20 text-nav uppercase font-spaceBold">
        Empty
      </Text>
    </View>
  );
}

export default function PadMixer() {
  const { channels, loadedCount } = usePadLayers();
  const emptySlots = Math.max(0, MAX_PAD_LAYERS - loadedCount);

  return (
    <View className="p-2 mt-2 rounded-lg">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="uppercase text-overline tracking-widest text-ink-muted font-spaceBold">
          Mixer
        </Text>
        <Text className="text-ink-muted text-micro font-satoshiRegular">
          {loadedCount} of {MAX_PAD_LAYERS} pads
        </Text>
      </View>

      <View className="flex-row justify-center gap-2">
        {channels
          .filter((channel) => channel.id !== NATURE_CHANNEL.key)
          .map((channel) => (
            <ChannelStrip key={channel.id} channel={channel} />
          ))}
        {Array.from({ length: emptySlots }, (_, index) => (
          <EmptyStrip key={`empty-${index}`} />
        ))}
        {channels
          .filter((channel) => channel.id === NATURE_CHANNEL.key)
          .map((channel) => (
            <ChannelStrip key={channel.id} channel={channel} />
          ))}
      </View>
    </View>
  );
}
