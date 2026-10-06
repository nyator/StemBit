import { genreOf, type RemotePack } from "./loopStore";

// Filtering and sorting the Loop Store.
//
// The same rule the Bits browser follows, so the two read as one idea: within
// an axis, ticking more than one value is an OR -- "Afrobeats" and "Gospel"
// together get you either. Across axes it's an AND -- add "Under 90 BPM" and
// that OR narrows further to slow packs in either genre.
//
// The unit is a pack (a single is a one-loop pack), and a pack matches a
// loop-level axis -- tempo, key -- when any of its loops does. Somebody after
// "a pack with something in A minor" wants the pack with one A-minor loop in
// it, not only packs recorded entirely in A minor.

export type StoreAxis = "types" | "genres" | "tempos" | "keys" | "artists";

/** Every ticked value per axis. An empty array means "not narrowed by this one". */
export type StoreFilters = Record<StoreAxis, string[]>;

export const NO_STORE_FILTERS: StoreFilters = {
  types: [],
  genres: [],
  tempos: [],
  keys: [],
  artists: [],
};

/** Section order in the sheet, and each section's heading. */
export const STORE_AXES: { axis: StoreAxis; label: string }[] = [
  { axis: "types", label: "Type" },
  { axis: "genres", label: "Genre" },
  { axis: "tempos", label: "Tempo" },
  { axis: "keys", label: "Key" },
  { axis: "artists", label: "Artist" },
];

export const PACKS = "Packs";
export const SINGLES = "Singles";

/**
 * Tempo in bands rather than exact values: a catalogue's tempos are nearly all
 * different, and a filter row per BPM would be a list of ones.
 */
export const TEMPO_BANDS = [
  { label: "Under 90 BPM", min: 0, max: 90 },
  { label: "90–119 BPM", min: 90, max: 120 },
  { label: "120 BPM and up", min: 120, max: Infinity },
] as const;

/** The values a pack has on one axis. */
export const valuesOf = (pack: RemotePack, axis: StoreAxis): string[] => {
  switch (axis) {
    case "types":
      return [pack.single ? SINGLES : PACKS];
    case "genres":
      return [genreOf(pack)];
    case "tempos":
      return TEMPO_BANDS.filter((band) =>
        pack.loops.some((loop) => loop.bpm >= band.min && loop.bpm < band.max)
      ).map((band) => band.label);
    case "keys":
      return [
        ...new Set(pack.loops.flatMap((loop) => (loop.musicalKey ? [loop.musicalKey] : []))),
      ];
    case "artists":
      return [pack.artist];
  }
};

export const matchesFilters = (pack: RemotePack, filters: StoreFilters) =>
  (Object.keys(filters) as StoreAxis[]).every((axis) => {
    const wanted = filters[axis];
    return wanted.length === 0 || valuesOf(pack, axis).some((value) => wanted.includes(value));
  });

/**
 * What the sheet offers on an axis: only values some pack actually has, so no
 * row selects nothing. Types and tempos keep their natural order; genres keep
 * the manifest's; keys and artists are alphabetical.
 */
export const optionsFor = (packs: RemotePack[], axis: StoreAxis): string[] => {
  const present = new Set(packs.flatMap((pack) => valuesOf(pack, axis)));
  switch (axis) {
    case "types":
      return [PACKS, SINGLES].filter((value) => present.has(value));
    case "tempos":
      return TEMPO_BANDS.map((band) => band.label).filter((value) => present.has(value));
    case "genres":
      return [...present];
    case "keys":
    case "artists":
      return [...present].sort((a, b) => a.localeCompare(b));
  }
};

/** Flattened to one entry per ticked value, for the removable pills. */
export const activeFilters = (filters: StoreFilters) =>
  (Object.keys(filters) as StoreAxis[]).flatMap((axis) =>
    filters[axis].map((value) => ({ axis, value }))
  );

/* -------------------------------------------------------------------------- */
/* Sorting                                                                     */
/* -------------------------------------------------------------------------- */

export type StoreSort = "featured" | "newest" | "title" | "artist" | "loops" | "tempo";

export const STORE_SORTS: { id: StoreSort; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "newest", label: "Newest" },
  { id: "title", label: "Title A–Z" },
  { id: "artist", label: "Artist A–Z" },
  { id: "loops", label: "Most loops" },
  { id: "tempo", label: "Tempo: slow to fast" },
];

export const DEFAULT_SORT: StoreSort = "featured";

const dateOf = (pack: RemotePack) => (pack.addedAt ? Date.parse(pack.addedAt) : -Infinity);
const slowestOf = (pack: RemotePack) => Math.min(...pack.loops.map((loop) => loop.bpm));

/**
 * A sorted copy. Every order falls back to the manifest's on a tie -- the
 * sort is stable -- so two packs released the same day keep the order whoever
 * published them chose.
 *
 * "Featured" is the manifest order with featured packs lifted to the top; a
 * pack without a release date sorts after every dated one under "Newest".
 */
export const sortPacks = (packs: RemotePack[], sort: StoreSort): RemotePack[] => {
  const sorted = [...packs];
  switch (sort) {
    case "featured":
      return sorted.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    case "newest":
      // Compared rather than subtracted: two undated packs are -Infinity each,
      // and -Infinity minus -Infinity is NaN, not a tie.
      return sorted.sort((a, b) => {
        const left = dateOf(a);
        const right = dateOf(b);
        return left === right ? 0 : right > left ? 1 : -1;
      });
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "artist":
      return sorted.sort(
        (a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title)
      );
    case "loops":
      return sorted.sort((a, b) => b.loops.length - a.loops.length);
    case "tempo":
      return sorted.sort((a, b) => slowestOf(a) - slowestOf(b));
  }
};
