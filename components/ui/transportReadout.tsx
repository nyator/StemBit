import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Line, Path, Rect } from "react-native-svg";

import { COLORS, TRACK_PALETTE } from "../../constants/theme";
import { BAR_STEPS, barAt, secondsPerBar } from "../../constants/barGrid";
import { useSessionPlayback } from "../../context/SessionPlaybackContext";
import type { CueSection } from "../../context/SessionsContext";
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
/** Tall enough to read an arrangement in, short enough to leave the clocks room. */
const WAVE_HEIGHT = 34;

/**
 * Bar width, and the gap between bars is what's left of the step.
 *
 * Deliberately fatter than the trimmer's hairlines. That is a placing tool held
 * at arm's length, where a thin bar per pixel is detail you want; this is read
 * across a stage, where the same drawing turns into a grey smear and only the
 * gross shape survives. Fat bars with air between them are what stays legible.
 */
const WAVE_STROKE = 2;
const WAVE_STEP = 5;

/** How far apart bar lines have to be before they stop reading as a grid. */
const MIN_TICK_PX = 26;

/**
 * The song as mirrored vertical bars, one "M x y1 L x y2" per bucket.
 *
 * One Path rather than an element per bar: a few hundred of those cost a frame
 * or two on every layout pass, and this sits above a screen that re-renders
 * whenever a fader moves.
 *
 * Peaks are resampled to whatever number of bars fit the measured width, taking
 * the loudest in each group -- the alternative, drawing every bucket the engine
 * sent, packs 1200 bars into a phone's width and averages the song into a
 * rectangle. The max is what keeps a snare reading as a snare.
 */
function buildWavePath(peaks: number[], width: number) {
  if (width <= 0 || peaks.length === 0) return "";

  const bars = Math.max(1, Math.floor(width / WAVE_STEP));
  const middle = WAVE_HEIGHT / 2;
  // Half the height, less the stroke's own width, so the loudest bar sits
  // inside the box rather than clipped flat by its edges.
  const reach = middle - WAVE_STROKE / 2;
  const perBar = peaks.length / bars;

  let path = "";
  for (let bar = 0; bar < bars; bar++) {
    const from = Math.floor(bar * perBar);
    const to = Math.max(from + 1, Math.floor((bar + 1) * perBar));
    let peak = 0;
    for (let i = from; i < to && i < peaks.length; i++) {
      if (peaks[i] > peak) peak = peaks[i];
    }
    const x = bar * WAVE_STEP + WAVE_STROKE / 2;
    // Floored at half a pixel so silence draws as a line on the centre rather
    // than a gap -- a hole in the bar reads as "no song here", not "quiet here".
    const half = Math.max(0.5, peak * reach);
    path += `M${x.toFixed(1)} ${(middle - half).toFixed(1)}L${x.toFixed(1)} ${(
      middle + half
    ).toFixed(1)}`;
  }
  return path;
}

/**
 * Bar lines under the waveform, thinned to whatever the width can hold.
 *
 * Same ladder the timeline's ruler climbs, for the same reason: a five-minute
 * song at 160bpm is two hundred bars, and a line for each across a phone is a
 * grey block. Widening the step until they are far enough apart turns the
 * ruling into phrase markers -- every 8 or 16 bars -- which is the more useful
 * read here anyway. You are not counting to 137 on stage; you are seeing that
 * the quiet stretch is four phrases wide.
 *
 * Returns the lines already in pixels, plus the step, so the caller can say
 * what it is ruling in without recomputing it.
 */
function buildBarTicks(bpm: number, duration: number, width: number) {
  const perBar = secondsPerBar(bpm);
  if (!(perBar > 0) || !(duration > 0) || !(width > 0)) return null;

  const bars = Math.ceil(duration / perBar);
  const pxPerBar = width / bars;
  if (!Number.isFinite(pxPerBar) || pxPerBar <= 0) return null;

  const step =
    BAR_STEPS.find((candidate) => candidate * pxPerBar >= MIN_TICK_PX) ??
    BAR_STEPS[BAR_STEPS.length - 1];

  const xs: number[] = [];
  // From the first ruled bar after the start: a line on bar 1 would sit on the
  // waveform's own left edge and read as a border rather than a marker.
  for (let bar = step; bar < bars; bar += step) {
    xs.push(bar * pxPerBar);
  }
  return { xs, step };
}

