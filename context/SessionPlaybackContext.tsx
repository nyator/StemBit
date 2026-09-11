import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import { buildSessionEngineHtml } from "../constants/sessionEngine";
import type { ArrangementSpan } from "../constants/arrangement";
import { loadAssetBase64, loadAudioBase64 } from "../utils/loadAssetBase64";
import { resolveStemUri } from "../utils/importStems";
import {
  ACCENT_SOUND_ID,
  BEAT_SOUND_ID,
  METRONOME_SOUNDS,
  useMetronome,
} from "./MetronomeContext";
import { usePreferences } from "./PreferencesContext";
import type { CueTrack } from "./SessionsContext";

// The session's own playback, in a hidden WebView of its own.
//
// Separate from the Loop and Pad tabs' engines because a stem cue is
// multi-track and its tracks have to be sample-locked to each other, which only
// happens when they share one AudioContext. See constants/sessionEngine.ts.
//
// It is also deliberately absent from FloatingEngineControls, so running a set
// never surfaces on another tab.

// Click pan preference -> StereoPanner value (-1 left .. 0 .. 1 right). The
// same preference the loop click reads: pan is a decision about where you want
// a count in your ears, not about which engine is producing it.
const CLICK_PAN_VALUE: Record<string, number> = {
  left: -1,
  center: 0,
  right: 1,
};

// Asset id -> bundled asset module, from the shared metronome sound registry.
// The stem click is the metronome's click, as the loop click is.
const soundAsset = (id: string) =>
  METRONOME_SOUNDS.find((s) => s.id === id)?.asset;

/**
 * What the detector read off a stem; null when it found no pulse to read.
 *
 * Same shape the loop import screen consumes, because it is the same detector
 * (constants/tempoDetect.ts) embedded in both engines. `confidence` is not a
 * probability: it is the winning tempo's share of all the candidate intervals,
 * so material with a clear pulse puts half of them or more on one answer, and
 * material without spreads them.
 */
export type DetectedTempo = {
  bpm: number;
  confidence: number;
  /** Runner-up tempos, best first -- usually where the right answer is. */
  alternatives: number[];
};

/** How a launch is lined up against the transport grid, in beats. */
export type Quantum = 0 | 1 | 2 | 4 | 8;

/** Where the transport has reached. Bars and beats count from 0. */
export type TransportPosition = {
  bar: number;
  beat: number;
  /**
   * Position in the song, in seconds, or null when nothing is sounding.
   *
   * Not derivable from `bar` and `beat` on this side: a section launch seeks
   * into the middle of the stems, so bars elapsed and seconds into the song are
   * different numbers as soon as anyone hits a section pad. The engine knows
   * where it seeked to; nothing else does.
   */
  seconds: number | null;
  /** Post-fader RMS per track id, 0–1, for the mixer's meters. */
  levels: Record<string, number>;
};

/** One stem's place in the mix. Levels are linear 0–1, pan is -1 (L) to 1 (R). */
export type TrackMix = {
  level: number;
  pan: number;
  muted: boolean;
};

/**
 * A span of the song to launch: where to start, where to stop, and whether to
 * repeat.
 *
 * `loop` defaults on, which is what a section pad wants -- hold on the chorus
 * and it comes round again. The timeline turns it off: a playhead dropped on
 * bar 40 promises the song from bar 40, not four bars on a ring.
 */
export type PlaySpan = {
  id: string;
  startSeconds: number;
  endSeconds?: number;
  loop?: boolean;
  /**
   * How many times through before the song carries on past this span.
   *
   * Absent means the engine falls back to `loop` -- which is how the timeline
   * launches, and why this is optional rather than defaulted. Present, it wins:
   * 1 plays once and continues, SECTION_LOOP_FOREVER (0) holds, and anything
   * higher counts. See CueSection.repeats.
   */
  repeats?: number;
  /**
   * The song's sections, for a play-through that honours all of them.
   *
   * Sent by PLAY, which walks the whole arrangement rather than firing one
   * section: the engine repeats each one as its own count says and carries on
   * into the next. A section pad sends `repeats` instead -- it launches one
   * span and has no opinion about what follows.
   */
  arrangement?: ArrangementSpan[];
};

