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
import { useMetronome } from "./MetronomeContext";
import { useSessionPlayback } from "./SessionPlaybackContext";
import { arrangementFrom } from "../constants/arrangement";
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
  /**
   * A cue that has been pressed and is waiting for the next downbeat to start,
   * or null. The running order shows it as armed so the press reads as having
   * registered -- without that, a cue that will not sound for most of a bar
   * looks like a button that did nothing.
   */
  armedItemId: string | null;
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

/**
 * Longest an armed cue waits for a downbeat before starting anyway.
 *
 * A 4/4 bar at the slowest tempo the loop engine allows is six seconds, so a
 * real downbeat always wins this. It is here for the cases where none is
 * coming at all -- see armCueFallback.
 */
const ARM_TIMEOUT_MS = 8000;

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
    queueLoopSwap,
    cancelLoopSwap,
    subscribeSwap,
  } = useLoopPlayback();
  const { togglePad, stopPad, activeKeyIndex, mode, setMode } = usePadPlayback();
  // Only to get out of the way. A setlist never drives the metronome; it just
  // can't leave one running underneath what it fires.
  const { isPlaying: metroPlaying, stopMetronome } = useMetronome();
  const metroPlayingRef = useRef(metroPlaying);
  metroPlayingRef.current = metroPlaying;
  const session = useSessionPlayback();

  const [liveItemId, setLiveItemId] = useState<string | null>(null);
  // The cue waiting for a downbeat, and the id the running order draws as
  // armed. Both, because one is read from a message handler and the other has
  // to make the list re-render.
  const pendingCueRef = useRef<SessionItem | null>(null);
  const [armedItemId, setArmedItemId] = useState<string | null>(null);
  // Backstop for a downbeat that never arrives -- see armCueFallback.
  const armFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live mirrors of two values that decide whether a press arms or fires. Read
  // through refs because play() is called from a press that captured an older
  // render, and a stale "is a loop running" answers the question wrongly in
  // exactly the case this feature is for.
  const loopPlayingRef = useRef(loopPlaying);
  loopPlayingRef.current = loopPlaying;
  const liveItemIdRef = useRef<string | null>(null);
  liveItemIdRef.current = liveItemId;
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

  /**
   * Clear the stage for a cue.
   *
   * A setlist is the top of the app: what it fires is what the room hears, and
   * anything left running from another tab is something the user was doing
   * BEFORE they started the set. The metronome is the case that bit -- it holds
   * the same playback lock the loop engine wants, so firing a loop cue over a
   * running click used to fail on the lock and simply not sound, with a warning
   * nobody sees. Refusing is the right answer between two tabs the user is
   * choosing between; it is the wrong answer for a cue, which is a decision
   * that has already been made.
   */
  const clearTheStage = () => {
    if (metroPlayingRef.current) stopMetronome();
  };

  const startCue = (item: SessionItem) => {
    clearTheStage();

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
      // The song's shape goes with it, so a cue fired from a setlist row plays
      // the arrangement the same way the performance screen's PLAY does.
      // Without this the counts only worked from the one screen that happened
      // to send them, which made the same song behave differently depending on
      // where it was started from -- the worst kind of difference to discover
      // on stage.
      const sections = item.sections ?? [];
      session.play(tracks, item.bpm ?? 120, 0, {
        id: "song",
        startSeconds: sections[0]?.startSeconds ?? 0,
        loop: false,
        arrangement: arrangementFrom(sections),
      });
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
      // Unconditionally. This used to be gated on `!loopPlaying`, which is the
      // value from the render this closure was made in -- so firing a cue while
      // another was playing read "already playing" and skipped the start, even
      // though selecting the new loop a line earlier had just stopped the old
      // one. The cue went silent and only worked if you pressed stop first.
      //
      // Safe to call either way: startLoop returns early when the loop is
      // genuinely still running, which it checks against a ref rather than a
      // captured render.
      startLoop();
    } else if (loopPlaying) {
      stopLoop();
    }
  };

  /** Forget whatever was waiting, and stop waiting for it. */
  const clearArmed = () => {
    const wasArmed = pendingCueRef.current !== null;
    pendingCueRef.current = null;
    setArmedItemId(null);
    if (armFallbackRef.current) {
      clearTimeout(armFallbackRef.current);
      armFallbackRef.current = null;
    }
    // The engine is holding a boundary for it; tell it to let go, or the swap
    // would still land after the cue was abandoned.
    if (wasArmed) cancelLoopSwap();
  };

  /**
   * A press must always end in a sound.
   *
   * The wait is for an accent from the engine, and there are ways one never
   * comes: a loop region shorter than a beat reports no beats at all, and an
   * engine the OS reclaimed reports nothing. Neither is worth leaving a cue
   * armed forever over -- quantising is a nicety, a button that does nothing is
   * not. So the wait has a ceiling, generous enough that a real downbeat wins
   * it at any tempo the app allows (a 4/4 bar at the slowest is six seconds).
   */
  const armCueFallback = () => {
    if (armFallbackRef.current) clearTimeout(armFallbackRef.current);
    armFallbackRef.current = setTimeout(() => {
      armFallbackRef.current = null;
      const next = pendingCueRef.current;
      if (!next) return;
      pendingCueRef.current = null;
      setArmedItemId(null);
      startCueRef.current(next);
    }, ARM_TIMEOUT_MS);
  };

  /**
   * Fire a cue -- on the next bar line, if something is already running.
   *
   * Pressing a cue mid-bar and having it start under your finger is the one
   * thing a setlist must not do: the change lands wherever your thumb happened
   * to be rather than where the band is. So a cue pressed over a running loop is
   * ARMED, and joins on the next downbeat -- the same promise the section pads
   * make inside a song.
   *
   * The swap itself is the engine's, not this file's. Everything the boundary
   * needs is handed over in one message and both sources are scheduled against
   * the audio clock, so the new loop starts on the sample the old one ends and
   * the seam is a crossfade rather than a gap. Nothing about the timing comes
   * back through here -- a message arriving on a downbeat would already be late
   * by however long the bridge took, which is the whole reason the engine
   * exists.
   *
   * The pad is not part of the swap. It is a drone rather than a transport, and
   * moving it a beat early or late is inaudible, so it changes here as soon as
   * the cue is armed.
   *
   * Only over a loop. A stem cue is tens of megabytes that have to be read and
   * decoded before a note can sound, and the engine deliberately holds one
   * song's stems at a time -- so there is nothing to have ready on a downbeat.
   * Those still switch immediately.
   */
  const play = (item: SessionItem) => {
    const loop = !item.tracks?.length && item.loopKey
      ? findLoopByKey(item.loopKey)
      : null;

    // TEMPORARY DIAGNOSTIC -- remove once the loop-swap arm is confirmed working.
    console.log("[SessionCue] play()", {
      itemId: item.id,
      hasLoop: !!loop,
      loopPlaying: loopPlayingRef.current,
      liveItemId: liveItemIdRef.current,
    });

    if (loop && loopPlayingRef.current && liveItemIdRef.current !== item.id) {
      captureTabState();
      const queued = queueLoopSwap(loop, item.bpm ?? loop.bpm);
      // TEMPORARY DIAGNOSTIC -- remove once the loop-swap arm is confirmed working.
      console.log("[SessionCue] queueLoopSwap ->", queued);
      if (queued) {
        pendingCueRef.current = item;
        setArmedItemId(item.id);
        armCueFallback();
        // The pad goes now: it has nothing to line up with, and waiting would
        // leave the incoming cue's key arriving a bar after its loop.
        if (item.padPack && item.padKey) {
          armPad(item.padPack, item.padKey, item.padMode ?? "major");
        } else {
          stopPad();
        }
        return;
      }
      // Nothing decoded to swap in yet -- fall through and start it outright
      // rather than swallowing the press.
    }

    // Pressing anything else abandons a cue that was waiting: the last thing
    // pressed is what should play, which is how the section pads behave too.
    clearArmed();
    startCue(item);
  };

  // Held in refs and subscribed once: these are new closures every render, and
  // re-subscribing on each would tear the listener down and rebuild it several
  // times a second for no reason.
  const startCueRef = useRef(startCue);
  startCueRef.current = startCue;
  const clearArmedRef = useRef(clearArmed);
  clearArmedRef.current = clearArmed;

  // The armed cue became the live one, or couldn't.
  //
  // The audio has already changed by the time this arrives -- the engine swapped
  // the sources on the boundary itself. All that is left here is to say so: mark
  // the cue live and take the armed styling off. The message being a little late
  // costs a few milliseconds of a border colour, not a beat.
  useEffect(
    () =>
      subscribeSwap((key) => {
        const next = pendingCueRef.current;
        if (!next) return;
        clearArmedRef.current();

        if (key === null) {
          // The engine couldn't do it after all. Start the cue outright rather
          // than leaving a press that never sounded.
          startCueRef.current(next);
          return;
        }
        setLiveItemId(next.id);
      }),
    [subscribeSwap]
  );

  // Silence, and nothing else. Deliberately does NOT restore: putting the
  // user's own loop back re-selects it in the engine, so the next cue had to
  // swap the loaded loop a second time and wait on its decode before it would
  // sound. Between songs that read as the transport hanging. The loaded loop is
  // left where it is; the restore happens once, when the set ends.
  const stopTransport = () => {
    setLiveItemId(null);
    pendingPadRef.current = null;
    // A cue waiting on a downbeat that is no longer coming: stopping has to
    // take the armed one with it, or it would fire into the silence.
    clearArmedRef.current();
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
        armedItemId,
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
