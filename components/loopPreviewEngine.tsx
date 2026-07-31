import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import { buildLoopEngineHtml } from "../constants/loopEngine";
import { METRONOME_SOUNDS } from "../context/MetronomeContext";
import { usePreferences } from "../context/PreferencesContext";
import { loadAssetBase64 } from "../utils/loadAssetBase64";

// A second, throwaway instance of the loop engine, for the import screen.
//
// The same Web Audio engine the Loop tab plays through (constants/loopEngine.ts)
// — so what the user hears while trimming and warping here is exactly what
// they'll hear after saving, down to the same stretcher and the same click. It
// gets its own instance rather than borrowing LoopPlaybackContext's for one
// reason: that engine holds the user's *selected* loop, and auditioning an
// import through it would quietly evict it. This one is mounted with the screen
// and dies with it.
//
// Import also needs something the shipped catalog never does: analysis. The file
// has to be decoded to be drawn and measured before there's a Loop to select,
// which is the "analyze" message.

/**
 * What the detector read off the audio; null when it found no beat to read.
 *
 * From realtime-bpm-analyzer, which reports whole BPM values folded into 90-180
 * — so a 70 BPM loop comes back as 140 and an 85 as 170. It reports no downbeat,
 * which is why an imported loop's region starts where the audio starts rather
 * than on a detected first beat.
 */
export type DetectedTempo = {
  bpm: number;
  /**
   * The winning tempo's share of all the candidates' interval counts, 0–1. Not a
   * probability: a clear pulse puts half the intervals or more on one tempo,
   * while material with no pulse spreads them evenly across several. The screen
   * uses it to decide whether to apply the tempo or only offer it.
   */
  confidence: number;
  /** Runner-up tempos, best first. Usually where the right answer is if the top one is wrong. */
  alternatives: number[];
};

/** What the engine reports back about a picked file. */
export type LoopAnalysis = {
  key: string;
  duration: number;
  /** The audible region, as an opening suggestion for the trim. */
  audibleStart: number;
  audibleEnd: number;
  /** Peak amplitudes, 0–1, evenly spaced across the whole file. */
  peaks: number[];
  /** Tempo read off the audible region. */
  tempo: DetectedTempo | null;
};

export type LoopPreviewHandle = {
  /** Decode a picked file and report its length, waveform and audible region. */
  analyze: (key: string, base64: string) => void;
  /**
   * Re-read the tempo of one region. Worth doing once the user has trimmed:
   * a count-in, a tail or a bar of applause all drag the reading around, and
   * the trim is the part they actually mean.
   */
  detect: (key: string, start: number, end: number) => void;
  /**
   * Peaks for one window, at whatever resolution is asked for. The trimmer's zoom
   * needs this: the overview's buckets are tens of milliseconds wide, far too
   * coarse to place an edge on the front of a drum hit.
   */
  regionPeaks: (
    key: string,
    start: number,
    end: number,
    buckets: number
  ) => void;
  /** Make the analyzed file the active loop, at this tempo and trim. */
  load: (options: {
    key: string;
    nativeBpm: number;
    beatsPerBar: number;
    trimStart: number;
    trimEnd: number;
  }) => void;
  play: (rate: number) => void;
  stop: () => void;
  /** Re-warp what's playing (target BPM / the loop's own BPM). */
  setRate: (rate: number) => void;
};

type LoopPreviewEngineProps = {
  onAnalyzed: (analysis: LoopAnalysis) => void;
  /**
   * Answer to a `detect` call. The key comes with it because detection takes long
   * enough (a decode, a filter render, a dozen threshold passes) for the user to
   * have picked a different file by the time it lands.
   */
  onDetected: (key: string, tempo: DetectedTempo | null) => void;
  /** Answer to a `regionPeaks` call, carrying back the window it describes. */
  onRegionPeaks: (
    key: string,
    start: number,
    end: number,
    peaks: number[]
  ) => void;
  /**
   * Where playback has reached, as a fraction through the loop, several times a
   * second while it plays — and null when it stops. Read off the audio clock in
   * the engine, which is the only clock that knows what's actually being heard.
   */
  onPosition: (phase: number | null) => void;
  onError: (message: string) => void;
  /** Layer the metronome click over the preview, locked to the loop's grid. */
  clickEnabled: boolean;
};

const soundAsset = (id: string) =>
  METRONOME_SOUNDS.find((sound) => sound.id === id)?.asset;

export const LoopPreviewEngine = forwardRef<
  LoopPreviewHandle,
  LoopPreviewEngineProps
