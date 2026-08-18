import {
  createContext,
  useCallback,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { Alert, Animated, AppState, Easing } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { setAudioModeAsync } from "expo-audio";

import {
  findLoopByKey,
  getAllLoops,
  getBeatsPerBar,
  type Loop,
} from "../constants/loops";
import { buildLoopEngineHtml } from "../constants/loopEngine";
import { loadAssetBase64, loadAudioBase64 } from "../utils/loadAssetBase64";
import { usePlaybackLock } from "./PlaybackLockContext";
import { usePreferences } from "./PreferencesContext";
import { useUserLoops } from "./UserLoopsContext";
import {
  METRONOME_SOUNDS,
  PLAYBACK_FEELS,
  DEFAULT_FEEL_INDEX,
} from "./MetronomeContext";

export const LOOP_MIN_BPM = 20;
export const LOOP_MAX_BPM = 240;

// How long the engine gets to answer a liveness ping before it's declared
// dead. Generous: the WebView may still be waking up after a spell in the
// background, and a needless restart costs a re-decode.
// Matches POSITION_INTERVAL_MS in constants/loopEngine.ts: how often the engine
// reports the playhead, and therefore how long each tween between reports runs.
const POSITION_REPORT_MS = 60;

const ENGINE_PONG_TIMEOUT_MS = 2000;

// How long playback survives after the app reports it went to the background
// before it's actually stopped. See the AppState handler for why this exists.
const BACKGROUND_STOP_GRACE_MS = 5000;

// Loop-click pan preference -> StereoPanner value (-1 left .. 0 .. 1 right).
const CLICK_PAN_VALUE: Record<string, number> = {
  left: -1,
  center: 0,
  right: 1,
};

// Asset id -> bundled asset module, from the shared metronome sound registry.
// The loop click "follows the metronome's sound", so it plays whichever
// accent/beat samples the Metronome is set to.
const soundAsset = (id: string) =>
  METRONOME_SOUNDS.find((s) => s.id === id)?.asset;

/**
 * A hold on the loop's phase, and the value that hold keeps fed.
 *
 * `phase` is how far through the current loop pass playback is, 0–1, resetting
 * on every pass -- so it drives anything that has to move in time with the loop.
 * An Animated.Value rather than a number: it changes 16 times a second, and the
 * provider wraps the whole app, so as state it would re-render every screen for
 * a value one row draws. Interpolate it; don't read it in render.
 *
 * Only the engine can know it. A bundled loop's region is found inside the
 * WebView (silence trim, then a snap to whole beats), so its length exists
 * nowhere in JS, and anything timed here instead would drift against the audio.
 *
 * It costs something to know, which is why it is leased rather than simply
 * available. Reporting it is 16 messages a second, each parsed on the RN JS
 * thread and each starting a JS-driven animation on arrival -- continuous work
 * on the one thread that also has to deliver the beat. Left running for screens
 * that draw no phase, it saturated that thread and the beat visualiser slid
 * progressively behind a click that never moved. So the engine is asked for it
 * only while a lease is out, and released the moment the last one goes.
 */
export type LoopPhaseLease = {
  phase: Animated.Value;
  release: () => void;
};

type LoopPlaybackContextValue = {
  bpm: number;
  setBpm: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  isBlockedByOtherEngine: boolean;
  // Title of the currently selected loop, or null when none is selected.
  // Lives here (not in route params) so it survives regardless of which
  // screen instance is currently focused -- same pattern as Pad/Metro.
  selectedTitle: string | null;
  /** Key of the selected loop, so the browser can mark the loaded row. */
  selectedKey: string | null;
  // The tempo the selected loop was recorded at, or null when none is
  // selected. Reset returns the BPM control to this.
  nativeBpm: number | null;
  // Beats per bar of the selected loop (time-signature numerator, defaults
  // to 4). Drives the beat-dot count on the loop screen.
  beatsPerBar: number;
  /** Index into PLAYBACK_FEELS: half / normal / double time. */
  feelIndex: number;
  setFeelIndex: (index: number) => void;
  /**
   * The feel's multiplier, exposed so the screen's beat dots can pulse at the
   * rate the loop is actually running rather than at the raw BPM.
   */
  speedMultiplier: number;
  resetBpm: () => void;
  /**
   * Take out a lease on the loop's phase: the value, and the reporting that
   * keeps it moving. Release it when you stop drawing.
   *
   * The value is reachable ONLY through a lease, which is the point. The engine
   * reports its position only while something has said it is drawing that --
   * see the note on the lease type -- so a phase handed out on its own would
   * sit at zero forever and read as a bug in whoever drew it. Making the two
   * inseparable means that cannot be written.
   *
   * Prefer the useLoopPhase hook below, which pairs the lease to a component's
   * lifetime so releasing isn't something a caller can forget.
   */
  retainPhase: () => LoopPhaseLease;
  /**
   * Watch the loop's beats: which beat of the bar has just landed, 0-based and
   * null when nothing is sounding, and whether it's an accent. Returns an
   * unsubscribe.
   *
   * One call per beat, from the engine's own grid -- the cursor that schedules
   * the click -- announced at the moment that beat sounds. That is the only
   * number that cannot drift from what is being heard, and two earlier attempts
   * at this both did: a setInterval at the current tempo, and then sampling the
   * playhead every 60ms. Neither is wrong about the tempo; they are wrong about
   * *when*, by a little more each bar.
   *
   * A subscription rather than a value on this context, for the same reason
   * loopPhase is an Animated.Value: this provider wraps the whole app, and as
   * state every beat would re-render every tab and both navigators for a row of
   * dots that one screen draws.
   */
  subscribeBeat: (
    listener: (beat: number | null, accent: boolean) => void
  ) => () => void;
  setSelectedLoopKey: (key: string | undefined) => void;
  startLoop: () => void;
  stopLoop: () => void;
};

const LoopPlaybackContext = createContext<LoopPlaybackContextValue | null>(
  null
);

// Plays the selected backing loop track, "warped" to the current BPM
// (playback rate = bpm / the loop's own recorded tempo, see
// constants/loops.ts).
//
// Playback happens inside a hidden WebView running a Web Audio engine
// (constants/loopEngine.ts): sample-accurate gapless looping with
// silence-trimmed, beat-snapped loop points — things AVPlayer/ExoPlayer
// looping can't do.
//
// The whole catalog is preloaded and decoded into the engine as soon as it
// boots, so selecting a loop is a pointer swap and pressing play is always
// instant. If play is somehow pressed mid-load (e.g. first seconds of app
// start), it's queued and fires the moment the loop is ready rather than
// asking the user to try again.
export function LoopPlaybackProvider({ children }: { children: ReactNode }) {
  const { activeEngine, requestStart, release } = usePlaybackLock();
  const { prefs } = usePreferences();
  // The user's imported loops. Read here only to know when a new one has
  // appeared and needs preloading — every lookup goes through findLoopByKey,
  // which covers both catalogs.
  const { userLoops } = useUserLoops();
  const isBlockedByOtherEngine =
    activeEngine !== null && activeEngine !== "loop";

  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);

  // Playback feel (subdivision): half / normal / double time, same three
  // options the Metronome offers. It lives here rather than on the screen
  // because it's part of the playback rate the engine runs at — on the screen
  // it was a control that changed nothing.
  const [feelIndex, setFeelIndex] = useState(DEFAULT_FEEL_INDEX);
  const speedMultiplier = PLAYBACK_FEELS[feelIndex].multiplier;
  // Read by getPlaybackRate, which is called from callbacks that would
  // otherwise close over a stale value.
  const speedMultiplierRef = useRef(speedMultiplier);
  speedMultiplierRef.current = speedMultiplier;

  // The tempo the loaded loop was recorded at; BPM changes are warped onto
  // it via playback rate (bpm / nativeBpm = 1x at the loop's own tempo).
  const nativeBpmRef = useRef<number | null>(null);
  // Mirror of nativeBpmRef in state, so the UI can show/enable a reset
  // control against the loop's original tempo.
  const [nativeBpm, setNativeBpm] = useState<number | null>(null);
  // Beats per bar of the selected loop (time-signature numerator), so the
  // engine accents every bar downbeat rather than only the loop's first beat.
  // Mirrored in state so the beat visuals can react to it.
  const beatsPerBarRef = useRef<number>(4);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const currentKeyRef = useRef<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loopReady, setLoopReady] = useState(false);
  const loopReadyRef = useRef(false);
  // Play was pressed while the loop was still decoding: start as soon as
  // the engine reports it loaded.
  const pendingPlayRef = useRef(false);

  const webViewRef = useRef<WebView>(null);
  const [engineHtml] = useState(buildLoopEngineHtml);
  // Position reporting is off in the engine by default because it posts a
  // message every 60ms. It's switched on with playback and off again on stop,
  // so the traffic only exists while something can actually be drawn from it.
  //
  // Deliberately an Animated.Value and NOT React state. This provider wraps the
  // whole app, so 16 setState calls a second would re-render every tab and both
  // navigators for a value only one row draws -- enough jank to make the thing
  // it drives stutter. Writing to an Animated.Value re-renders nothing.
  const loopPhase = useRef(new Animated.Value(0)).current;
  // Last reported phase, to tell a wrap (which snaps) from normal progress
  // (which tweens).
  const lastPhaseRef = useRef(0);
  // Whoever is drawing the beat, and the last beat they were told about. A set
  // rather than a single callback so a screen mounting before the last one
  // unmounts can't silently displace it.
  const beatListenersRef = useRef<
    Set<(beat: number | null, accent: boolean) => void>
  >(new Set());
  const lastBeatRef = useRef<number | null>(null);
  // How many mounted things are drawing loopPhase. Zero means the engine can
  // stop reporting its position -- see retainPhase.
  const phaseDemandRef = useRef(0);
  // Bumping this remounts the WebView, which is how a dead engine is
  // recovered (see restartEngine).
  const [engineGeneration, setEngineGeneration] = useState(0);
  // Pending liveness check, if one is in flight.
  const pongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Countdown to stopping playback after the app went to the background.
  const backgroundStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Messages posted before the WebView page has attached its listeners are
  // silently dropped, so everything is queued until its "ready" handshake.
  const engineReadyRef = useRef(false);
  const messageQueueRef = useRef<Record<string, unknown>[]>([]);
  // Loop keys whose preload has been handed to the engine (or is in flight).
  const preloadStartedRef = useRef<Set<string>>(new Set());
  // Click sound ids already handed to the engine to decode.
  const clickLoadedRef = useRef<Set<string>>(new Set());

  const postToEngine = (message: Record<string, unknown>) => {
    if (engineReadyRef.current) {
      webViewRef.current?.postMessage(JSON.stringify(message));
    } else {
      messageQueueRef.current.push(message);
    }
  };

  // Read a loop's audio and hand it to the engine to decode ahead of time.
  // Works for either kind of loop: a bundled asset, or a file the user
  // imported (see context/UserLoopsContext.tsx).
  const preloadLoop = (key: string) => {
    if (preloadStartedRef.current.has(key)) return;
    preloadStartedRef.current.add(key);

    const loop = findLoopByKey(key);
    if (!loop) return;

    loadAudioBase64(loop.source)
      .then((base64) => {
        postToEngine({
          type: "preload",
          key: loop.key,
          base64,
          nativeBpm: loop.bpm,
        });
      })
      .catch((error) => {
        // Allow a retry on next select.
        preloadStartedRef.current.delete(key);
        console.error("Failed to preload loop", key, error);
      });
  };

  // What the engine needs to make a loop active. An imported loop carries the
  // trim the user set on the import screen; a bundled one leaves those off and
  // lets the engine find its own loop points.
  const selectMessage = (loop: Loop, base64?: string) => ({
    type: "select",
    key: loop.key,
    nativeBpm: loop.bpm,
    beatsPerBar: getBeatsPerBar(loop),
    trimStart: loop.trimStart,
    trimEnd: loop.trimEnd,
    base64,
  });

  // Hand a click sample (by metronome sound id) to the engine to decode, once.
  const loadClickSound = (id: string | undefined) => {
    if (!id || clickLoadedRef.current.has(id)) return;
    const asset = soundAsset(id);
    if (asset == null) return;
    clickLoadedRef.current.add(id);
    loadAssetBase64(asset)
      .then((base64) => {
        postToEngine({ type: "loadClick", id, base64 });
      })
      .catch((error) => {
        clickLoadedRef.current.delete(id);
        console.error("Failed to load loop click sound", id, error);
      });
  };

  // Push the current loop-click config (from preferences) to the engine. The
  // click follows the metronome's selected sounds + per-voice volumes, and its
  // overall level tracks the metronome master (Settings -> Metronome Volume) —
  // NOT the Loop Volume, which governs the backing track. Plus its own enable +
  // pan preferences.
  const postClickConfig = () => {
    postToEngine({
      type: "setClick",
      enabled: prefs.loopClick,
      pan: CLICK_PAN_VALUE[prefs.loopClickPan] ?? 0,
      accentId: prefs.accentSound,
      beatId: prefs.beatSound,
      accentVolume: prefs.accentVolume * prefs.metronomeVolume,
      beatVolume: prefs.beatVolume * prefs.metronomeVolume,
    });
  };

  // Re-send the active loop to the engine with its audio attached. Used both
  // when the engine comes up empty and when it reports it has no bytes for
  // the current key — in either case the startup preloads are async file
  // reads, so a bare "select" would arrive first and fail.
  const reselectCurrentLoop = () => {
    const key = currentKeyRef.current;
    const loop = key ? findLoopByKey(key) : null;
    if (!loop) return;
    loadAudioBase64(loop.source)
      .then((base64) => {
        if (currentKeyRef.current !== loop.key) return; // selection moved on
        postToEngine(selectMessage(loop, base64));
      })
      .catch((error) => {
        console.error("Loop reload failed", error);
      });
  };

  // Throw the engine away and build a new one.
  //
  // The WebView's process can be reclaimed by the OS while the app sits in
  // the background (Android kills the renderer, iOS terminates the content
  // process). The view object survives, so nothing looks wrong, but its page
  // is gone: every postMessage lands nowhere. That reads as "the loop just
  // stopped working", and re-selecting a loop doesn't help because that is a
  // postMessage too.
  //
  // Recovery is a remount rather than webViewRef.reload(): after
  // onRenderProcessGone, Android's WebView instance is unusable and must be
  // replaced, not reloaded. Clearing engineReadyRef first matters — it puts
  // postToEngine back into queueing mode, so anything sent while the
  // replacement boots is delivered on its "ready" instead of dropped.
  const restartEngine = () => {
    if (pongTimerRef.current) {
      clearTimeout(pongTimerRef.current);
      pongTimerRef.current = null;
    }
    engineReadyRef.current = false;
    messageQueueRef.current = [];
    preloadStartedRef.current.clear();
    clickLoadedRef.current.clear();
    loopReadyRef.current = false;
    setLoopReady(false);
    pendingPlayRef.current = false;
    isPlayingRef.current = false;
    setIsPlaying(false);
    release("loop");
    setEngineGeneration((generation) => generation + 1);
  };

  // Ask the engine to answer for itself. onRenderProcessGone /
  // onContentProcessDidTerminate cover most deaths, but they don't fire on
  // every OS and build, and a silently dead engine is exactly the failure
  // that leaves the user with a play button that does nothing.
  const checkEngineAlive = () => {
    if (!engineReadyRef.current) return; // still booting; "ready" will settle it
    if (pongTimerRef.current) return; // a check is already outstanding
    pongTimerRef.current = setTimeout(() => {
      pongTimerRef.current = null;
      console.warn("Loop engine stopped responding — restarting it");
      restartEngine();
    }, ENGINE_PONG_TIMEOUT_MS);
    webViewRef.current?.postMessage(JSON.stringify({ type: "ping" }));
  };

  // Warm the whole catalog at startup so play is always instant. Runs again
  // when the user's imports arrive — they're read from disk, so they land after
  // the first pass — and after a new one is added. preloadStartedRef makes the
  // repeats free for anything already handed over.
  useEffect(() => {
    getAllLoops().forEach((loop) => preloadLoop(loop.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoops]);

  // Keep the app's audio session configured for playback in silent mode
  // (iOS). The WebView plays through the same session.
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionModeAndroid: "duckOthers",
    }).catch((error) => {
      console.error("Failed to set audio mode", error);
    });
  }, []);

  /**
   * Say that something is drawing the loop's phase. Returns a release.
   *
   * The engine only reports its position while someone is looking, because the
   * reporting is not free and it is not free on a thread that can afford it:
   * sixteen messages a second, each one parsed on the RN JS thread and each one
   * starting a 60ms JS-driven animation on arrival. Continuous work, forever,
   * on the same thread that has to deliver the beat -- and the beat is what
   * ends up queued behind it. That is a visualiser running progressively later
   * than a click which is scheduled on the audio clock and doesn't care how
   * busy JS is.
   *
   * The Loop tab draws no phase at all, so before this it was paying that bill
   * for nothing, the whole time it was playing.
   */
  const retainPhase = useCallback((): LoopPhaseLease => {
    phaseDemandRef.current += 1;
    if (phaseDemandRef.current === 1 && isPlayingRef.current) {
      postToEngine({ type: "positionUpdates", enabled: true });
    }

    // Each lease releases once. Without this a double release -- React's strict
    // mode runs an effect's cleanup twice on mount, and callers are human --
    // would decrement for a hold that was only taken once, and the count would
    // reach zero while something was still drawing.
    let released = false;
    return {
      phase: loopPhase,
      release: () => {
        if (released) return;
        released = true;
        phaseDemandRef.current = Math.max(0, phaseDemandRef.current - 1);
        if (phaseDemandRef.current === 0) {
          postToEngine({ type: "positionUpdates", enabled: false });
          loopPhase.setValue(0);
          lastPhaseRef.current = 0;
        }
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable across renders, so a subscriber's effect doesn't tear down and
  // resubscribe every time this provider re-renders -- which it does on every
  // tempo nudge.
  const subscribeBeat = useCallback(
    (listener: (beat: number | null, accent: boolean) => void) => {
      beatListenersRef.current.add(listener);
      return () => {
        beatListenersRef.current.delete(listener);
      };
    },
    []
  );

  const stopLoop = () => {
    pendingPlayRef.current = false;
    isPlayingRef.current = false;
    setIsPlaying(false);
    postToEngine({ type: "stop" });
    postToEngine({ type: "positionUpdates", enabled: false });
    loopPhase.setValue(0);
    lastPhaseRef.current = 0;
    // Said here as well as by the engine's parting message, so a dot is never
    // left lit by a message that went missing on the way out.
    if (lastBeatRef.current !== null) {
      lastBeatRef.current = null;
      beatListenersRef.current.forEach((listener) => listener(null, false));
    }
    release("loop");
  };

  // Loop audio only makes sense in the foreground: the WebView's audio
  // clock suspends in the background anyway. Coming back is also the moment
  // the engine is most likely to have been reclaimed while we weren't
  // looking, so that's where the liveness check goes.
  //
  // Only a real "background" counts, and even then not straight away.
  // "inactive" is a transient overlay — Control Centre, the notification
  // shade, an incoming-call banner, the app switcher — where the app is still
  // on screen and its audio keeps running.
  //
  // Android doesn't report "inactive" at all: RN maps the activity's onPause
  // straight to "background", so pulling down the notification shade looks
  // identical to genuinely leaving the app. Hence the grace period rather
  // than a state test alone — a glance at a notification is over in a second
  // or two, actually leaving the app isn't. Whichever state the platform
  // reports, playback survives the short excursion and stops on the long one.
  useEffect(() => {
    const cancelPendingStop = () => {
      if (backgroundStopTimerRef.current) {
        clearTimeout(backgroundStopTimerRef.current);
        backgroundStopTimerRef.current = null;
      }
    };

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        if (!isPlayingRef.current || backgroundStopTimerRef.current) return;
        backgroundStopTimerRef.current = setTimeout(() => {
          backgroundStopTimerRef.current = null;
          // The JS thread can be frozen while backgrounded, so this may fire
          // late — possibly just as the user comes back. Never stop
          // something that is playing in the foreground.
          if (AppState.currentState === "active") return;
          if (isPlayingRef.current) stopLoop();
        }, BACKGROUND_STOP_GRACE_MS);
        return;
      }
      // Back on screen, so whatever took us away was brief.
      cancelPendingStop();
      if (state === "active") checkEngineAlive();
    });

    return () => {
      subscription.remove();
      cancelPendingStop();
      if (pongTimerRef.current) {
        clearTimeout(pongTimerRef.current);
        pongTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rate the engine warps the loop to: the tempo the user asked for against
  // the tempo it was recorded at, times the feel.
  //
  // Folding the feel in here rather than giving it its own control is what
  // makes half/double time work everywhere at once — the WSOLA stretcher
  // time-stretches to whatever rate it's handed (so the pitch holds), and the
  // loop click derives its beat interval from the same currentRate, so the
  // click subdivides along with the music instead of drifting off it.
  const getPlaybackRate = (nextBpm = bpm) => {
    const base = nativeBpmRef.current ? nextBpm / nativeBpmRef.current : 1;
    return base * speedMultiplierRef.current;
  };

  const beginPlayback = () => {
    isPlayingRef.current = true;
    setIsPlaying(true);
    // Only if something is actually drawing the phase -- see retainPhase.
    if (phaseDemandRef.current > 0) {
      postToEngine({ type: "positionUpdates", enabled: true });
    }
    postToEngine({ type: "play", rate: getPlaybackRate() });
  };

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") {
        // Fires on first boot and again if the WebView ever reloads (its
        // caches are wiped then, so everything must be re-sent).
        engineReadyRef.current = true;
        const queued = messageQueueRef.current;
        messageQueueRef.current = [];
        queued.forEach((message) =>
          webViewRef.current?.postMessage(JSON.stringify(message))
        );
        preloadStartedRef.current.clear();
        getAllLoops().forEach((loop) => preloadLoop(loop.key));
        // A fresh engine holds nothing, so the loop is not playable again
        // until the re-select below reports back. Saying so keeps the
        // transport from offering Play against an empty engine.
        loopReadyRef.current = false;
        setLoopReady(false);
        reselectCurrentLoop();
        // The WebView's decoded click buffers + master gain are wiped on
        // reload too: re-send the click samples, config, and loop volume.
        clickLoadedRef.current.clear();
        loadClickSound(prefs.accentSound);
        loadClickSound(prefs.beatSound);
        postClickConfig();
        postToEngine({ type: "setLoopVolume", volume: prefs.loopVolume });
      } else if (data.type === "beat") {
        // A beat is landing right now. One message per beat, sent by the grid
        // that schedules the click, at the moment the click sounds -- so what
        // is drawn and what is heard are the same event rather than two clocks
        // that agree at the start.
        const beat = typeof data.beat === "number" ? data.beat : null;
        const accent = data.accent === true;
        lastBeatRef.current = beat;
        beatListenersRef.current.forEach((listener) => listener(beat, accent));
      } else if (data.type === "position") {
        // phase is 0–1 through the current pass, or null when the engine stops
        // and takes the playhead away.
        const phase = typeof data.phase === "number" ? data.phase : null;
        if (phase === null) {
          loopPhase.setValue(0);
          lastPhaseRef.current = 0;
        } else if (phase < lastPhaseRef.current) {
          // The pass wrapped. Snap: tweening down to a smaller value would run
          // anything driven by this backwards, which reads as a rewind rather
          // than a repeat.
          loopPhase.setValue(phase);
          lastPhaseRef.current = phase;
        } else {
          // Reports land every 60ms; stepping straight to each one visibly
          // stair-steps, so each is tweened over exactly that interval.
          //
          // Tweened one step AHEAD of the reported value, not to it. The wrap
          // happens between reports, so the last phase before a pass ends is
          // short of 1 by however far the loop travels in 60ms -- anything
          // driven by this then stopped visibly short of full and jumped back,
          // never looking like it completed. Leading by the last observed
          // increment means it arrives at 1 exactly as the wrap lands.
          const step = phase - lastPhaseRef.current;
          lastPhaseRef.current = phase;
          Animated.timing(loopPhase, {
            toValue: Math.min(1, phase + step),
            duration: POSITION_REPORT_MS,
            easing: Easing.linear,
            // Interpolated into a width, which isn't a transform.
            useNativeDriver: false,
          }).start();
        }
      } else if (data.type === "loaded") {
        if (data.key !== currentKeyRef.current) return; // stale select
        loopReadyRef.current = true;
        setLoopReady(true);
        if (pendingPlayRef.current) {
          pendingPlayRef.current = false;
          beginPlayback();
        }
      } else if (data.type === "pong") {
        if (pongTimerRef.current) {
          clearTimeout(pongTimerRef.current);
          pongTimerRef.current = null;
        }
      } else if (data.type === "error") {
        // Self-heal: the engine has no bytes for the current loop (e.g. a
        // preload was lost) — re-read the asset and select again with the
        // data attached. The pending play, if any, stays queued and fires
        // when the retried select reports "loaded".
        if (
          data.code === "missing-data" &&
          data.key &&
          data.key === currentKeyRef.current
        ) {
          reselectCurrentLoop();
          return;
        }

        // Play landed on an engine with nothing loaded — it restarted under
        // us, or a select failed. Without this the transport sits there
        // showing "playing" in silence, and pressing it again just repeats
        // the same dead round trip.
        if (data.code === "no-loop") {
          pendingPlayRef.current = false;
          isPlayingRef.current = false;
          setIsPlaying(false);
          release("loop");
          loopReadyRef.current = false;
          setLoopReady(false);
          reselectCurrentLoop();
          return;
        }

        console.error("Loop engine error:", data.message);
        if (pendingPlayRef.current) {
          pendingPlayRef.current = false;
          isPlayingRef.current = false;
          setIsPlaying(false);
          release("loop");
        }
      }
    } catch (error) {
      // Ignore malformed messages
    }
  };

  // Make the given loop the engine's active loop, resetting the tempo
  // control to the loop's own native BPM so it starts back at 1x speed.
  const setSelectedLoopKey = (key: string | undefined) => {
    loopReadyRef.current = false;
    setLoopReady(false);
    stopLoop();

    const selectedLoop = key ? findLoopByKey(key) : null;
    if (!selectedLoop) {
      currentKeyRef.current = null;
      nativeBpmRef.current = null;
      setNativeBpm(null);
      setSelectedTitle(null);
      setSelectedKey(null);
      return;
    }

    currentKeyRef.current = selectedLoop.key;
    setSelectedKey(selectedLoop.key);
    nativeBpmRef.current = selectedLoop.bpm;
    beatsPerBarRef.current = getBeatsPerBar(selectedLoop);
    setBeatsPerBar(beatsPerBarRef.current);
    setNativeBpm(selectedLoop.bpm);
    setBpm(selectedLoop.bpm);
    setSelectedTitle(selectedLoop.title);

    // Normally instant: the engine already holds the decoded buffer from
    // the startup preload. preloadLoop is a no-op if it's in flight, and a
    // recovery path if the original preload failed.
    preloadLoop(selectedLoop.key);
    postToEngine(selectMessage(selectedLoop));
  };

  // Warp the loop's playback rate to match the current BPM relative to the
  // tempo it was recorded at (e.g. sample_bpm80 at bpm=160 plays at 2x), and
  // to the chosen feel. A feel change is a rate change like any other, so the
  // engine debounces it and crossfades at the matching musical position rather
  // than jumping.
  useEffect(() => {
    if (loopReady) {
      postToEngine({ type: "setRate", rate: getPlaybackRate() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, loopReady, feelIndex]);

  // Keep the engine's click samples + config in sync with preferences. Runs on
  // mount (queued until the engine is ready) and whenever any click-relevant
  // preference changes; the engine reacts live if a loop is already playing.
  useEffect(() => {
    loadClickSound(prefs.accentSound);
    loadClickSound(prefs.beatSound);
    postClickConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    prefs.loopClick,
    prefs.loopClickPan,
    prefs.accentSound,
    prefs.beatSound,
    prefs.accentVolume,
    prefs.beatVolume,
    prefs.metronomeVolume,
  ]);

  // Backing-track level (Settings -> Loop Volume). The engine ramps to it, so
  // it applies live if a loop is already playing.
  useEffect(() => {
    postToEngine({ type: "setLoopVolume", volume: prefs.loopVolume });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.loopVolume]);

  // Return the tempo control to the selected loop's recorded BPM (1x rate).
  // No-op when nothing is selected.
  const resetBpm = () => {
    if (nativeBpmRef.current === null) return;
    setBpm(nativeBpmRef.current);
  };

  const startLoop = () => {
    if (isPlaying) return;

    if (nativeBpmRef.current === null) {
      Alert.alert("No loop selected", "Select a loop before pressing play.");
      return;
    }

    if (!requestStart("loop")) {
      console.warn("Stop the Metronome before starting the Loop");
      return;
    }

    if (!loopReadyRef.current) {
      // Still decoding (only possible in the first moments after app
      // start): show the playing state now and start the instant it lands.
      pendingPlayRef.current = true;
      isPlayingRef.current = true;
      setIsPlaying(true);
      return;
    }

    beginPlayback();
  };

  useEffect(() => {
    return () => {
      stopLoop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LoopPlaybackContext.Provider
      value={{
        bpm,
        setBpm,
        isPlaying,
        isBlockedByOtherEngine,
        selectedTitle,
        selectedKey,
        nativeBpm,
        beatsPerBar,
        feelIndex,
        setFeelIndex,
        speedMultiplier,
        resetBpm,
        retainPhase,
        subscribeBeat,
        setSelectedLoopKey,
        startLoop,
        stopLoop,
      }}
    >
      {children}
      <WebView
        // Remounting on a new generation is what actually rebuilds a dead
        // engine — see restartEngine.
        key={engineGeneration}
        ref={webViewRef}
        source={{ html: engineHtml }}
        onMessage={handleWebViewMessage}
        // The OS reclaimed this WebView's process, almost always while the
        // app was backgrounded. Both callbacks mean the same thing: the page
        // is gone and this view can't be used again.
        onRenderProcessGone={() => {
          console.warn("Loop engine renderer was killed — restarting it");
          restartEngine();
        }}
        onContentProcessDidTerminate={() => {
          console.warn("Loop engine content process ended — restarting it");
          restartEngine();
        }}
        originWhitelist={["*"]}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        containerStyle={{ flex: 0, width: 0, height: 0 }}
        style={{ flex: 0, width: 0, height: 0, opacity: 0 }}
        pointerEvents="none"
      />
    </LoopPlaybackContext.Provider>
  );
}

export function useLoopPlayback() {
  const context = useContext(LoopPlaybackContext);
  if (!context) {
    throw new Error(
      "useLoopPlayback must be used within a LoopPlaybackProvider"
    );
  }
  return context;
}

/**
 * The loop's phase, for anything that draws it.
 *
 * Holds the engine's position reporting open for exactly as long as the
 * component is mounted, and lets it stop the moment nothing is drawing. This is
 * the only way to get the value -- see LoopPhaseLease for why the two travel
 * together -- so there is no version of this a caller can hold wrong.
 */
export function useLoopPhase() {
  const { retainPhase } = useLoopPlayback();
  // Taken once per mount, in an initialiser rather than an effect: the value has
  // to exist on the first render, and a phase that arrived one render late would
  // remount whatever interpolates it.
  const [lease] = useState(retainPhase);
  useEffect(() => lease.release, [lease]);
  return lease.phase;
}
