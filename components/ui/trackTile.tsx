import { Animated, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../../constants/theme";

// One stem, as something to hit.
//
// The console layout every stage rig draws -- a coloured channel, a meter, a
// mute under it -- collapsed into a single tile, because a phone held at arm's
// length has room for tiles or for faders, not both. What survives the collapse
// is what the colour and the meter are for: telling four stems apart without
// reading them, and seeing that a track is actually sounding.
//
// The meter matters more here than it does on a console. On stage the question
// is rarely "how loud is the bass" -- it is "is anything coming out of the bass
// at all", asked in the half second after something sounds wrong. A moving bar
// answers that; a name and a border don't.

/**
 * Channel colours, in the order stems get them.
 *
 * Hue is doing real work: it is how you find the drums on a screen you are not
 * looking at directly. So these are spread across the wheel and kept clear of
 * the brand blue, which the transport and the section pads already own.
 */
export const TRACK_COLORS = [
  "#38BDF8", // cyan
  "#22C55E", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#A855F7", // violet
  "#14B8A6", // teal
  "#EC4899", // pink
  "#84CC16", // lime
] as const;

/** The colour for the nth stem, wrapping for songs with more stems than hues. */
export const trackColor = (index: number) =>
  TRACK_COLORS[index % TRACK_COLORS.length];

export const TILE_HEIGHT = 108;

type TrackTileProps = {
  name: string;
  color: string;
  /** Post-fader RMS, 0–1, as an Animated.Value straight off the engine. */
  meter: Animated.Value;
  /** True when nothing is coming out of this track, whatever the reason. */
  isSilent: boolean;
  isSolo: boolean;
  onToggleMute: () => void;
  onToggleSolo: () => void;
};

export default function TrackTile({
  name,
  color,
  meter,
  isSilent,
  isSolo,
  onToggleMute,
  onToggleSolo,
}: TrackTileProps) {
  // Meters are read in RMS, which is a small number for anything but a
  // sustained tone -- a drum stem peaking at 0dB reads about 0.2. Curved rather
  // than shown raw so the bar uses its whole width instead of twitching along
  // the first fifth of it.
  const width = meter.interpolate({
    inputRange: [0, 0.05, 0.25, 0.6, 1],
    outputRange: ["0%", "18%", "55%", "100%", "100%"],
    extrapolate: "clamp",
  });

  const accent = isSolo ? COLORS.warning : color;

  return (
    <View
      className="mb-3 overflow-hidden rounded-lg"
      style={{
        width: "48.5%",
        height: TILE_HEIGHT,
        borderWidth: 2,
        // The whole tile carries the state. A small control inside it would be
        // unreadable at the distance this gets used from.
        borderColor: isSilent ? COLORS.borderIdle : accent,
        backgroundColor: isSilent ? "transparent" : `${accent}1F`,
        opacity: isSilent ? 0.5 : 1,
      }}
    >
      <TouchableOpacity
        onPress={onToggleMute}
        activeOpacity={0.85}
        accessibilityLabel={`${isSilent ? "Unmute" : "Mute"} ${name}`}
        className="justify-between flex-1 px-3 pt-3 pb-2"
      >
        <Text
          className="text-[15px] text-white font-satoshiBold"
          numberOfLines={2}
        >
          {name}
        </Text>

        <View>
          <Text
            className="mb-[6px] text-[10px] font-spaceBold tracking-widest"
            style={{ color: isSilent ? COLORS.textMuted : accent }}
          >
            {isSolo ? "SOLO" : isSilent ? "MUTED" : "ON"}
          </Text>

          {/* Along the bottom of the tile, the width of it -- a level is easier
              to read as a line that grows towards an edge than as a bar
              floating in the middle of a card. */}
          <View
            className="overflow-hidden rounded-full"
            style={{ height: 4, backgroundColor: COLORS.track }}
          >
            <Animated.View
              style={{ width, height: "100%", backgroundColor: accent }}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* Solo along the bottom edge rather than as a second tile: it is the
          rarer action, and the tile's main body should stay the mute, which is
          the one hit in a hurry. */}
      <TouchableOpacity
        onPress={onToggleSolo}
        accessibilityLabel={`${isSolo ? "Clear solo" : "Solo"} ${name}`}
        className="items-center py-[5px]"
        style={{
          backgroundColor: isSolo ? COLORS.warning : "rgba(255,255,255,0.07)",
        }}
      >
        <Text
          className="text-[10px] font-spaceBold tracking-widest"
          style={{ color: isSolo ? COLORS.black : COLORS.textMuted }}
        >
          SOLO
        </Text>
      </TouchableOpacity>
    </View>
  );
}
