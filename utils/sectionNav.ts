// Previous / next section, for the Studio transport.
//
// Measured in section starts, sorted. Next is the first one past where the
// song is. Previous behaves the way a player's "back" does: a press while
// you're well into a section returns to its top, and only a press near the
// top steps back a section -- otherwise "back" from the second bar of the
// chorus would skip the chorus entirely. Stopped, there's no "well into":
// the cursor is placed on purpose, so back always goes to the start before it.

/** How far into a section, playing, a back press returns to its top. */
export const BACK_GRACE_SECONDS = 1.5;

// Under this, two positions are the same place -- a start the cursor sits on
// exactly is "here", not "ahead" or "behind".
const SAME_PLACE = 0.05;

export function nextSectionStart(
  starts: number[],
  at: number
): number | null {
  const ahead = [...starts].sort((a, b) => a - b).find((t) => t > at + SAME_PLACE);
  return ahead ?? null;
}

/** The start to go back to; 0, the top of the song, when there's none. */
export function prevSectionStart(
  starts: number[],
  at: number,
  playing: boolean
): number {
  const grace = playing ? BACK_GRACE_SECONDS : SAME_PLACE;
  const behind = [...starts]
    .sort((a, b) => a - b)
    .filter((t) => t < at - grace);
  return behind.length > 0 ? behind[behind.length - 1] : 0;
}
