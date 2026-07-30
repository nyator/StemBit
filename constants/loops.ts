import audio from "./audio";

// Categories are a fixed, curated list — add new ones here and they appear
// automatically as filter chips in the loop browser.
export const LOOP_CATEGORIES = ["Worship", "Praise", "Funk", "Afro", "Drill", "Highlife"] as const;
export type LoopCategory = (typeof LOOP_CATEGORIES)[number];

/**
 * Where a loop's audio comes from: a bundled asset module id (the require()s in
 * constants/audio.js) or a `file://` URI for a loop the user imported from
 * their device. utils/loadAssetBase64 reads either.
 */
export type LoopSource = number | string;

export type Loop = {
  key: string;
  title: string;
  artist: string;
  category: LoopCategory;
  bpm: number;
  timeSignature: string;
  source: LoopSource;
  /**
   * The loop region, in seconds into the file. Only imported loops carry these:
   * the user trims them by hand (app/(loops)/import.tsx), because an arbitrary
   * file has no reason to start and end on the beat. Bundled loops leave them
   * off and let the engine find the region itself -- silence trim plus a snap
   * to whole beats (see constants/loopEngine.ts).
   */
  trimStart?: number;
  trimEnd?: number;
  /** Imported by the user rather than shipped with the app. */
  userAdded?: boolean;
};

/**
 * The artist every imported loop is filed under, so the browser's Artists mode
 * gets a "Yours" chip for free rather than needing a browse mode of its own.
 */
export const USER_LOOP_ARTIST = "Yours";

// The single source of truth for the loop catalog. Artists are derived from
// this list (see getArtists), so adding a loop with a new artist name
// automatically creates that artist in the browser.
export const LOOPS: Loop[] = [
  {
    key: "sample_bpm80",
    title: "Worship Move",
    artist: "Stembit",
    category: "Worship",
    bpm: 80,
    timeSignature: "4 / 4",
    source: audio.sampleLoop,
  },
  {
    key: "pst_nath",
    title: "Pst Nath",
    artist: "Stembit",
    category: "Highlife",
    bpm: 87,
    timeSignature: "4 / 4",
    source: audio.pstNath,
  },
  {
    key: "worship_war",
    title: "Worship War",
    artist: "Stembit",
    category: "Worship",
    bpm: 98,
    timeSignature: "4 / 4",
    source: audio.worshipWar,
  },
  {
    key: "afro_pop",
    title: "Afro Pop",
    artist: "Stembit",
    category: "Afro",
    bpm: 96,
    timeSignature: "4 / 4",
    source: audio.afroPop,
  },
  {
    key: "drillogy",
    title: "Drillogy",
    artist: "Stembit",
    category: "Drill",
    bpm: 132,
    timeSignature: "4 / 4",
    source: audio.drillogy,
  },
  {
    key: "worship_155",
    title: "Worship",
    artist: "Stembit",
    category: "Worship",
    bpm: 155,
    timeSignature: "3 / 4",
    source: audio.worship155,
  },
  {
    key: "afro_dance",
    title: "Afro Dance",
    artist: "Stembit",
    category: "Afro",
    bpm: 97,
    timeSignature: "4 / 4",
    source: audio.afroDance,
  },
];

// Loops the user imported. context/UserLoopsContext.tsx owns reading and
// writing them; this is the copy the lookups below see.
//
// Module state rather than something pulled out of the context, because these
// lookups are called from places that aren't React: WebView message handlers,
// engine callbacks, timers. A list captured at render time is exactly the stale
// closure that would have the engine reaching for a loop that has since been
// deleted, or missing one just imported. UserLoopsProvider is the only writer,
// and it writes on every change (never in an effect, so the value is in place
// before anything downstream re-renders).
let userLoops: Loop[] = [];

export const setUserLoopRegistry = (loops: Loop[]) => {
  userLoops = loops;
};

/**
 * The bundled catalog plus the user's imports. Imports come first: they're the
 * few loops among many that the user put there on purpose, so they belong at
 * the top of the browser rather than at the bottom of the shipped list.
 */
