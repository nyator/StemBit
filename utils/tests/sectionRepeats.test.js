/**
 * Section repeat counts: "play this chorus four times, then carry on".
 *
 * Web Audio has no repeat count. An AudioBufferSourceNode either loops forever
 * or not at all, so a count is done by starting the source looping and
 * switching `loop` off partway through the final pass -- after which it plays
 * on past loopEnd into the rest of the file, which is the handover we want.
 *
 * That makes the interesting behaviour a timing decision rather than a value,
 * and none of it is visible from the outside until it is wrong on stage. So
 * `launch` is run here against a stubbed audio graph: the sources record what
 * was done to them, the clock is manual, and the timer is driven by hand.
 *
 * What must hold:
 *   - a section with no count set never loops (the old default was forever)
 *   - a count of N leaves the loop exactly once, during the Nth pass
 *   - the release also clears `live.looping`, or every readout on the screen
 *     stays folded back inside a section the audio has already left
 *   - a stale launch never touches the sources of the one that replaced it
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
// \r?\n: git checks these out with CRLF on Windows and an \n-only pattern
// silently fails to match there.
const script = source.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const launchSource = script.match(
  /function launch\([\s\S]*?\r?\n        \}/
)[0];

const SECONDS_PER_TRACK = 100;

/**
 * A stand-in for the engine's audio graph.
 *
 * Everything `launch` reaches for from its enclosing scope is supplied as a
 * parameter, which is the closest this can get to how it actually runs without
 * a WebView or an audio device.
 */
function harness({ trackCount = 2 } = {}) {
  const sources = [];
  const timers = [];
  const posts = [];

  const state = {
    launchGeneration: 0,
    live: null,
    currentSectionId: null,
    now: 0,
  };

  const makeSource = () => {
    const node = {
      buffer: null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      onended: null,
      connected: false,
      startArgs: null,
      connect() {
        node.connected = true;
      },
      start(...args) {
        node.startArgs = args;
      },
    };
    sources.push(node);
    return node;
  };

  const buffers = {};
  const trackIds = [];
  for (let i = 0; i < trackCount; i++) {
    const id = `t${i}`;
    trackIds.push(id);
    buffers[id] = { duration: SECONDS_PER_TRACK };
  }

  const run = (section, atTime) =>
    new Function(
      "section",
      "atTime",
      "audioContext",
      "buffers",
      "playing",
      "gainForTrack",
      "stopAll",
      "post",
      "startClickGrid",
      "stopTransport",
      "setTimeout",
      "state",
      `
      var launchGeneration = state.launchGeneration;
      var live = state.live;
      var currentSectionId = state.currentSectionId;
      ${launchSource}
      launch(section, atTime);
      state.launchGeneration = launchGeneration;
      state.live = live;
      state.currentSectionId = currentSectionId;
      `
    )(
      section,
      atTime,
      {
        get currentTime() {
          return state.now;
        },
        createBufferSource: makeSource,
      },
      buffers,
      {},
      () => ({}),
      () => {},
      (message) => posts.push(message),
      () => {},
      () => {},
      (fn, delay) => {
        timers.push({ fn, delay });
        return timers.length;
      },
      state
    );

  return { run, sources, timers, posts, state, trackIds };
}

/** A section spanning 10s–18s: an 8-second span, so passes are easy to count. */
const spanSection = (extra) => ({
  sectionId: "chorus",
  tracks: ["t0", "t1"],
  offset: 10,
  endSeconds: 18,
  ...extra,
});

const SPAN = 8;

describe("no count asked for — the timeline's launches are untouched", () => {
  it("still loops when loop is not false", () => {
    const h = harness();
    h.run(spanSection(), 0);
    expect(h.sources.every((s) => s.loop)).toBe(true);
    expect(h.sources[0].loopStart).toBe(10);
    expect(h.sources[0].loopEnd).toBe(18);
    expect(h.timers).toHaveLength(0);
  });

  it("still stops at the section edge when loop is false", () => {
    const h = harness();
    h.run(spanSection({ loop: false }), 0);
    expect(h.sources.every((s) => s.loop)).toBe(false);
    // start(when, offset, duration) — the duration cap is what stops it running
    // on into the next section.
    expect(h.sources[0].startArgs).toEqual([0, 10, SPAN]);
  });
});

describe("a count of one — play it once and carry on", () => {
  it("does not loop, and is not capped at the section edge", () => {
    const h = harness();
    h.run(spanSection({ repeats: 1 }), 0);

    expect(h.sources.every((s) => s.loop)).toBe(false);
    // No third argument: the source runs past the section into the rest of the
    // file, which is the whole difference between this and loop:false.
    expect(h.sources[0].startArgs).toEqual([0, 10]);
    expect(h.timers).toHaveLength(0);
  });

  it("reports live as not looping, so the playhead does not fold back", () => {
    const h = harness();
    h.run(spanSection({ repeats: 1 }), 0);
    expect(h.state.live.looping).toBe(false);
  });
});

