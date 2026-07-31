import { useEffect, useRef, useState } from "react";

import { KEYS, usePadPlayback } from "../context/PadPlaybackContext";
import { useLoopPlayback } from "../context/LoopPlaybackContext";
import { usePreferences } from "../context/PreferencesContext";
import { findPadPackByKey } from "../constants/pads";
import { findLoopByKey } from "../constants/loops";
import type { SessionItem } from "../context/SessionsContext";

// Firing one cue from a setlist: load what it names and start it.
//
// The point of a session is that on stage this is a single tap, so everything
// that would otherwise be four screens of setting up -- pick the loop, set the
// tempo, choose the pad pack, find the key -- happens here in order.
//
// Order matters. The pad stack is a preference the pad engine reads, so it has to
// be in place before a key is pressed; the loop's tempo has to be set after the
// loop is selected, because selecting one resets the tempo to its own.

/** A cue can name a loop, a pad, or both. This is what it takes to run one. */
export function useSessionCue() {
  const { prefs, setPref } = usePreferences();
  const {
    setSelectedLoopKey,
    setBpm,
    startLoop,
    stopLoop,
    isPlaying: loopPlaying,
    selectedKey,
  } = useLoopPlayback();
  const { togglePad, stopPad, activeKeyIndex } = usePadPlayback();

  /** The cue currently live, so the list can mark it. */
  const [liveItemId, setLiveItemId] = useState<string | null>(null);
  // The pad can't be armed and played in the same tick: the engine reads the
  // stack out of preferences, and that write has to land first.
  const pendingPadRef = useRef<{ index: number } | null>(null);

  useEffect(() => {
    const pending = pendingPadRef.current;
    if (!pending) return;
    pendingPadRef.current = null;
    togglePad(pending.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.padLayers]);

  const play = (item: SessionItem) => {
    setLiveItemId(item.id);

    if (item.padPack && item.padKey) {
      const pack = findPadPackByKey(item.padPack);
      const index = KEYS.indexOf(item.padKey);

      if (pack && index >= 0) {
        const already = prefs.padLayers.length === 1 &&
          prefs.padLayers[0].pack === pack.key;

        // A cue names one pad, so it plays exactly that one -- the mixer's
        // stack from the last song would otherwise sound underneath it.
        if (!already) {
          setPref("padLayers", [{ pack: pack.key, level: 1, muted: false }]);
          pendingPadRef.current = { index };
        } else if (activeKeyIndex !== index) {
          togglePad(index);
        }
      }
    } else {
      stopPad();
    }

    if (item.loopKey && findLoopByKey(item.loopKey)) {
      // Selecting resets the tempo to the loop's own, so the cue's tempo goes on
      // after it. Nothing starts until both are set.
      if (selectedKey !== item.loopKey) setSelectedLoopKey(item.loopKey);
      if (item.bpm) setBpm(item.bpm);
      if (!loopPlaying) startLoop();
    } else if (loopPlaying) {
      stopLoop();
    }
  };

  const stop = () => {
    setLiveItemId(null);
    pendingPadRef.current = null;
    stopLoop();
    stopPad();
  };

  return { play, stop, liveItemId };
}
