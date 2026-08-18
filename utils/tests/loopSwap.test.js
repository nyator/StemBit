/**
 * Tests for nextDownbeatTime (constants/loopEngine.ts) — where a queued cue
 * lands.
 *
 * This is the whole of the quantised cue swap that can be reasoned about
 * without Web Audio: given the beat grid's cursor, work out the audio-clock
 * time of the next bar line. Everything after it is scheduling, which only the
 * engine's own clock can do.
 *
 * Extracted from the engine source the same way the other engine tests do it,
 * with its module-level dependencies supplied per case so each one can describe
 * a different position in the bar.
 */

const fs = require("fs");
const path = require("path");

const ENGINE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "constants",
  "loopEngine.ts"
);

// \r?\n throughout: git checks this out with CRLF on Windows and an \n-only
// pattern silently fails to match there.
const script = fs
  .readFileSync(ENGINE_PATH, "utf8")
  .match(/<script id="engine">([\s\S]*?)<\/script>/)[1];

const fnSource = script.match(
  /function nextDownbeatTime[\s\S]*?\r?\n        \}/
)[0];

/**
 * Run it against one arrangement of engine state.
 *
 * `gridNextTime` is the audio time of the next beat the grid will fire and
 * `gridBeatIndex` is which beat of the bar that is -- the pair the click
 * scheduler keeps.
 */
const nextDownbeat = ({
  now = 10,
  gridNextTime = 10.25,
  gridBeatIndex = 0,
  beatSeconds = 0.5,
  barBeats = 4,
  playing = true,
  active = true,
}) =>
  // eslint-disable-next-line no-new-func
  new Function(
    "state",
    `
      var playing = state.playing ? {} : null;
      var active = state.active ? {} : null;
      var gridNextTime = state.gridNextTime;
      var gridBeatIndex = state.gridBeatIndex;
      var audioContext = { currentTime: state.now };
      var MIN_SCHEDULE_LEAD = 0.002;
      function beatSeconds() { return state.beatSeconds; }
      function barBeats() { return state.barBeats; }
      ${fnSource}
      return nextDownbeatTime();
    `
  )({ now, gridNextTime, gridBeatIndex, beatSeconds, barBeats, playing, active });

describe("nextDownbeatTime — where a queued cue lands", () => {
  it("is the next beat itself when that beat is the downbeat", () => {
    // Nothing to wait through: the grid's next beat IS beat 1 of the bar.
    expect(nextDownbeat({ gridNextTime: 10.25, gridBeatIndex: 0 })).toBeCloseTo(
      10.25,
      6
    );
  });

  it("waits out the rest of the bar from anywhere inside it", () => {
    // 4/4 at 120: half a second a beat. On beat 2, three beats left to run.
    expect(nextDownbeat({ gridNextTime: 10.25, gridBeatIndex: 1 })).toBeCloseTo(
      10.25 + 1.5,
      6
    );
    expect(nextDownbeat({ gridNextTime: 10.25, gridBeatIndex: 2 })).toBeCloseTo(
      10.25 + 1.0,
      6
    );
    expect(nextDownbeat({ gridNextTime: 10.25, gridBeatIndex: 3 })).toBeCloseTo(
      10.25 + 0.5,
      6
    );
  });

  it("counts the bar in the loop's own meter", () => {
    // 3/4: on beat 2, two beats left rather than three.
    expect(
      nextDownbeat({ gridNextTime: 10.25, gridBeatIndex: 1, barBeats: 3 })
    ).toBeCloseTo(10.25 + 1.0, 6);
  });

  it("never returns a boundary that has already gone by", () => {
    // The press landed so late in the bar that the downbeat is now behind us --
    // scheduling into it would be dropped by Web Audio and the cue would never
    // sound. The following bar is the answer instead.
    const at = nextDownbeat({
      now: 12,
      gridNextTime: 10.25,
      gridBeatIndex: 0,
      beatSeconds: 0.5,
      barBeats: 4,
    });
    expect(at).toBeGreaterThan(12);
    // Still ON the grid: a whole number of bars past where it started.
    expect(((at - 10.25) / 2) % 1).toBeCloseTo(0, 6);
  });

  it("leaves room to schedule rather than landing on the instant", () => {
    // A boundary exactly at `now` is already unusable by the time anything is
    // handed to the audio clock.
    const at = nextDownbeat({ now: 10.25, gridNextTime: 10.25, gridBeatIndex: 0 });
    expect(at).toBeGreaterThan(10.25);
  });

  it("has nothing to answer when the loop isn't running", () => {
    expect(nextDownbeat({ playing: false })).toBeNull();
    expect(nextDownbeat({ active: false })).toBeNull();
  });

  it("has nothing to answer at a tempo that yields no beat length", () => {
    expect(nextDownbeat({ beatSeconds: 0 })).toBeNull();
  });
});
