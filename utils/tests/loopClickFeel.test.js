/**
 * Tests for the loop click's subdivision (constants/loopEngine.ts).
 *
 * The subdivision moves the CLICK and nothing else: the loop's playback rate,
 * its buffer and its phase are all untouched, so half and double time are a
 * re-timing of the click and the beat dots rather than a second tempo control.
 * (Folding it into the rate is what it used to do, and that made it an exact
 * duplicate of the BPM dial.)
 *
 * What that leaves to get right is the accent. The grid ticks at the
 * subdivision and barBeats() ticks of it make one accent cycle -- the same
 * arrangement the metronome uses, where double time doubles the click rate and
 * still accents every fourth click. Get it wrong and 2x on a 4/4 loop gives one
 * accent stranded in eight clicks instead of two.
 *
 * Extracted from the engine source the way the other engine tests do it.
 */

const fs = require("fs");
const path = require("path");

const ENGINE_PATH = path.join(__dirname, "..", "..", "constants", "loopEngine.ts");

// \r?\n throughout: git checks this out with CRLF on Windows and an \n-only
// pattern silently fails to match there.
const script = fs
  .readFileSync(ENGINE_PATH, "utf8")
  .match(/<script id="engine">([\s\S]*?)<\/script>/)[1];

const grab = (name) =>
  script.match(new RegExp(`function ${name}[\\s\\S]*?\\r?\\n        \\}`))[0];

const musicalBeatSecondsSrc = grab("musicalBeatSeconds");
const beatSecondsSrc = grab("beatSeconds");
const advanceGridSrc = grab("advanceGrid");

/**
 * Run the real grid forward and report what each tick sounds.
 *
 * "a" is the accent voice, "b" the plain one -- scheduleClick picks between
 * them on `beatIndex === 0`, so the index the grid hands out is the whole of
 * the decision and is what this checks.
 */
const ticks = ({ feel = 1, barBeats = 4, count = 8, nativeBpm = 120, rate = 1 }) =>
  // eslint-disable-next-line no-new-func
  new Function(
    "state",
    `
      var active = { nativeBpm: state.nativeBpm };
      var currentRate = state.rate;
      var clickFeel = state.feel;
      function barBeats() { return state.barBeats; }
      ${musicalBeatSecondsSrc}
      ${beatSecondsSrc}
      var gridNextTime = 0;
      var gridBeatIndex = 0;
      ${advanceGridSrc}

      var beatSec = beatSeconds();
      var out = [];
      for (var i = 0; i < state.count; i++) {
        out.push({
          sound: gridBeatIndex === 0 ? "a" : "b",
          // In the loop's own beats, so a tick can be placed against the music.
          musicalBeat: gridNextTime / (60 / (state.nativeBpm * state.rate)),
        });
        advanceGrid(beatSec);
      }
      return out;
    `
  )({ feel, barBeats, count, nativeBpm, rate });

const pattern = (options) => ticks(options).map((t) => t.sound).join("");

describe("loop click subdivision", () => {
  it("accents every bar at normal speed", () => {
    expect(pattern({ feel: 1, count: 8 })).toBe("abbbabbb");
  });

  /** The bug this was written for: one accent in eight instead of two. */
  it("accents every fourth click at double time, not once a bar", () => {
    expect(pattern({ feel: 2, count: 8 })).toBe("abbbabbb");
  });

  it("accents every fourth click at half time", () => {
    expect(pattern({ feel: 0.5, count: 8 })).toBe("abbbabbb");
  });

  it("counts the accent cycle in the loop's own meter", () => {
    expect(pattern({ feel: 1, barBeats: 3, count: 6 })).toBe("abbabb");
    expect(pattern({ feel: 2, barBeats: 3, count: 6 })).toBe("abbabb");
  });

  it("spaces the clicks by the subdivision", () => {
    // 120 BPM: half a second a beat, so 2x is a quarter and 0.5x is a whole.
    const spacing = (feel) => {
      const [first, second] = ticks({ feel, count: 2 });
      return second.musicalBeat - first.musicalBeat;
    };
    expect(spacing(1)).toBeCloseTo(1, 6);
    expect(spacing(2)).toBeCloseTo(0.5, 6);
    expect(spacing(0.5)).toBeCloseTo(2, 6);
  });

  it("puts double time's accents on real beats of the bar", () => {
    // Two accents per 4/4 bar at 2x, on beats 1 and 3 -- not adrift between.
    const accents = ticks({ feel: 2, count: 8 })
      .filter((t) => t.sound === "a")
      .map((t) => t.musicalBeat);
    expect(accents).toEqual([0, 2]);
  });

  it("leaves the music's own beat alone whatever the click does", () => {
    // musicalBeatSeconds is what bar lines and cue swaps are measured in, and
    // the subdivision must not reach it. 120 BPM is half a second a beat, feel
    // or no feel.
    const musical = (feel) =>
      // eslint-disable-next-line no-new-func
      new Function(
        "state",
        `
          var active = { nativeBpm: 120 };
          var currentRate = 1;
          var clickFeel = state.feel;
          ${musicalBeatSecondsSrc}
          return musicalBeatSeconds();
        `
      )({ feel });

    expect(musical(0.5)).toBeCloseTo(0.5, 6);
    expect(musical(1)).toBeCloseTo(0.5, 6);
    expect(musical(2)).toBeCloseTo(0.5, 6);
  });
});
