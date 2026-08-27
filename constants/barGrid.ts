// The song measured in bars rather than seconds, and the snapping that follows
// from it.
//
// Seconds are what the engine deals in -- a buffer offset is a number of
// samples and nothing else -- but they are not what anybody arranging a song
// thinks in. A chorus is eight bars, it starts on a downbeat, and "0:47.3" is
// only ever a symptom of where that downbeat happened to land. So the ruler,
// the section readouts and the transport bar all count bars, and the times
// underneath stay exact.
//
// Shared rather than lived in the timeline, because the timeline is no longer
// the only surface that counts bars: PERFORM's transport bar rules itself off
// the same grid, and two implementations of "which bar is this" that disagree
// by one would be worse than either.
//
// 4/4 throughout. The timeline has always assumed it (its ruler was built on a
// hardcoded four) and nothing in a cue records a meter, so this is that
// assumption written down in one place rather than a new limitation. A cue that
// carries its own signature one day changes this file and nothing else.

/** Steps a bar grid is allowed to thin out to, coarsest last. */
export const BAR_STEPS = [1, 2, 4, 8, 16, 32, 64, 128];

export const BEATS_PER_BAR = 4;

const DEFAULT_BPM = 120;

/**
 * How close a dragged edge has to come before the grid takes it.
 *
 * Magnetic rather than absolute, which is the whole reason this is in pixels
 * and not in beats. Hard quantising would mean the positions between two grid
 * lines simply cannot be expressed -- and a song that changes on the "and" of
 * four, or a live recording that drifts, would become untrimmable. Within a
 * thumb's width of a line you get the line; further out you get exactly where
 * you put it.
 */
const SNAP_PX = 12;

/**
 * The tightest a grid division may be drawn or snapped to before it stops being
 * something you can aim at.
 *
 * Below this the lines are closer together than the finger dragging between
 * them, so "snap to the nearest" stops meaning anything -- every position is
 * within range of one, and the snap just adds jitter. Widening the step instead
 * keeps the target real, which at low zoom means snapping to phrase boundaries
 * (8 bars, 16) rather than to bars nobody can distinguish.
 */
const MIN_STEP_PX = 18;

/** Seconds in one bar at this tempo. */
export const secondsPerBar = (bpm: number) =>
  (60 / (bpm > 0 ? bpm : DEFAULT_BPM)) * BEATS_PER_BAR;

/** Seconds in one beat at this tempo. */
export const secondsPerBeat = (bpm: number) =>
  60 / (bpm > 0 ? bpm : DEFAULT_BPM);

/**
 * Which bar a moment falls in, zero-based and fractional.
 *
 * Fractional because callers want different things from it: a readout rounds it
 * to name a bar, a tick generator walks it in whole steps, and a "how far into
 * this bar" needs the remainder. Rounding here would take that choice away.
 */
export const barAt = (seconds: number, bpm: number) =>
  seconds / secondsPerBar(bpm);

/** A bar number as a musician says it: one-based, rounded to the nearest. */
export const barLabel = (seconds: number, bpm: number) =>
  Math.round(barAt(seconds, bpm)) + 1;

/**
 * The finest division worth showing at this scale, in seconds.
 *
 * Walks beat, bar, two bars, four, and so on until one of them is far enough
 * apart on screen to aim at. That single ladder is what makes zoom feel like it
 * is doing something musical: zoomed out you are placing phrases, zoomed in you
 * are placing beats, and nothing in between ever draws a grid too fine to use.
 */
export function gridStepSeconds(bpm: number, pxPerSecond: number) {
  const beat = secondsPerBeat(bpm);
  const bar = secondsPerBar(bpm);
  const ladder = [beat, ...BAR_STEPS.map((step) => bar * step)];
  return (
    ladder.find((step) => step * pxPerSecond >= MIN_STEP_PX) ??
    ladder[ladder.length - 1]
  );
}

/**
 * A dragged position, pulled onto the grid if it came close enough.
 *
 * `pxPerSecond` is how the drag is actually being seen -- content width over
 * duration, so it already carries the zoom. Passing it rather than a zoom level
 * is what lets the same call serve the timeline's nine-thousand-pixel content
 * and the transport bar's three hundred.
 */
export function snapSeconds(
  seconds: number,
  bpm: number,
  pxPerSecond: number
): number {
  if (!(pxPerSecond > 0) || !(bpm > 0) || !Number.isFinite(seconds)) {
    return seconds;
  }
  const step = gridStepSeconds(bpm, pxPerSecond);
  if (!(step > 0)) return seconds;

  const nearest = Math.round(seconds / step) * step;
  if (Math.abs(nearest - seconds) * pxPerSecond > SNAP_PX) return seconds;
  // Bar 1 is the floor. Defensive rather than load-bearing -- the timeline
  // clamps its drags to the song before they get here, so a negative should
  // never arrive -- but the cost of being wrong is a negative buffer offset,
  // which the engine reads as "play from the end" rather than as an error.
  return Math.max(0, nearest);
}

/**
 * How long a span is in bars, for a readout.
 *
 * Rounded to a sensible number of places rather than to a whole bar: after
 * snapping, spans land on whole bars and read as "8 bars", but a span that was
 * placed deliberately off the grid has to be able to say so rather than
 * claiming a tidiness it doesn't have.
 */
export function barSpan(
  startSeconds: number,
  endSeconds: number,
  bpm: number
): number {
  const bars = (endSeconds - startSeconds) / secondsPerBar(bpm);
  if (!Number.isFinite(bars) || bars <= 0) return 0;
  const whole = Math.round(bars);
  return Math.abs(bars - whole) < 0.02 ? whole : Math.round(bars * 10) / 10;
}
