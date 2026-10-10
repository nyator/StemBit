// Tempos are held to one decimal place. See utils/bpm.ts.
import { parseBpmDraft, roundBpm, sanitizeBpmDraft } from "../bpm";

describe("roundBpm", () => {
  it("keeps a tenth and drops the rest", () => {
    expect(roundBpm(125.5)).toBe(125.5);
    expect(roundBpm(125.54)).toBe(125.5);
    expect(roundBpm(125.56)).toBe(125.6);
    expect(roundBpm(120)).toBe(120);
  });

  it("cleans up float noise from arithmetic", () => {
    expect(roundBpm(0.1 + 0.2 + 125)).toBe(125.3);
    expect(String(roundBpm(92.3 - 1))).toBe("91.3");
  });
});

describe("sanitizeBpmDraft", () => {
  it("lets through digits and one point", () => {
    expect(sanitizeBpmDraft("125.5")).toBe("125.5");
    expect(sanitizeBpmDraft("1a2b5")).toBe("125");
  });

  it("keeps a trailing point while it's being typed", () => {
    expect(sanitizeBpmDraft("125.")).toBe("125.");
  });

  it("allows one decimal digit and one point", () => {
    expect(sanitizeBpmDraft("125.55")).toBe("125.5");
    expect(sanitizeBpmDraft("12.5.5")).toBe("12.5");
  });
});

describe("parseBpmDraft", () => {
  it("reads whole and decimal tempos", () => {
    expect(parseBpmDraft("125")).toBe(125);
    expect(parseBpmDraft("125.5")).toBe(125.5);
    expect(parseBpmDraft("125.")).toBe(125);
  });

  it("is null when there's no number yet", () => {
    expect(parseBpmDraft("")).toBeNull();
    expect(parseBpmDraft(".")).toBeNull();
  });
});
