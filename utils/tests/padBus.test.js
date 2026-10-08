/**
 * Tests for padBusScale (constants/pads.ts) — the gain every pad channel is
 * multiplied by so the stacked voices stay inside full scale.
 *
 * This exists because of a real regression: the bus divided by the plain sum of
 * the levels, so loading a second pack halved every channel and the instrument
 * audibly ducked. The property that matters is not any particular number but
 * that stacking pads doesn't make the pad quieter, so that's what's asserted
 * here — in power terms, which is how uncorrelated sources actually combine.
 */

const { padBusScale, NATURE_CHANNEL } = require("../../constants/pads");

/**
 * What the bus actually puts out, as power, for a set of channels.
 *
 * Uncorrelated sources sum in power, not amplitude: each channel contributes
 * the square of the gain that reaches it. One voice at full scale is 1.
 */
const outputPower = (channels) => {
  const scale = padBusScale(channels);
  return channels.reduce(
    (sum, channel) =>
      sum + (channel.muted ? 0 : (channel.level * scale) ** 2),
    0
  );
};

const full = (count) =>
  Array.from({ length: count }, () => ({ level: 1, muted: false }));

describe("padBusScale — stacking pads must not turn the instrument down", () => {
  it("holds the output level as packs are added", () => {
    const one = outputPower(full(1));
    expect(outputPower(full(2))).toBeCloseTo(one, 5);
    expect(outputPower(full(3))).toBeCloseTo(one, 5);
    expect(outputPower(full(4))).toBeCloseTo(one, 5);
  });

  it("does not drop a channel's own gain to a fraction of the stack", () => {
    // The old law gave each of two full faders 0.5. Anything at or below that
    // is the regression this file exists to catch.
    expect(padBusScale(full(2))).toBeGreaterThan(0.5);
    expect(padBusScale(full(4))).toBeGreaterThan(0.25);
  });

  it("leaves a single pad completely alone", () => {
    expect(padBusScale(full(1))).toBe(1);
  });

  it("never boosts a stack that is quieter than full scale", () => {
    expect(padBusScale([{ level: 0.5 }])).toBe(1);
    expect(padBusScale([{ level: 0.3 }, { level: 0.4 }])).toBe(1);
    expect(padBusScale([])).toBe(1);
  });

  it("gives the remaining channels room when one is muted", () => {
    const withMuted = padBusScale([
      { level: 1, muted: false },
      { level: 1, muted: true },
    ]);
    expect(withMuted).toBe(padBusScale(full(1)));
  });

  it("keeps the summed peak within what padVolume can absorb", () => {
    // Worst case is every voice lining up in phase, where amplitudes add. Two
    // pads at the top peak at 1.41x, which the default padVolume of 0.7 pulls
    // back under full scale. This is the tradeoff the power law accepts.
    const scale = padBusScale(full(2));
    expect(scale * 2 * 0.7).toBeLessThanOrEqual(1);
  });

  it("charges the nature bed at its trimmed level, not its fader", () => {
    // The bed reaches the bus through a fixed trim, so it should cost the pads
    // only what it actually contributes -- otherwise bringing it in would duck
    // the instrument for gain the bed never uses.
    const bedAtFullFader = { level: 1 * NATURE_CHANNEL.trim, muted: false };
    const withBed = padBusScale([...full(1), bedAtFullFader]);
    expect(withBed).toBeGreaterThan(padBusScale(full(2)));
  });
});