export const getAllLoops = (): Loop[] => [...userLoops, ...LOOPS];

export const findLoopByKey = (key: string | undefined) =>
  getAllLoops().find((loop) => loop.key === key);

// Beats per bar = the time signature's numerator ("4 / 4" -> 4, "3 / 4" -> 3).
// Drives where the loop click's accent falls: on every bar downbeat, so the
// accent pattern is independent of how many bars long the loop is. Falls back
// to 4 for a malformed signature.
export const getBeatsPerBar = (loop: Loop) => beatsPerBarOf(loop.timeSignature);

// The filters below default to the full catalog (bundled + imported) so a
// screen that just wants "everything" doesn't have to assemble it. The list is
// still a parameter: the browser passes the same array it rendered its counts
// from, which is what keeps a chip's count and its contents from disagreeing.
export const getLoopsByCategory = (
  category: LoopCategory,
  loops: Loop[] = getAllLoops()
) => loops.filter((loop) => loop.category === category);

export const getLoopsByArtist = (artist: string, loops: Loop[] = getAllLoops()) =>
  loops.filter((loop) => loop.artist === artist);

// Unique artist names, sorted, derived from the catalog.
export const getArtists = (loops: Loop[] = getAllLoops()) =>
  [...new Set(loops.map((loop) => loop.artist))].sort((a, b) =>
    a.localeCompare(b)
  );

// Beats in one bar of the given time signature string ("4 / 4" -> 4). The
// import screen needs this before it has a Loop to hand to getBeatsPerBar.
export const beatsPerBarOf = (timeSignature: string) => {
  const numerator = parseInt(timeSignature.split("/")[0].trim(), 10);
  return Number.isFinite(numerator) && numerator > 0 ? numerator : 4;
};

/** The time signatures the import screen offers. */
export const LOOP_TIME_SIGNATURES = ["4 / 4", "3 / 4", "6 / 8", "5 / 4"] as const;

/** Loop lengths, in bars, the import screen offers to fit a tempo to. */
export const LOOP_BAR_OPTIONS = [1, 2, 4, 8, 16] as const;

// When several bar counts are plausible, the one implying a tempo near here
// wins: a two-second loop is far likelier to be one bar at 120 than sixteen at
// 1920.
const LIKELY_BPM = 110;

/**
 * Guess the tempo of a region by assuming it's a whole number of bars, and
 * taking the bar count whose implied tempo is the most musically likely.
 *
 * This is where an imported loop's tempo comes from before the user has said
 * what it is. It's a starting point, not an answer -- nothing in a bare audio
 * file says how many bars it holds -- but it's right often enough that checking
 * it against the click beats typing a number in cold.
 */
export const suggestLoopTempo = (
  lengthSeconds: number,
  beatsPerBar: number,
  { minBpm, maxBpm }: { minBpm: number; maxBpm: number }
) => {
  const clamp = (bpm: number) =>
    Math.max(minBpm, Math.min(maxBpm, Math.round(bpm)));

  if (!(lengthSeconds > 0)) return { bars: 1, bpm: clamp(LIKELY_BPM) };

  const bpmFor = (bars: number) => (bars * beatsPerBar * 60) / lengthSeconds;

  let best: { bars: number; bpm: number; distance: number } | null = null;
  for (const bars of LOOP_BAR_OPTIONS) {
    const bpm = bpmFor(bars);
    if (bpm < minBpm || bpm > maxBpm) continue;
    // Compared as a ratio, so half-speed and double-speed sit equally far from
    // the likely tempo rather than the slow end always winning.
    const distance = Math.abs(Math.log(bpm / LIKELY_BPM));
    if (!best || distance < best.distance) {
      best = { bars, bpm: clamp(bpm), distance };
    }
  }

  // Nothing landed in range: a very short or very long region. One bar, clamped
  // -- the user is going to correct it either way, and this at least gives the
  // trim a grid to snap to.
  return best
    ? { bars: best.bars, bpm: best.bpm }
    : { bars: 1, bpm: clamp(bpmFor(1)) };
};
