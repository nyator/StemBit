/**
 * Tests for imported-loop tempo detection.
 *
 * Detection itself is realtime-bpm-analyzer (see constants/vendor/). What's ours
 * is the wiring: slicing a region out of the decoded buffer, and turning the
 * library's candidate list into the single tempo and confidence the import screen
 * acts on. Both are tested here, against the real library rather than a stub.
 *
 * Two things make that possible outside a WebView:
 *
 *   - The library needs a real OfflineAudioContext (it renders a 200Hz Q=1 biquad
 *     lowpass through Web Audio). Node has none, so it gets a shim running the
 *     same RBJ-cookbook lowpass in plain JS -- the filter Web Audio's
 *     BiquadFilterNode implements, so the library sees what it would see in the
 *     WebView.
 *   - The engine's own helpers are plain JS inside its HTML string, so they're
 *     extracted from the source the way loopStretch.test.js extracts the stretcher.
 *
 * The material is the other half of the point. An earlier hand-written detector
 * passed every test built on impulse trains in silence and still answered half
 * tempo on real files, because a mix is nothing like an impulse train: the kick
 * carries most of the energy and nearly all of it is low, reverb and sustain fill
 * the space between attacks, limiting flattens the peaks, and a regular offbeat
 * hi-hat means the space between beats is not empty. So the fixtures build
 * something that behaves like a mix. Everything is deterministic.
 */

const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;

// ---- OfflineAudioContext shim ----------------------------------------------

function biquadLowpass(input, output, sampleRate, frequency, q) {
  const w0 = (2 * Math.PI * frequency) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const cosw0 = Math.cos(w0);
  const b0 = (1 - cosw0) / 2;
  const b1 = 1 - cosw0;
  const b2 = (1 - cosw0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  for (let i = 0; i < input.length; i++) {
    const x0 = input[i];
    const y0 =
      (b0 / a0) * x0 +
      (b1 / a0) * x1 +
      (b2 / a0) * x2 -
      (a1 / a0) * y1 -
      (a2 / a0) * y2;
    output[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
}

class FakeAudioBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._channels = [];
    for (let c = 0; c < channels; c++) {
      this._channels.push(new Float32Array(length));
    }
  }

  getChannelData(channel) {
    return this._channels[channel];
  }
}

global.OfflineAudioContext = class {
  constructor(channels, length, sampleRate) {
    this._length = length;
    this._sampleRate = sampleRate;
    this.destination = {};
    this._source = null;
    this._filter = null;
  }

  createBufferSource() {
    const context = this;
    return {
      buffer: null,
      connect(node) {
        context._source = this;
        context._filter = node;
      },
      start() {},
    };
  }

  createBiquadFilter() {
    return {
      type: "lowpass",
      frequency: { value: 200 },
      Q: { value: 1 },
      connect() {},
    };
  }

  async startRendering() {
    const source = this._source.buffer;
    const rendered = new FakeAudioBuffer(
      source.numberOfChannels,
      this._length,
      this._sampleRate
    );
    for (let c = 0; c < source.numberOfChannels; c++) {
      biquadLowpass(
        source.getChannelData(c),
        rendered.getChannelData(c),
        this._sampleRate,
        this._filter.frequency.value,
        this._filter.Q.value
      );
    }
    return rendered;
  }
};

// ---- the code under test ---------------------------------------------------

const PACKAGE_DIR = path.join(
  __dirname,
  "..",
  "..",
  "node_modules",
  "realtime-bpm-analyzer"
);
const { analyzeFullBuffer } = require(path.join(PACKAGE_DIR, "dist", "index.js"));

const ENGINE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "constants",
  "loopEngine.ts"
);
const engineSource = fs.readFileSync(ENGINE_PATH, "utf8");
// \r?\n throughout: git checks this out with CRLF on Windows and an \n-only
// pattern silently fails to match there.
const engineScript = engineSource.match(
  /<script id="engine">([\s\S]*?)<\/script>/
)[1];