type SessionPlaybackContextValue = {
  /** Cue whose stems are currently decoded, or null. */
  loadedCueId: string | null;
  /** True once every track of the loaded cue has decoded. */
  isReady: boolean;
  isPlaying: boolean;
  /**
   * Decode a cue's stems, dropping whatever the last one left behind. Safe to
   * call for the cue already loaded -- it returns without touching the engine,
   * so re-cueing the live song doesn't stall it.
   *
   * `force` decodes anyway, for the one case that check gets wrong: the cue is
   * the same cue but its stems have changed underneath it, which is what
   * importing or removing one in STUDIO does. Without it the engine would keep
   * playing the set of stems the song had when it was opened.
   */
  loadCue: (cueId: string, tracks: CueTrack[], force?: boolean) => Promise<void>;
  /**
   * Start the loaded cue. `quantum` 0 starts now; 4 waits for the next bar.
   * `section` seeks every track to the same point, which is what keeps them
   * locked across a jump.
   */
  play: (
    tracks: CueTrack[],
    bpm: number,
    quantum?: Quantum,
    section?: PlaySpan
  ) => void;
  stop: () => void;
  /**
   * Place one track in the mix without disturbing the others. Omitted fields
   * are left where they are, so a fader move doesn't reset a pan.
   */
  setTrack: (trackId: string, mix: Partial<TrackMix>) => void;
  /**
   * Watch the transport. Returns an unsubscribe.
   *
   * A subscription rather than a value on this context: the engine reports 16
   * times a second, and this provider wraps the whole app -- as state it would
   * re-render every screen to move one counter. Only what subscribes re-renders.
   */
  subscribePosition: (listener: (position: TransportPosition) => void) => () => void;
  /**
   * The shape of one track, for drawing. Resolves once the engine has measured
   * it; rejects only if the track isn't loaded.
   */
  getPeaks: (trackId: string) => Promise<{ peaks: number[]; duration: number }>;
  /**
   * Read the tempo off a loaded stem. Resolves to null when the detector can't
   * find a pulse, which is a normal answer rather than a failure.
   *
   * Measured on the buffer this engine already decoded. The alternative was a
   * second engine mounted to read a second copy of the same audio, at the one
   * moment a whole multitrack song is already in memory.
   */
  detectTempo: (trackId: string) => Promise<DetectedTempo | null>;
};

const SessionPlaybackContext =
  createContext<SessionPlaybackContextValue | null>(null);

