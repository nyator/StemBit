import { findLoopByKey } from "../constants/loops";
import { findPadPackByKey } from "../constants/pads";
import type { SessionItem } from "../context/SessionsContext";

// What a cue holds, in one line.
//
// Shared between the setlist row and the performance screen's setlist sheet,
// which are the same list read in two places. They have to agree: a cue that
// says "Afro Pop · 96 BPM" in the running order and something else in the sheet
// reads as two different cues, and telling them apart mid-set is exactly the
// work this line exists to save.

/** Wide gaps, so the parts read as separate facts rather than a sentence. */
const JOIN = "   ·   ";

export function describeCue(item: SessionItem): string {
  const stemCount = item.tracks?.length ?? 0;
  // The cue's key, wherever it ends up sitting: after the tempo on a stem
  // song, after the loop's own tempo on a loop cue, or on the pad's own line
  // if there's no loop under it to carry it.
  const keyLabel = item.padKey
    ? `${item.padKey} ${item.padMode === "minor" ? "min" : "maj"}`
    : null;

  if (stemCount > 0) {
    return [
      `${stemCount} ${stemCount === 1 ? "stem" : "stems"}`,
      item.bpm ? `${item.bpm} BPM` : null,
      keyLabel,
    ]
      .filter(Boolean)
      .join(JOIN);
  }

  const parts: string[] = [];

  const loop = item.loopKey ? findLoopByKey(item.loopKey) : null;
  if (loop) {
    parts.push(
      [loop.title, item.bpm ? `${item.bpm} BPM` : null, keyLabel]
        .filter(Boolean)
        .join(" · ")
    );
  }

  const pack = item.padPack ? findPadPackByKey(item.padPack) : null;
  // The key already sits on the loop's line above when there is one -- a pad
  // with no loop under it is the only case still saying it here.
  if (pack && item.padKey) {
    parts.push(loop ? pack.title : `${pack.title} in ${item.padKey}`);
  }

  // An empty cue is a real state -- it is what a cue looks like between being
  // created and being filled in -- so it gets said rather than left blank.
  return parts.length ? parts.join(JOIN) : "Nothing set";
}
