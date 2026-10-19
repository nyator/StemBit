// Whether a stem is heard, given the mixer.
//
// One rule, used by the screen to dim a strip and by the engine to silence
// it, so the two can't disagree about what the room hears.
//
// Cue tracks are the exception to solo and to master mute. A song played to
// a click on stage often carries one or more guide stems -- a voice calling
// "verse", "chorus", a count-in -- that the band has to hear whatever else is
// going on. Soloing the bass to check it shouldn't take the cues away, and
// neither should dropping the whole band out with master mute: that's the
// moment the click and the cues are the only thing holding the room, which
// is why the click already bypasses master. A cue track still answers its
// own mute -- the one way to take it out.

export type SoloInput = {
  trackId: string;
  /** The soloed track, or null. */
  solo: string | null;
  /** The band muted -- every stem but the cue tracks. */
  master: boolean;
  /** This track's own mute. */
  muted: boolean;
  /** A cue (guide) track: heard under a solo. */
  guide: boolean;
};

export function isTrackSilent({ trackId, solo, master, muted, guide }: SoloInput) {
  // Cues go through master mute and solo alike; only their own mute stops them.
  if (guide) return muted;
  if (master) return true;
  if (!solo) return muted;
  return trackId !== solo;
}
