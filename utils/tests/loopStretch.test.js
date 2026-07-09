/**
 * Smoothness tests for the loop engine's pitch-preserving time-stretch.
 *
 * The stretcher is pure JS inside the engine's WebView HTML, so we extract
 * it from constants/loopEngine.ts and run it directly — no WebView needed.
 *
 * A synthetic 1-bar 80 BPM "band" loop (kick, snare, hats, sustained pad —
 * the hard cases for time-stretching) is rendered at several rates and
 * measured the way an ear would judge it:
 *   - every drum hit lands on the new tempo grid (no doubled/dropped hits)
 *   - no spurious transients (clicks, thumps, flams)
 *   - the loop's wrap point stays seamless
 *   - pitch is unchanged (that's the whole point)
 *   - the tempo-change crossfade doesn't dip or bump the volume
 */

const fs = require("fs");
const path = require("path");

// ---- extract the stretcher from the engine HTML ---------------------------

function extractStretchLoop() {
  const ts = fs.readFileSync(
    path.join(__dirname, "..", "..", "constants", "loopEngine.ts"),
    "utf8"
  );
  const script = ts.match(/<script>([\s\S]*?)<\/script>/)[1];
  const fn = script
    .match(/function stretchLoop[\s\S]*?\n        \}\n        \/\/ --- end time-stretch/)[0]
    .replace("// --- end time-stretch", "");
  // eslint-disable-next-line no-eval
  return eval(`(${fn})`);
}

// ---- synthetic test material ----------------------------------------------

const SR = 44100;
const BPM = 80;
const SPB = 60 / BPM;
const BAR_SECONDS = 4 * SPB; // 3.0s
const N = Math.round(SR * BAR_SECONDS);

// every rhythmic hit in the loop (kick 1&3, snare 2&4, 8th-note hats)
const TRUE_HITS = [0, 0.375, 0.75, 1.125, 1.5, 1.875, 2.25, 2.625];

function makeBandLoop() {
  const x = new Float32Array(N);
  const addBurst = (t, f, dur, amp, noise) => {
    const s = Math.round(t * SR);
    const len = Math.round(dur * SR);
    for (let i = 0; i < len && s + i < N; i++) {
      const env = Math.exp((-4 * i) / len);
      x[s + i] +=
        amp * env * (noise ? Math.random() * 2 - 1 : Math.sin((2 * Math.PI * f * i) / SR));
    }
  };
  for (let b = 0; b < 4; b++) {
    if (b % 2 === 0) addBurst(b * SPB, 60, 0.25, 0.8, false); // kick
    else addBurst(b * SPB, 0, 0.12, 0.45, true); // snare
  }
  for (let e = 0; e < 8; e++) addBurst((e * SPB) / 2, 0, 0.03, 0.25, true); // hats
  // pad: exact-cycle sines so the loop's own seam is clean
  for (const f of [220, 330, 440]) {
    for (let i = 0; i < N; i++) x[i] += 0.12 * Math.sin((2 * Math.PI * f * i) / SR);
  }
  return x;
}

// ---- metrics ----------------------------------------------------------------

function rmsEnv(y, winSeconds) {
  const w = Math.round(winSeconds * SR);
  const out = [];
  for (let s = 0; s + w <= y.length; s += w) {
    let e = 0;
    for (let i = s; i < s + w; i++) e += y[i] * y[i];
    out.push(Math.sqrt(e / w));
  }
  return out;
}

// energy-rise onset detector (5ms resolution)
function onsetTimes(y) {
  const env = rmsEnv(y, 0.005);
  const t = [];
  for (let i = 2; i < env.length; i++) {
    if (env[i] - env[i - 2] > 0.09 && (t.length === 0 || i * 0.005 - t[t.length - 1] > 0.06)) {
      t.push(i * 0.005);
    }
  }
  return t;
}

function zeroCrossFreq(y) {
  let z = 0;
  for (let i = 1; i < y.length; i++) if (y[i - 1] < 0 && y[i] >= 0) z++;
  return z / (y.length / SR);
}

// ---- tests -------------------------------------------------------------------

const RATES = [0.8, 0.85, 1.15, 1.25, 1.4];

