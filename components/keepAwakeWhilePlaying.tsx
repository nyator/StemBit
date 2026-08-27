import { useEffect } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

import { useMetronome } from "../context/MetronomeContext";
import { useLoopPlayback } from "../context/LoopPlaybackContext";
import { usePadPlayback } from "../context/PadPlaybackContext";
import { useSessionPlayback } from "../context/SessionPlaybackContext";

// Holds the screen on while any engine is playing.
//
// All four engines stop themselves when the app leaves the foreground (see
// the AppState handlers in the playback contexts) — their audio runs in
// hidden WebViews, whose clocks the OS suspends there regardless. So without
// this, a practice session ends the moment the screen times out, which is
// exactly when the user is playing an instrument rather than touching the
// phone.
//
// Scoped to actual playback rather than the whole app: an idle StemBit on
// screen has no claim on the user's battery.
//
// Renders nothing; mounted at the app root alongside FloatingEngineControls.
const KEEP_AWAKE_TAG = "stembit-playback";

export default function KeepAwakeWhilePlaying() {
  const metronome = useMetronome();
  const loop = useLoopPlayback();
  const pad = usePadPlayback();
  const session = useSessionPlayback();

  const isAnyEnginePlaying =
    metronome.isPlaying || loop.isPlaying || pad.isPlaying || session.isPlaying;

  useEffect(() => {
    if (!isAnyEnginePlaying) return;

    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch((error) => {
      // Not fatal: the screen just keeps its normal timeout.
      console.warn("Could not keep the screen awake", error);
    });

    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {
        // Already released, or never acquired because the call above failed.
      });
    };
  }, [isAnyEnginePlaying]);

  return null;
}