// The detector itself lives in constants/tempoDetect.ts, embedded into both the
// loop engine and the session engine -- one copy, so a stem song and an imported
// loop are read by the same code. Everything below is extracted from there
// rather than from either engine.
const DETECT_PATH = path.join(
  __dirname,
  "..",
  "..",
  "constants",
  "tempoDetect.ts"
);
const detectSource = fs.readFileSync(DETECT_PATH, "utf8");

/** describeTempo maps the library's candidates to what the screen consumes. */
const describeTempo = (() => {
  const fn = detectSource.match(
    /function describeTempo[\s\S]*?\r?\n        \}/
  )[0];
  // eslint-disable-next-line no-eval
  return eval(`(function () { ${fn}\nreturn describeTempo; })()`);
})();

// The detector's analysis constants, read from its source so these can't drift.
const engineNumber = (name) =>
  Number(detectSource.match(new RegExp(`var ${name} = ([\\d.]+);`))[1]);
const ANALYSIS_MIN_SECONDS = engineNumber("ANALYSIS_MIN_SECONDS");
const ANALYSIS_MAX_SECONDS = engineNumber("ANALYSIS_MAX_SECONDS");
const ANALYSIS_TILE_UNDER_SECONDS = engineNumber("ANALYSIS_TILE_UNDER_SECONDS");
const ANALYSIS_FALLBACK_HZ = engineNumber("ANALYSIS_FALLBACK_HZ");
const ANALYSIS_RETRY_CONFIDENCE = engineNumber("ANALYSIS_RETRY_CONFIDENCE");

// sliceRegion needs an AudioContext to make a buffer; in the engine that's the
// page's. Here it's the fake one, so the region can be built without Web Audio.
// The repetition is the part that matters and is mirrored exactly: the detector
// wants 15 peaks before it answers at all, and a loop is usually far too short to
// hold them.
const sliceRegion = (buffer, startSeconds, endSeconds, repeat) => {
  const rate = buffer.sampleRate;
  const from = Math.max(0, Math.floor(startSeconds * rate));
  const to = Math.min(buffer.length, Math.ceil(endSeconds * rate));
  const length = to - from;
  if (length < rate) return null;

  const seconds = length / rate;
  const copies = repeat
    ? Math.max(1, Math.ceil(ANALYSIS_MIN_SECONDS / seconds))
    : 1;
  const total = Math.min(length * copies, Math.ceil(ANALYSIS_MAX_SECONDS * rate));

  const region = new FakeAudioBuffer(buffer.numberOfChannels, total, rate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const source = buffer.getChannelData(c).subarray(from, to);
    const target = region.getChannelData(c);
    for (let at = 0; at < total; at += length) {
      target.set(
        at + length <= total ? source : source.subarray(0, total - at),
        at
      );
    }
  }
  return region;
};

/** The engine's ladder: as-is, repeated if short, then with the filter opened. */
async function detectTempo(buffer, startSeconds, endSeconds) {
  const plain = sliceRegion(buffer, startSeconds, endSeconds, false);
  if (!plain) return null;

  const seconds = plain.length / plain.sampleRate;
  const repeated =
    seconds < ANALYSIS_TILE_UNDER_SECONDS
      ? sliceRegion(buffer, startSeconds, endSeconds, true)
      : null;

  const attempts = repeated
    ? [
        { region: repeated },
        { region: plain },
        { region: repeated, options: { frequencyValue: ANALYSIS_FALLBACK_HZ } },
      ]
    : [
        { region: plain },
        { region: plain, options: { frequencyValue: ANALYSIS_FALLBACK_HZ } },
      ];

  let best = null;
  for (const attempt of attempts) {
    let result = null;
    try {
      result = describeTempo(
        await analyzeFullBuffer(attempt.region, attempt.options)
      );
    } catch (error) {
      result = null;
    }
    if (result && (!best || result.confidence > best.confidence)) best = result;
    if (best && best.confidence >= ANALYSIS_RETRY_CONFIDENCE) return best;
  }
  return best;
}

// The two thresholds the import screen uses. Keep in step with import.tsx.
/** At or above this, the detected tempo is applied. */
const AUTO_TEMPO_CONFIDENCE = 0.2;
/** At or above this, it's presented as a strong, steady beat. */
const STRONG_TEMPO_CONFIDENCE = 0.4;

// ---- synthetic material ----------------------------------------------------