/**
 * The song's sections as tinted bands under the waveform, one colour per
 * section so the arrangement reads at a glance -- the same reason a section
 * gets its own pad in PERFORM rather than a name in a list.
 *
 * Coloured by index rather than anything about the section itself: there is
 * no meaning to "verse is teal", the point is only that the band before it
 * and the band after it are never the same colour.
 */
function buildSectionBands(
  sections: CueSection[],
  duration: number,
  width: number
) {
  if (width <= 0 || duration <= 0 || sections.length === 0) return [];
  return sections.map((section, index) => {
    const end = Math.min(section.endSeconds ?? duration, duration);
    const start = Math.min(section.startSeconds, end);
    return {
      id: section.id,
      x: (start / duration) * width,
      width: Math.max(0, ((end - start) / duration) * width),
      color: TRACK_PALETTE[index % TRACK_PALETTE.length],
    };
  });
}

type TransportReadoutProps = {
  /** The cue being performed. */
  title: string;
  /** Song length in seconds, measured off the stems. 0 until they're in. */
  duration: number;
  isPlaying: boolean;
  /** Where the audio has reached, for the progress bar. */
  playheadSeconds: Animated.Value;
  /**
   * The song's shape, 0–1, evenly spaced across `duration` — the stems
   * flattened to one envelope. Empty until they've been measured, which is a
   * second or two after a cue is opened; the bar is drawn plain until then.
   */
  peaks?: number[];
  /** The song's arrangement, drawn as coloured bands under the waveform. */
  sections?: CueSection[];
  /** The cue's tempo, for the bar ruling under the waveform and the bar count
   *  beside the title. */
  bpm?: number;
  /** Unset at the ends of the set, where there is nothing to step to. */
  prev?: NeighbourCue;
  next?: NeighbourCue;
};

