import audio from "./audio";

// Categories are a fixed, curated list — add new ones here and they appear
// automatically as filter chips in the loop browser.
export const LOOP_CATEGORIES = ["Worship", "Praise", "Funk", "Afro", "Drill", "Highlife"] as const;
export type LoopCategory = (typeof LOOP_CATEGORIES)[number];

export type Loop = {
  key: string;
  title: string;
  artist: string;
  category: LoopCategory;
  bpm: number;
  timeSignature: string;
  source: number;
};

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

export const findLoopByKey = (key: string | undefined) =>
  LOOPS.find((loop) => loop.key === key);

// Beats per bar = the time signature's numerator ("4 / 4" -> 4, "3 / 4" -> 3).
// Drives where the loop click's accent falls: on every bar downbeat, so the
// accent pattern is independent of how many bars long the loop is. Falls back
// to 4 for a malformed signature.
export const getBeatsPerBar = (loop: Loop) => {
  const numerator = parseInt(loop.timeSignature.split("/")[0].trim(), 10);
  return Number.isFinite(numerator) && numerator > 0 ? numerator : 4;
};

export const getLoopsByCategory = (category: LoopCategory) =>
  LOOPS.filter((loop) => loop.category === category);

export const getLoopsByArtist = (artist: string) =>
  LOOPS.filter((loop) => loop.artist === artist);

// Unique artist names, sorted, derived from the catalog.
export const getArtists = () =>
  [...new Set(LOOPS.map((loop) => loop.artist))].sort((a, b) =>
    a.localeCompare(b)
  );
