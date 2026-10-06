/**
 * Tests for the Loop Store's filter and sort.
 *
 * The rules mirror the Bits browser's: OR within an axis, AND across axes, and
 * a pack matches a loop-level axis (tempo, key) when any one of its loops does.
 * The sorts all fall back to manifest order on a tie, which is the order the
 * person publishing the store chose.
 */

const { parseCatalog } = require("../../constants/loopStore");
const {
  NO_STORE_FILTERS,
  matchesFilters,
  optionsFor,
  sortPacks,
  valuesOf,
} = require("../../constants/storeFilters");

const loop = (overrides = {}) => ({
  key: `k-${Math.random()}`,
  title: "Loop",
  category: "Afro",
  bpm: 100,
  timeSignature: "4 / 4",
  trimStart: 0,
  trimEnd: 2.4,
  file: "packs/x/loop.wav",
  ...overrides,
});

const catalog = parseCatalog({
  packs: [
    {
      id: "slow-gospel",
      title: "Sunday",
      artist: "Ama",
      genre: "Gospel",
      addedAt: "2026-08-01",
      loops: [loop({ bpm: 72, musicalKey: "A minor" }), loop({ bpm: 76 })],
    },
    {
      id: "fast-afro",
      title: "Lagos Run",
      artist: "Kwame",
      genre: "Afrobeats",
      featured: true,
      loops: [loop({ bpm: 124, musicalKey: "F#" })],
    },
    {
      id: "mixed-afro",
      title: "Amapiano Nights",
      artist: "Ama",
      genre: "Afrobeats",
      addedAt: "2026-09-15",
      loops: [loop({ bpm: 88 }), loop({ bpm: 112, musicalKey: "A minor" }), loop({ bpm: 128 })],
    },
  ],
  loops: [loop({ key: "single-1", title: "Bounce", artist: "Kofi", bpm: 96 })],
});

const ids = (packs) => packs.map((pack) => pack.id);
const only = (overrides) => ({ ...NO_STORE_FILTERS, ...overrides });

describe("matchesFilters", () => {
  it("lets everything through with nothing ticked", () => {
    expect(catalog.filter((pack) => matchesFilters(pack, NO_STORE_FILTERS))).toHaveLength(4);
  });

  it("ORs values within an axis", () => {
    const hits = catalog.filter((pack) =>
      matchesFilters(pack, only({ genres: ["Gospel", "Afrobeats"] }))
    );
    expect(ids(hits)).toEqual(["slow-gospel", "fast-afro", "mixed-afro"]);
  });

  it("ANDs across axes", () => {
    const hits = catalog.filter((pack) =>
      matchesFilters(pack, only({ genres: ["Afrobeats"], artists: ["Ama"] }))
    );
    expect(ids(hits)).toEqual(["mixed-afro"]);
  });

  it("matches a tempo band when any loop in the pack falls in it", () => {
    // The mixed pack spans all three bands, so it answers to each.
    const slow = catalog.filter((pack) => matchesFilters(pack, only({ tempos: ["Under 90 BPM"] })));
    expect(ids(slow)).toEqual(["slow-gospel", "mixed-afro"]);
    const fast = catalog.filter((pack) =>
      matchesFilters(pack, only({ tempos: ["120 BPM and up"] }))
    );
    expect(ids(fast)).toEqual(["fast-afro", "mixed-afro"]);
  });

  it("matches a key when any loop states it", () => {
    const hits = catalog.filter((pack) => matchesFilters(pack, only({ keys: ["A minor"] })));
    expect(ids(hits)).toEqual(["slow-gospel", "mixed-afro"]);
  });

  it("tells packs from singles", () => {
    const hits = catalog.filter((pack) => matchesFilters(pack, only({ types: ["Singles"] })));
    expect(ids(hits)).toEqual(["single:single-1"]);
  });
});

describe("optionsFor", () => {
  it("offers only values some pack has, in each axis's order", () => {
    expect(optionsFor(catalog, "types")).toEqual(["Packs", "Singles"]);
    expect(optionsFor(catalog, "tempos")).toEqual([
      "Under 90 BPM",
      "90–119 BPM",
      "120 BPM and up",
    ]);
    expect(optionsFor(catalog, "keys")).toEqual(["A minor", "F#"]);
    expect(optionsFor(catalog, "artists")).toEqual(["Ama", "Kofi", "Kwame"]);
  });

  it("files a single without a genre under its loop's category", () => {
    const single = catalog.find((pack) => pack.single);
    expect(valuesOf(single, "genres")).toEqual(["Afro"]);
  });
});

describe("sortPacks", () => {
  it("lifts featured packs to the top and otherwise keeps manifest order", () => {
    expect(ids(sortPacks(catalog, "featured"))).toEqual([
      "fast-afro",
      "slow-gospel",
      "mixed-afro",
      "single:single-1",
    ]);
  });

  it("puts the newest first and undated packs last, in manifest order", () => {
    expect(ids(sortPacks(catalog, "newest"))).toEqual([
      "mixed-afro",
      "slow-gospel",
      "fast-afro",
      "single:single-1",
    ]);
  });

  it("sorts by title, by artist then title, by size and by tempo", () => {
    expect(ids(sortPacks(catalog, "title"))).toEqual([
      "mixed-afro",
      "single:single-1",
      "fast-afro",
      "slow-gospel",
    ]);
    expect(ids(sortPacks(catalog, "artist"))).toEqual([
      "mixed-afro",
      "slow-gospel",
      "single:single-1",
      "fast-afro",
    ]);
    expect(ids(sortPacks(catalog, "loops"))[0]).toBe("mixed-afro");
    // By each pack's slowest loop.
    expect(ids(sortPacks(catalog, "tempo"))).toEqual([
      "slow-gospel",
      "mixed-afro",
      "single:single-1",
      "fast-afro",
    ]);
  });

  it("leaves the list it was given alone", () => {
    const before = ids(catalog);
    sortPacks(catalog, "title");
    expect(ids(catalog)).toEqual(before);
  });
});
