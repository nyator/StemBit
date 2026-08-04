/**
 * Tests for the parts of loop importing that decide what a user's file
 * actually loops:
 *
 *   - resolveRegion  (constants/loopEngine.ts) — whether a trim the app sent is
 *     used, clamped, or thrown away in favour of the automatic loop points.
 *   - analyzePeaks   (constants/loopEngine.ts) — the waveform the trim handles
 *     are dragged against.
 *   - suggestLoopTempo (constants/loops.ts) — the opening tempo guess.
 *
 * The first two live inside the engine's WebView HTML, so they're extracted from
 * the source the same way loopStretch.test.js extracts the stretcher: they're
 * plain functions over plain data, and none of this needs a WebView.
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

// \r?\n throughout: git checks these files out with CRLF on Windows, and an
// \n-only pattern silently fails to match there.
function extractFromEngine(pattern, preamble = "") {
  const ts = fs.readFileSync(ENGINE_PATH, "utf8");
  const script = ts.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
  const fn = script.match(pattern)[0];
  // eslint-disable-next-line no-eval
  return eval(`(function () { ${preamble}\n${fn}\nreturn ${
    fn.match(/function (\w+)/)[1]
  }; })()`);
}

describe("the page the engine actually renders", () => {
  // Built, not read: this is the artifact the WebView is handed. Everything below
  // is a failure that ships silently otherwise -- TypeScript never looks inside a
  // template literal, and a dead engine looks like an app that just stopped
  // detecting tempo or stopped playing, with no build error anywhere.
  const { buildLoopEngineHtml } = require("../../constants/loopEngine");
  const html = buildLoopEngineHtml();
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(
    (match) => match[1]
  );

  it("renders exactly two scripts: the detector, then the engine", () => {
    expect(scripts).toHaveLength(2);
    expect(html).toContain('<script id="engine">');
  });

  it("compiles both of them as JavaScript", () => {
    // Compiled, not run. A syntax error in either -- a stray backtick in a comment
    // closing the literal early has done it three times -- leaves the page with no
    // engine at all.
    scripts.forEach((script) => {
      expect(() => new Function(script)).not.toThrow();
    });
  });

  it("puts the detector on the page before the engine looks for it", () => {
    // This file has been rolled back once by an editor holding a stale buffer,
    // taking the detector's injection with it. Everything still compiled; tempo
    // detection just silently returned nothing for every file. Hence naming both
    // halves of the handshake here.
    expect(scripts[0]).toContain("window.bpmAnalyzer = module.exports");
    expect(scripts[0]).toContain("analyzeFullBuffer");
    expect(scripts[1]).toContain("window.bpmAnalyzer");
    expect(scripts[1]).toMatch(/analyzeFullBuffer\(\s*region/);
    expect(html.indexOf("window.bpmAnalyzer = module.exports")).toBeLessThan(
      html.indexOf('<script id="engine">')
    );
  });

  it("has no hand-written tempo detector left in it", () => {
    // Detection is the library's job now (see utils/tests/loopTempo.test.js). If
    // these come back, something has been reverted rather than written.
    expect(scripts[1]).not.toMatch(/function (onsetEnvelope|gridScore|pickOnsets)/);
  });

  it("keeps the engine's own source free of backticks and ${...}", () => {
    // The detector's bundle has plenty of both, which is exactly why it's embedded
    // via JSON.stringify. The engine's own code is inside the template literal, so
    // for it they're fatal.
    //
    // One interpolation is deliberate and named below: the silent-mode keep-alive,
    // shared verbatim with the metronome engine. Naming it rather than loosening
    // the pattern means a stray ${...} anywhere else still fails here, and the
    // injected source is held to the same rule by the test after this one.
    const engineSource = fs
      .readFileSync(ENGINE_PATH, "utf8")
      .match(/<script id="engine">([\s\S]*?)<\/script>/)[1]
      .replace("${SILENT_MODE_KEEP_ALIVE_SOURCE}", "");
    expect(engineSource).not.toMatch(/`/);
    expect(engineSource).not.toMatch(/\$\{/);
  });

  it("keeps the injected keep-alive source free of backticks and ${...} too", () => {
    // It lands inside the same template literal, so it carries the same hazard --
    // and being in another file is exactly how it would get edited without anyone
    // remembering that.
    const {
      SILENT_MODE_KEEP_ALIVE_SOURCE,
    } = require("../../constants/silentModeKeepAlive");
    expect(SILENT_MODE_KEEP_ALIVE_SOURCE).not.toMatch(/`/);
    expect(SILENT_MODE_KEEP_ALIVE_SOURCE).not.toMatch(/\$\{/);
    // It has to actually reach the page: the engine calls startKeepAlive() on
    // play, and a missing definition is a ReferenceError that stops playback
    // outright rather than merely leaving the silent switch in charge.
    expect(scripts[1]).toContain("function startKeepAlive");
    expect(scripts[1]).toContain("function stopKeepAlive");
  });
});

const resolveRegion = extractFromEngine(
  /function resolveRegion[\s\S]*?\r?\n        \}/,
  // The one constant it closes over, read from the engine so the test can't
  // drift from it.
  (() => {
    const ts = fs.readFileSync(ENGINE_PATH, "utf8");
    return ts.match(/var MIN_LOOP_SECONDS = [\d.]+;/)[0];
  })()
);

const analyzePeaks = extractFromEngine(
  /function analyzePeaks[\s\S]*?\r?\n        \}/,
  (() => {
    const ts = fs.readFileSync(ENGINE_PATH, "utf8");
    return [
      ts.match(/var PEAK_BUCKETS = \d+;/)[0],
      ts.match(/var PEAK_SAMPLES_PER_BUCKET = \d+;/)[0],
    ].join("\n");
  })()
);

const { suggestLoopTempo } = require("../../constants/loops");

// A stand-in for a decoded AudioBuffer: only the four members the engine
// touches. `fill` is called per frame index so a test can shape the audio.
function fakeBuffer({ frames, sampleRate = 48000, channels = 1, fill }) {
  const data = [];
  for (let c = 0; c < channels; c++) {
    const channel = new Float32Array(frames);
    for (let i = 0; i < frames; i++) channel[i] = fill ? fill(i, c) : 0;
    data.push(channel);
  }
  return {
    length: frames,
    duration: frames / sampleRate,
    sampleRate,
    numberOfChannels: channels,
    getChannelData: (index) => data[index],
  };
}

const entryFor = (buffer, loopStart, loopEnd) => ({
  buffer,
  loopStart,
  loopEnd,
  nativeBpm: 0,
});

describe("resolveRegion — which region an imported loop plays", () => {
  const buffer = fakeBuffer({ frames: 48000 * 10 }); // 10 seconds
  const entry = entryFor(buffer, 0.5, 4.5); // what the auto-trim found

  it("uses an explicit trim, which is the user's own edit", () => {
    expect(resolveRegion(entry, 2, 6)).toEqual({ start: 2, end: 6 });
  });

  it("keeps a trim that runs past the end of the file inside it", () => {
    // A trim can outlive its file: the tempo/bar snap extends the end, and the
    // last bar of a file may be a few samples short.
    expect(resolveRegion(entry, 8, 12)).toEqual({ start: 8, end: 10 });
    expect(resolveRegion(entry, -3, 2)).toEqual({ start: 0, end: 2 });
  });

  it("falls back to the automatic points rather than looping a sliver", () => {
    // Inverted, empty, and far-too-short trims are all mistakes, not
    // instructions — looping them would produce a click or silence.
    expect(resolveRegion(entry, 6, 2)).toEqual({ start: 0.5, end: 4.5 });
    expect(resolveRegion(entry, 3, 3)).toEqual({ start: 0.5, end: 4.5 });
    expect(resolveRegion(entry, 3, 3.01)).toEqual({ start: 0.5, end: 4.5 });
  });

  it("falls back when only one edge is given, or neither", () => {
    expect(resolveRegion(entry, 2, undefined)).toEqual({ start: 0.5, end: 4.5 });
    expect(resolveRegion(entry, undefined, undefined)).toEqual({
      start: 0.5,
      end: 4.5,
    });
  });
});

describe("analyzePeaks — the waveform behind the trim handles", () => {
  it("returns one value per bucket, each a 0–1 amplitude", () => {
    const buffer = fakeBuffer({
      frames: 48000 * 4,
      fill: (i) => Math.sin(i / 40) * 0.8,
    });
    const peaks = analyzePeaks(buffer, 240);

    expect(peaks).toHaveLength(240);
    peaks.forEach((peak) => {
      expect(peak).toBeGreaterThan(0);
      expect(peak).toBeLessThanOrEqual(1);
    });
  });

  it("shows where the audio is, so silence reads as silence", () => {
    // Loud for the middle half only — the shape the eye has to be able to see
    // to place a trim at all.
    const frames = 48000 * 4;
    const buffer = fakeBuffer({
      frames,
      fill: (i) => (i > frames * 0.25 && i < frames * 0.75 ? 0.9 : 0),
    });
    const peaks = analyzePeaks(buffer, 100);

    expect(peaks[5]).toBe(0);
    expect(peaks[95]).toBe(0);
    expect(peaks[50]).toBeCloseTo(0.9, 2);
  });

  it("takes the louder channel, so a one-sided stereo file still draws", () => {
    const buffer = fakeBuffer({
      frames: 48000,
      channels: 2,
      fill: (i, channel) => (channel === 1 ? 0.7 : 0),
    });
    expect(analyzePeaks(buffer, 20).every((peak) => peak > 0.6)).toBe(true);
  });

  it("never asks for more buckets than the file has frames", () => {
    const buffer = fakeBuffer({ frames: 12, fill: () => 0.5 });
    expect(analyzePeaks(buffer, 480)).toHaveLength(12);
  });
});

describe("analyzePeaks over a window — what the trimmer's zoom draws", () => {
  const SAMPLE_RATE = 48000;

  it("draws only the frames asked for", () => {
    // Loud in the second half only. A window over the first half must come back
    // silent, or the zoom would be showing audio from somewhere else.
    const frames = SAMPLE_RATE * 4;
    const buffer = fakeBuffer({
      frames,
      fill: (i) => (i > frames / 2 ? 0.8 : 0),
    });

    const firstHalf = analyzePeaks(buffer, 100, 0, frames / 2);
    const secondHalf = analyzePeaks(buffer, 100, frames / 2, frames);

    expect(firstHalf).toHaveLength(100);
    expect(Math.max(...firstHalf)).toBe(0);
    expect(Math.min(...secondHalf.slice(2))).toBeCloseTo(0.8, 2);
  });

  it("resolves a window far finer than the same buckets over the whole file", () => {
    // The point of zooming. A 20ms click in a 10-second file is a fraction of one
    // bucket in the overview -- its exact position is unreadable -- but fills
    // several buckets in a 1-second window, which is what makes it possible to put
    // an edge on the front of it.
    const frames = SAMPLE_RATE * 10;
    const clickAt = SAMPLE_RATE * 5;
    const clickFrames = Math.round(SAMPLE_RATE * 0.02);
    const buffer = fakeBuffer({
      frames,
      fill: (i) => (i >= clickAt && i < clickAt + clickFrames ? 0.9 : 0),
    });

    const overview = analyzePeaks(buffer, 480);
    const zoomed = analyzePeaks(
      buffer,
      480,
      clickAt - SAMPLE_RATE * 0.5,
      clickAt + SAMPLE_RATE * 0.5
    );

    const loudBuckets = (peaks) => peaks.filter((peak) => peak > 0.5).length;
    expect(loudBuckets(overview)).toBe(1);
    expect(loudBuckets(zoomed)).toBeGreaterThan(5);
    // And it's where it should be: halfway through the window.
    const middle = zoomed.findIndex((peak) => peak > 0.5) / zoomed.length;
    expect(middle).toBeGreaterThan(0.45);
    expect(middle).toBeLessThan(0.55);
  });

  it("clamps a window that runs past either end of the file", () => {
    const frames = SAMPLE_RATE;
    const buffer = fakeBuffer({ frames, fill: () => 0.5 });
    expect(analyzePeaks(buffer, 50, -SAMPLE_RATE, frames * 5)).toHaveLength(50);
  });

  it("returns nothing for an inside-out or empty window", () => {
    const buffer = fakeBuffer({ frames: SAMPLE_RATE, fill: () => 0.5 });
    expect(analyzePeaks(buffer, 50, 1000, 1000)).toEqual([]);
    expect(analyzePeaks(buffer, 50, 2000, 1000)).toEqual([]);
  });
});

describe("suggestLoopTempo — the opening tempo guess", () => {
  const range = { minBpm: 20, maxBpm: 240 };

  it("reads a two-second 4/4 region as one bar at 120", () => {
    expect(suggestLoopTempo(2, 4, range)).toEqual({ bars: 1, bpm: 120 });
  });

  it("prefers the bar count that lands on a playable tempo", () => {
    // 8s could be 1 bar at 30 or 8 bars at 240; 4 bars at 120 is the reading a
    // musician would make.
    expect(suggestLoopTempo(8, 4, range)).toEqual({ bars: 4, bpm: 120 });
    expect(suggestLoopTempo(4, 4, range)).toEqual({ bars: 2, bpm: 120 });
  });

  it("counts bars in the loop's own time signature", () => {
    // Three beats to the bar: 3s is one bar at 60, or two at 120.
    expect(suggestLoopTempo(3, 3, range)).toEqual({ bars: 2, bpm: 120 });
  });

  it("clamps rather than proposing a tempo the app can't play", () => {
    const tooShort = suggestLoopTempo(0.2, 4, range);
    expect(tooShort.bpm).toBeLessThanOrEqual(range.maxBpm);
    expect(tooShort.bpm).toBeGreaterThanOrEqual(range.minBpm);

    const tooLong = suggestLoopTempo(600, 4, range);
    expect(tooLong.bpm).toBeGreaterThanOrEqual(range.minBpm);
  });

  it("survives a zero-length region", () => {
    expect(suggestLoopTempo(0, 4, range).bpm).toBeGreaterThanOrEqual(
      range.minBpm
    );
  });
});
