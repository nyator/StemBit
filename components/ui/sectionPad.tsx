import { useEffect, useRef } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";

import { COLORS, SIZES } from "../../constants/theme";
import { repeatDescription, repeatLabel } from "../../constants/barGrid";

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

/**
 * Thinner than the setlist row's 6pt bar.
 *
 * Not drift: that bar spans a full-width row and this one spans a pad in a
 * grid, so the same thickness would read as a heavier line here. The colour is
 * shared (COLORS.progressTrack) precisely so the height can differ on purpose
 * without the two bars also quietly diverging in tone.
 */
const BAR_HEIGHT = 4;

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
  /** PERFORM's own row, one pad wide -- see the note by its call site. */
  fullWidth?: boolean;
  /**
   * How many times this section plays when hit. See CueSection.repeats.
   *
   * The badge only appears where there is somewhere to send the change. A
   * compact pad in a setlist row has no room for a second target and no
   * business editing the song, so it is left off there.
   */
  repeats?: number;
  /** Opens the picker. The badge shows the count; it no longer changes it. */
  onEditRepeats?: () => void;
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
  fullWidth = false,
  repeats,
  onEditRepeats,
}: SectionPadProps) {
  const hasSpan = endSeconds !== undefined && endSeconds > startSeconds;
  const showBadge = !compact && !!onEditRepeats;
  // Set apart from the ordinary once-through, which is what earns the colour.
  const badgeIsSet = repeats === 0 || (!!repeats && repeats > 1);

  // Clamped at both ends, so a playhead before this section reads as empty
  // rather than as negative width, and a looped section that overshoots by a
  // frame doesn't run the fill past the pad's edge.
  const fill = playheadSeconds.interpolate({
    inputRange: [startSeconds, hasSpan ? endSeconds! : startSeconds + 1],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  // Armed has no position to show a fill against -- the launch hasn't landed
  // yet, so there's no "how far in" to draw. A pulse across the whole pad says
  // the other thing that matters: this one is about to go, on the next bar.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isArmed) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 420,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [isArmed, pulse]);

  return (
    <View
      className="mb-2 overflow-hidden border-2 rounded-lg"
      style={{
        width: fullWidth ? "100%" : "48.5%",
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
              height: BAR_HEIGHT,
              backgroundColor: COLORS.progressTrack,
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

      {/* Armed but not yet live: a full-width pulse rather than a fill, since
          there is nothing to measure "how far in" against until the launch
          actually lands on the next bar. */}
      {isArmed && !isLive && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: COLORS.brandFrom,
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.12, 0.4],
            }),
          }}
        />
      )}

      {/* Launch and repeats sit side by side, sharing the pad's width.
          Neither overlaps the other: they are two flex children of one row, so
          which one a press lands on is decided by geometry rather than by
          which view happens to paint last. The repeat control was an absolutely
          positioned chip over this button's corner, which is exactly the
          arrangement where a press can go to the wrong one -- or to neither. */}
      <View className="flex-row flex-1">
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        // Everything the pad shows, said out loud in the same order.
        // "Launch Chorus" was all this used to announce, which dropped the two
        // things the pad exists to convey: where the section sits in the song,
        // and whether it is the one currently running.
        accessibilityLabel={[
          name,
          `section ${index + 1}`,
          `starts at ${clock(startSeconds)}`,
          repeats === 0
            ? "repeats until stopped"
            : repeats && repeats > 1
              ? `plays ${repeats} times`
              : null,
          isLive ? "playing now" : isArmed ? "armed" : null,
        ]
          .filter(Boolean)
          .join(", ")}
        // The single most surprising thing about this screen, and until now it
        // was written down nowhere a screen reader could reach: a section does
        // not start under your finger, it starts on the next bar.
        accessibilityHint="Starts on the next bar."
        accessibilityState={{ selected: isLive }}
        className={`justify-between flex-1 px-3 ${compact ? "py-1.5" : "py-2"}`}
      >
        <Text
          className={`text-white font-spaceBold ${compact ? "text-title" : "text-heading"}`}
          numberOfLines={1}
        >
          {name}
        </Text>

        {/* Its place in the song. Live and armed already read off the fill,
            the pulse and the border colour -- spelling either out here too
            would be saying the same thing twice.

            11, not the 10 this was: the design system calls 11 the floor for
            anything a musician reads while playing, and this line is read
            mid-song more than the name above it is. */}
        <Text
          className="text-micro font-spaceBold tracking-widest"
          style={{
            color: isLive
              ? COLORS.white
              : isArmed
                ? COLORS.brandFrom
                : COLORS.textMuted,
          }}
        >
          {`${index + 1}  ·  ${clock(startSeconds)}`}
        </Text>
      </TouchableOpacity>

      {/* Repeats: how many times this section plays before the song carries on.

          A full-height strip down the right edge, the way the track tiles put
          mute along their bottom -- a band of the pad that is unambiguously its
          own control. It was a 38x26 chip floating over the launch button's
          corner, which was too small to hit on stage and sat in the one place
          where a miss starts the song.

          It opens a picker rather than advancing the count. With nine values to
          choose from, cycling meant up to eight presses to reach one of them. */}
      {showBadge && (
        <TouchableOpacity
          onPress={onEditRepeats}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${name} repeats: ${repeatDescription(repeats).toLowerCase()}`}
          accessibilityHint="Opens the repeat picker for this section."
          className="items-center justify-center"
          style={{
            width: SIZES.minTouch,
            borderLeftWidth: 1,
            borderLeftColor: COLORS.border,
            backgroundColor: badgeIsSet
              ? COLORS.brand
              : "rgba(255,255,255,0.06)",
          }}
        >
          <Text
            className="text-label font-spaceBold"
            style={{ color: badgeIsSet ? COLORS.white : COLORS.textMuted }}
          >
            {repeatLabel(repeats)}
          </Text>
          <Text
            className="mt-0.5 text-nav font-spaceBold tracking-widest"
            style={{ color: badgeIsSet ? COLORS.white : COLORS.textMuted }}
          >
            REP
          </Text>
        </TouchableOpacity>
      )}
      </View>
    </View>
  );
}