describe("a count of zero — hold until something else is hit", () => {
  it("loops with no release timer", () => {
    const h = harness();
    h.run(spanSection({ repeats: 0 }), 0);

    expect(h.sources.every((s) => s.loop)).toBe(true);
    expect(h.state.live.looping).toBe(true);
    expect(h.timers).toHaveLength(0);
  });

  it("never arms an ended handler, because it never ends", () => {
    const h = harness();
    h.run(spanSection({ repeats: 0 }), 0);
    expect(h.sources.every((s) => s.onended == null)).toBe(true);
  });
});

describe("a real count — N passes, then the song carries on", () => {
  it("starts looping and schedules exactly one release", () => {
    const h = harness();
    h.run(spanSection({ repeats: 4 }), 0);

    expect(h.sources.every((s) => s.loop)).toBe(true);
    expect(h.timers).toHaveLength(1);
  });

  it("aims the release at the middle of the final pass", () => {
    const h = harness();
    h.run(spanSection({ repeats: 4 }), 0);

    // Pass 4 runs from 3*SPAN to 4*SPAN. The midpoint is 3.5*SPAN.
    expect(h.timers[0].delay).toBeCloseTo(3.5 * SPAN * 1000, 6);
  });

  it("leaves at least half a pass of slack on either side", () => {
    const h = harness();
    h.run(spanSection({ repeats: 2 }), 0);

    const release = h.timers[0].delay / 1000;
    const finalPassStart = 1 * SPAN;
    const finalPassEnd = 2 * SPAN;
    expect(release).toBeGreaterThan(finalPassStart);
    expect(release).toBeLessThan(finalPassEnd);
    expect(release - finalPassStart).toBeCloseTo(SPAN / 2, 6);
  });

  it("accounts for a launch scheduled into the future", () => {
    const h = harness();
    h.state.now = 2; // context clock already running
    h.run(spanSection({ repeats: 2 }), 5); // launch lands at t=5

    // Release is at 5 + 1.5*SPAN absolute; the delay is measured from now.
    expect(h.timers[0].delay).toBeCloseTo((5 + 1.5 * SPAN - 2) * 1000, 6);
  });

  it("never asks setTimeout for a negative delay", () => {
    const h = harness();
    h.state.now = 900; // clock well past the launch
    h.run(spanSection({ repeats: 2 }), 0);
    expect(h.timers[0].delay).toBe(0);
  });

  it("releases every looping source when it fires", () => {
    const h = harness({ trackCount: 3 });
    h.run(spanSection({ tracks: ["t0", "t1", "t2"], repeats: 4 }), 0);
    expect(h.sources.every((s) => s.loop)).toBe(true);

    h.timers[0].fn();

    expect(h.sources.every((s) => s.loop)).toBe(false);
  });

  it("clears live.looping, so the reported position stops wrapping", () => {
    const h = harness();
    h.run(spanSection({ repeats: 4 }), 0);
    expect(h.state.live.looping).toBe(true);

    h.timers[0].fn();

    expect(h.state.live.looping).toBe(false);
  });

  it("arms an ended handler, since it will run out like a straight play", () => {
    const h = harness();
    h.run(spanSection({ repeats: 4 }), 0);
    expect(typeof h.sources[h.sources.length - 1].onended).toBe("function");
  });
});

describe("a release that outlives its launch", () => {
  it("does not touch the sources of whatever replaced it", () => {
    const h = harness();
    h.run(spanSection({ repeats: 4 }), 0);
    const stale = h.timers[0].fn;
    const firstBatch = h.sources.slice();

    // Another pad is hit before the count runs out.
    h.run(spanSection({ sectionId: "verse", repeats: 0 }), 20);
    const secondBatch = h.sources.slice(firstBatch.length);
    expect(secondBatch.every((s) => s.loop)).toBe(true);

    stale();

    // The replacement is still looping, and the live record still describes it.
    expect(secondBatch.every((s) => s.loop)).toBe(true);
    expect(h.state.live.looping).toBe(true);
  });
});

describe("degenerate spans", () => {
  it("skips the timer for a section with no length", () => {
    const h = harness();
    // An end at or before the start leaves nothing to loop over; boundary falls
    // back to the buffer's own duration.
    h.run(spanSection({ offset: 10, endSeconds: 10, repeats: 4 }), 0);
    expect(h.timers).toHaveLength(1);
    // The span is the rest of the file, not zero, so the delay stays sane.
    expect(h.timers[0].delay).toBeGreaterThan(0);
  });

  it("survives a section whose tracks have no decoded buffers", () => {
    const h = harness();
    expect(() =>
      h.run(spanSection({ tracks: ["missing"], repeats: 4 }), 0)
    ).not.toThrow();
    expect(h.sources).toHaveLength(0);
    // Nothing looping means nothing to release.
    expect(h.timers).toHaveLength(0);
  });
});
