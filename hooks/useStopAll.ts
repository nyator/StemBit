import { useLoopPlayback } from "../context/LoopPlaybackContext";
import { useMetronome } from "../context/MetronomeContext";
import { usePadPlayback } from "../context/PadPlaybackContext";
import { useSessionPlayback } from "../context/SessionPlaybackContext";

// Everything that can be sounding at once, and one way to silence all of it.
//
// The one place that knows the full list. Anything offering "stop everything"
// goes through here rather than calling the engines it happens to know about,
// so an engine added later is stopped everywhere by being added once, below.
//
// Each stop is called whether or not its engine is playing: stopping an idle
// engine costs nothing, and skipping one on a stale isPlaying would leave
// audio running under a UI that says it stopped. The pad fades out rather
// than cutting, the way stopPad always has.
//
// Needs every playback provider above it -- SessionPlaybackProvider is the
// innermost (app/_layout.tsx).
export function useStopAll() {
  const loop = useLoopPlayback();
  const pad = usePadPlayback();
  const metronome = useMetronome();
  const session = useSessionPlayback();

  const playingCount = [loop.isPlaying, pad.isPlaying, metronome.isPlaying, session.isPlaying]
    .filter(Boolean).length;

  const stopAll = () => {
    loop.stopLoop();
    pad.stopPad();
    metronome.stopMetronome();
    session.stop();
  };

  return { stopAll, playingCount };
}
