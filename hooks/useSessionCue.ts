import { useEffect, useRef, useState } from "react";

import { KEYS, usePadPlayback } from "../context/PadPlaybackContext";
import { useLoopPlayback } from "../context/LoopPlaybackContext";
import { usePreferences, type PadLayer } from "../context/PreferencesContext";
import { findPadPackByKey } from "../constants/pads";
import { findLoopByKey } from "../constants/loops";
import type { SessionItem } from "../context/SessionsContext";

/**
 * What the Loop and Pad tabs looked like before a session took them over, so
 * running a setlist can be undone.
 */
type TabState = {
  padLayers: PadLayer[];
  loopKey: string | null;
  bpm: number;
};

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
    bpm,
  } = useLoopPlayback();
  const { togglePad, stopPad, activeKeyIndex } = usePadPlayback();

  /** The cue currently live, so the list can mark it. */
  const [liveItemId, setLiveItemId] = useState<string | null>(null);
  // What the Loop and Pad tabs held before this session started, captured on
  // the first cue and put back on stop.
  //
  // A session doesn't own any playback of its own -- it drives the same two
  // engines the tabs do, which is what keeps only one thing sounding at a time
  // on stage. The cost is that firing a cue overwrites the loop selection, the
  // tempo, and the pad stack, and padLayers is a *persisted* preference: before
  // this, running one setlist destroyed whatever the user had built in the pad
  // mixer, permanently and with no way back.
  const tabStateRef = useRef<TabState | null>(null);
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
    // Only on the first cue: later cues in the same setlist are overwriting the
    // session's own work, not the user's, so re-snapshotting there would record
    // the previous song and lose what we came in with.
    if (tabStateRef.current === null) {
      tabStateRef.current = {
        padLayers: prefs.padLayers,
        loopKey: selectedKey,
        bpm,
      };
    }

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

    // Hand the tabs back exactly as the session found them.
    const before = tabStateRef.current;
    if (!before) return;
    tabStateRef.current = null;

    setPref("padLayers", before.padLayers);
    // Same ordering the cue itself relies on: selecting a loop resets the tempo
    // to that loop's own, so the remembered tempo has to be written after it.
    setSelectedLoopKey(before.loopKey ?? undefined);
    setBpm(before.bpm);
  };

  return { play, stop, liveItemId };
}
