/**
 * Tests for the loop store's manifest parser.
 *
 * catalog.json is the one thing the app knows about the R2 bucket, and it is a
 * hand-authored file arriving over a network -- so every case here is a real
 * failure mode rather than a hypothetical: a typo'd category, a loop uploaded
 * before its trim points were measured, a paid pack whose audio deliberately has
 * no public path yet, an R2 error page served where JSON was expected.
 *
 * The rule the parser follows throughout is the same one UserLoopsContext
 * applies to the on-disk index: drop the bad entry, keep the rest. A store that
 * shows eleven of twelve packs is a store; one that shows an error because the
 * twelfth has a typo is not.
 */

const {
  parseCatalog,
  isPackFree,
  isPackUnlocked,
  formatBytes,
  packBytes,
  localKeyFor,
  fileNameFor,
} = require("../../constants/loopStore");

/** A loop entry with everything the parser insists on. */
const loop = (overrides = {}) => ({
  key: "kwame/deep-groove",
  title: "Deep Groove",
  category: "Afro",
  bpm: 104,
  timeSignature: "4 / 4",
  trimStart: 0,
  trimEnd: 4.615385,
  file: "packs/kwame/deep-groove.wav",
  bytes: 812_000,
  ...overrides,
});

const pack = (overrides = {}) => ({
  id: "kwame-afro-vol1",
  title: "Afro Vol. 1",
  artist: "Kwame Mensah",
  loops: [loop()],
  ...overrides,
});

describe("parseCatalog", () => {
  it("reads packs and stamps each loop with its pack's id and artist", () => {
    const [parsed] = parseCatalog({ packs: [pack()] });

    expect(parsed.id).toBe("kwame-afro-vol1");
    expect(parsed.single).toBe(false);
    expect(parsed.loops).toHaveLength(1);
    // Copied down rather than looked up later: a loop is handed to the download
    // on its own, and it has to know who to credit without its pack in hand.
    expect(parsed.loops[0].artist).toBe("Kwame Mensah");
    expect(parsed.loops[0].packId).toBe("kwame-afro-vol1");
  });

  it("turns a root-level loop into a one-loop pack", () => {
    const [parsed] = parseCatalog({
      loops: [loop({ artist: "Ama", title: "Single Bit" })],
    });

    expect(parsed.single).toBe(true);
    expect(parsed.artist).toBe("Ama");
    expect(parsed.loops).toHaveLength(1);
    // Derived from the loop's key, so a refresh links to the same pack.
    expect(parsed.id).toBe("single:kwame/deep-groove");
  });

  it("keeps the good loops in a pack and drops only the broken ones", () => {
    const [parsed] = parseCatalog({
      packs: [
        pack({
          loops: [
            loop({ key: "a" }),
            loop({ key: "b", trimEnd: 0 }), // no region to loop
            loop({ key: "c", bpm: "fast" }), // not a number
            loop({ key: "d" }),
          ],
        }),
      ],
    });

    expect(parsed.loops.map((entry) => entry.key)).toEqual(["a", "d"]);
  });

  it("falls back to the first category rather than dropping an unknown one", () => {
    // A category retired from LOOP_CATEGORIES, or simply misspelled on upload.
    // The loop is still a loop -- it just files under the wrong chip, which is a
    // far smaller loss than the row not existing.
    const [parsed] = parseCatalog({
      packs: [pack({ loops: [loop({ category: "Amapiano" })] })],
    });

    expect(parsed.loops[0].category).toBe("Worship");
  });

  it("drops a free loop with nowhere to download from", () => {
    // A row whose download could never succeed. Better absent than listed.
    expect(parseCatalog({ packs: [pack({ loops: [loop({ file: undefined })] })] })).toEqual(
      []
    );
  });

  it("keeps a paid loop that has no file yet", () => {
    // The expected shape of a paid pack: browsable in the store, with its audio
    // kept out of the public bucket entirely until there is something to check a
    // purchase against.
    const [parsed] = parseCatalog({
      packs: [pack({ price: 4.99, loops: [loop({ file: undefined })] })],
    });

    expect(parsed.loops).toHaveLength(1);
    expect(parsed.loops[0].file).toBeUndefined();
    expect(isPackUnlocked(parsed)).toBe(false);
  });

  it("drops a pack whose loops are all unusable", () => {
    expect(parseCatalog({ packs: [pack({ loops: [] })] })).toEqual([]);
    expect(parseCatalog({ packs: [pack({ loops: [loop({ title: "" })] })] })).toEqual([]);
  });

  it("drops a pack missing an id or a title", () => {
    expect(parseCatalog({ packs: [pack({ id: undefined })] })).toEqual([]);
    expect(parseCatalog({ packs: [pack({ title: undefined })] })).toEqual([]);
  });

  it("survives anything that isn't the shape it expects", () => {
    // Whatever a misconfigured bucket serves in place of the manifest: an error
    // page parsed as JSON, an array, a half-written file.
    expect(parseCatalog(null)).toEqual([]);
    expect(parseCatalog("nope")).toEqual([]);
    expect(parseCatalog([])).toEqual([]);
    expect(parseCatalog({})).toEqual([]);
    expect(parseCatalog({ packs: "soon" })).toEqual([]);
    expect(parseCatalog({ packs: [null, 7, pack()] })).toHaveLength(1);
  });
});

describe("pricing", () => {
  it("treats an absent or zero price as free", () => {
    expect(isPackFree(pack())).toBe(true);
    expect(isPackFree({ ...pack(), price: 0 })).toBe(true);
    expect(isPackFree({ ...pack(), price: 4.99 })).toBe(false);
  });

  it("never unlocks a paid pack", () => {
    // The whole point of the lock: nothing on the device gets to decide a
    // purchase happened. When entitlements exist this is the test that changes.
    expect(isPackUnlocked({ ...pack(), price: 4.99 })).toBe(false);
  });

  it("normalises a negative or non-numeric price to free", () => {
    const [parsed] = parseCatalog({ packs: [pack({ price: -3 })] });
    expect(isPackFree(parsed)).toBe(true);
  });
});

describe("sizes", () => {
  it("adds up a pack's loops", () => {
    const [parsed] = parseCatalog({
      packs: [
        pack({
          loops: [
            loop({ key: "a", bytes: 1000 }),
            loop({ key: "b", bytes: 2000 }),
            loop({ key: "c", bytes: undefined }),
          ],
        }),
      ],
    });

    expect(packBytes(parsed)).toBe(3000);
  });

  it("says nothing rather than 0 B when a size is missing", () => {
    expect(formatBytes(undefined)).toBe("");
    expect(formatBytes(0)).toBe("");
    expect(formatBytes(512_000)).toBe("500 KB");
    expect(formatBytes(2_202_010)).toBe("2.1 MB");
  });
});

describe("local naming", () => {
  it("namespaces a downloaded loop's key away from shipped and imported ones", () => {
    // Shipped keys are bare ("afro_97"), imports are "user-...". A collision
    // would have the engine playing one loop under another's name.
    expect(localKeyFor("kwame/deep-groove")).toBe("store-kwame-deep-groove");
    expect(localKeyFor("Ama — Bounce!")).toBe("store-ama-bounce");
  });

  it("keeps the uploaded file's extension, since the row preview decodes by name", () => {
    expect(fileNameFor(loop())).toBe("deep-groove.wav");
    expect(fileNameFor(loop({ file: "packs/kwame/groove" }))).toBe(
      "kwame/deep-groove.wav"
    );
  });
});
