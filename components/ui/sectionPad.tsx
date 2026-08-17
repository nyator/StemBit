import { Animated, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../../constants/theme";

// One section of a song, as a pad you hit.
//
// The pad fills across as its section plays, which is the whole point of it
// being a pad rather than a row in a list. On stage the question is never "which
// section is this" -- you can hear that -- it is "how long have I got before it
// ends", asked while deciding whether there is time to say something before the
// chorus lands. A name can't answer that and a timecode makes you do arithmetic
// during a song. A bar that is three quarters across answers it at a glance.
//
// Same two layers as the setlist's live row (see LoopFillBar), for the same
// reason: the wash across the whole pad is readable from anywhere in the room,
// the solid bar along the bottom edge is the precise one for when you actually
// look down.

type SectionPadProps = {
  name: string;
  /** Its place in the song, shown when there's nothing more urgent to say. */
  index: number;
  startSeconds: number;
  /**
   * Where it ends -- the next section's start, or the song's own end.
   *
   * Undefined means neither is known, which happens for the last section of a
   * song whose length hasn't been measured. The pad still works; it just can't
   * fill, since there is no length to fill against.
   */
  endSeconds?: number;
  /** True while the playhead is inside this section. */
  isLive: boolean;
  /** Hit, but waiting for the bar its launch is quantised to. */
  isArmed: boolean;
  /** The transport's position in the song, for the fill. */
  playheadSeconds: Animated.Value;
  onPress: () => void;
  /** The shorter pad used inside a setlist row, where space is borrowed. */
  compact?: boolean;
};

/** mm:ss for the pad's idle line. */
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export default function SectionPad({
  name,
  index,
  startSeconds,
  endSeconds,
  isLive,
  isArmed,
  playheadSeconds,
  onPress,
  compact = false,
}: SectionPadProps) {
  const hasSpan = endSeconds !== undefined && endSeconds > startSeconds;

  // Clamped at both ends, so a playhead before this section reads as empty
  // rather than as negative width, and a looped section that overshoots by a
  // frame doesn't run the fill past the pad's edge.
  const fill = playheadSeconds.interpolate({
    inputRange: [startSeconds, hasSpan ? endSeconds! : startSeconds + 1],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  return (
    <View
      className="mb-2 overflow-hidden border-2 rounded-lg"
      style={{
        width: "48.5%",
        height: compact ? 52 : 66,
        backgroundColor: COLORS.surface,
        borderColor: isLive
          ? COLORS.brand
          : isArmed
            ? COLORS.brandFrom
            : COLORS.border,
      }}
    >
      {/* Only while live. A fill left behind on a pad that stopped playing
          would be claiming a position the transport no longer has. */}
      {isLive && hasSpan && (
        <>
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: fill,
              backgroundColor: COLORS.brand,
              // Under the label rather than over it: the pad has to stay
              // readable at every point in the sweep, including under the part
              // that has already filled.
              opacity: 0.45,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 4,
              backgroundColor: "rgba(255,255,255,0.10)",
            }}
          >
            <Animated.View
              style={{
                height: "100%",
                width: fill,
                backgroundColor: COLORS.brandFrom,
              }}
            />
          </View>
        </>
      )}

      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityLabel={`Launch ${name}`}
        accessibilityState={{ selected: isLive }}
        className={`justify-between flex-1 px-3 ${compact ? "py-[6px]" : "py-2"}`}
      >
        <Text
          className={`text-white font-satoshiBold ${compact ? "text-[13px]" : "text-[15px]"}`}
          numberOfLines={1}
        >
          {name}
        </Text>

        {/* Whichever of three things is true: it's running, it's been hit and is
            waiting for the bar, or -- most of the time -- where it starts. */}
        <Text
          className="text-[10px] font-spaceBold tracking-widest"
          style={{
            color: isLive
              ? COLORS.white
              : isArmed
                ? COLORS.brandFrom
                : COLORS.textMuted,
          }}
        >
          {isLive
            ? "PLAYING"
            : isArmed
              ? "ARMED"
              : `${index + 1}  ·  ${clock(startSeconds)}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
