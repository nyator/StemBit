// A song's sections, as the playback engine wants them.
//
// A cue is fired from more places than the screen that edits it: the
// performance transport, a setlist row, PREV/NEXT stepping through a set. All
// of them have to play the same song the same way, and the counts only worked
// from the one screen that happened to send them -- which made the same song
// behave differently depending on where it was started from. That is the worst
// kind of difference to find on stage, so the conversion lives here rather than
// on any one screen.

export type ArrangementSpan = {
  startSeconds: number;
  /**
   * Where the section ends.
   *
   * Zero means "to the end of the file", which is left for the engine to fill
   * in -- see below.
   */
  endSeconds: number;
  repeats?: number;
};

type SectionLike = {
  startSeconds: number;
  endSeconds?: number;
  repeats?: number;
};

/**
 * A cue's sections as spans the engine can repeat.
 *
 * Sections are stored with an optional end, and the last one usually has none:
 * it simply runs to wherever the song stops. That is fine for drawing and fine
 * for a single pad launch, but a span with no end cannot be repeated -- there
 * is nothing to loop back from -- so each one is closed against the next
 * section's start.
 *
 * The last section is deliberately left at 0 rather than guessed at. Only the
 * engine holds the decoded buffers, so only the engine knows how long the song
 * actually is, and it fills that in at launch. The alternative was to pass the
 * duration measured on the performance screen, which works there and is simply
 * unavailable everywhere else -- exactly the split that had a setlist row
 * ignoring section counts that the same song's PLAY button honoured.
 *
 * Sorted, because a section's place in the running order is its position in the
 * song and nothing else: sections are stored sorted, but a caller holding an
 * unsorted list would otherwise get an arrangement that jumps backwards.
 */
export function arrangementFrom(sections: SectionLike[]): ArrangementSpan[] {
  const ordered = [...sections].sort((a, b) => a.startSeconds - b.startSeconds);

  return ordered
    .map((section, index) => ({
      startSeconds: section.startSeconds,
      endSeconds: section.endSeconds ?? ordered[index + 1]?.startSeconds ?? 0,
      repeats: section.repeats,
    }))
    // An inside-out or empty span has no music in it to repeat. Zero survives:
    // that is the open end the engine closes, not a broken one.
    .filter(
      (span) => span.endSeconds === 0 || span.endSeconds > span.startSeconds
    );
}
