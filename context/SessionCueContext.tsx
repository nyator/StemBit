import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { KEYS, usePadPlayback } from "./PadPlaybackContext";
import { useLoopPlayback } from "./LoopPlaybackContext";
import { useSessionPlayback } from "./SessionPlaybackContext";
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
  /**
   * Major/minor is engine state rather than a preference, so it survives a
   * session without this -- but a cue in a minor key would leave the Pad tab
   * voiced minor after the set ended, which the user never asked for.
   */
  padMode: "major" | "minor";
};

type SessionCueContextValue = {
  /** The cue currently live, so the list can mark it. */
  liveItemId: string | null;
  // No loopPhase here any more. It used to be passed through so the setlist
  // could draw a fill bar without reaching into the Loop tab's context, and
  // that convenience is exactly what made it possible to hold the value without
  // the lease that keeps it fed -- a bar that would simply never move. Anything
  // drawing the phase asks LoopPlaybackContext for it directly, through
  // useLoopPhase, which cannot be held wrong.
  play: (item: SessionItem) => void;
  /**
   * Sound a pad at a given key, under whatever else is playing.
   *
   * Exposed rather than left to callers to do through the pad context directly,
   * because arming a pad means overwriting `padLayers` -- a *persisted*
   * preference holding whatever the user built in the pad mixer. Everything
   * that does that has to snapshot it first, and having one place that does is
   * the only way that stays true. See tabStateRef.
   */
  armPad: (packKey: string, key: string, mode: "major" | "minor") => void;
  /** Silence the pad, leaving anything else playing alone. */
  releasePad: () => void;
  /** Silence the live cue. Fast, and leaves the engine ready to fire another. */
  stop: () => void;
  /**
   * Silence the cue's transports, leaving any pad sounding.
   *
   * For stepping between cues rather than for stopping. The pad is a drone, not
   * a part -- it is brought in over the last chord and left running while you
   * talk, which is exactly the moment you are moving to the next cue -- so it
   * holds across the move while the loop and the stems go quiet. stop() is the
   * one that means silence, and it takes the pad down too.
   */
  stopTransport: () => void;
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
  } = useLoopPlayback();
  const { togglePad, stopPad, activeKeyIndex, mode, setMode } = usePadPlayback();
  const session = useSessionPlayback();

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

  // Only on the first cue of a session: later cues are overwriting the
  // session's own work, not the user's, so re-snapshotting there would record
  // the previous song and lose what we came in with.
  const captureTabState = () => {
    if (tabStateRef.current !== null) return;
    tabStateRef.current = {
      padLayers: prefs.padLayers,
      loopKey: selectedKey,
      bpm,
      padMode: mode,
    };
  };

  const armPad = (packKey: string, key: string, padMode: "major" | "minor") => {
    const pack = findPadPackByKey(packKey);
    const index = KEYS.indexOf(key);
    if (!pack || index < 0) return;

    captureTabState();

    // Voicing first. setMode stops whatever is sounding, so a pad started
    // before it would be silenced by the thing meant to tune it -- and it
    // writes its own ref synchronously, so the toggle below already sees the
    // new voicing.
    const revoiced = mode !== padMode;
    if (revoiced) setMode(padMode);

    const already =
      prefs.padLayers.length === 1 && prefs.padLayers[0].pack === pack.key;

    // A cue names one pad, so it plays exactly that one -- the mixer's stack
    // from the last song would otherwise sound underneath it.
    if (!already) {
      setPref("padLayers", [{ pack: pack.key, level: 1, muted: false }]);
      pendingPadRef.current = { index };
    } else if (revoiced || activeKeyIndex !== index) {
      // Re-toggled unconditionally after a voicing change: setMode cleared the
      // active key, so "it is already on that key" is no longer true however
      // this render's state reads.
      togglePad(index);
    }
  };

  const releasePad = () => {
    pendingPadRef.current = null;
    stopPad();
  };

  const play = (item: SessionItem) => {
    // A stem cue is a different instrument: its tracks are multi-track audio
    // that has to stay locked to itself, so it runs on the session engine and
    // the loop engine is silenced rather than driven.
    //
    // The pad is the exception. It is a drone rather than a transport -- it
    // does not have to line up with anything, so nothing stops it sitting under
    // a stem song in that song's key, which is the one combination worth
    // having.
    if (item.tracks?.length) {
      setLiveItemId(item.id);
      stopLoop();

      if (item.padPack && item.padKey) {
        armPad(item.padPack, item.padKey, item.padMode ?? "major");
      } else {
        stopPad();
      }

      const tracks = item.tracks;
      // loadCue returns as soon as the files are handed over; the engine
      // reports back when they've decoded. play() is safe to call now -- it
      // holds the launch until then rather than firing into an empty engine.
      session.loadCue(item.id, tracks).catch((error) => {
        console.error("Failed to cue stems", error);
      });
      session.play(tracks, item.bpm ?? 120);
      return;
    }

    captureTabState();

    setLiveItemId(item.id);

    if (item.padPack && item.padKey) {
      armPad(item.padPack, item.padKey, item.padMode ?? "major");
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
  const stopTransport = () => {
    setLiveItemId(null);
    pendingPadRef.current = null;
    stopLoop();
    // Unconditional: which engine a cue used isn't worth tracking, and stopping
    // one that isn't running costs nothing. Missing one would leave a song
    // playing with the UI insisting it had stopped.
    session.stop();
  };

  const stop = () => {
    stopTransport();
    stopPad();
  };

  const endSession = () => {
    stop();

    const before = tabStateRef.current;
    if (!before) return;
    tabStateRef.current = null;

    setPref("padLayers", before.padLayers);
    setMode(before.padMode);
    // Same ordering the cue itself relies on: selecting a loop resets the tempo
    // to that loop's own, so the remembered tempo has to be written after it.
    setSelectedLoopKey(before.loopKey ?? undefined);
    setBpm(before.bpm);
  };

  return (
    <SessionCueContext.Provider
      value={{
        liveItemId,
        play,
        armPad,
        releasePad,
        stop,
        stopTransport,
        endSession,
      }}
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
