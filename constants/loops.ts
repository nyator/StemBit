import audio from "./audio";

// Categories are a fixed, curated list — add new ones here and they appear
// automatically as filter chips in the loop browser.
export const LOOP_CATEGORIES = ["Worship", "Praise", "Funk"] as const;
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
];

export const findLoopByKey = (key: string | undefined) =>
  LOOPS.find((loop) => loop.key === key);

export const getLoopsByCategory = (category: LoopCategory) =>
  LOOPS.filter((loop) => loop.category === category);

export const getLoopsByArtist = (artist: string) =>
  LOOPS.filter((loop) => loop.artist === artist);

// Unique artist names, sorted, derived from the catalog.
export const getArtists = () =>
  [...new Set(LOOPS.map((loop) => loop.artist))].sort((a, b) =>
    a.localeCompare(b)
  );