>(function LoopPreviewEngine(
  { onAnalyzed, onDetected, onRegionPeaks, onPosition, onError, clickEnabled },
  ref
) {
  const { prefs } = usePreferences();
  const webViewRef = useRef<WebView>(null);
  const [engineHtml] = useState(buildLoopEngineHtml);

  // Same handshake as LoopPlaybackContext: anything posted before the page has
  // attached its listeners is dropped, so it queues until "ready".
  const readyRef = useRef(false);
  const queueRef = useRef<Record<string, unknown>[]>([]);
  const clickLoadedRef = useRef<Set<string>>(new Set());

  // The callbacks are read through refs so the message handler and the
  // imperative methods can't close over a stale render.
  const onAnalyzedRef = useRef(onAnalyzed);
  onAnalyzedRef.current = onAnalyzed;
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const onRegionPeaksRef = useRef(onRegionPeaks);
  onRegionPeaksRef.current = onRegionPeaks;
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const post = (message: Record<string, unknown>) => {
    if (readyRef.current) {
      webViewRef.current?.postMessage(JSON.stringify(message));
    } else {
      queueRef.current.push(message);
    }
  };

  const loadClickSound = (id: string | undefined) => {
    if (!id || clickLoadedRef.current.has(id)) return;
    const asset = soundAsset(id);
    if (asset == null) return;
    clickLoadedRef.current.add(id);
    loadAssetBase64(asset)
      .then((base64) => post({ type: "loadClick", id, base64 }))
      .catch((error) => {
        clickLoadedRef.current.delete(id);
        console.error("Failed to load preview click sound", id, error);
      });
  };

  // The click follows the user's metronome sounds and levels, exactly as the
  // Loop tab's does — it's here to check the trim and tempo against, so it has
  // to be the same click they'll hear later.
  useEffect(() => {
    loadClickSound(prefs.accentSound);
    loadClickSound(prefs.beatSound);
    post({
      type: "setClick",
      enabled: clickEnabled,
      pan: 0,
      accentId: prefs.accentSound,
      beatId: prefs.beatSound,
      accentVolume: prefs.accentVolume * prefs.metronomeVolume,
      beatVolume: prefs.beatVolume * prefs.metronomeVolume,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clickEnabled,
    prefs.accentSound,
    prefs.beatSound,
    prefs.accentVolume,
    prefs.beatVolume,
    prefs.metronomeVolume,
  ]);

  useEffect(() => {
    post({ type: "setLoopVolume", volume: prefs.loopVolume });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.loopVolume]);

  useImperativeHandle(ref, () => ({
    analyze: (key, base64) => post({ type: "analyze", key, base64 }),
    detect: (key, start, end) => post({ type: "detect", key, start, end }),
    regionPeaks: (key, start, end, buckets) =>
      post({ type: "regionPeaks", key, start, end, buckets }),
    load: ({ key, nativeBpm, beatsPerBar, trimStart, trimEnd }) =>
      post({ type: "select", key, nativeBpm, beatsPerBar, trimStart, trimEnd }),
    play: (rate) => post({ type: "play", rate }),
    stop: () => post({ type: "stop" }),
    setRate: (rate) => post({ type: "setRate", rate }),
  }));

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") {
        readyRef.current = true;
        const queued = queueRef.current;
        queueRef.current = [];
        queued.forEach((message) =>
          webViewRef.current?.postMessage(JSON.stringify(message))
        );
        // Only this engine asks for the playhead: the import screen has a
        // waveform to draw it on, and it's several messages a second.
        post({ type: "positionUpdates", enabled: true });
      } else if (data.type === "analyzed") {
        onAnalyzedRef.current({
          key: data.key,
          duration: data.duration,
          audibleStart: data.audibleStart,
          audibleEnd: data.audibleEnd,
          peaks: Array.isArray(data.peaks) ? data.peaks : [],
          tempo: data.tempo ?? null,
        });
      } else if (data.type === "detected") {
        onDetectedRef.current(data.key, data.tempo ?? null);
      } else if (data.type === "position") {
        onPositionRef.current(
          typeof data.phase === "number" ? data.phase : null
        );
      } else if (data.type === "regionPeaks") {
        onRegionPeaksRef.current(
          data.key,
          data.start,
          data.end,
          Array.isArray(data.peaks) ? data.peaks : []
        );
      } else if (data.type === "error") {
        onErrorRef.current(
          data.code === "decode-failed"
            ? "That file couldn't be decoded. Try an MP3, WAV or M4A."
            : data.message || "The preview engine hit a problem."
        );
      }
    } catch (error) {
      // Ignore malformed messages
    }
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ html: engineHtml }}
      onMessage={handleMessage}
      onRenderProcessGone={() =>
        onErrorRef.current("The preview engine stopped. Go back and try again.")
      }
      onContentProcessDidTerminate={() =>
        onErrorRef.current("The preview engine stopped. Go back and try again.")
      }
      originWhitelist={["*"]}
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
      containerStyle={{ flex: 0, width: 0, height: 0 }}
      style={{ flex: 0, width: 0, height: 0, opacity: 0 }}
      pointerEvents="none"
    />
  );
});
