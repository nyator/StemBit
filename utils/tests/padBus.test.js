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

const { padBusScale, padTrim, PAD_PACKS } = require("../../constants/pads");

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

  it("charges a trimmed ambience at its trimmed level, not its fader", () => {
    // A field recording reaches the bus through a fixed trim, so it should
    // cost the pads only what it actually contributes -- otherwise bringing
    // it in would duck the instrument for gain it never uses.
    const forestAtFullFader = { level: 1 * padTrim("nature"), muted: false };
    const withForest = padBusScale([...full(1), forestAtFullFader]);
    expect(withForest).toBeGreaterThan(padBusScale(full(2)));
  });
});

describe("the pad catalog", () => {
  it("gives every ambience one clip and every pad all twelve", () => {
    for (const pack of PAD_PACKS) {
      const roots = Object.keys(pack.sources);
      if (pack.kind === "ambience") expect(roots).toEqual(["C"]);
      else expect(roots).toHaveLength(12);
    }
  });

  it("keeps the old Nature channel's key, so saved mixes carry over", () => {
    expect(PAD_PACKS.find((pack) => pack.key === "nature")?.kind).toBe("ambience");
  });

  it("leaves an untrimmed pack at full scale", () => {
    expect(padTrim("drone-pad")).toBe(1);
    expect(padTrim("no-such-pack")).toBe(1);
  });
});

describe("major-only keys", () => {
  const { playableKey, MINOR_KEYS_ENABLED } = require("../../constants/pads");

  it("leaves a major key alone", () => {
    expect(playableKey("D#", "major")).toEqual({ key: "D#", mode: "major" });
  });

  (MINOR_KEYS_ENABLED ? it.skip : it)(
    "plays a saved minor key as its relative major -- the clip it always sounded",
    () => {
      expect(playableKey("A", "minor")).toEqual({ key: "C", mode: "major" });
      expect(playableKey("C", "minor")).toEqual({ key: "D#", mode: "major" });
      expect(playableKey("A#", "minor")).toEqual({ key: "C#", mode: "major" });
    }
  );
});
