import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

import type { CueSection } from "../context/SessionsContext";
import { useSessionPlayback } from "../context/SessionPlaybackContext";

// Which section of a stem song is sounding, and how far into it we are.
//
// A hook rather than screen state because two surfaces now ask the same
// question: the performance screen's section pads, and the setlist row that
// expands to show the same pads. They have to answer it identically -- a pad
// that says "Chorus is live" in one place and not the other is worse than
// either behaviour on its own.
//
// The section is followed rather than remembered. Set from the press, the lit
// pad is whichever one was last hit, which stops being true the moment the song
// plays on into the next section: the chorus arrives and the pad still says
// Verse 2. The playhead is the only thing that actually knows.

type LiveSections = {
  /**
   * The transport's position in the song, in seconds.
   *
   * An Animated.Value, so a pad's fill can be interpolated straight off it. The
   * engine reports sixteen times a second and a number here would mean sixteen
   * renders of whatever holds this hook, per second, to move one bar.
   */
  playheadSeconds: Animated.Value;
  /** The section the playhead is inside, or null with nothing sounding. */
  liveSectionId: string | null;
  /** Hit, but waiting on the bar its launch is quantised to. */
  armedSectionId: string | null;
  /** Call on launching a section, before the audio moves. */
  arm: (sectionId: string) => void;
};

export function useLiveSections(sections: CueSection[]): LiveSections {
  const session = useSessionPlayback();

  const playheadSeconds = useRef(new Animated.Value(0)).current;
  const [liveSectionId, setLiveSectionId] = useState<string | null>(null);
  const [armedSectionId, setArmedSectionId] = useState<string | null>(null);

  // Mirrors of both, for the subscriber below -- it runs from a closure made
  // once per subscription and would otherwise be reading a stale render.
  const liveRef = useRef<string | null>(null);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  useEffect(
    () =>
      session.subscribePosition((next) => {
        if (next.seconds === null) return;
        playheadSeconds.setValue(next.seconds);

        const ordered = sectionsRef.current;
        let landed: string | null = null;
        // Backwards: the section you are in is the last one that starts at or
        // before here and hasn't ended yet. Sections are kept sorted when
        // they're written, so the first match walking back is the innermost.
        //
        // The end is checked, not just the start. Sections own both edges now
        // and so can have gaps between them -- the four bars you loop out of a
        // verse leave the rest of that verse belonging to nothing -- and a
        // playhead in a gap must light no pad rather than the one before it.
        for (let index = ordered.length - 1; index >= 0; index--) {
          const section = ordered[index];
          if (next.seconds < section.startSeconds - 0.001) continue;
          if (
            section.endSeconds !== undefined &&
            next.seconds >= section.endSeconds
          ) {
            continue;
          }
          landed = section.id;
          break;
        }

        // The one update here that costs a render, so it is gated on the id
        // actually changing: a handful of renders across a song rather than
        // sixteen a second.
        if (landed === liveRef.current) return;
        liveRef.current = landed;
        setLiveSectionId(landed);
        // Arrived, so it is no longer pending.
        setArmedSectionId((current) => (current === landed ? null : current));
      }),
    [session, playheadSeconds]
  );

  // Nothing is live or pending once the transport is down.
  useEffect(() => {
    if (session.isPlaying) return;
    liveRef.current = null;
    setLiveSectionId(null);
    setArmedSectionId(null);
  }, [session.isPlaying]);

  /**
   * Relaunching the section already running is the exception: there is no
   * arrival to wait for, since the live id never changes, so that one shows
   * nothing rather than an "armed" that would sit there for the rest of the
   * song.
   */
  const arm = (sectionId: string) =>
    setArmedSectionId(sectionId === liveRef.current ? null : sectionId);

  return { playheadSeconds, liveSectionId, armedSectionId, arm };
}
