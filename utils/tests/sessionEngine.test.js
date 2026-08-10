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

function extract(name) {
  const fn = script.match(
    new RegExp(`function ${name}\\([\\s\\S]*?\\r?\\n        \\}`)
  )[0];
  // eslint-disable-next-line no-eval
  return eval(`(${fn})`);
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
