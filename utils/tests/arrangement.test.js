/**
 * Arrangement playback: PLAY walking the song as its sections are configured.
 *
 * PLAY used to send one flat span from the top of the song to the end of the
 * file, so a chorus set to play four times played once unless its own pad was
 * what started it. It now sends the section list, and the engine repeats each
 * one in turn.
 *
 * The mechanism is deliberately not a seek. The stems are started once and play
 * continuously; a repeat is done by pointing the same sources' loop window at a
 * section and taking the window away again after the last pass. So the whole
 * schedule is arithmetic done up front — which is exactly the kind of thing
 * that is either right or is wrong in front of a room, with nothing in between.
 *
 * planArrangement is pure, so it is tested directly.
 */

const fs = require("fs");
const path = require("path");

const ENGINE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "constants",
  "sessionEngine.ts"
);

const source = fs.readFileSync(ENGINE_PATH, "utf8");
const script = source.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const planSource = script.match(
  /function planArrangement\([\s\S]*?\r?\n        \}/
)[0];

// eslint-disable-next-line no-eval
const planArrangement = eval(`(${planSource})`);

/** Three 10-second sections back to back, so every number below is readable. */
const song = (repeats = []) => [
  { startSeconds: 0, endSeconds: 10, repeats: repeats[0] },
  { startSeconds: 10, endSeconds: 20, repeats: repeats[1] },
  { startSeconds: 20, endSeconds: 30, repeats: repeats[2] },
];

const on = (plan) => plan.filter((s) => s.looping);
const off = (plan) => plan.filter((s) => !s.looping);

describe("a song with nothing configured", () => {
  it("schedules nothing at all", () => {
    // Every section plays once, which is what continuous playback already
    // does. Touching the sources here would be work with no effect.
    expect(planArrangement(song(), 0, 0)).toEqual([]);
  });

  it("treats an explicit 1 the same as an unset count", () => {
    expect(planArrangement(song([1, 1, 1]), 0, 0)).toEqual([]);
  });
});

describe("one repeated section", () => {
  it("turns the loop on inside the first pass and off inside the last", () => {
    const plan = planArrangement(song([undefined, 3, undefined]), 0, 0);
    expect(plan).toHaveLength(2);

    // Section 2 is reached at t=10 and runs 3 times: passes at 10-20, 20-30,
    // 30-40.
    expect(plan[0]).toMatchObject({ looping: true, loopStart: 10, loopEnd: 20 });
    expect(plan[0].when).toBeCloseTo(15, 6); // middle of pass 1
    expect(plan[1]).toMatchObject({ looping: false });
    expect(plan[1].when).toBeCloseTo(35, 6); // middle of pass 3
  });

  it("puts every switch strictly inside a pass, never on a boundary", () => {
    const plan = planArrangement(song([undefined, 4, undefined]), 0, 0);
    // Boundaries for section 2 played 4 times: 10, 20, 30, 40, 50.
    for (const step of plan) {
      const offsetIntoSection = (step.when - 10) % 10;
      expect(offsetIntoSection).toBeCloseTo(5, 6);
    }
  });

  it("reports the song position each switch happens at", () => {
    const plan = planArrangement(song([undefined, 3, undefined]), 0, 0);
    // Halfway through section 2 both times — which is where the audio is,
    // however far the raw elapsed clock has run.
    expect(plan[0].position).toBeCloseTo(15, 6);
    expect(plan[1].position).toBeCloseTo(15, 6);
  });
});