function makeBuffer(seconds) {
  const frames = Math.round(seconds * SAMPLE_RATE);
  const buffer = new FakeAudioBuffer(1, frames, SAMPLE_RATE);
  buffer.data = buffer.getChannelData(0);
  return buffer;
}

let seed = 12345;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff - 0.5;
};
beforeEach(() => {
  seed = 12345;
});

function add(buffer, at, length, generate) {
  const start = Math.round(at * SAMPLE_RATE);
  const frames = Math.round(length * SAMPLE_RATE);
  for (let i = 0; i < frames; i++) {
    const index = start + i;
    if (index < 0 || index >= buffer.length) break;
    buffer.data[index] += generate(i / SAMPLE_RATE, index);
  }
}

/** Kick: a 55Hz body with a pitch drop. Nearly all of its energy is low. */
const kick = (buffer, at, gain = 1) =>
  add(buffer, at, 0.25, (t) =>
    Math.sin(2 * Math.PI * (55 + 60 * Math.exp(-t * 60)) * t) *
    Math.exp(-t * 14) *
    gain
  );

/** Snare: noise plus a 190Hz tone. */
const snare = (buffer, at, gain = 1) =>
  add(buffer, at, 0.2, (t) =>
    (noise() * 2 * 0.8 + Math.sin(2 * Math.PI * 190 * t) * 0.5) *
    Math.exp(-t * 22) *
    gain
  );

/** Closed hat: short, bright noise. */
const hat = (buffer, at, gain = 1) =>
  add(buffer, at, 0.06, (t) => noise() * 2 * Math.exp(-t * 90) * gain);

/** Bass: a sustained note, filling the space between the drums. */
const bass = (buffer, at, length, frequency, gain = 0.9) =>
  add(buffer, at, length, (t) =>
    Math.sin(2 * Math.PI * frequency * t) *
    Math.min(1, t * 200) *
    Math.exp(-t * 1.2) *
    gain
  );

/** Pad: a held chord. The thing that must not read as a confident beat. */
const pad = (buffer, length, gain = 0.35) =>
  add(buffer, 0, length, (t) =>
    ((Math.sin(2 * Math.PI * 220 * t) +
      Math.sin(2 * Math.PI * 277 * t) +
      Math.sin(2 * Math.PI * 330 * t)) /
      3) *
    gain
  );

/** Crude feedback reverb: smears every transient, as a real mix does. */
function reverb(buffer, mix = 0.35, delay = 0.045, decay = 0.6) {
  const step = Math.round(delay * SAMPLE_RATE);
  for (let i = step; i < buffer.length; i++) {
    buffer.data[i] += buffer.data[i - step] * decay * mix;
  }
}

/** Limiting: what a mastered file does to its peaks. */
function limit(buffer, ceiling = 0.9) {
  let peak = 0;
  for (let i = 0; i < buffer.length; i++) {
    peak = Math.max(peak, Math.abs(buffer.data[i]));
  }
  const gain = peak > 0 ? 1 / peak : 1;
  for (let i = 0; i < buffer.length; i++) {
    buffer.data[i] = Math.tanh(buffer.data[i] * gain * 2.2) * ceiling;
  }
}

/** A full mix: drums, bass, pad, reverb, limiting. */
function fullMix(bpm, bars = 4, options = {}) {
  const beat = 60 / bpm;
  const beats = bars * 4;
  // The tail is room for the reverb to ring past the last beat, as an excerpt of
  // a song has. A loop cut for looping has none, hence the option.
  const buffer = makeBuffer(beats * beat + (options.tail ?? 0.4));

  for (let b = 0; b < beats; b++) {
    const at = b * beat;
    kick(buffer, at);
    if (b % 4 === 2) kick(buffer, at + beat * 0.75, 0.8); // syncopation
    if (b % 2 === 1) snare(buffer, at, 0.9); // backbeat
    hat(buffer, at + beat / 2, 0.5); // offbeat
    if (options.sixteenths) {
      hat(buffer, at + beat * 0.25, 0.25);
      hat(buffer, at + beat * 0.75, 0.3);
    }
    bass(buffer, at, beat * 0.95, [55, 65, 73, 55][b % 4]);
  }

  if (options.pad !== false) pad(buffer, buffer.duration);
  reverb(buffer);
  limit(buffer);
  return buffer;
}

