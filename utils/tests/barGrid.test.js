/**
 * The bar grid the timeline snaps section edges to.
 *
 * Trimming a section by hand meant landing it on whatever second the finger
 * happened to be over, which is never where a section actually starts — a
 * chorus begins on a downbeat, and a boundary two hundred milliseconds early
 * loops back over the tail of the verse. Snapping fixes that, but only if it
 * stays magnetic: quantising outright would make the positions between two grid
 * lines impossible to express, and a song that changes on the "and" of four
 * would become untrimmable. So these check both halves — that a near-miss is
 * pulled onto the line, and that a deliberate placement well away from one is
 * left exactly where it was put.
 */

const {
  REPEAT_CHOICES,
  barAt,
  barLabel,
  barSpan,
  gridStepSeconds,
  repeatChoiceLabel,
  repeatDescription,
  repeatLabel,
  secondsPerBar,
  secondsPerBeat,
  snapSeconds,
} = require("../../constants/barGrid");

// 120bpm in 4/4: one beat is 0.5s, one bar is 2s. Every number below is
// readable against that.
const BPM = 120;
const BAR = 2;

describe("bar arithmetic", () => {
  it("measures a bar and a beat from the tempo", () => {
    expect(secondsPerBar(120)).toBe(2);
    expect(secondsPerBeat(120)).toBe(0.5);
    expect(secondsPerBar(60)).toBe(4);
  });

  it("falls back to 120 rather than dividing by zero", () => {
    expect(secondsPerBar(0)).toBe(2);
    expect(secondsPerBar(-30)).toBe(2);
  });

  it("reports a fractional bar, so callers can round it their own way", () => {
    expect(barAt(0, BPM)).toBe(0);
    expect(barAt(BAR, BPM)).toBe(1);
    expect(barAt(BAR * 2.5, BPM)).toBe(2.5);
  });

  it("labels bars the way a musician counts them, from one", () => {
    expect(barLabel(0, BPM)).toBe(1);
    expect(barLabel(BAR * 4, BPM)).toBe(5);
  });
});

describe("barSpan — how long a section is, for the readout", () => {
  it("reports a whole number when the span landed on the grid", () => {
    expect(barSpan(0, BAR * 8, BPM)).toBe(8);
    expect(barSpan(BAR * 4, BAR * 12, BPM)).toBe(8);
  });

  it("still reads as whole when snapping left floating-point dust", () => {
    // What Math.round(x / step) * step actually returns for bar 8.
    const snapped = Math.round((BAR * 8 + 0.0001) / BAR) * BAR;
    expect(barSpan(0, snapped, BPM)).toBe(8);
  });

  it("admits a span that was deliberately placed off the grid", () => {
    expect(barSpan(0, BAR * 8.5, BPM)).toBe(8.5);
  });

  it("is zero for an inside-out or empty span rather than negative", () => {
    expect(barSpan(BAR * 4, BAR * 2, BPM)).toBe(0);
    expect(barSpan(BAR * 4, BAR * 4, BPM)).toBe(0);
  });
});

describe("gridStepSeconds — the finest division worth aiming at", () => {
  it("offers beats when the view is zoomed far enough in", () => {
    // 200px per second: a beat is 100px apart. Easily aimable.
    expect(gridStepSeconds(BPM, 200)).toBe(secondsPerBeat(BPM));
  });

  it("widens to bars when beats get too close together", () => {
    // 20px/s puts beats 10px apart — under the threshold — but bars at 40px.
    expect(gridStepSeconds(BPM, 20)).toBe(BAR);
  });

  it("widens to phrases when even bars are too close", () => {
    // 2px/s: a bar is 4px. The step has to climb to 8 bars (32px) to clear 18.
    expect(gridStepSeconds(BPM, 2)).toBe(BAR * 8);
  });

  it("never returns zero or a non-finite step for a degenerate view", () => {
    for (const px of [0.0001, 1, 1000]) {
      const step = gridStepSeconds(BPM, px);
      expect(step).toBeGreaterThan(0);
      expect(Number.isFinite(step)).toBe(true);
    }
  });
});

