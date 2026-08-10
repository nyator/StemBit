import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated } from "react-native";

import { KEYS, usePadPlayback } from "./PadPlaybackContext";
import { useLoopPlayback } from "./LoopPlaybackContext";
import { usePreferences, type PadLayer } from "./PreferencesContext";
import { findPadPackByKey } from "../constants/pads";
import { findLoopByKey } from "../constants/loops";
import type { SessionItem } from "./SessionsContext";

// Firing cues from a setlist: load what a cue names and start it.
//
// The point of a session is that on stage this is a single tap, so everything
// that would otherwise be four screens of setting up -- pick the loop, set the
// tempo, choose the pad pack, find the key -- happens here in order.
//
// Order matters. The pad stack is a preference the pad engine reads, so it has
// to be in place before a key is pressed; the loop's tempo has to be set after
// the loop is selected, because selecting one resets the tempo to its own.
//
// This is a context rather than a plain hook because what it holds outlives the
// screen that drives it. (sessions)/setlist is a pushed Stack route, so leaving
// for a tab unmounts it -- while the loop and pad engines, mounted at the root,
// keep playing. As hook-local state, both fields below reset on that remount:
// the screen came back showing nothing playing, its play button then no-opped
// (the engines were already running, so every branch of play() was a no-op) and
// only stop appeared to work. Held here, they live exactly as long as the audio.

/**
 * What the Loop and Pad tabs looked like before a session took them over, so
 * running a setlist can be undone.
 */
type TabState = {
  padLayers: PadLayer[];
  loopKey: string | null;
  bpm: number;
};

type SessionCueContextValue = {
  /** The cue currently live, so the list can mark it. */
  liveItemId: string | null;
  /**
   * How far through the current loop pass the live cue is, 0–1. Passed through
   * from the loop engine so the setlist can show it without reaching into the
   * Loop tab's context itself. Animated.Value, not a number -- see the note on
   * LoopPlaybackContext.loopPhase.
   */
  loopPhase: Animated.Value;
  play: (item: SessionItem) => void;
  /** Silence the live cue. Fast, and leaves the engine ready to fire another. */
  stop: () => void;
  /**
   * Finish the set: silence everything and give the Loop and Pad tabs back
   * exactly as the session found them. Separate from stop() because restoring
   * re-selects the user's own loop, and doing that between cues made every
   * stop-then-start swap the engine's loaded loop twice.
   */
  endSession: () => void;
};

const SessionCueContext = createContext<SessionCueContextValue | null>(null);

export function SessionCueProvider({ children }: { children: ReactNode }) {
  const { prefs, setPref } = usePreferences();
  const {
    setSelectedLoopKey,
    setBpm,
    startLoop,
    stopLoop,
    isPlaying: loopPlaying,
    selectedKey,
    bpm,
    loopPhase,
  } = useLoopPlayback();
  const { togglePad, stopPad, activeKeyIndex } = usePadPlayback();

  const [liveItemId, setLiveItemId] = useState<string | null>(null);
  // What the Loop and Pad tabs held before this session started, captured on
  // the first cue and put back on stop.
  //
  // A session doesn't own any playback of its own -- it drives the same two
  // engines the tabs do, which is what keeps only one thing sounding at a time
  // on stage. The cost is that firing a cue overwrites the loop selection, the
  // tempo, and the pad stack, and padLayers is a *persisted* preference: without
  // this, running one setlist destroys whatever the user built in the pad mixer,
  // permanently and with no way back.
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
    // Only on the first cue of a session: later cues are overwriting the
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

  // Silence, and nothing else. Deliberately does NOT restore: putting the
  // user's own loop back re-selects it in the engine, so the next cue had to
  // swap the loaded loop a second time and wait on its decode before it would
  // sound. Between songs that read as the transport hanging. The loaded loop is
  // left where it is; the restore happens once, when the set ends.
  const stop = () => {
    setLiveItemId(null);
    pendingPadRef.current = null;
    stopLoop();
    stopPad();
  };

  const endSession = () => {
    stop();

    const before = tabStateRef.current;
    if (!before) return;
    tabStateRef.current = null;

    setPref("padLayers", before.padLayers);
    // Same ordering the cue itself relies on: selecting a loop resets the tempo
    // to that loop's own, so the remembered tempo has to be written after it.
    setSelectedLoopKey(before.loopKey ?? undefined);
    setBpm(before.bpm);
  };

  return (
    <SessionCueContext.Provider
      value={{ liveItemId, loopPhase, play, stop, endSession }}
    >
      {children}
    </SessionCueContext.Provider>
  );
}

export function useSessionCue(): SessionCueContextValue {
  const context = useContext(SessionCueContext);
  if (!context) {
    throw new Error("useSessionCue must be used within a SessionCueProvider");
  }
  return context;
}
