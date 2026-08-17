import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";

import { COLORS } from "../../constants/theme";
import { useSessionPlayback } from "../../context/SessionPlaybackContext";
import SetlistNav, { type NeighbourCue } from "./setlistNav";

// What's playing, how far in, how much is left, and what's either side of it.
//
// Lifted from the show-page layout every stage rig converges on -- MainStage,
// the Studio One show page, Ableton's session view header. They all put the same
// four things at the top, and they do it because that is the set of questions
// someone standing in front of a band actually asks: am I on the right song, do
// I have time to talk, when does this end, and what am I reaching for next.
//
// The numbers are the point, so they are set in the numeral font at a size that
// survives being read from behind a keyboard, with the labels shrunk to almost
// nothing above them. The reverse of ordinary UI, where the label is the thing
// you read -- here you already know what "remaining" means and you are looking
// for a number from six feet away.
//
// The last of those questions is also a control, which is why the running order
// runs both ways down here. Forwards is the obvious one -- a set is played in
// order and the next song is the one you reach for. Backwards is the one that
// actually gets used: the band wants that last song again, or you opened the
// wrong one, and without it the only way a step back exists is through the
// setlist sheet, which is a gesture and a read at the moment you have least of
// both. Those two buttons are SetlistNav, shared with the loop cue's readout --
// a set is stepped through the same way whatever a cue happens to hold.

/**
 * Seconds as mm:ss, zero-padded.
 *
 * Padded so the string keeps its width: an unpadded minute makes the whole row
 * jump sideways once a song passes 10:00, and a number that moves is a number
 * you have to re-find.
 */
const clock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  return `${String(minutes).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
};

type TransportReadoutProps = {
  /** The cue being performed. */
  title: string;
  /** Song length in seconds, measured off the stems. 0 until they're in. */
  duration: number;
  isPlaying: boolean;
  /** Where the audio has reached, for the progress bar. */
  playheadSeconds: Animated.Value;
  /** Place in the running order, 1-based, and how long the set is. */
  position?: { index: number; total: number };
  /** Unset at the ends of the set, where there is nothing to step to. */
  prev?: NeighbourCue;
  next?: NeighbourCue;
};

export default function TransportReadout({
  title,
  duration,
  isPlaying,
  playheadSeconds,
  position,
  prev,
  next,
}: TransportReadoutProps) {
  const session = useSessionPlayback();

  // The one number on this screen that has to go through React.
  //
  // The transport reports sixteen times a second and everything else here is
  // driven from an Animated.Value to keep that traffic off the render path, but
  // a formatted time can't be interpolated -- it has to be a string, which means
  // state. So it is kept to a leaf component that re-renders on its own, and
  // only when the displayed value actually changes: whole seconds, which is once
  // a second rather than sixteen times.
  const [elapsed, setElapsed] = useState(0);
  const shownRef = useRef(-1);

  useEffect(
    () =>
      session.subscribePosition((next) => {
        if (next.seconds === null) return;
        const whole = Math.floor(next.seconds);
        if (whole === shownRef.current) return;
        shownRef.current = whole;
        setElapsed(whole);
      }),
    [session]
  );

  // Stopped is 00:00, not wherever the song happened to be cut off. This is the
  // "what will happen when I press play" readout, and in the performance view
  // play starts from the top.
  useEffect(() => {
    if (isPlaying) return;
    shownRef.current = -1;
    setElapsed(0);
  }, [isPlaying]);

  const progress = useMemo(
    () =>
      playheadSeconds.interpolate({
        inputRange: [0, Math.max(duration, 0.001)],
        outputRange: ["0%", "100%"],
        extrapolate: "clamp",
      }),
    [playheadSeconds, duration]
  );

  return (
    <View>
      <View className="flex-row items-center mb-1">
        <Text className="text-[9px] text-ink-muted font-spaceBold tracking-widest">
          NOW PLAYING
        </Text>
        {isPlaying && (
          <View
            className="ml-2 rounded-full"
            style={{ width: 6, height: 6, backgroundColor: COLORS.brand }}
          />
        )}
      </View>

      <Text className="text-2xl text-white font-satoshiBold" numberOfLines={1}>
        {title}
      </Text>

      {/* The song as one bar. Not a waveform -- that is a studio tool for
          placing things, and this is here to answer "how far through are we"
          from across a stage, which is the one thing a bar does better. */}
      <View
        className="mt-3 overflow-hidden rounded-full"
        style={{ height: 3, backgroundColor: COLORS.track }}
      >
        <Animated.View
          style={{ width: progress, height: "100%", backgroundColor: COLORS.brand }}
        />
      </View>

      <View className="flex-row items-start mt-3">
        <Cell label="ELAPSED" value={clock(elapsed)} />
        <Cell
          label="REMAINING"
          // Dashes rather than 00:00 until the stems have been measured: a zero
          // reads as "the song is over", which is the opposite of the truth.
          value={duration > 0 ? `-${clock(duration - elapsed)}` : "--:--"}
          muted
        />

        {/* How far through the night you are, which is the question the two
            clocks beside it can't answer -- they are both about this one song,
            and "two to go" is the one that decides whether you talk. */}
        {position && (
          <Cell
            label="IN SET"
            value={`${position.index} / ${position.total}`}
            muted
            align="end"
          />
        )}
      </View>

      {/* Both dead with the transport up, which is the safe reading and the
          useful one at once: the moment you want either is the few seconds
          after a song ends, and loading a cue's stems takes long enough that
          starting it there rather than walking back to the setlist is most of
          the gap between songs. */}
      <SetlistNav prev={prev} next={next} />
    </View>
  );
}

function Cell({
  label,
  value,
  muted,
  align,
}: {
  label: string;
  value: string;
  muted?: boolean;
  /** Pushed to the right edge, for the last cell in the row. */
  align?: "end";
}) {
  return (
    <View className={align === "end" ? "items-end flex-1" : "mr-4"}>
      <Text className="text-[9px] text-ink-muted font-spaceBold tracking-widest">
        {label}
      </Text>
      <Text
        className="mt-1 text-xl font-spaceBold"
        style={{
          color: muted ? COLORS.textMuted : COLORS.white,
          // Digits of equal width, so a counter doesn't shuffle its own
          // neighbours sideways every time it ticks.
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </View>
  );
}