export default function TransportReadout({
  title,
  duration,
  isPlaying,
  playheadSeconds,
  peaks,
  sections,
  bpm,
  prev,
  next,
}: TransportReadoutProps) {
  const session = useSessionPlayback();

  // Which bar the song is in, tracked off the transport's reports.
  //
  // Off the raw position rather than a once-a-second clock: a bar number
  // computed from second-resolution timing is wrong for up to half a bar --
  // exactly the half where you are deciding whether to come in.
  const [bar, setBar] = useState(1);
  const shownBarRef = useRef(-1);
  // Read inside a subscription that outlives any one render.
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  useEffect(
    () =>
      session.subscribePosition((next) => {
        if (next.seconds === null) return;

        const tempo = bpmRef.current;
        if (!tempo) return;
        const atBar = Math.floor(barAt(next.seconds, tempo)) + 1;
        if (atBar === shownBarRef.current) return;
        shownBarRef.current = atBar;
        setBar(atBar);
      }),
    [session]
  );

  // Stopped is bar 1, not wherever the song happened to be cut off. This is
  // the "what will happen when I press play" readout, and in the performance
  // view play starts from the top.
  useEffect(() => {
    if (isPlaying) return;
    shownBarRef.current = -1;
    setBar(1);
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

  // The waveform is drawn at a pixel width, not a percentage, so it has to be
  // measured. Both copies use the same number, which is what keeps the lit bars
  // sitting exactly on the unlit ones.
  const [waveWidth, setWaveWidth] = useState(0);
  const handleWaveLayout = (event: LayoutChangeEvent) => {
    setWaveWidth(event.nativeEvent.layout.width);
  };

  const hasWave = waveWidth > 0 && !!peaks && peaks.length > 0;

  // Built once per shape rather than per frame -- see the note at the bar.
  const wavePath = useMemo(
    () => (hasWave ? buildWavePath(peaks!, waveWidth) : ""),
    [hasWave, peaks, waveWidth]
  );

  // Where the bars fall, so the shape can be counted rather than just looked at.
  const barTicks = useMemo(
    () =>
      hasWave && bpm && duration > 0
        ? buildBarTicks(bpm, duration, waveWidth)
        : null,
    [hasWave, bpm, duration, waveWidth]
  );

  // The arrangement, as bands under the shape. Built off the measured width
  // like the ticks above, so a band's edge lines up with the bar it starts on.
  const sectionBands = useMemo(
    () =>
      hasWave && sections && sections.length > 0 && duration > 0
        ? buildSectionBands(sections, duration, waveWidth)
        : [],
    [hasWave, sections, duration, waveWidth]
  );

  return (
    <View>
      <View className="flex-row items-center mb-1">
        <Text className="text-micro text-ink-muted font-spaceBold tracking-widest">
          NOW PLAYING
        </Text>
        {isPlaying && (
          <View
            className="ml-2 rounded-full"
            style={{ width: 6, height: 6, backgroundColor: COLORS.brand }}
          />
        )}

        {/* The bar count, opposite the label.

            Up here rather than in the row of clocks below, because it is not
            the same kind of number. ELAPSED and REMAINING are about the song as
            a length; this is where you are in the arrangement, which is what
            you say out loud to a band ("from the top of 17") and the only one
            of the three that the waveform underneath is ruled for. */}
        {!!bpm && (
          <Text
            className="flex-1 text-right text-micro text-ink-muted font-spaceBold tracking-widest"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            BAR {bar}
            {barTicks ? `  ·  RULED /${barTicks.step}` : ""}
          </Text>
        )}
      </View>

      <Text className="text-heading text-white font-satoshiBold" numberOfLines={1}>
        {title}
      </Text>

      {/* The song as its own shape, filling as it plays.

          A flat bar answers "how far through are we" and nothing else. The
          waveform answers it just as well -- the lit part is still the part
          that has gone -- and carries the arrangement with it for free: the
          quiet bar before the last chorus is a visible notch, so where you are
          in the song is something you recognise rather than something you
          measure. That is the read you actually want from six feet away.

          Drawn twice rather than recoloured per frame: the played copy sits
          over the unplayed one inside a clip whose width is the same Animated
          value the bar used, so the fill costs one interpolation and the paths
          are built only when the peaks or the width change. Nothing here
          re-renders at the transport's sixteen-a-second. */}
      <View className="mt-3" onLayout={handleWaveLayout}>
        {hasWave ? (
          <>
            <Svg width={waveWidth} height={WAVE_HEIGHT}>
              {/* The arrangement, tinted behind everything else -- it is a
                  backdrop to place the shape against, not a thing to read on
                  its own, so it sits under both the ruling and the bars. */}
              {sectionBands.map((band) => (
                <Rect
                  key={band.id}
                  x={band.x}
                  y={0}
                  width={band.width}
                  height={WAVE_HEIGHT}
                  fill={band.color}
                  opacity={0.16}
                />
              ))}
              {/* Ruling first, so it sits behind the shape rather than across
                  it -- it is there to be counted against, not to be read. */}
              {barTicks?.xs.map((x) => (
                <Line
                  key={x}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={WAVE_HEIGHT}
                  stroke={COLORS.border}
                  strokeWidth={1}
                />
              ))}
              <Path d={wavePath} stroke={COLORS.track} strokeWidth={WAVE_STROKE} />
            </Svg>
            <Animated.View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: progress,
                height: WAVE_HEIGHT,
                overflow: "hidden",
              }}
            >
              {/* Full width inside the clip, so the bars line up with the ones
                  underneath instead of being squeezed into the lit region. */}
              <Svg width={waveWidth} height={WAVE_HEIGHT}>
                <Path d={wavePath} stroke={COLORS.brand} strokeWidth={WAVE_STROKE} />
              </Svg>
            </Animated.View>
          </>
        ) : (
          // Until the stems are measured. Same question, same colours, just
          // without the shape -- a cue that has only just been opened still has
          // to be able to say how far through it is.
          <View
            className="overflow-hidden rounded-full"
            style={{ height: 3, backgroundColor: COLORS.track }}
          >
            <Animated.View
              style={{ width: progress, height: "100%", backgroundColor: COLORS.brand }}
            />
          </View>
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