describe("several repeated sections in a row", () => {
  it("stacks each one after the last has finished its passes", () => {
    const plan = planArrangement(song([2, 3, 2]), 0, 0);
    expect(plan).toHaveLength(6);

    // Section 1: 2 x 10s from t=0  -> occupies 0-20
    expect(plan[0].when).toBeCloseTo(5, 6);
    expect(plan[1].when).toBeCloseTo(15, 6);
    // Section 2 is reached at t=20, 3 x 10s -> occupies 20-50
    expect(plan[2].when).toBeCloseTo(25, 6);
    expect(plan[3].when).toBeCloseTo(45, 6);
    // Section 3 is reached at t=50, 2 x 10s -> occupies 50-70
    expect(plan[4].when).toBeCloseTo(55, 6);
    expect(plan[5].when).toBeCloseTo(65, 6);
  });

  it("never leaves a loop on across a section boundary", () => {
    const plan = planArrangement(song([2, 3, 2]), 0, 0);
    // Strictly alternating on/off means the window is always taken away before
    // the next one is set — otherwise a section would loop inside the wrong
    // span for a moment.
    expect(plan.map((s) => s.looping)).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
    ]);
  });

  it("keeps the schedule ordered in time", () => {
    const plan = planArrangement(song([4, 2, 8]), 0, 0);
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].when).toBeGreaterThan(plan[i - 1].when);
    }
  });
});

describe("a vamp", () => {
  it("loops and schedules nothing after it", () => {
    const plan = planArrangement(song([undefined, 0, 4]), 0, 0);

    // Section 3's count is unreachable: nothing gets past a vamp until a pad
    // is hit, so scheduling it would be scheduling the past.
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ looping: true, loopStart: 10, loopEnd: 20 });
  });

  it("still honours the counted sections before it", () => {
    const plan = planArrangement(song([2, 0, undefined]), 0, 0);
    expect(plan.map((s) => s.looping)).toEqual([true, false, true]);
    expect(plan[2]).toMatchObject({ loopStart: 10, loopEnd: 20 });
  });
});

describe("starting partway through", () => {
  it("measures the first section from where playback actually enters it", () => {
    // Entering section 2 at 15 leaves half a pass; the rest are full.
    const plan = planArrangement(song([undefined, 3, undefined]), 15, 0);

    expect(plan[0].when).toBeCloseTo(2.5, 6); // middle of the 5s remainder
    expect(plan[0].position).toBeCloseTo(17.5, 6);
    // Passes: 0-5 (partial), 5-15, 15-25. Middle of the last is 20.
    expect(plan[1].when).toBeCloseTo(20, 6);
  });

  it("skips sections already behind the playhead", () => {
    const plan = planArrangement(song([4, 4, 2]), 25, 0);
    // Only section 3 is still ahead.
    expect(on(plan)).toHaveLength(1);
    expect(plan[0]).toMatchObject({ loopStart: 20, loopEnd: 30 });
  });

  it("offsets the whole schedule by the launch time", () => {
    const base = planArrangement(song([2, 2, 2]), 0, 0);
    const later = planArrangement(song([2, 2, 2]), 0, 7.5);
    expect(later.map((s) => s.when)).toEqual(base.map((s) => s.when + 7.5));
    // Positions are in the song, so they do not move with the clock.
    expect(later.map((s) => s.position)).toEqual(base.map((s) => s.position));
  });
});

describe("malformed sections", () => {
  it("ignores a section with no length", () => {
    const plan = planArrangement(
      [
        { startSeconds: 0, endSeconds: 0, repeats: 4 },
        { startSeconds: 0, endSeconds: 10, repeats: 2 },
      ],
      0,
      0
    );
    expect(on(plan)).toHaveLength(1);
    expect(plan[0]).toMatchObject({ loopStart: 0, loopEnd: 10 });
  });

  it("ignores an inside-out section", () => {
    const plan = planArrangement(
      [{ startSeconds: 20, endSeconds: 5, repeats: 4 }],
      0,
      0
    );
    expect(plan).toEqual([]);
  });

  it("survives an empty song", () => {
    expect(planArrangement([], 0, 0)).toEqual([]);
  });

  it("pairs every on with an off, except a vamp", () => {
    const plan = planArrangement(song([3, 5, 2]), 0, 0);
    expect(on(plan)).toHaveLength(off(plan).length);
  });
});