/** Piano-ish chords on every beat: pitched, soft attacks, no drums at all. */
function chordLoop(bpm, bars = 4) {
  const beat = 60 / bpm;
  const beats = bars * 4;
  const buffer = makeBuffer(beats * beat + 0.4);
  for (let b = 0; b < beats; b++) {
    const at = b * beat;
    const root = [261, 311, 349, 392][b % 4];
    [1, 1.26, 1.5].forEach((interval) =>
      add(buffer, at, beat * 1.6, (t) =>
        Math.sin(2 * Math.PI * root * interval * t) *
        Math.min(1, t * 400) *
        Math.exp(-t * 3.2) *
        0.3
      )
    );
  }
  reverb(buffer);
  limit(buffer);
  return buffer;
}

// ---- the tests -------------------------------------------------------------

describe("the vendored detector", () => {
  it("is the same code as the installed package", () => {
    // The library is committed as a string because it has to be injectable into
    // the WebView (constants/vendor/bpmAnalyzerSource.ts, generated by
    // scripts/vendor-bpm-analyzer.js). Nothing makes anyone regenerate it after
    // an npm upgrade, so this does.
    const {
      BPM_ANALYZER_SOURCE,
      BPM_ANALYZER_VERSION,
    } = require("../../constants/vendor/bpmAnalyzerSource");
    const installed = fs.readFileSync(
      path.join(PACKAGE_DIR, "dist", "index.js"),
      "utf8"
    );
    const { version } = require(path.join(PACKAGE_DIR, "package.json"));

    expect(BPM_ANALYZER_VERSION).toBe(version);
    expect(BPM_ANALYZER_SOURCE).toBe(installed);
  });

  it("needs nothing but a module/exports pair to load", () => {
    // Which is why injecting it into the page works at all.
    const {
      BPM_ANALYZER_SOURCE,
    } = require("../../constants/vendor/bpmAnalyzerSource");
    expect(BPM_ANALYZER_SOURCE).not.toMatch(/\brequire\s*\(/);
    expect(() =>
      new Function(
        "var module = { exports: {} }; var exports = module.exports;" +
          BPM_ANALYZER_SOURCE
      )
    ).not.toThrow();
  });

  it("is safe to embed in a script tag", () => {
    // It goes into the engine's HTML inside <script>. A literal </script>
    // anywhere in it -- in a string, in a comment -- would end that tag early and
    // spill the rest of the library into the page as markup, taking the engine
    // with it.
    const {
      BPM_ANALYZER_SOURCE,
    } = require("../../constants/vendor/bpmAnalyzerSource");
    expect(BPM_ANALYZER_SOURCE).not.toMatch(/<\/script/i);
    expect(BPM_ANALYZER_SOURCE).not.toMatch(/<!--/);
  });
});

describe("reading the tempo off a mix", () => {
  [90, 100, 120, 128, 140, 174].forEach((bpm) => {
    it(`finds ${bpm} BPM in a full mix at ${bpm}`, async () => {
      const mix = fullMix(bpm);
      const result = await detectTempo(mix, 0, mix.duration);
      expect(result).not.toBeNull();
      expect(result.bpm).toBe(bpm);
      expect(result.confidence).toBeGreaterThanOrEqual(AUTO_TEMPO_CONFIDENCE);
    });
  });

  it("hears the kick, not just the backbeat", async () => {
    // The failure that motivated moving to this library: a kick's energy is
    // nearly all low, and a detector that can't hear it locks onto the snare on
    // 2 and 4 and answers half tempo.
    const mix = fullMix(128);
    const result = await detectTempo(mix, 0, mix.duration);
    expect(result.bpm).toBeGreaterThan(120);
    expect(result.bpm).toBeLessThan(136);
  });

  it("handles a dense sixteenth-note pattern", async () => {
    const mix = fullMix(128, 4, { sixteenths: true });
    expect((await detectTempo(mix, 0, mix.duration)).bpm).toBe(128);
  });

  it("reads a melodic loop with no drums in it", async () => {
    for (const bpm of [100, 128]) {
      const loop = chordLoop(bpm);
      expect((await detectTempo(loop, 0, loop.duration)).bpm).toBe(bpm);
    }
  });

  it("reads a swung loop from its downbeats", async () => {
    const bpm = 96;
    const beat = 60 / bpm;
    const buffer = makeBuffer(16 * beat + 0.4);
    for (let b = 0; b < 16; b++) {
      const at = b * beat;
      kick(buffer, at);
      if (b % 2 === 1) snare(buffer, at, 0.9);
      hat(buffer, at + beat * 0.66, 0.45); // swung, not straight
      hat(buffer, at + beat * 0.33, 0.2);
      bass(buffer, at, beat * 0.9, [55, 65, 73, 55][b % 4]);
    }
    reverb(buffer);
    limit(buffer);

    expect((await detectTempo(buffer, 0, buffer.duration)).bpm).toBe(bpm);
  });

  it("still answers on a short excerpt that rings past its last beat", async () => {
    // Two bars WITH a reverb tail: not a loop, an excerpt. The tail means the
    // region isn't a whole number of beats, so repeating it -- which is how a
    // region this short gets read at all -- puts an interval at every join that
    // isn't in the music, and the answer can come back a few BPM out. Asserted as
    // "an answer in the right area" rather than an exact tempo, because that is
    // what this case honestly delivers; trimming the tail (which the screen's
    // DETECT does) makes it exact.
    const mix = fullMix(100, 2);
    const result = await detectTempo(mix, 0, mix.duration);

    expect(result).not.toBeNull();
    expect(result.bpm).toBeGreaterThan(85);
    expect(result.bpm).toBeLessThan(115);
  });

  it("reads the region it is given, not the whole file", async () => {
    // 100 BPM for the first half, 150 for the second. Asked about the second
    // half, it must say 150 -- this is what makes DETECT on a trimmed region a
    // better read than on the whole file.
    const first = fullMix(100, 2);
    const second = fullMix(150, 4);
    const buffer = makeBuffer(first.duration + second.duration);
    buffer.data.set(first.data, 0);
    buffer.data.set(second.data, Math.round(first.duration * SAMPLE_RATE));

    const result = await detectTempo(buffer, first.duration, buffer.duration);
    expect(result.bpm).toBe(150);
  });

  // Loops, as opposed to excerpts of songs. Cut tight -- no tail past the last
  // beat -- because that's what a loop exported from a DAW is, and it's the shape
  // repeating depends on: a region that isn't a whole number of beats puts an
  // interval at every join that doesn't exist in the music.
  [
    [120, 2],
    [100, 2],
    [100, 1],
    [128, 1],
  ].forEach(([bpm, bars]) => {
    it(`reads a ${bars}-bar loop at ${bpm}, too short to detect unrepeated`, async () => {
      const loop = fullMix(bpm, bars, { tail: 0 });
      expect(loop.duration).toBeLessThan(ANALYSIS_TILE_UNDER_SECONDS);

      const result = await detectTempo(loop, 0, loop.duration);
      expect(result).not.toBeNull();
      expect(result.bpm).toBe(bpm);
    });
  });

  it("reads a click track, which has nothing for the default filter to hear", async () => {
    // The other reported failure. A click is a short, bright tick with no low end
    // whatever, so the detector's 200Hz lowpass sees silence and returns nothing.
    // Finding it takes the second pass with the filter opened up.
    const bpm = 120;
    const beat = 60 / bpm;
    const buffer = makeBuffer(8 * beat + 0.2);
    for (let b = 0; b < 8; b++) {
      // 2kHz ping, 25ms: a metronome click, nothing below a kilohertz.
      add(buffer, b * beat, 0.025, (t) =>
        Math.sin(2 * Math.PI * (b % 4 === 0 ? 2600 : 1800) * t) *
        Math.exp(-t * 120)
      );
    }

    const result = await detectTempo(buffer, 0, buffer.duration);
    expect(result).not.toBeNull();
    expect(result.bpm).toBe(bpm);
  });

  it("reads a loop whose pulse is only hats", async () => {
    // Same blind spot as a click track: nothing low to lock onto.
    const bpm = 128;
    const beat = 60 / bpm;
    const buffer = makeBuffer(16 * beat + 0.3);
    for (let b = 0; b < 16; b++) {
      hat(buffer, b * beat, b % 2 === 0 ? 0.9 : 0.5);
    }
    limit(buffer);

    const result = await detectTempo(buffer, 0, buffer.duration);
    expect(result).not.toBeNull();
    expect(result.bpm).toBe(bpm);
  });

  it("declines a region under a second", async () => {
    const buffer = makeBuffer(0.5);
    kick(buffer, 0.01);
    expect(await detectTempo(buffer, 0, buffer.duration)).toBeNull();
  });
});

describe("material with no tempo in it", () => {
  // These must never come back as a CONFIDENT reading. Deliberately not the
  // stricter claim that they stay under the gate the screen applies a tempo at:
  // a beating pad scores around 0.28 and a two-bar snippet of real music 0.24, so
  // no threshold separates them, and the one worth keeping is the one that
  // doesn't refuse real music. Material with no pulse can therefore get a tempo
  // applied; it arrives labelled "faint beat, worth checking against the click",
  // with the runner-up tempos one tap away.
  const expectNoConfidentPulse = async (buffer) => {
    const result = await detectTempo(buffer, 0, buffer.duration);
    if (result === null) return; // declining outright is also correct
    expect(result.confidence).toBeLessThan(STRONG_TEMPO_CONFIDENCE);
  };

  it("declines silence", async () => {
    expect(await detectTempo(makeBuffer(4), 0, 4)).toBeNull();
  });

  it("is not fooled by a held pad", async () => {
    const buffer = makeBuffer(6);
    pad(buffer, 6);
    limit(buffer);
    await expectNoConfidentPulse(buffer);
  });

  it("is not fooled by white noise", async () => {
    const buffer = makeBuffer(6);
    for (let i = 0; i < buffer.length; i++) buffer.data[i] = noise() * 2 * 0.5;
    await expectNoConfidentPulse(buffer);
  });

  it("is not fooled by free-time playing", async () => {
    const buffer = makeBuffer(8);
    [0, 1.7, 3.1, 5.2, 6.4].forEach((at, i) =>
      bass(buffer, at, 1.5, [55, 65, 73, 60, 55][i])
    );
    limit(buffer);
    await expectNoConfidentPulse(buffer);
  });

  it("is not fooled by scattered hits", async () => {
    const buffer = makeBuffer(8);
    [0, 0.31, 0.9, 1.05, 1.9, 2.7, 2.95, 3.8, 4.35, 5.2, 5.6, 6.9].forEach((at) =>
      snare(buffer, at, 0.8)
    );
    limit(buffer);
    await expectNoConfidentPulse(buffer);
  });
});

describe("describeTempo — turning candidates into one answer", () => {
  it("takes the top candidate and scores it against the rest", () => {
    const result = describeTempo([
      { tempo: 128, count: 49 },
      { tempo: 171, count: 22 },
      { tempo: 102, count: 11 },
      { tempo: 146, count: 9 },
      { tempo: 114, count: 7 },
    ]);
    expect(result.bpm).toBe(128);
    expect(result.confidence).toBeCloseTo(49 / 98, 3);
    expect(result.alternatives).toEqual([171, 102, 146]);
  });

  it("scores an even spread low, which is what no pulse looks like", () => {
    const even = describeTempo([
      { tempo: 114, count: 24 },
      { tempo: 96, count: 23 },
      { tempo: 122, count: 16 },
      { tempo: 159, count: 12 },
      { tempo: 174, count: 10 },
    ]);
    expect(even.confidence).toBeLessThan(STRONG_TEMPO_CONFIDENCE);
  });

  it("returns null when there are no candidates", () => {
    expect(describeTempo([])).toBeNull();
    expect(describeTempo(null)).toBeNull();
    expect(describeTempo(undefined)).toBeNull();
  });

  it("survives a candidate with no usable tempo", () => {
    expect(describeTempo([{ tempo: 0, count: 3 }])).toBeNull();
    expect(describeTempo([{ tempo: 120, count: 0 }]).confidence).toBe(0);
  });
});
