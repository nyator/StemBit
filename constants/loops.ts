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
   * The loop region, in seconds into the file.
   *
   * Every imported loop carries these: the user trims them by hand
   * (app/(loops)/import.tsx), because an arbitrary file has no reason to start
   * and end on the beat. A bundled loop can leave them off and let the engine
   * find the region itself -- silence trim plus a snap to whole beats (see
   * constants/loopEngine.ts) -- which is what the loops delivered already
   * loop-length do. The ones cut from longer recordings state their region
   * instead, because a bar that ends on a decay can trim shorter than the snap
   * will reach back; see the note above those entries in LOOPS.
   */
  trimStart?: number;
  trimEnd?: number;
  /**
   * The tempo to open this loop at, when that isn't the tempo it was recorded
   * at. Only a user's own loops carry one.
   *
   * Two different numbers, and conflating them is why this exists. `bpm` is
   * what the audio WAS recorded at, and every warp is measured from it -- move
   * it and the engine stretches by the wrong ratio. This is what you want to
   * HEAR, and moving it is what actually makes the loop play slower. Loading a
   * loop sets the session to this and warps from `bpm`, so a 107 loop asked for
   * at 96 is stretched to 96 rather than relabelled 96 and left at 107.
   */
  playbackBpm?: number;
  /**
   * In the user's own library rather than shipped with the app -- true for a
   * file they imported and for one downloaded from the store alike. What it
   * governs is capability, not provenance: this loop's audio is a file in app
   * storage, so it can be renamed, re-tempoed and deleted, none of which a
   * bundled loop allows.
   */
  userAdded?: boolean;
  /**
   * The store pack this was downloaded from, for a loop that came from one.
   *
   * Absent on both shipped loops and the user's own imports. It's what lets the
   * browser credit the artist on a downloaded row instead of filing it under
   * "Imported" -- the pack's author is the whole point of an artist pack, and
   * losing their name at the moment the loop arrives would be the one place it
   * matters most.
   */
  packId?: string;
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
  // Every entry states its own region rather than letting the engine find one.
  //
  // The automatic points are meant for a file that might have encoder padding
  // or dead air: they trim everything below -46 dBFS off both ends, then snap
  // what is left to a whole number of beats -- but only if it is already within
  // BEAT_SNAP_TOLERANCE (0.1 beats) of one. Several of these end on a decay
  // that falls under that threshold before the bar does, so the trim eats it,
  // the snap declines to reach back, and the engine loops a region short of a
  // whole bar. Stating the region skips the trim and the snap both.
  //
  // trimEnd is each file's exact duration. scripts/import_loops.js pads or
  // trims every file to a whole number of beats on the way in, so these are
  // exact rather than nearly.
  {
    key: "afro",
    title: "Afro",
    artist: "Stembit",
    category: "Afro",
    bpm: 96,
    timeSignature: "4 / 4",
    source: audio.afro,
    // 2 bars, 5.000000s
    trimStart: 0,
    trimEnd: 5.000000,
  },
  {
    key: "afro_97",
    title: "Afro 97",
    artist: "Stembit",
    category: "Afro",
    bpm: 97,
    timeSignature: "4 / 4",
    source: audio.afro97,
    // 1 bar, 2.474229s
    trimStart: 0,
    trimEnd: 2.474229,
  },
  {
    key: "afro_97_ii",
    title: "Afro 97 II",
    artist: "Stembit",
    category: "Afro",
    bpm: 97,
    timeSignature: "4 / 4",
    source: audio.afro97Ii,
    // 1 bar, 2.474229s
    trimStart: 0,
    trimEnd: 2.474229,
  },
  {
    key: "back_home",
    title: "Back Home",
    artist: "Stembit",
    category: "Afro",
    bpm: 128,
    timeSignature: "4 / 4",
    source: audio.backHome,
    // 2 bars, 3.750000s
    trimStart: 0,
    trimEnd: 3.750000,
  },
  {
    key: "afro_dancehall",
    title: "Afro Dancehall",
    artist: "Stembit",
    category: "Afro",
    bpm: 131,
    timeSignature: "4 / 4",
    source: audio.afroDancehall,
    // 2 bars, 3.664125s
    trimStart: 0,
    trimEnd: 3.664125,
  },
  {
    key: "afro_local",
    title: "Afro Local",
    artist: "Stembit",
    category: "Afro",
    bpm: 136,
    timeSignature: "4 / 4",
    source: audio.afroLocal,
    // 1 bar, 1.764708s
    trimStart: 0,
    trimEnd: 1.764708,
  },
  {
    key: "afro_oi",
    title: "Afro OI",
    artist: "Stembit",
    category: "Afro",
    bpm: 107,
    timeSignature: "4 / 4",
    source: audio.afroOi,
    // 2 bars, 4.485979s
    trimStart: 0,
    trimEnd: 4.485979,
  },
  {
    key: "afro_p",
    title: "Afro P",
    artist: "Stembit",
    category: "Afro",
    bpm: 122,
    timeSignature: "4 / 4",
    source: audio.afroP,
    // 2 bars, 3.934417s
    trimStart: 0,
    trimEnd: 3.934417,
  },
  {
    key: "afro_piano",
    title: "Afro Piano",
    artist: "Stembit",
    category: "Afro",
    bpm: 124,
    timeSignature: "4 / 4",
    source: audio.afroPiano,
    // 2 bars, 3.870958s
    trimStart: 0,
    trimEnd: 3.870958,
  },
  {
    key: "afro_praise",
    title: "Afro Praise",
    artist: "Stembit",
    category: "Praise",
    bpm: 135,
    timeSignature: "4 / 4",
    source: audio.afroPraise,
    // 2 bars, 3.555563s
    trimStart: 0,
    trimEnd: 3.555563,
  },
  {
    key: "drill",
    title: "Drill",
    artist: "Stembit",
    category: "Drill",
    bpm: 132,
    timeSignature: "4 / 4",
    source: audio.drill,
    // 2 bars, 3.636354s
    trimStart: 0,
    trimEnd: 3.636354,
  },
  {
    key: "pst_nath",
    title: "Pst Nath",
    artist: "Stembit",
    category: "Highlife",
    bpm: 87,
    timeSignature: "4 / 4",
    source: audio.pstNath,
    // 1 bar, 2.758625s
    trimStart: 0,
    trimEnd: 2.758625,
  },
  {
    key: "worship_80",
    title: "Worship 80",
    artist: "Stembit",
    category: "Worship",
    bpm: 80,
    timeSignature: "4 / 4",
    source: audio.worship80,
    // 1 bar, 3.000000s
    trimStart: 0,
    trimEnd: 3.000000,
  },
  {
    key: "worship_80_ii",
    title: "Worship 80 II",
    artist: "Stembit",
    category: "Worship",
    bpm: 80,
    timeSignature: "4 / 4",
    source: audio.worship80Ii,
    // 1 bar, 3.000000s
    trimStart: 0,
    trimEnd: 3.000000,
  },
  {
    key: "worship_80_iii",
    title: "Worship 80 III",
    artist: "Stembit",
    category: "Worship",
    bpm: 80,
    timeSignature: "4 / 4",
    source: audio.worship80Iii,
    // 2 bars, 6.000000s
    trimStart: 0,
    trimEnd: 6.000000,
  },
  {
    key: "worship_mm",
    title: "Worship MM",
    artist: "Stembit",
    category: "Worship",
    bpm: 80,
    timeSignature: "4 / 4",
    source: audio.worshipMm,
    // 1 bar, 3.000000s
    trimStart: 0,
    trimEnd: 3.000000,
  },
  {
    key: "worship_68",
    title: "Worship 6/8",
    artist: "Stembit",
    category: "Worship",
    bpm: 80,
    timeSignature: "3 / 4",
    source: audio.worship68,
    // 3 bars, 6.750000s
    trimStart: 0,
    trimEnd: 6.750000,
  },
  {
    key: "worship_82",
    title: "Worship 82",
    artist: "Stembit",
    category: "Worship",
    bpm: 82,
    timeSignature: "4 / 4",
    source: audio.worship82,
    // 1 bar, 2.926833s
    trimStart: 0,
    trimEnd: 2.926833,
  },
  {
    key: "worship_mover",
    title: "Worship Mover",
    artist: "Stembit",
    category: "Worship",
    bpm: 82,
    timeSignature: "4 / 4",
    source: audio.worshipMover,
    // 1 bar, 2.926833s
    trimStart: 0,
    trimEnd: 2.926833,
  },
  {
    key: "worship_91",
    title: "Worship 91",
    artist: "Stembit",
    category: "Worship",
    bpm: 91,
    timeSignature: "4 / 4",
    source: audio.worship91,
    // 1 bar, 2.637354s
    trimStart: 0,
    trimEnd: 2.637354,
  },
  {
    key: "worship_underdog",
    title: "Worship Underdog",
    artist: "Stembit",
    category: "Worship",
    bpm: 94,
    timeSignature: "4 / 4",
    source: audio.worshipUnderdog,
    // 1 bar, 2.553187s
    trimStart: 0,
    trimEnd: 2.553187,
  },
  {
    key: "worship_war_drum",
    title: "Worship War Drum",
    artist: "Stembit",
    category: "Worship",
    bpm: 94,
    timeSignature: "4 / 4",
    source: audio.worshipWarDrum,
    // 1 bar, 2.553187s
    trimStart: 0,
    trimEnd: 2.553187,
  },
  {
    key: "worship_war",
    title: "Worship War",
    artist: "Stembit",
    category: "Worship",
    bpm: 98,
    timeSignature: "4 / 4",
    source: audio.worshipWar,
    // 2 bars, 4.897958s
    trimStart: 0,
    trimEnd: 4.897958,
  },
  {
    key: "worship_135",
    title: "Worship 135",
    artist: "Stembit",
    category: "Worship",
    bpm: 135,
    timeSignature: "4 / 4",
    source: audio.worship135,
    // 2 bars, 3.555563s
    trimStart: 0,
    trimEnd: 3.555563,
  },
  {
    key: "worship_155",
    title: "Worship 155",
    artist: "Stembit",
    category: "Worship",
    bpm: 155,
    timeSignature: "3 / 4",
    source: audio.worship155,
    // 4 bars, 4.645167s
    trimStart: 0,
    trimEnd: 4.645167,
  },
  {
    key: "worship_155_ii",
    title: "Worship 155 II",
    artist: "Stembit",
    category: "Worship",
    bpm: 155,
    timeSignature: "3 / 4",
    source: audio.worship155Ii,
    // 2 bars, 2.322583s
    trimStart: 0,
    trimEnd: 2.322583,
  },
  {
    key: "worship_155_iii",
    title: "Worship 155 III",
    artist: "Stembit",
    category: "Worship",
    bpm: 155,
    timeSignature: "3 / 4",
    source: audio.worship155Iii,
    // 2 bars, 2.322583s
    trimStart: 0,
    trimEnd: 2.322583,
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
 * Corrections to a shipped loop's own tempo, trim or time signature.
 *
 * A catalog entry states the tempo its audio was recorded at, and every warp is
 * measured from that -- so a loop declared 155 that is really 154 plays slightly
 * off at every other tempo, and the click walks away from it. The audio is
 * bundled and can't be edited, but what the app believes about it can be, and
 * that's what this is. context/UserLoopsContext.tsx owns loading and saving.
 */
export type LoopOverride = {
  bpm?: number;
  timeSignature?: string;
  trimStart?: number;
  trimEnd?: number;
};

let catalogOverrides: Record<string, LoopOverride> = {};

export const setCatalogOverrides = (overrides: Record<string, LoopOverride>) => {
  catalogOverrides = overrides;
};

/** Whether a shipped loop is playing at something other than its shipped values. */
export const isLoopOverridden = (key: string) => !!catalogOverrides[key];

const withOverride = (loop: Loop): Loop => {
  const override = catalogOverrides[loop.key];
  return override ? { ...loop, ...override } : loop;
};

/** The shipped catalog, with any corrections applied. */
export const getCatalogLoops = (): Loop[] => LOOPS.map(withOverride);

/**
 * The bundled catalog plus the user's imports. Imports come first: they're the
 * few loops among many that the user put there on purpose, so they belong at
 * the top of the browser rather than at the bottom of the shipped list.
 */
export const getAllLoops = (): Loop[] => [...userLoops, ...getCatalogLoops()];

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

export const getLoopsByTimeSignature = (
  timeSignature: string,
  loops: Loop[] = getAllLoops()
) => loops.filter((loop) => loop.timeSignature === timeSignature);

/**
 * The meters actually present, in musical order.
 *
 * Derived from the loops rather than taken from LOOP_TIME_SIGNATURES, the way
 * artists are and categories are not: that list is what the IMPORT screen
 * offers, and offering a "6 / 8" filter chip that selects nothing is a worse
 * answer than not offering it. Import a 6/8 loop and the chip appears.
 *
 * Sorted by denominator then numerator, so quarter-note meters group together
 * ahead of eighth-note ones -- 3/4, 4/4, 5/4, then 6/8 -- rather than falling
 * into whatever order the catalog happens to list them in.
 */
export const getTimeSignatures = (loops: Loop[] = getAllLoops()) => {
  const parse = (signature: string) => {
    const [numerator, denominator] = signature
      .split("/")
      .map((part) => parseInt(part.trim(), 10));
    return {
      numerator: Number.isFinite(numerator) ? numerator! : 4,
      denominator: Number.isFinite(denominator) ? denominator! : 4,
    };
  };

  return [...new Set(loops.map((loop) => loop.timeSignature))].sort((a, b) => {
    const left = parse(a);
    const right = parse(b);
    return (
      left.denominator - right.denominator || left.numerator - right.numerator
    );
  });
};

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