describe("snapSeconds — magnetic, not quantised", () => {
  // 100px per second at 120bpm: beats are 50px apart, so the grid is beats and
  // the 12px catchment is 0.12s either side of one.
  const PX = 100;

  it("pulls a near-miss onto the line", () => {
    expect(snapSeconds(2.05, BPM, PX)).toBeCloseTo(2, 6);
    expect(snapSeconds(1.94, BPM, PX)).toBeCloseTo(2, 6);
  });

  it("leaves a position that was placed well away from a line", () => {
    // 2.25s is a quarter-second off the nearest beat — 25px, past the catchment.
    expect(snapSeconds(2.25, BPM, PX)).toBe(2.25);
  });

  it("keeps the off-grid placements reachable at every zoom", () => {
    // The point of magnetism: for any scale there is somewhere between two
    // lines that survives untouched, so no position is unexpressible.
    for (const px of [20, 100, 400]) {
      const step = gridStepSeconds(BPM, px);
      const between = step * 3 + step / 2;
      expect(snapSeconds(between, BPM, px)).toBeCloseTo(between, 6);
    }
  });

  it("snaps to phrases when zoomed out, where bars are indistinguishable", () => {
    // 2px/s -> an 8-bar step. Bar 9 (16s) is the nearest line to 15.8s.
    expect(snapSeconds(15.8, BPM, 2)).toBeCloseTo(16, 6);
  });

  it("takes a position just after zero onto bar 1 rather than before it", () => {
    // 100px/s, beat grid: 0.02s is 2px from the start, well inside the
    // catchment, so it lands exactly on 0 rather than near it.
    expect(snapSeconds(0.02, BPM, PX)).toBe(0);
    expect(snapSeconds(0, BPM, PX)).toBe(0);
  });

  it("never hands back a negative offset, which the engine cannot seek to", () => {
    // Defensive: the timeline clamps its own drags to the song, so a negative
    // should not arrive. If one ever does it must not become a negative buffer
    // offset — the engine reads that as "play from the end".
    expect(snapSeconds(-0.05, BPM, PX)).toBe(0);
    expect(snapSeconds(-4, BPM, PX)).toBe(0);
  });

  it("passes the position straight through when it cannot form a grid", () => {
    expect(snapSeconds(3.7, 0, PX)).toBe(3.7);
    expect(snapSeconds(3.7, BPM, 0)).toBe(3.7);
    expect(snapSeconds(3.7, BPM, -5)).toBe(3.7);
    expect(snapSeconds(NaN, BPM, PX)).toBeNaN();
  });

  it("is stable: snapping an already-snapped position changes nothing", () => {
    const once = snapSeconds(2.05, BPM, PX);
    expect(snapSeconds(once, BPM, PX)).toBe(once);
  });
});


/**
 * The section pad's repeat count.
 *
 * Nine values, picked from a list rather than cycled through — a ladder of
 * doublings could not express a three-times chorus, and a tap-to-advance badge
 * put "8" seven presses away from "1" on a chip inside the button that starts
 * the song. What these check is that the list covers what a band actually gets
 * asked for, and that every count can say what it does in all three places it
 * has to: the badge, the picker, and out loud.
 */
describe("REPEAT_CHOICES — what a section can be asked to do", () => {
  it("offers every count from one to eight, not just the doublings", () => {
    expect([...REPEAT_CHOICES]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
  });

  it("puts forever last, where it reads as the exception it is", () => {
    expect(REPEAT_CHOICES[REPEAT_CHOICES.length - 1]).toBe(0);
  });

  it("has no duplicates, so nothing in the picker is unreachable", () => {
    expect(new Set(REPEAT_CHOICES).size).toBe(REPEAT_CHOICES.length);
  });
});

describe("repeatLabel — what the badge shows", () => {
  it("draws the ordinary once-through as a dash, not as x1", () => {
    // Labelling the default would make every pad in the grid look configured,
    // and the eye would have to read all of them to find the one that isn't.
    expect(repeatLabel(1)).toBe("–");
    expect(repeatLabel(undefined)).toBe("–");
  });

  it("counts the rest", () => {
    expect(repeatLabel(2)).toBe("×2");
    expect(repeatLabel(5)).toBe("×5");
    expect(repeatLabel(8)).toBe("×8");
  });

  it("draws forever as an infinity sign", () => {
    expect(repeatLabel(0)).toBe("∞");
  });
});

describe("repeatChoiceLabel — what the picker shows", () => {
  it("spells out every option, the default included", () => {
    // Unlike the badge, nothing here is hidden: the list is being read to make
    // a choice, so "1" has to be as visible as "5".
    expect(repeatChoiceLabel(1)).toBe("1");
    expect(repeatChoiceLabel(5)).toBe("5");
    expect(repeatChoiceLabel(0)).toBe("∞");
  });

  it("gives every choice a face", () => {
    for (const choice of REPEAT_CHOICES) {
      expect(repeatChoiceLabel(choice).length).toBeGreaterThan(0);
    }
  });
});

describe("repeatDescription — the count as a sentence", () => {
  it("says what happens after the repeats, which is the non-obvious half", () => {
    expect(repeatDescription(1)).toBe("Plays once, then the song carries on");
    expect(repeatDescription(4)).toBe(
      "Plays 4 times, then the song carries on"
    );
  });

  it("treats an unset count as once", () => {
    expect(repeatDescription(undefined)).toBe(repeatDescription(1));
  });

  it("describes forever as waiting for you rather than as a number", () => {
    expect(repeatDescription(0)).toBe("Repeats until you hit something else");
  });

  it("describes every choice without saying 'undefined' or 'NaN'", () => {
    for (const choice of REPEAT_CHOICES) {
      const said = repeatDescription(choice);
      expect(said).not.toMatch(/undefined|NaN/);
      expect(said.length).toBeGreaterThan(0);
    }
  });
});
