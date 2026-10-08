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
 * The inputs are the LOOP's position, not the click grid's: `phase` is where
 * the loop stands (0..1) and `loopBeats` how many of its own beats it holds.
 * That is the whole point of the function -- it used to read the grid cursor,
 * and once the subdivision could tick that grid at 2x, "the next accent" and
 * "the next bar line" stopped being the same instant. A cue is quantised to the
 * music, so it is measured against the music.
 */
const nextDownbeat = ({
  now = 10,
  phase = 0,
  loopBeats = 8,
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
      var active = state.active ? { loopBeats: state.loopBeats } : null;
      var audioContext = { currentTime: state.now };
      var MIN_SCHEDULE_LEAD = 0.002;
      function musicalBeatSeconds() { return state.beatSeconds; }
      function barBeats() { return state.barBeats; }
      function phaseAt() { return state.phase; }
      ${fnSource}
      return nextDownbeatTime();
    `
  )({ now, phase, loopBeats, beatSeconds, barBeats, playing, active });

/** Phase of a loop `loopBeats` long, standing `beat` beats in. */
const atBeat = (beat, loopBeats = 8) => beat / loopBeats;

describe("nextDownbeatTime — where a queued cue lands", () => {
  it("lands on the bar line the loop is about to reach", () => {
    // A tenth of a beat short of beat 4 of an 8-beat 4/4 loop: 0.05s away at
    // half a second a beat.
    expect(nextDownbeat({ phase: atBeat(3.9) })).toBeCloseTo(10 + 0.05, 6);
  });

  it("waits out the rest of the bar from anywhere inside it", () => {
    // 4/4 at 120: half a second a beat. One beat in, three left to run.
    expect(nextDownbeat({ phase: atBeat(1) })).toBeCloseTo(10 + 1.5, 6);
    expect(nextDownbeat({ phase: atBeat(2) })).toBeCloseTo(10 + 1.0, 6);
    expect(nextDownbeat({ phase: atBeat(3) })).toBeCloseTo(10 + 0.5, 6);
  });

  it("counts the bar in the loop's own meter", () => {
    // 3/4: one beat in, two left rather than three.
    expect(
      nextDownbeat({ phase: atBeat(1, 6), loopBeats: 6, barBeats: 3 })
    ).toBeCloseTo(10 + 1.0, 6);
  });

  it("takes the bar after the one it is standing on", () => {
    // Exactly on a bar line, which is unusable: by the time anything reaches
    // the audio clock the instant has gone. The next one is a whole bar away.
    expect(nextDownbeat({ phase: atBeat(4) })).toBeCloseTo(10 + 2.0, 6);
  });

  it("leaves room to schedule rather than landing on the instant", () => {
    const at = nextDownbeat({ phase: 0 });
    expect(at).toBeGreaterThan(10 + 0.002);
  });

  /**
   * The regression this function was rewritten for.
   *
   * The subdivision ticks the click grid at 0.5x, 1x or 2x, and the old
   * implementation read its cursor -- so at 2x it returned the next ACCENT,
   * which is half a bar early, and a queued cue swapped mid-bar. Reading the
   * loop's own position instead means the answer cannot move: none of the
   * inputs here have anything to do with the click.
   */
  it("is unmoved by the subdivision", () => {
    const answers = [0.5, 1, 2].map(() =>
      // Nothing in the signature to vary: the feel is not an input any more,
      // which is the point. Same state, same answer, whatever the click does.
      nextDownbeat({ phase: atBeat(1) })
    );
    expect(new Set(answers).size).toBe(1);
    expect(answers[0]).toBeCloseTo(10 + 1.5, 6);
  });

  it("has nothing to answer when the loop isn't running", () => {
    expect(nextDownbeat({ playing: false })).toBeNull();
    expect(nextDownbeat({ active: false })).toBeNull();
  });

  it("has nothing to answer at a tempo that yields no beat length", () => {
    expect(nextDownbeat({ beatSeconds: 0 })).toBeNull();
  });

  it("has nothing to answer for a loop with no beats in it", () => {
    expect(nextDownbeat({ loopBeats: 0 })).toBeNull();
  });
});
