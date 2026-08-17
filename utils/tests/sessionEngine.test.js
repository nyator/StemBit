/**
 * Session engine: grid maths, and the template-literal hazards every engine
 * page in this project is exposed to.
 *
 * The engine is pure JS inside a WebView HTML string, so the scheduling
 * functions are extracted and run directly -- no WebView, no audio hardware.
 * What's tested here is the part that has to be right before anything can be
 * heard: which beat a launch lands on.
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
// \r?\n throughout: git's autocrlf checks these files out with CRLF on Windows,
// and an \n-only pattern silently fails to match there.
const script = source.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];

function sourceOf(name) {
  return script.match(
    new RegExp(`function ${name}\\([\\s\\S]*?\\r?\\n        \\}`)
  )[0];
}

function extract(name) {
  // eslint-disable-next-line no-eval
  return eval(`(${sourceOf(name)})`);
}

/**
 * songSeconds reads the engine's `live` record, so it's built here with one
 * supplied rather than extracted bare -- a closure over a parameter is the
 * closest thing to how it actually runs.
 */
function songSecondsWith(live) {
  return new Function(
    "live",
    `${sourceOf("songSeconds")}; return songSeconds;`
  )(live);
}

describe("session engine page", () => {
  it("keeps its source free of backticks and ${...}", () => {
    // The whole engine lives inside a template literal, so either one ends the
    // string early and takes the page with it. There is no interpolation in
    // this engine at all, which makes the rule simple: neither may appear.
    expect(script).not.toMatch(/`/);
    expect(script).not.toMatch(/\$\{/);
  });

  it("answers a ping, so the app can tell a dead engine from a quiet one", () => {
    expect(script).toMatch(/case "ping"/);
    expect(script).toMatch(/type: "pong"/);
  });
});

describe("launch quantisation", () => {
  const nextBoundary = extract("nextBoundary");

  it("lands on the next bar line from mid-bar", () => {
    // 4/4, quantum of 4 beats. Anywhere inside the first bar goes to beat 4.
    expect(nextBoundary(0.5, 4)).toBe(4);
    expect(nextBoundary(2.0, 4)).toBe(4);
    expect(nextBoundary(3.99, 4)).toBe(4);
  });

  it("skips ahead rather than landing on a line already reached", () => {
    // Exactly on the line is too late to schedule into -- by the time the
    // message crossed the bridge that beat has effectively gone, and a launch
    // scheduled for it would be dropped or fire fractionally late. The next one
    // is the honest answer.
    expect(nextBoundary(4, 4)).toBe(8);
    expect(nextBoundary(0, 4)).toBe(4);
  });

  it("supports the half-bar grid, so a cue can land on 1 or 3", () => {
    // The count a drummer actually gives you in 4/4.
    expect(nextBoundary(0.5, 2)).toBe(2);
    expect(nextBoundary(2.5, 2)).toBe(4);
    expect(nextBoundary(3.1, 2)).toBe(4);
  });

  it("supports a beat grid for the tightest launches", () => {
    expect(nextBoundary(0.2, 1)).toBe(1);
    expect(nextBoundary(6.7, 1)).toBe(7);
  });

  it("never returns a boundary before where it was asked from", () => {
    for (let beat = 0; beat < 16; beat += 0.37) {
      for (const quantum of [1, 2, 4, 8]) {
        expect(nextBoundary(beat, quantum)).toBeGreaterThan(beat);
      }
    }
  });

  it("treats a nonsense quantum as no quantisation rather than looping forever", () => {
    expect(nextBoundary(3.2, 0)).toBe(3.2);
    expect(nextBoundary(3.2, -4)).toBe(3.2);
  });
});

describe("song position", () => {
  // The number the timeline's playhead and the bar counter are both drawn from.
  // It is not "how long has the transport run": a section launch seeks every
  // stem into the middle of the files, and from that moment the two answers
  // differ by however far in the seek went.

  it("has no answer when nothing is sounding", () => {
    expect(songSecondsWith(null)(12.5)).toBeNull();
  });

  it("counts from where the launch seeked to, not from zero", () => {
    // Launched at audio-clock 100, seeking 90 seconds into the song. Two
    // seconds later we are at 0:92 -- not at 0:02, which is what a transport
    // counting from its own start would say.
    const at = songSecondsWith({
      at: 100,
      offset: 90,
      loopStart: 90,
      loopEnd: 120,
      looping: false,
    });
    expect(at(102)).toBeCloseTo(92);
    expect(at(100)).toBeCloseTo(90);
  });

  it("sits at the launch point while the launch is still in the future", () => {
    // Armed launches are scheduled a little ahead of the clock. Until the
    // audio actually starts the playhead belongs on the spot it is about to
    // start from, not somewhere before it.
    const at = songSecondsWith({
      at: 100,
      offset: 90,
      loopStart: 90,
      loopEnd: 120,
      looping: false,
    });
    expect(at(99.8)).toBeCloseTo(90);
  });

  it("wraps within the loop rather than running past its end", () => {
    // A 10-second section on repeat: 15 seconds in is 5 seconds into the
    // second pass, and the playhead has to be back inside the section.
    const at = songSecondsWith({
      at: 0,
      offset: 10,
      loopStart: 10,
      loopEnd: 20,
      looping: true,
    });
    expect(at(9.9)).toBeCloseTo(19.9);
    expect(at(10)).toBeCloseTo(10);
    expect(at(15)).toBeCloseTo(15);
    expect(at(23)).toBeCloseTo(13);
  });

  it("keeps the playhead inside the loop no matter how long it has held", () => {
    const at = songSecondsWith({
      at: 0,
      offset: 30,
      loopStart: 30,
      loopEnd: 38,
      looping: true,
    });
    for (let elapsed = 0; elapsed < 200; elapsed += 0.31) {
      const position = at(elapsed);
      expect(position).toBeGreaterThanOrEqual(30);
      expect(position).toBeLessThan(38);
    }
  });

  it("runs straight past a section end when looping is off", () => {
    // Played straight, a section boundary is something the playhead crosses --
    // the song keeps going into whatever follows.
    const at = songSecondsWith({
      at: 0,
      offset: 10,
      loopStart: 10,
      loopEnd: 20,
      looping: false,
    });
    expect(at(15)).toBeCloseTo(25);
  });
});
