import { Animated, Text, TouchableOpacity, View } from "react-native";

import { COLORS, SIZES, TRACK_PALETTE } from "../../constants/theme";

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
//
// TWO CONTROLS, BOTH NAMED. The body solos, the strip along the bottom mutes.
// That split used to be invisible: the body carried no verb at all, so the only
// way to discover that tapping a tile solos it was to tap one mid-song and hear
// everything else drop out. It now says SOLO on it. The strip already said
// MUTE, and still does.
//
// Both of them also used to lie to a screen reader -- the body announced itself
// as "Mute <track>" while calling solo, and the strip announced "Solo <track>"
// while calling mute, so the two labels were exactly inverted against what the
// buttons did. Whatever a control says out loud has to be what it does.

/**
 * Channel colours, in the order stems get them. Defined in constants/theme.ts
 * with the rest of the palette; re-exported here because this is where callers
 * already look for it.
 */
export const TRACK_COLORS = TRACK_PALETTE;

/** The colour for the nth stem, wrapping for songs with more stems than hues. */
export const trackColor = (index: number) =>
  TRACK_COLORS[index % TRACK_COLORS.length];

// The mute strip used to be about 28pt tall. See SIZES.minTouch for why that
// matters more on this screen than anywhere else in the app.
const MIN_TOUCH = SIZES.minTouch;

const BODY_HEIGHT = 76;
export const TILE_HEIGHT = BODY_HEIGHT + MIN_TOUCH;

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
  const status = isSolo ? "SOLO" : isSilent ? "MUTED" : "ON";

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
      }}
    >
      <TouchableOpacity
        onPress={onToggleSolo}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={isSolo ? `Clear solo on ${name}` : `Solo ${name}`}
        accessibilityHint={
          isSolo
            ? "Returns every other track to the mix."
            : "Silences every other track until you clear it."
        }
        accessibilityState={{ selected: isSolo }}
        className="justify-between px-3 pt-2.5 pb-2"
        style={{ height: BODY_HEIGHT }}
      >
        <View className="flex-row items-center justify-between">
          <Text
            // 14, not the 12 this was. A stem's name is the tile's whole
            // identity and the thing you scan a grid of these for.
            className="flex-1 mr-1 text-label font-satoshiBold"
            style={{ color: isSilent ? COLORS.textSoft : COLORS.white }}
            numberOfLines={1}
          >
            {name}
          </Text>

          {/* The tile's own verb, which it never had.
              Solo is the destructive one here -- it silences everything else --
              so it is the one that has to be legible before it is pressed, not
              inferred afterwards. */}
          <Text
            className="text-micro font-spaceBold tracking-widest"
            style={{ color: isSolo ? COLORS.warning : COLORS.textMuted }}
          >
            SOLO
          </Text>
        </View>

        <View>
          <Text
            // 11 rather than 10: the design system calls 11 the floor for
            // anything read while playing, and this is the line that says
            // whether the track is coming out at all.
            className="mb-1.5 text-micro font-spaceBold tracking-widest"
            style={{ color: isSilent ? COLORS.textMuted : accent }}
          >
            {status}
          </Text>

          {/* Along the bottom of the tile, the width of it -- a level is easier
              to read as a line that grows towards an edge than as a bar
              floating in the middle of a card. */}
          <View
            className="overflow-hidden rounded-full"
            style={{ height: 6, backgroundColor: COLORS.track }}
          >
            <Animated.View
              style={{ width, height: "100%", backgroundColor: accent }}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* Mute along the bottom edge, always present.
          It used to be hidden whenever the track was soloed, which left the one
          track you could still hear with no way to silence it -- and took the
          control away at exactly the moment the tile was the loudest thing in
          the room. */}
      <TouchableOpacity
        onPress={onToggleMute}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={isSilent ? `Unmute ${name}` : `Mute ${name}`}
        accessibilityState={{ selected: isSilent }}
        className="items-center justify-center"
        style={{
          height: MIN_TOUCH,
          backgroundColor: isSilent
            ? "rgba(255,255,255,0.13)"
            : "rgba(255,255,255,0.07)",
        }}
      >
        <Text
          className="text-micro font-spaceBold tracking-widest"
          style={{ color: isSilent ? COLORS.white : COLORS.textMuted }}
        >
          {isSilent ? "UNMUTE" : "MUTE"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