export function SessionPlaybackProvider({ children }: { children: ReactNode }) {
  const { prefs } = usePreferences();
  // Only to get out of the way -- see play(). Read through a ref because play()
  // is called from handlers that captured an older render.
  const { isPlaying: metroPlaying, stopMetronome } = useMetronome();
  const metroPlayingRef = useRef(metroPlaying);
  metroPlayingRef.current = metroPlaying;
  const webViewRef = useRef<WebView>(null);
  const [engineHtml] = useState(buildSessionEngineHtml);
  const [engineGeneration, setEngineGeneration] = useState(0);

  const [loadedCueId, setLoadedCueId] = useState<string | null>(null);
  // Mirrors loadedCueId for the same reason readyRef mirrors isReady: a
  // deferred play fires from a handler that captured an older render.
  const loadedCueIdRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Messages posted before the page attaches its listeners are dropped, so
  // everything queues until the engine's "ready" handshake.
  const engineReadyRef = useRef(false);
  const messageQueueRef = useRef<Record<string, unknown>[]>([]);
  // Track ids still decoding, so "all loaded" is a fact rather than a guess.
  const pendingRef = useRef<Set<string>>(new Set());
  // Identifies the load that owns pendingRef -- see loadCue.
  const loadTokenRef = useRef(0);
  // Readiness as a ref as well as state: play() is called from handlers that
  // captured an older render, and asking stale state whether the stems are
  // decoded is how a launch ends up firing into an empty engine.
  const readyRef = useRef(false);
  // Whoever is currently drawing the transport. A set rather than a single
  // callback so a screen mounting before the last one unmounts can't silently
  // displace it.
  const positionListenersRef = useRef<Set<(p: TransportPosition) => void>>(
    new Set()
  );
  // Outstanding getPeaks calls, by track id.
  const peaksWaitersRef = useRef<
    Map<string, (shape: { peaks: number[]; duration: number }) => void>
  >(new Map());
  // A play that arrived before the stems finished decoding. Firing on stage
  // shouldn't need the operator to know whether a file has decoded yet, so the
  // press is remembered and honoured the moment it can be.
  const pendingPlayRef = useRef<{
    tracks: CueTrack[];
    bpm: number;
    quantum: Quantum;
    section?: PlaySpan;
  } | null>(null);

  const markReady = () => {
    readyRef.current = true;
    setIsReady(true);

    const pending = pendingPlayRef.current;
    if (!pending) return;
    pendingPlayRef.current = null;
    startPlayback(pending.tracks, pending.bpm, pending.quantum, pending.section);
  };

  const postToEngine = (message: Record<string, unknown>) => {
    if (!engineReadyRef.current) {
      messageQueueRef.current.push(message);
      return;
    }
    webViewRef.current?.postMessage(JSON.stringify(message));
  };

  /* ---------------------------------------------------------------------- */
  /* Click                                                                   */
  /* ---------------------------------------------------------------------- */

  // Click sound ids already handed to the engine to decode.
  const clickLoadedRef = useRef<Set<string>>(new Set());
  // Outstanding detectTempo calls, by track id.
  const tempoWaitersRef = useRef<
    Map<string, (tempo: DetectedTempo | null) => void>
  >(new Map());

  const loadClickSound = (id: string | undefined) => {
    if (!id || clickLoadedRef.current.has(id)) return;
    const asset = soundAsset(id);
    if (asset == null) return;
    clickLoadedRef.current.add(id);
    loadAssetBase64(asset)
      .then((base64) => postToEngine({ type: "loadClick", id, base64 }))
      .catch((error) => {
        clickLoadedRef.current.delete(id);
        console.error("Failed to load stem click sound", id, error);
      });
  };

  // Everything about the click except whether it is on comes from the same
  // place the loop click reads -- the same two samples, how loud each voice is,
  // where it sits in the stereo field, and the metronome's own master. Only the
  // on/off is its own (prefs.stemClick), because a song and a loop want a count
  // at different times.
  //
  // Note the level: the metronome master, not the loop or pad volume. The click
  // is the metronome, layered over a song rather than played on its own.
  useEffect(() => {
    loadClickSound(ACCENT_SOUND_ID);
    loadClickSound(BEAT_SOUND_ID);
    postToEngine({
      type: "setClick",
      enabled: prefs.stemClick,
      pan: CLICK_PAN_VALUE[prefs.loopClickPan] ?? 0,
      accentId: ACCENT_SOUND_ID,
      beatId: BEAT_SOUND_ID,
      accentVolume: prefs.accentVolume * prefs.metronomeVolume,
      beatVolume: prefs.beatVolume * prefs.metronomeVolume,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    prefs.stemClick,
    prefs.loopClickPan,
    prefs.accentVolume,
    prefs.beatVolume,
    prefs.metronomeVolume,
    engineGeneration,
  ]);

  const loadCue = async (cueId: string, tracks: CueTrack[], force = false) => {
    if (cueId === loadedCueId && !force) return;

    // Which load is the current one.
    //
    // A load reads every stem off disk one at a time, so it is in flight for as
    // long as that takes -- and a second one can now start while it runs, since
    // `force` exists precisely to reload a cue that is already loaded. The two
    // then share pendingRef: the older run keeps posting its tracks into the
    // newer run's pending set and empties it early, so the engine is declared
    // ready with stems it has never decoded and the play that follows arms
    // tracks with no buffers. A press that looks like it worked and makes no
    // sound. The token lets a superseded run notice and stand down.
    const token = ++loadTokenRef.current;

    readyRef.current = false;
    setIsReady(false);
    loadedCueIdRef.current = cueId;
    setLoadedCueId(cueId);
    // Free the previous song before decoding the next. A set's worth of stems
    // held at once would exhaust the WebView long before the night ended.
    postToEngine({ type: "clearTracks" });

    pendingRef.current = new Set(tracks.map((track) => track.id));
    if (tracks.length === 0) {
      markReady();
      return;
    }

    // Sequential rather than Promise.all: each file is read into a base64
    // string, and a song's stems read at once would hold several copies of the
    // whole song in JS memory at the same moment.
    for (const track of tracks) {
      if (loadTokenRef.current !== token) return;
      try {
        const base64 = await loadAudioBase64(resolveStemUri(track.uri));
        if (loadTokenRef.current !== token) return;
        postToEngine({ type: "loadTrack", id: track.id, base64 });
      } catch (error) {
        console.error("Failed to read stem", track.name, error);
        pendingRef.current.delete(track.id);
        // A file that can't be read produces no "loaded" message, so nothing
        // else will ever empty the set on its behalf. Without this, one
        // unreadable stem -- or the last stem of a song failing -- leaves the
        // cue waiting on a track that is never coming: isReady stays false, and
        // every press of PLAY is quietly queued instead of sounding.
        if (pendingRef.current.size === 0) markReady();
      }
    }
  };

  function startPlayback(
    tracks: CueTrack[],
    bpm: number,
    quantum: Quantum,
    section?: PlaySpan
  ) {
    postToEngine({ type: "setTempo", bpm });
    postToEngine({
      type: "arm",
      sectionId: section?.id ?? loadedCueIdRef.current,
      tracks: tracks.map((track) => track.id),
      quantum,
      offset: section?.startSeconds ?? 0,
      endSeconds: section?.endSeconds ?? 0,
      loop: section?.loop ?? true,
      // Sent through as-is, undefined included. The engine reads a present
      // `repeats` as "a count was asked for" and an absent one as "use the
      // old loop flag", so defaulting it here would rewrite every timeline
      // seek into a counted launch.
      repeats: section?.repeats,
      arrangement: section?.arrangement,
    });
    setIsPlaying(true);
  }

  const play = (
    tracks: CueTrack[],
    bpm: number,
    quantum: Quantum = 0,
    section?: PlaySpan
  ) => {
    // Anything else still sounding is from before the set started.
    //
    // Here rather than at the call sites because there are several -- a setlist
    // row, PERFORM's transport, STUDIO's, a section pad -- and every one of them
    // means the same thing: this song is what the room hears now. The stem
    // engine holds no playback lock of its own, so without this a click left
    // running on the metronome tab simply plays over the song.
    if (metroPlayingRef.current) stopMetronome();

    // Held until the stems have decoded. A stem cue is tens of megabytes and
    // decoding takes a moment; arming before then would launch a section whose
    // tracks have no buffers yet, which the engine skips -- silence, from a
    // press that looked like it worked.
    if (!readyRef.current) {
      pendingPlayRef.current = { tracks, bpm, quantum, section };
      return;
    }
    startPlayback(tracks, bpm, quantum, section);
  };

  const stop = () => {
    // Drops a play that was still waiting on a decode, so stopping during the
    // load doesn't leave a launch that fires once the stems arrive.
    pendingPlayRef.current = null;
    postToEngine({ type: "stopTransport" });
    setIsPlaying(false);
  };

  const setTrack = (trackId: string, mix: Partial<TrackMix>) => {
    postToEngine({
      type: "setTrack",
      id: trackId,
      level: mix.level,
      muted: mix.muted,
      pan: mix.pan,
    });
  };

  const detectTempo = (trackId: string) =>
    new Promise<DetectedTempo | null>((resolve) => {
      // Same request/response shape as getPeaks: the bridge has none of its own,
      // so the reply is matched by track id.
      tempoWaitersRef.current.set(trackId, resolve);
      postToEngine({ type: "detectTempo", id: trackId });

      // Detection renders a lowpass through an OfflineAudioContext and can take
      // several passes over tens of seconds of audio. Generous, then -- but not
      // unbounded: a stem that never answers must not leave a screen waiting on
      // it forever. Resolving null rather than rejecting, because "couldn't read
      // a tempo" is the same answer whether the detector said so or never
      // finished, and the screen does the same thing with both.
      setTimeout(() => {
        const waiter = tempoWaitersRef.current.get(trackId);
        if (!waiter) return;
        tempoWaitersRef.current.delete(trackId);
        waiter(null);
      }, 30000);
    });

  const getPeaks = (trackId: string) =>
    new Promise<{ peaks: number[]; duration: number }>((resolve, reject) => {
      // Resolved by the "peaks" message rather than awaited across the bridge,
      // which has no request/response of its own. Keyed by track id so several
      // waveforms can be measured at once without their answers crossing.
      peaksWaitersRef.current.set(trackId, resolve);
      // Enough buckets to still look like audio zoomed in. At 400 a lane held
      // at 32x is a row of blocks, which is no use for the thing zoom is for --
      // putting a marker on a transient rather than near one.
      postToEngine({ type: "getPeaks", id: trackId, buckets: 1200 });

      // A track that never decoded produces no answer, and a waveform that
      // waits forever is worse than one that admits it has nothing to draw.
      setTimeout(() => {
        if (peaksWaitersRef.current.delete(trackId)) {
          reject(new Error(`No peaks for ${trackId}`));
        }
      }, 5000);
    });

  const subscribePosition = (
    listener: (position: TransportPosition) => void
  ) => {
    positionListenersRef.current.add(listener);
    return () => {
      positionListenersRef.current.delete(listener);
    };
  };

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "ready") {
        engineReadyRef.current = true;
        const queued = messageQueueRef.current;
        messageQueueRef.current = [];
        queued.forEach((message) =>
          webViewRef.current?.postMessage(JSON.stringify(message))
        );
      } else if (data.type === "loaded") {
        pendingRef.current.delete(data.id);
        if (pendingRef.current.size === 0) markReady();
      } else if (data.type === "peaks") {
        const waiter = peaksWaitersRef.current.get(data.id);
        if (waiter) {
          peaksWaitersRef.current.delete(data.id);
          waiter({ peaks: data.peaks, duration: data.duration });
        }
      } else if (data.type === "tempo") {
        const waiter = tempoWaitersRef.current.get(data.id);
        if (waiter) {
          tempoWaitersRef.current.delete(data.id);
          waiter(data.tempo ?? null);
        }
      } else if (data.type === "position") {
        positionListenersRef.current.forEach((listener) =>
          listener({
            bar: data.bar,
            beat: data.beat,
            seconds: typeof data.seconds === "number" ? data.seconds : null,
            levels: data.levels ?? {},
          })
        );
      } else if (data.type === "ended") {
        // A song played straight ran out. The engine stops its own transport
        // and says so separately, but clearing this here means the button
        // flips the moment the audio does rather than a message later.
        setIsPlaying(false);
      } else if (data.type === "transport") {
        // The engine is the authority on whether anything is running -- it
        // stops the transport itself in cases the app never hears about.
        setIsPlaying(data.running === true);
      } else if (data.type === "error") {
        console.error("Session engine error:", data.code, data.id ?? "");
        // A stem that won't decode must not leave the cue waiting forever on a
        // track that is never coming.
        if (data.id) {
          pendingRef.current.delete(data.id);
          if (pendingRef.current.size === 0) markReady();
        }
      }
    } catch {
      // Ignore malformed messages.
    }
  };
  useEffect(() => {
 
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") postToEngine({ type: "resume" });
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restartEngine = () => {
    engineReadyRef.current = false;
    messageQueueRef.current = [];
    pendingRef.current = new Set();
    // Any load still walking a track list belongs to the engine that just died.
    loadTokenRef.current += 1;
    // The replacement has decoded nothing, click samples included; the effect
    // that pushes click config re-sends them on the new generation.
    clickLoadedRef.current.clear();
    pendingPlayRef.current = null;
    readyRef.current = false;
    loadedCueIdRef.current = null;
    setLoadedCueId(null);
    setIsReady(false);
    setIsPlaying(false);
    setEngineGeneration((generation) => generation + 1);
  };

  return (
    <SessionPlaybackContext.Provider
      value={{
        loadedCueId,
        isReady,
        isPlaying,
        loadCue,
        play,
        stop,
        setTrack,
        subscribePosition,
        getPeaks,
        detectTempo,
      }}
    >
      {children}
      <WebView
        key={engineGeneration}
        ref={webViewRef}
        source={{ html: engineHtml }}
        onMessage={handleWebViewMessage}
        onRenderProcessGone={() => {
          console.warn("Session engine renderer was killed — restarting it");
          restartEngine();
        }}
        onContentProcessDidTerminate={() => {
          console.warn("Session engine content process ended — restarting it");
          restartEngine();
        }}
        originWhitelist={["*"]}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        containerStyle={{ flex: 0, width: 0, height: 0 }}
      />
    </SessionPlaybackContext.Provider>
  );
}

export function useSessionPlayback(): SessionPlaybackContextValue {
  const context = useContext(SessionPlaybackContext);
  if (!context) {
    throw new Error(
      "useSessionPlayback must be used within a SessionPlaybackProvider"
    );
  }
  return context;
}