describe("loop time-stretch smoothness", () => {
  const stretchLoop = extractStretchLoop();
  const input = makeBandLoop();
  const strongInputOnsets = onsetTimes(input); // the loud hits the detector hears

  test("input material is valid (strong hits detectable)", () => {
    expect(strongInputOnsets.length).toBeGreaterThanOrEqual(3);
  });

  test.each(RATES)("rate %f: output length is exact", (rate) => {
    const out = stretchLoop([input], SR, rate)[0];
    expect(Math.abs(out.length - Math.round(N / rate))).toBeLessThanOrEqual(1);
  });

  test.each(RATES)("rate %f: every strong hit lands on the new tempo grid", (rate) => {
    const out = stretchLoop([input], SR, rate)[0];
    const outOnsets = onsetTimes(out);
    for (const t of strongInputOnsets) {
      const expected = t / rate;
      const err = Math.min(...outOnsets.map((o) => Math.abs(o - expected)));
      // a musician hears ~15-20ms; require better than 15ms
      expect(err).toBeLessThan(0.015);
    }
  });

  test.each(RATES)("rate %f: no more than one subtle spurious transient", (rate) => {
    const out = stretchLoop([input], SR, rate)[0];
    const outOnsets = onsetTimes(out);
    const grid = TRUE_HITS.map((t) => t / rate);
    const spurious = outOnsets.filter(
      (t) => Math.min(...grid.map((g) => Math.abs(t - g))) > 0.03
    );
    expect(spurious.length).toBeLessThanOrEqual(1);
  });

  test.each(RATES)("rate %f: loop wrap point stays seamless", (rate) => {
    const out = stretchLoop([input], SR, rate)[0];
    // discontinuity at the wrap must not exceed the material's own largest step
    let maxStep = 0;
    for (let i = 1; i < input.length; i++) {
      maxStep = Math.max(maxStep, Math.abs(input[i] - input[i - 1]));
    }
    expect(Math.abs(out[0] - out[out.length - 1])).toBeLessThan(maxStep * 0.5);
  });

  test.each(RATES)("rate %f: pitch is preserved (the whole point)", (rate) => {
    // pure exact-cycle 440Hz sine loop: frequency must not move with tempo
    const sine = new Float32Array(N);
    for (let i = 0; i < N; i++) sine[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / SR);
    const out = stretchLoop([sine], SR, rate)[0];
    const mid = out.subarray(Math.floor(out.length * 0.1), Math.floor(out.length * 0.9));
    const freq = zeroCrossFreq(mid);
    expect(Math.abs(freq - 440) / 440).toBeLessThan(0.01); // within 1%
    // and confirm varispeed would have failed this test
    expect(Math.abs(440 * rate - 440) / 440).toBeGreaterThan(0.01);
  });

  test("tempo-change crossfade: no volume dip or bump through the swap", () => {
    // Simulate the engine's applyRateChange: original playing, swap to a
    // 1.25x render at the same musical phase with a 30ms linear crossfade.
    const rate = 1.25;
    const stretchedArr = stretchLoop([input], SR, rate)[0];
    const swapAtSeconds = 1.3; // mid-bar, mid-sustain
    const fade = Math.round(SR * 0.03);

    const phase = (swapAtSeconds % BAR_SECONDS) / BAR_SECONDS;
    const newOffset = Math.round(phase * stretchedArr.length);

    // mixed timeline: 0.5s before the swap, 0.5s after
    const before = Math.round(SR * 0.5);
    const after = Math.round(SR * 0.5);
    const mixed = new Float32Array(before + after);
    const swapStartIn = Math.round(swapAtSeconds * SR);
    for (let i = 0; i < before; i++) mixed[i] = input[(swapStartIn - before + i) % N];
    for (let i = 0; i < after; i++) {
      const oldS = input[(swapStartIn + i) % N];
      const newS = stretchedArr[(newOffset + i) % stretchedArr.length];
      const w = Math.min(1, i / fade);
      mixed[before + i] = oldS * (1 - w) + newS * w;
    }

    // RMS envelope around the swap must stay within musical bounds
    const env = rmsEnv(mixed, 0.02);
    const median = [...env].sort((a, b) => a - b)[Math.floor(env.length / 2)];
    const windowStart = Math.floor(before / (SR * 0.02)) - 3;
    const windowEnd = windowStart + 6; // ±~60ms around the swap
    for (let i = Math.max(0, windowStart); i < Math.min(env.length, windowEnd); i++) {
      expect(env[i]).toBeGreaterThan(median * 0.4); // no dropout
      expect(env[i]).toBeLessThan(median * 2.5); // no thump
    }
  });
});
