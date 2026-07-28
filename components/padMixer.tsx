import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";

import { MAX_PAD_LAYERS, NATURE_CHANNEL } from "../constants/pads";
import { COLORS } from "../constants/theme";
import { usePadLayers, type MixerChannel } from "../hooks/usePadLayers";
import { MinusCircle } from "./icons";
import VerticalFader from "./ui/verticalFader";

// The loaded stack as a console: one channel strip per pad pack, plus the
// nature bed, laid out the way a hardware mixer is. Loading a pack from the
// catalog fills the next channel; empty channels stay on the panel so the
// capacity is visible rather than something you discover by hitting it.
//
// The percentage under each fader is that channel's share of the output, not
// its fader position. They differ because the mix is normalised to keep the
// summed voices from clipping (see padBusScale) — pushing one fader up leaves
// the others less room, and muting one hands its share back to the rest.

function ChannelStrip({ channel }: { channel: MixerChannel }) {
  const { setLevel, removeLayer, toggleMute } = usePadLayers();
  // Fader position mid-drag, before it's committed to preferences. Writing on
  // every move would mean a file write per frame.
  const [draftLevel, setDraftLevel] = useState<number | null>(null);
  const isNature = channel.id === NATURE_CHANNEL.key;

  return (
    <View
      className="items-center px-1 pt-2 pb-2 rounded-lg"
      style={{
        flex: 1,
        minWidth: 64,
        // The nature bed is set apart from the pad channels: it plays over all
        // of them rather than being one of them.
        backgroundColor: isNature ? "rgba(0,65,91,0.35)" : "rgba(0,0,0,0.25)",
      }}
    >
      {/* Unload sits in the top corner, the full height of the fader away from
          Mute at the base. The two were side by side and a strip is too narrow
          to tell them apart by feel — one is used constantly, the other undoes
          your setup. */}
      {channel.removable && (
        <TouchableOpacity
          onPress={() => removeLayer(channel.id)}
          hitSlop={10}
          accessibilityLabel={`Unload ${channel.title} from the mixer`}
          style={{ position: "absolute", top: 4, right: 4, zIndex: 1 }}
        >
          <MinusCircle size={16} color="rgba(255,255,255,0.35)" />
        </TouchableOpacity>
      )}

      <Text
        className="text-white text-[11px] font-satoshiMedium"
        numberOfLines={1}
        style={{ paddingHorizontal: 14 }}
      >
        {channel.title}
      </Text>
      <Text
        className="text-[10px] font-spaceBold mb-2"
        style={{ color: channel.muted ? COLORS.danger : COLORS.textMuted }}
      >
        {channel.muted ? "MUTED" : `${Math.round(channel.share * 100)}%`}
      </Text>

      <View style={channel.muted ? { opacity: 0.45 } : undefined}>
        <VerticalFader
          value={draftLevel ?? channel.level}
          onChange={setDraftLevel}
          onComplete={(level) => {
            setDraftLevel(null);
            setLevel(channel.id, level);
          }}
          accessibilityLabel={`${channel.title} level`}
        />
      </View>

      {/* Mute is the strip's frequent control, so it gets the whole width. */}
      <TouchableOpacity
        onPress={() => toggleMute(channel.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: channel.muted }}
        accessibilityLabel={`${channel.muted ? "Unmute" : "Mute"} ${
          channel.title
        }`}
        className="items-center justify-center w-full py-[6px] mt-3 rounded"
        style={{
          backgroundColor: channel.muted
            ? COLORS.danger
            : "rgba(255,255,255,0.1)",
        }}
      >
        <Text className="text-white text-[10px] font-spaceBold">MUTE</Text>
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
      <Text className="text-white/20 text-[10px] uppercase font-spaceBold">
        Empty
      </Text>
    </View>
  );
}

export default function PadMixer() {
  const { channels, loadedCount } = usePadLayers();
  const emptySlots = Math.max(0, MAX_PAD_LAYERS - loadedCount);

  return (
    <View className="p-3 mt-2 mb-3 bg-hairline-dial rounded-lg">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="uppercase text-overline tracking-widest text-ink-muted font-spaceBold">
          Mixer
        </Text>
        <Text className="text-ink-muted text-[11px] font-satoshiRegular">
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