/**
 * Turning a cue's stored sections into spans the engine can repeat.
 *
 * The bug this closes: the counts only worked from the one screen that happened
 * to send them. PLAY on the performance screen honoured the arrangement; the
 * same song fired from a setlist row played straight through — the same cue
 * behaving two different ways depending on where it was started.
 *
 * The awkward part is the last section, which usually has no stored end. It
 * cannot be closed by anything that does not hold the decoded audio, so it is
 * left open here on purpose and filled in by the engine.
 */
const { arrangementFrom } = require("../../constants/arrangement");

describe("arrangementFrom", () => {
  it("closes each section against the next one's start", () => {
    expect(
      arrangementFrom([
        { startSeconds: 0 },
        { startSeconds: 10 },
        { startSeconds: 20, endSeconds: 30 },
      ])
    ).toEqual([
      { startSeconds: 0, endSeconds: 10, repeats: undefined },
      { startSeconds: 10, endSeconds: 20, repeats: undefined },
      { startSeconds: 20, endSeconds: 30, repeats: undefined },
    ]);
  });

  it("leaves a trailing open end at zero for the engine to fill", () => {
    // Guessing here would repeat the wrong music, and the screen's measured
    // duration is not available to every caller — which is what caused the
    // split this whole helper exists to remove.
    const spans = arrangementFrom([{ startSeconds: 0 }, { startSeconds: 10 }]);
    expect(spans[spans.length - 1].endSeconds).toBe(0);
  });

  it("keeps an end that was stored, rather than deriving over it", () => {
    const spans = arrangementFrom([
      { startSeconds: 0, endSeconds: 4 },
      { startSeconds: 10 },
    ]);
    // 4, not 10: a trimmed section that stops before the next one starts is a
    // gap in the song, not an error to smooth over.
    expect(spans[0].endSeconds).toBe(4);
  });

  it("carries the repeat counts through untouched", () => {
    expect(
      arrangementFrom([
        { startSeconds: 0, endSeconds: 10, repeats: 4 },
        { startSeconds: 10, endSeconds: 20, repeats: 0 },
      ]).map((s) => s.repeats)
    ).toEqual([4, 0]);
  });

  it("sorts by start, so an unordered list cannot jump backwards", () => {
    const spans = arrangementFrom([
      { startSeconds: 20, endSeconds: 30 },
      { startSeconds: 0, endSeconds: 10 },
      { startSeconds: 10, endSeconds: 20 },
    ]);
    expect(spans.map((s) => s.startSeconds)).toEqual([0, 10, 20]);
  });

  it("drops an inside-out section but keeps the open-ended one", () => {
    const spans = arrangementFrom([
      { startSeconds: 20, endSeconds: 5 },
      { startSeconds: 30 },
    ]);
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ startSeconds: 30, endSeconds: 0 });
  });

  it("survives a cue with no sections", () => {
    expect(arrangementFrom([])).toEqual([]);
  });

  it("does not mutate the list it was given", () => {
    const sections = [{ startSeconds: 20 }, { startSeconds: 0 }];
    arrangementFrom(sections);
    expect(sections.map((s) => s.startSeconds)).toEqual([20, 0]);
  });
});

describe("an open end, once the engine has closed it", () => {
  it("becomes a repeatable span against the file's length", () => {
    // What launch() does before planning: anything still open is closed against
    // the decoded buffer, which is the only place the song's real length lives.
    const spans = arrangementFrom([
      { startSeconds: 0, endSeconds: 10 },
      { startSeconds: 10, repeats: 3 },
    ]);
    const bufferDuration = 40;
    const closed = spans.map((s) => ({
      ...s,
      endSeconds: s.endSeconds > s.startSeconds ? s.endSeconds : bufferDuration,
    }));

    const plan = planArrangement(closed, 0, 0);
    // The final section is 10-40, played 3 times from t=10.
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ looping: true, loopStart: 10, loopEnd: 40 });
    expect(plan[0].when).toBeCloseTo(25, 6); // middle of pass 1 (10-40)
    expect(plan[1].when).toBeCloseTo(85, 6); // middle of pass 3 (70-100)
  });
});
