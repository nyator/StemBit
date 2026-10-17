// Tempos carry one decimal place: 125.5 is a tempo, 125.53 is noise.
//
// Songs sit between whole numbers often enough to matter -- a loop cut from a
// recording at 92.5, a click that has to match a track that drifts over a
// whole number -- and the engines never needed integers: a beat is 60 / bpm
// seconds and a loop's rate is bpm / its own bpm, both happy with a fraction.
// What has to be held to a tenth is everything that makes one, so the screens
// never show 125.50000000001 and two "125.5"s compare equal.

/** One decimal place, the precision every tempo in the app is held to. */
export const roundBpm = (bpm: number) => Math.round(bpm * 10) / 10;

/**
 * What a typed tempo may look like while it's being typed: digits and one
 * point, at most one digit after it. "125." stays as typed -- the point is on
 * its way to a decimal, not a mistake.
 */
export const sanitizeBpmDraft = (text: string) => {
  const [whole, ...rest] = text.replace(/[^0-9.]/g, "").split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 1)}`;
};

/** A draft as a tempo, or null if there's no number in it yet. */
export const parseBpmDraft = (text: string) => {
  const parsed = parseFloat(text);
  return Number.isNaN(parsed) ? null : roundBpm(parsed);
};
