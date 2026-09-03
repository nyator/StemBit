import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
// The legacy entrypoint, not the package root. SDK 54 ships
// expo-file-system 19, where the root export is the new File/Directory API
// and the path-and-string API this file uses moved behind /legacy. Importing
// from the root leaves EncodingType undefined and makes every read throw.
import * as FileSystem from "expo-file-system/legacy";

import {
  LOOP_CATEGORIES,
  LOOP_TIME_SIGNATURES,
  beatsPerBarOf,
  findLoopByKey,
  suggestLoopTempo,
  type LoopCategory,
} from "../../constants/loops";
import { loadAudioBase64 } from "../../utils/loadAssetBase64";
import {
  LOOP_MAX_BPM,
  LOOP_MIN_BPM,
  useLoopPlayback,
} from "../../context/LoopPlaybackContext";
import { usePlaybackLock } from "../../context/PlaybackLockContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useUserLoops } from "../../context/UserLoopsContext";
import { useBpmControl } from "../../hooks/useBpmControl";
import { hapticImpact } from "../../utils/haptics";

import ScreenHeader from "../../components/ui/screenHeader";
import Screen from "../../components/ui/screen";
import { BpmDial, StepperButton } from "../../components/ui/instrument";
import { BrandButton } from "../../components/ui/brandButton";
import { BrandInput } from "../../components/ui/brandInput";
import WaveformTrimmer, {
  MIN_TRIM_SECONDS,
  type TrimZoom,
} from "../../components/ui/waveformTrimmer";
import {
  LoopPreviewEngine,
  type DetectedTempo,
  type LoopAnalysis,
  type LoopPreviewHandle,
} from "../../components/loopPreviewEngine";
import { COLORS } from "../../constants/theme";
import {
  AddCircle,
  Folder,
  MetronomeFill,
  MetronomeOutline,
  MinusCircle,
  PlayFilled,
  Reset,
  Stop,
} from "../../components/icons";

// Import a loop of the user's own: pick a file, say what tempo it is, trim it to
// the part that loops, and hear it warp before saving. Passed a `key` it edits
// that import instead -- same screen, because "where does this loop start and
// what tempo is it" is the same question the second time round, and a trim is
// exactly the thing you get wrong by a beat and want to fix later.
//
// The tempo and the trim are the whole point. The engine warps a loop by
// time-stretching it from its own tempo to the one asked for, so it needs to
// know two things about a file it has never seen: where the loop actually starts
// and ends, and how many beats that is. Shipped loops have both baked in
// (constants/loops.ts, and the engine's beat-snapping trim). A file off the
// user's phone has neither, and no analysis can reliably guess them -- so this
// screen is where they get set, with the audio playing so the answer can be
// checked by ear rather than trusted.
//
// Once saved it's a catalog entry like any other: the Loop tab warps it, clicks
// over it and changes its BPM with no idea it came from outside.

// Base64 of the whole file crosses the bridge to be decoded, so this is a limit
// on the message as much as on the file. A loop is a bar or two of audio; a cap
// this high is really only here to catch someone picking a whole album.
const MAX_FILE_BYTES = 20 * 1024 * 1024;


// How much audio is measured behind the zoomed view. Wider than the window,
// because the view scrolls -- dragged by the finger, or shoved along by an edge
// nearing the side -- and re-measuring on every frame of that would be a round
// trip to the engine per frame. With a buffer either side, scrolling is just
// re-slicing numbers already in hand.
//
// A multiple of the window rather than a fixed number of seconds: the zoom is
// continuous now, so the window is anything from the whole file down to a tenth
// of a second, and a fixed four seconds would be a wasteful buffer at one end
// and no buffer at all at the other.
const ZOOM_BUFFER_FACTOR = 3;
/** ...but never so narrow that a small scroll runs off the end of it. */
const ZOOM_BUFFER_MIN_SECONDS = 2;
// Buckets across the buffer. Fixed, so the resolution improves as you zoom in:
// the same 1920 measurements spread over a narrower buffer.
const ZOOM_BUCKETS = 1920;
/**
 * Past this window width the overview's own peaks are as good as anything the
 * engine would send back, so nothing is measured at all.
 *
 * The overview is a few hundred buckets across the whole file. Zoomed a little,
 * a slice of it still has more detail per pixel than the screen can draw; it is
 * only further in that it turns into a handful of bars stretched wide.
 */
const ZOOM_MEASURE_BELOW_SECONDS = 30;

// Detected tempo at or above this confidence is applied on the spot; below it,
// the tempo is estimated from the region's length instead and the screen says so.
//
// Measured against material that behaves like real audio
// (utils/tests/loopTempo.test.js): full mixes and melodic loops put 0.37-0.53 of
// the detector's interval counts on the winning tempo, a two-bar snippet 0.24,
// while material with no pulse spreads them out and lands around 0.28. Those
// overlap, so this errs towards applying: a detected tempo is nearly always
// right on real music, the wording says how sure it is, and the alternatives sit
// right there for the cases it isn't.
const AUTO_TEMPO_CONFIDENCE = 0.2;
const STRONG_TEMPO_CONFIDENCE = 0.4;

/** Where the tempo on screen came from. Shown, because it changes how much to trust it. */
type TempoSource = "detected" | "estimated" | "manual" | "saved";

const clampBpm = (value: number) =>
  Math.max(LOOP_MIN_BPM, Math.min(LOOP_MAX_BPM, Math.round(value)));

const formatSeconds = (value: number) => `${value.toFixed(2)}s`;

const fileBaseName = (name: string) =>
  name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "My Loop";

export default function ImportLoopScreen() {
  const router = useRouter();
  const { prefs } = usePreferences();
  const { addUserLoop, updateUserLoop, setLoopOverride } = useUserLoops();
  const { stopLoop, setSelectedLoopKey, selectedKey } = useLoopPlayback();
  const { activeEngine, requestStart, release } = usePlaybackLock();

  // Passed a key, this screen is editing that import rather than making one.
  // Resolved once: the record is edited in place, so a re-resolve mid-edit would
  // hand back the values being replaced.
  const { key: editKey } = useLocalSearchParams<{ key?: string }>();
  const [editing] = useState(() => {
    const loop = editKey ? findLoopByKey(editKey) : null;
    // Shipped loops are editable too. Their audio can't change -- it's bundled --
    // but the tempo the app believes it was recorded at can, and every warp is
    // measured from that, so a catalog entry that's a BPM out is worth correcting.
    return loop ?? null;
  });

  const engineRef = useRef<LoopPreviewHandle>(null);
  // For scrolling a focused field clear of the keyboard. The offset is measured
  // rather than assumed: what's above the name field changes with the file, the
  // notices and whether a tempo was detected.
  const scrollRef = useRef<ScrollView>(null);
  const nameOffsetRef = useRef(0);
  const tempoOffsetRef = useRef(0);

  const [picked, setPicked] = useState<DocumentPicker.DocumentPickerAsset | null>(
    null
  );
  // Unique per pick. It keys the engine's decode cache, so reusing it across
  // files would audition the previous one. Held in a ref because the engine's
  // reply is what's checked against it, and that can land before a re-render.
  const previewKeyRef = useRef("");
  const [analysis, setAnalysis] = useState<LoopAnalysis | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(editing?.title ?? "");
  const [category, setCategory] = useState<LoopCategory>(
    editing?.category ?? LOOP_CATEGORIES[0]
  );
  const [timeSignature, setTimeSignature] = useState<string>(
    editing?.timeSignature ?? LOOP_TIME_SIGNATURES[0]
  );
  /** The loop's own tempo -- what gets saved, and what warping is measured from. */
  const [bpm, setBpm] = useState(editing?.bpm ?? 120);
  /** The tempo the preview is warped to, for checking the loop holds up. */
  const [targetBpm, setTargetBpm] = useState(editing?.bpm ?? 120);
  const [tempoSource, setTempoSource] = useState<TempoSource>(
    editing ? "saved" : "estimated"
  );
  const [tempoConfidence, setTempoConfidence] = useState(0);
  const [detecting, setDetecting] = useState(false);
  // The detector's runner-up tempos, offered as one-tap corrections. It reports
  // everything folded into 90-180 BPM, so the reading a listener wanted is often
  // one of these rather than the winner.
  const [alternatives, setAlternatives] = useState<number[]>([]);

  const [trim, setTrim] = useState({ start: 0, end: 0 });
  // Bumped when an edit is finished (handle released, nudge tapped) rather than
  // while it's in flight: reloading the engine on every drag frame would
  // re-select the loop dozens of times a second.
  const [trimCommits, setTrimCommits] = useState(0);
  const trimRef = useRef(trim);
  trimRef.current = trim;

  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const [clickOn, setClickOn] = useState(true);
  // Only the genuinely occasional settings fold away. The tempo fixes stay on the
  // main path: they're what you came here for on the files where the detector got
  // it wrong, and hiding those behind a tap makes the one thing you need the one
  // thing you have to hunt for.
  const [showMore, setShowMore] = useState(false);
  /** The window the zoomed trim strip is showing, or null when it's closed. */
  const [zoom, setZoom] = useState<TrimZoom | null>(null);
  // Where playback has reached, as a fraction through the loop region, straight
  // off the engine's audio clock. Null when nothing is playing.
  const [playPhase, setPlayPhase] = useState<number | null>(null);
  // Room for the keyboard, only while a field is focused -- otherwise the screen
  // carries a keyboard's worth of empty space under Save the whole time.
  const [fieldFocused, setFieldFocused] = useState(false);

  const beatsPerBar = beatsPerBarOf(timeSignature);
  const duration = analysis?.duration ?? 0;
  const trimLength = Math.max(0, trim.end - trim.start);
  const barsInTrim =
    trimLength > 0 ? (trimLength * bpm) / 60 / beatsPerBar : 0;
  const wholeBars = Math.max(1, Math.round(barsInTrim));
  // Within a fiftieth of a bar counts as on the grid. Closer than that is below
  // what a listener can hear drift over a couple of passes; looser than that and
  // the click walks off the loop.
  const isOnGrid = trimLength > 0 && Math.abs(barsInTrim - wholeBars) < 0.02;
  // Editing a loop that came with the app. Its audio is bundled and its tempo was
  // set when the catalog was built, so the tools for working out an unknown
  // tempo -- tapping it, reading it off the audio, the detector's other readings
  // -- have nothing to add here: the number is already right or nearly right, and
  // all this screen is for is nudging it and hearing the result. Its name,
  // category and time signature are catalog facts and stay put.
  const isShipped = !!editing && !editing.userAdded;
  const canRename = !isShipped;
  const hasAudio = !!editing || !!picked;
  const canSave =
    hasAudio && !!analysis && trimLength >= MIN_TRIM_SECONDS && !!title.trim();
  const isBlockedByOtherEngine = activeEngine !== null && activeEngine !== "loop";

  // The Loop tab's engine keeps playing wherever the user navigates (it's
  // mounted above the navigator), and this screen has an engine of its own. Two
  // loops at once is nobody's intent, so the tab's stops on the way in.
  //
  // Editing also starts here: the file is already on disk, so it goes straight to
  // being read and analysed, skipping the picker.
  useEffect(() => {
    stopLoop();

    // Asked to edit something that isn't there any more. Say so rather than
    // quietly turning into the "add a loop" screen, which would look like the
    // edit silently did nothing.
    if (editKey && !editing) {
      setNotice("That loop couldn't be found — it may have been deleted.");
    }

    if (editing) {
      previewKeyRef.current = editing.key;
      setBusy(true);
      loadAudioBase64(editing.source)
        .then((base64) => engineRef.current?.analyze(editing.key, base64))
        .catch((error) => {
          console.error("Failed to read imported loop", error);
          setBusy(false);
          setNotice("Couldn't read this loop's audio. It may have been removed.");
        });
    }

    return () => {
      release("loop");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopPreview = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    engineRef.current?.stop();
    release("loop");
  };

  // Hand the engine the current tempo and trim. Called after any edit that
  // changes what should be looping; picks the preview back up if it was running,
  // since selecting a loop stops playback in the engine.
  const reloadPreview = (keepPlaying = isPlayingRef.current) => {
    if (!analysis) return;
    const { start, end } = trimRef.current;
    if (end - start < MIN_TRIM_SECONDS) return;

    engineRef.current?.load({
      key: analysis.key,
      nativeBpm: bpm,
      beatsPerBar,
      trimStart: start,
      trimEnd: end,
    });
    if (keepPlaying) {
      engineRef.current?.play(targetBpm / bpm);
    }
  };

  useEffect(() => {
    reloadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis?.key, bpm, timeSignature, trimCommits]);

  // Re-declaring the loop's own tempo resets the warp test to unity: the
  // question "does it hold up at 140?" is a different question once the loop is
  // no longer the tempo it was when you asked.
  useEffect(() => {
    setTargetBpm(bpm);
  }, [bpm]);

  // Warp the running preview. The engine debounces and crossfades at the
  // matching musical position, so this is safe to fire on every step of the
  // control.
  useEffect(() => {
    if (bpm > 0) engineRef.current?.setRate(targetBpm / bpm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetBpm, bpm]);

  const pickFile = async () => {
    setNotice(null);
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
    } catch (error) {
      console.error("Loop file pick failed", error);
      setNotice("Couldn't open the file picker.");
      return;
    }

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];

    if (asset.size != null && asset.size > MAX_FILE_BYTES) {
      setNotice(
        `That file is ${(asset.size / 1024 / 1024).toFixed(
          1
        )} MB. Pick one under ${MAX_FILE_BYTES / 1024 / 1024} MB — a loop only needs to be a bar or two.`
      );
      return;
    }

    stopPreview();
    setAnalysis(null);
    setZoom(null); // a window into audio that's being replaced
    setPicked(asset);
    setTitle(fileBaseName(asset.name));
    setBusy(true);

    const key = `import-${Date.now().toString(36)}`;
    previewKeyRef.current = key;

    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      engineRef.current?.analyze(key, base64);
    } catch (error) {
      console.error("Failed to read picked loop", error);
      setBusy(false);
      setNotice("Couldn't read that file.");
    }
  };

  // Put a region on the grid: start on a beat, end a whole number of bars later.
  // This is the "warp" half of the job -- once a region is a whole number of bars
  // at a known tempo, the engine can stretch it to any other tempo and the click
  // will still land on it. Never runs past the end of the file: bars are dropped
  // until it fits rather than saving a loop that's short of a bar.
  const alignToGrid = (
    atBpm: number,
    startAt: number,
    regionEnd: number,
    total: number,
    beats = beatsPerBar
  ) => {
    const barSeconds = (beats * 60) / atBpm;
    const start = Math.max(0, startAt);
    let barCount = Math.max(1, Math.round((regionEnd - start) / barSeconds));
    while (barCount > 1 && start + barCount * barSeconds > total + 0.001) {
      barCount -= 1;
    }
    return { start, end: Math.min(total, start + barCount * barSeconds) };
  };

  // The engine has decoded the file. If a tempo came back, lay the loop out on
  // it from the start of the audible region -- nothing for the user to set. If it
  // didn't, fall back to inferring a tempo from that region's length, and say
  // which happened: a length guess is worth checking, a detection much less so.
  const handleAnalyzed = (result: LoopAnalysis) => {
    if (result.key !== previewKeyRef.current) return; // a later pick took over
    setBusy(false);
    setAnalysis(result);

    // Editing: the waveform is all that was missing. The tempo and trim are the
    // ones already saved -- re-detecting over them would throw away the very
    // decision the user came back to adjust. DETECT is still there by hand.
    if (editing) {
      setTrim({
        start: editing.trimStart ?? result.audibleStart,
        end: editing.trimEnd ?? result.audibleEnd,
      });
      setTrimCommits((count) => count + 1);
      return;
    }

    adoptTempo(
      result.tempo,
      result.audibleStart,
      result.audibleEnd,
      result.duration
    );
  };

  // What to do with a reading. One place, so picking a file and pressing DETECT
  // can't reach different conclusions from the same evidence.
  //
  // Above the confidence gate the tempo is adopted and the region laid out on it.
  // Below it, the reading is NOT thrown away: its top candidate is still the
  // best-supported tempo in the audio, so it goes to the front of the chips where
  // one tap adopts it. What the screen declines to do is adopt it silently -- it
  // lays out the length-based estimate instead, which is at least a whole number
  // of bars, and the line under the BPM says that's what happened.
  //
  // Returns whether the reading was trusted, for the caller to report.
  const adoptTempo = (
    detected: DetectedTempo | null,
    startAt: number,
    regionEnd: number,
    total: number
  ) => {
    const trusted = !!detected && detected.confidence >= AUTO_TEMPO_CONFIDENCE;

    setAlternatives(
      !detected
        ? []
        : trusted
          ? detected.alternatives
          : [detected.bpm, ...detected.alternatives]
    );

    if (trusted && detected) {
      applyTempo(
        clampBpm(detected.bpm),
        "detected",
        detected.confidence,
        startAt,
        regionEnd,
        total
      );
      return true;
    }

    const guess = suggestLoopTempo(
      Math.max(MIN_TRIM_SECONDS, regionEnd - startAt),
      beatsPerBar,
      { minBpm: LOOP_MIN_BPM, maxBpm: LOOP_MAX_BPM }
    );
    applyTempo(
      guess.bpm,
      "estimated",
      detected ? detected.confidence : 0,
      startAt,
      regionEnd,
      total
    );
    return false;
  };

  // Adopt a tempo and lay the loop out on it, in one go.
  const applyTempo = (
    atBpm: number,
    source: TempoSource,
    confidence: number,
    startAt: number,
    regionEnd: number,
    total: number
  ) => {
    const aligned = alignToGrid(atBpm, startAt, regionEnd, total);
    setBpm(atBpm);
    setTargetBpm(atBpm);
    setTempoSource(source);
    setTempoConfidence(confidence);
    setTrim(aligned);
    setTrimCommits((count) => count + 1);
  };

  // Re-read the tempo, this time from the trim alone. Once the region is right
  // this is a cleaner read than the whole file: no count-in, no fade-out, no
  // stray bar at the end pulling the average around.
  const redetectTempo = () => {
    if (!analysis || trimLength < MIN_TRIM_SECONDS) return;
    setDetecting(true);
    engineRef.current?.detect(analysis.key, trim.start, trim.end);
  };

  const handleDetected = (key: string, tempo: DetectedTempo | null) => {
    setDetecting(false);
    // A reply for a file that has since been replaced. Detection is a decode, a
    // filter render and a dozen threshold passes, so there's real time for the
    // user to have moved on.
    if (!analysis || key !== previewKeyRef.current) return;

    // The trim keeps its start; only its length is re-laid, onto the new tempo's
    // grid. (If the handles moved while this was in flight, they win -- the tempo
    // is a property of the audio, not of exactly where the edges were.)
    const trusted = adoptTempo(tempo, trim.start, trim.end, duration);

    setNotice(
      trusted
        ? null
        : tempo
          ? "Not a clear beat in that region — its best readings are offered under the tempo."
          : "Nothing beat-like in that region — using its length instead."
    );
  };

  // Bring a field to the top of the scroll when it's focused, so the keyboard
  // coming up can't leave it underneath. Delayed a frame: on Android the window
  // resizes as the keyboard opens, and scrolling before that lands in the wrong
  // place.
  const scrollFieldIntoView = (offset: number) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, offset - 24), animated: true });
    }, 120);
  };

  const commitTrim = (start: number, end: number) => {
    setTrim({ start, end });
    setTrimCommits((count) => count + 1);
  };

  // --- Zoomed trimming ----------------------------------------------------
  // Hold a handle and the waveform expands to about a second around that edge, at
  // the engine's full resolution; let go and it's the whole file again. Zoomed
  // out, a few hundred pixels stand in for the whole file, so one pixel is tens of
  // milliseconds and an edge can only land near a beat. This is where it goes on
  // one. Drag toward either side and the view scrolls, so the trim isn't limited
  // to what happened to be on screen when the zoom opened.
  //
  // The screen measures a buffer several times wider than the window; the trimmer
  // slides its view over that. Scrolling therefore costs an array slice rather
  // than a round trip per frame, and the engine is only asked again when the view
  // approaches the end of what's measured.

  // The stretch of audio to measure behind a window, clamped to the file.
  const zoomBufferFor = (view: { start: number; end: number }) => {
    const window = Math.max(0.05, view.end - view.start);
    const span = Math.min(
      Math.max(0.05, duration),
      Math.max(ZOOM_BUFFER_MIN_SECONDS, window * ZOOM_BUFFER_FACTOR)
    );
    const centre = (view.start + view.end) / 2;
    const from = Math.min(
      Math.max(0, centre - span / 2),
      Math.max(0, duration - span)
    );
    return { start: from, end: from + span };
  };

  const fetchZoomBuffer = (view: { start: number; end: number }) => {
    if (!analysis) return null;
    const buffer = zoomBufferFor(view);
    engineRef.current?.regionPeaks(
      analysis.key,
      buffer.start,
      buffer.end,
      ZOOM_BUCKETS
    );
    return buffer;
  };

  /**
   * The trimmer is looking somewhere new -- zoomed, scrolled, or back out to
   * the whole file.
   *
   * Measures a buffer for it, but only when the window is narrow enough that
   * measuring beats slicing the overview, and only when what is already
   * measured doesn't still cover the view. The whole point of a buffer wider
   * than the window is that most scrolling needs nothing.
   */
  const handleViewChange = (view: { start: number; end: number } | null) => {
    if (!analysis || duration <= 0) return;

    if (!view || view.end - view.start > ZOOM_MEASURE_BELOW_SECONDS) {
      setZoom(null);
      return;
    }

    setZoom((current) => {
      // Room left in the buffer on both sides, or the file's own edge, means
      // the view is still covered and there is nothing to do.
      if (current) {
        const margin = (view.end - view.start) / 2;
        const roomBefore =
          view.start - current.bufferStart >= margin || current.bufferStart <= 0;
        const roomAfter =
          current.bufferEnd - view.end >= margin ||
          current.bufferEnd >= duration - 0.0001;
        if (roomBefore && roomAfter) return current;
      }

      const buffer = fetchZoomBuffer(view);
      if (!buffer) return current;
      if (
        current &&
        current.bufferStart === buffer.start &&
        current.bufferEnd === buffer.end
      ) {
        return current;
      }
      // Peaks land in a moment. Until they do the old ones stay on screen if
      // there are any, and the trimmer stretches the overview's if there
      // aren't -- either way the view is never blank under the finger.
      return {
        bufferStart: buffer.start,
        bufferEnd: buffer.end,
        peaks: current?.peaks ?? [],
      };
    });
  };

  const handleRegionPeaks = (
    key: string,
    start: number,
    end: number,
    peaks: number[]
  ) => {
    if (key !== previewKeyRef.current) return;
    setZoom((current) => {
      // Only the buffer still wanted: a reply for one already scrolled past would
      // redraw the view with the wrong audio.
      if (!current || current.bufferStart !== start || current.bufferEnd !== end) {
        return current;
      }
      return { ...current, peaks };
    });
  };

  const resetTrimToAudible = () => {
    if (!analysis) return;
    commitTrim(analysis.audibleStart, analysis.audibleEnd);
  };

  // Move the region's end onto the nearest whole bar at the current tempo, which
  // is what stops a loop drifting out of time as it repeats. The shift is a
  // fraction of a beat -- this straightens a region that's nearly right, it
  // doesn't rescue one that's wrong.
  const snapTrimToGrid = (barCount: number, atBpm: number) => {
    const length = (barCount * beatsPerBar * 60) / atBpm;
    let start = trimRef.current.start;
    let end = start + length;
    if (end > duration) {
      // Not enough file left after the start: keep the length and back the
      // whole region up, rather than saving a loop that's short of a bar.
      end = duration;
      start = Math.max(0, end - length);
    }
    commitTrim(start, end);
  };

  const togglePreview = () => {
    hapticImpact(prefs.haptics, "medium");
    if (isPlayingRef.current) {
      stopPreview();
      return;
    }
    if (!analysis || trimLength < MIN_TRIM_SECONDS) return;
    if (!requestStart("loop")) return;

    isPlayingRef.current = true;
    setIsPlaying(true);
    reloadPreview(true);
  };

  // Any edit by hand -- steppers, typing, tap tempo -- means the number on screen
  // is no longer the detector's, and the line under it should stop saying it is.
  const setBpmByHand: React.Dispatch<React.SetStateAction<number>> = (value) => {
    setTempoSource("manual");
    setBpm(value);
  };

  // Passed whole to the dial and the steppers, the way the two instrument
  // screens do it.
  const controls = useBpmControl({
    bpm,
    setBpm: setBpmByHand,
    minBpm: LOOP_MIN_BPM,
    maxBpm: LOOP_MAX_BPM,
  });

  // Plain words, because what this line is really saying is how much to trust the
  // number above it -- and "0.42 confidence" tells nobody that.
  const tempoNote =
    tempoSource === "detected"
      ? tempoConfidence >= STRONG_TEMPO_CONFIDENCE
        ? "Found in the audio — a clear, steady beat"
        : "Found in the audio, but not certain — check it with the click below"
      : tempoSource === "estimated"
        ? "Guessed from the length — no clear beat to hear. Check it below"
        : tempoSource === "saved"
          ? isShipped
            ? "The tempo this loop came with. Nudge it if it plays out of time"
            : "The tempo you saved. FIND IT reads the audio again"
          : "You set this";

  const save = async () => {
    if (!analysis || !canSave || saving) return;
    setSaving(true);
    stopPreview();

    if (editing) {
      if (editing.userAdded) {
        updateUserLoop(editing.key, {
          title: title.trim(),
          category,
          bpm,
          timeSignature,
          trimStart: trim.start,
          trimEnd: trim.end,
        });
      } else {
        // A shipped loop keeps its name and category -- they're catalog facts,
        // and the audio behind them is bundled. What's saved is the correction:
        // what this app now believes the file's own tempo and loop points are.
        setLoopOverride(editing.key, {
          bpm,
          timeSignature,
          trimStart: trim.start,
          trimEnd: trim.end,
        });
      }
      // If this loop is the one loaded in the Loop tab, re-select it so the
      // engine picks up the new trim and tempo. The key and the file haven't
      // changed, so the decode is still cached and this costs nothing.
      if (selectedKey === editing.key) setSelectedLoopKey(editing.key);
      router.back();
      return;
    }

    if (!picked) return;

    try {
      const loop = await addUserLoop({
        title: title.trim(),
        category,
        bpm,
        timeSignature,
        trimStart: trim.start,
        trimEnd: trim.end,
        sourceUri: picked.uri,
        fileName: picked.name,
        mimeType: picked.mimeType,
      });
      // Load it straight away: the user just spent a minute deciding how this
      // loop should sound, and the next thing they want is to play it.
      setSelectedLoopKey(loop.key);
      router.back();
    } catch (error) {
      console.error("Failed to save imported loop", error);
      setSaving(false);
      Alert.alert(
        "Couldn't save",
        "The loop's audio couldn't be copied into the app. Try again, or pick the file from a different folder."
      );
    }
  };

  return (
    <Screen glows={["topLeftFar", "bottomLeft"]}>
      <ScreenHeader title={editing ? "Edit Loop" : "Add Loop"} />

      {/* The name field and the BPM field both sit low enough to be behind the
          keyboard on a short screen. Three things keep them visible, because on
          their own none of them covers both platforms: the view shrinks to the
          space left over (iOS; Android does it through the window's own resize),
          the padding at the bottom leaves room to scroll the last field clear,
          and focusing a field scrolls it into view. */}
      {/* <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      > */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-screen"
        contentContainerStyle={{ paddingBottom: fieldFocused ? 220 : 0 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* The screen is laid out as the job actually goes: the file, the region,
            the tempo, hear it, name it, save. Detection sets the tempo and the
            region on its own, so on a good file there is nothing to do but listen
            and save -- everything that exists to CORRECT that is real work but
            rare work, and it sits folded away at the bottom rather than making
            every import look like a form to fill in.

            One compact row for the file. Fixed when editing: swapping the audio
            under an existing key would be a different loop wearing its name, and
            the Loop tab may have this one loaded. */}
        <TouchableOpacity
          onPress={pickFile}
          disabled={busy || saving || !!editing}
          className="flex-row items-center gap-3 px-4 py-3 border rounded-md bg-surface-field border-hairline"
          style={busy || saving ? { opacity: 0.6 } : undefined}
        >
          <Folder size={20} color={COLORS.white} />
          <View style={{ flex: 1 }}>
            <Text
              className="text-white font-satoshiBold text-body"
              numberOfLines={1}
            >
              {editing ? editing.title : picked ? picked.name : "Choose a file"}
            </Text>
            <Text className="text-ink-muted text-micro font-satoshiRegular">
              {busy
                ? "Reading and decoding…"
                : editing
                  ? "Add a new loop to use a different file"
                  : picked
                    ? "MP3, WAV or M4A"
                    : "MP3, WAV or M4A from your device"}
            </Text>
          </View>
          {!editing && (
            <Text
              className="text-micro font-spaceBold"
              style={{ color: COLORS.brand }}
            >
              {picked ? "CHANGE" : "CHOOSE"}
            </Text>
          )}
        </TouchableOpacity>

        {notice && (
          <Text className="mt-2 text-overline text-danger font-satoshiMedium">
            {notice}
          </Text>
        )}

        {analysis && (
          <>
            {/* What plays. Drag the ends; pinch or use the buttons to zoom in,
                which is finer than any nudge button could be, so there are
                none. */}
            {/* <SectionLabel text="The part that loops" /> */}
            <WaveformTrimmer
              peaks={analysis.peaks}
              duration={analysis.duration}
              start={trim.start}
              end={trim.end}
              onChange={(start, end) => setTrim({ start, end })}
              onComplete={commitTrim}
              onViewChange={handleViewChange}
              zoom={zoom}
              classname="mt-2"
            />

            {/* One line about the region rather than three timestamps. What
                matters isn't where it starts in the file, it's whether it's a
                whole number of bars -- a region that isn't drifts a little
                further from the beat on every pass. */}
            <View className="flex-row items-center justify-between mt-1">
              <View className="flex-1">
                {/* <Text className="text-white font-satoshiBold text-body">
                  {isOnGrid
                    ? `${wholeBars} ${wholeBars === 1 ? "bar" : "bars"} · ${formatSeconds(trimLength)}`
                    : `${formatSeconds(trimLength)} — not a whole bar`}
                </Text> */}
                <Text className="text-white text-overline font-satoshiRegular mt-0.5">
                  {isOnGrid
                    ? "Drag the ends to trim. Pinch to zoom in."
                    : "It'll drift out of time as it repeats."}
                </Text>
              </View>

              {!isOnGrid && (
                <TouchableOpacity
                  onPress={() => snapTrimToGrid(wholeBars, bpm)}
                  accessibilityLabel="Snap the region to whole bars"
                  className="px-3 py-2 ml-2 bg-white rounded-sm"
                >
                  <Text className="text-black text-overline font-spaceBold">FIX</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={resetTrimToAudible}
                accessibilityLabel="Reset to the whole file"
                className="px-3 py-2 ml-2 rounded-sm bg-white/10"
              >
                <Text className="text-white text-overline font-spaceBold">RESET</Text>
              </TouchableOpacity>
            </View>

            <View
              className="flex-row items-center self-center gap-3 mt-8"
              onLayout={(event) => {
                tempoOffsetRef.current = event.nativeEvent.layout.y;
              }}
            >
              <StepperButton
                direction="down"
                controls={controls}
                label="Decrease loop tempo"
              />

              {/* The same dial the metronome and the loop player use, in its
                  compact form: no transport here for the beat rings to flare
                  against, and it has to sit inline between the steppers. */}
              <BpmDial
                controls={controls}
                isPlaying={isPlaying}
                variant="compact"
                onFocus={() => {
                  setFieldFocused(true);
                  scrollFieldIntoView(tempoOffsetRef.current);
                }}
                onBlur={() => setFieldFocused(false)}
              />

              <StepperButton
                direction="up"
                controls={controls}
                label="Increase loop tempo"
              />
            </View>


            <Text
              className="mt-1 text-overline text-center font-satoshiRegular"
              style={{
                color:
                  tempoSource === "detected" &&
                    tempoConfidence >= STRONG_TEMPO_CONFIDENCE
                    ? COLORS.brand
                    : COLORS.textSoft,
              }}
            >
              {tempoNote}
            </Text>

            {/* The detector's other readings, when it had any. Kept on the main
                path because this is the one correction that's common: it folds
                every tempo into 90-180, so a loop a listener would call 70 comes
                back as 140 and the reading you wanted is usually right here. */}
            {!isShipped && alternatives.length > 0 && (
              <View className="flex-row flex-wrap items-center justify-center gap-2 mt-3">
                <Text className="text-overline text-ink-muted font-satoshiRegular">
                  {tempoSource === "detected" ? "" : "Heard:"}
                </Text>
                {alternatives.map((option) => (
                  <Chip
                    key={option}
                    label={`${option}`}
                    selected={option === bpm}
                    onPress={() => {
                      hapticImpact(prefs.haptics, "light");
                      applyTempo(
                        clampBpm(option),
                        "detected",
                        tempoConfidence,
                        trim.start,
                        trim.end,
                        duration
                      );
                    }}
                  />
                ))}
              </View>
            )}

            {/* The two ways to work out a tempo the app doesn't know, on the main
                path rather than folded away: when the detector is wrong this is
                the whole job, and burying it makes the one thing you came here for
                the one thing you have to go looking for. Labelled with what they
                do, not what they are.

                Not for a loop that came with the app -- its tempo was set when the
                catalog was built, so there's nothing to work out, only to nudge. */}
            {!isShipped && (
            <View className="flex-row gap-2 mt-4">
              <TouchableOpacity
                onPressIn={controls.handleTapTempo}
                accessibilityLabel="Tap along to set the tempo"
                className="items-center justify-center flex-1 py-2.5 border-2 border-hairline-strong rounded-sm"
              >
                <Text className="text-white text-title font-spaceBold">
                  TAP IT OUT
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={redetectTempo}
                disabled={detecting}
                style={detecting ? { opacity: 0.5 } : undefined}
                accessibilityLabel="Find the tempo in the audio again"
                className="items-center justify-center flex-1 py-2.5 border-2 border-hairline-strong rounded-sm"
              >
                <Text className="text-white text-title font-spaceBold">
                  {detecting ? "LISTENING…" : "FIND IT"}
                </Text>
              </TouchableOpacity>
            </View>
            )}

            {/* Hear it. The click is locked to the loop's own grid, so if it
                slides, the tempo or the region is out -- which is the whole
                check this screen exists to let you make. */}
            <View className="flex-row items-center justify-center gap-5 mt-5">
              <TouchableOpacity
                accessibilityLabel={isPlaying ? "Stop preview" : "Play preview"}
                onPressIn={togglePreview}
                disabled={!isPlaying && isBlockedByOtherEngine}
                style={
                  !isPlaying && isBlockedByOtherEngine
                    ? { opacity: 0.4 }
                    : undefined
                }
              >
                {isPlaying ? <Stop size={56} /> : <PlayFilled size={56} />}
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityLabel={
                  clickOn ? "Turn off the check click" : "Turn on the check click"
                }
                onPress={() => setClickOn((on) => !on)}
                className={`items-center justify-center px-2 py-2 rounded-sm border-2 ${clickOn ? "bg-white border-white" : "border-hairline-strong"
                  }`}
              >
                {clickOn ? (
                  <MetronomeFill size={20} color={COLORS.black} />
                ) : (
                  <MetronomeOutline size={20} color={COLORS.white} />
                )}
              </TouchableOpacity>
            </View>

            {/* <Text className="mt-2 text-micro text-center text-ink-muted font-satoshiRegular">
              {isBlockedByOtherEngine
                ? "Stop the Metronome first"
                : clickOn
                  ? "Click follows the loop. If it slides out of time, the tempo is wrong."
                  : "Turn click on to check the tempo."}
            </Text> */}

            {/* A shipped loop keeps its name: it's a catalog fact, and only the
                tempo and trim are being corrected here. Showing an editable field
                that silently discarded what you typed would be worse than no
                field at all. */}
            {canRename ? (
              <View
                className="mt-5"
                onLayout={(event) => {
                  nameOffsetRef.current = event.nativeEvent.layout.y;
                }}
              >
                <BrandInput
                  label="Name"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Loop name"
                  maxLength={40}
                  error={title.trim() ? undefined : "Give it a name"}
                  onFocus={() => {
                    setFieldFocused(true);
                    scrollFieldIntoView(nameOffsetRef.current);
                  }}
                  onBlur={() => setFieldFocused(false)}
                />
              </View>
            ) : (
              <Text className="my-5 text-overline text-ink-muted font-satoshiRegular">
                {title} · this loop came with the app, so only its tempo and
                region are saved.
              </Text>
            )}

            <BrandButton
              label={saving ? "Saving…" : editing ? "Save changes" : "Save loop"}
              onPress={save}
              disabled={!canSave || saving}
              style={{ marginTop: 4 }}
            />

            {/* What's left is genuinely occasional: nearly every loop is 4/4, the
                category is a filing detail, and warping is something the Loop tab
                does anyway -- this is only here to hear it before committing. */}
            <Disclosure
              title="More"
              open={showMore}
              onToggle={() => setShowMore((open) => !open)}
              summary={isShipped ? category : `${timeSignature} · ${category}`}
              // For a shipped loop there's one control and a category left in
              // here, which isn't enough to be worth a tap to reach.
              alwaysOpen={isShipped}
            >
              {/* Also a catalog fact for a shipped loop, so it isn't offered. */}
              {!isShipped && (
                <>
                  <Text className="mb-2 text-ink font-spaceMedium text-label">
                    Time signature
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {LOOP_TIME_SIGNATURES.map((signature) => (
                      <Chip
                        key={signature}
                        label={signature}
                        selected={signature === timeSignature}
                        onPress={() => setTimeSignature(signature)}
                      />
                    ))}
                  </View>
                </>
              )}

              {canRename && (
                <>
                  <Text className="mt-4 mb-2 text-ink font-spaceMedium text-label">
                    Category
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {LOOP_CATEGORIES.map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        selected={option === category}
                        onPress={() => setCategory(option)}
                      />
                    ))}
                  </View>
                </>
              )}

              <Text className="mt-5 text-overline text-ink-soft font-satoshiRegular">
                Hear it warp: play it at another tempo.
              </Text>
              <View className="flex-row items-center justify-center gap-4 mt-2">
                <TouchableOpacity
                  accessibilityLabel="Warp preview slower"
                  onPress={() =>
                    setTargetBpm((value) => Math.max(LOOP_MIN_BPM, value - 1))
                  }
                  className="p-2 rounded-lg bg-white/10"
                >
                  <MinusCircle size={24} color={COLORS.white} />
                </TouchableOpacity>
                <View className="items-center" style={{ minWidth: 96 }}>
                  <Text
                    className="text-title font-spaceBold"
                    style={{
                      color: targetBpm === bpm ? COLORS.white : COLORS.brand,
                    }}
                  >
                    {targetBpm} BPM
                  </Text>
                  <Text className="text-ink-muted text-nav font-spaceBold uppercase">
                    playing at {(targetBpm / bpm).toFixed(2)}x
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityLabel="Warp preview faster"
                  onPress={() =>
                    setTargetBpm((value) => Math.min(LOOP_MAX_BPM, value + 1))
                  }
                  className="p-2 rounded-lg bg-white/10"
                >
                  <AddCircle size={24} color={COLORS.white} />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel="Reset preview tempo"
                  onPress={() => setTargetBpm(bpm)}
                  disabled={targetBpm === bpm}
                  style={targetBpm === bpm ? { opacity: 0.4 } : undefined}
                  className="p-2 rounded-lg bg-white/10"
                >
                  <Reset size={20} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            </Disclosure>
          </>
        )}
      </ScrollView>
      {/* </KeyboardAvoidingView> */}

      <LoopPreviewEngine
        ref={engineRef}
        onAnalyzed={handleAnalyzed}
        onDetected={handleDetected}
        onRegionPeaks={handleRegionPeaks}
        onPosition={setPlayPhase}
        onError={(message) => {
          setBusy(false);
          setDetecting(false);
          isPlayingRef.current = false;
          setIsPlaying(false);
          release("loop");
          setNotice(message);
        }}
        clickEnabled={clickOn}
      />
    </Screen>
  );
}

type DisclosureProps = {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Shown alongside the title while closed, so folding doesn't hide the value. */
  summary?: string;
  /**
   * Don't fold at all: plain heading, contents always shown, no toggle. For when
   * there's so little left inside that hiding it costs a tap and saves nothing --
   * a shipped loop's "More" is one control and a category.
   */
  alwaysOpen?: boolean;
  children: ReactNode;
};

// A folded section. Everything on this screen that exists to correct an automatic
// answer lives in one of these: needed often enough to keep, rare enough that
// having it open by default would bury the four things most imports actually use.
function Disclosure({
  title,
  open,
  onToggle,
  summary,
  alwaysOpen,
  children,
}: DisclosureProps) {
  const expanded = alwaysOpen || open;

  return (
    <View className="pt-4 mt-6 border-t border-hairline">
      {alwaysOpen ? (
        <Text className="text-white uppercase text-overline tracking-widest font-spaceBold">
          {title}
        </Text>
      ) : (
        <TouchableOpacity
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          className="flex-row items-center justify-between"
        >
          <Text className="text-white uppercase text-overline tracking-widest font-spaceBold">
            {title}
          </Text>
          <View className="flex-row items-center gap-2">
            {!expanded && summary ? (
              <Text className="text-overline text-ink-muted font-satoshiRegular">
                {summary}
              </Text>
            ) : null}
            <Text
              className="text-micro font-spaceBold"
              style={{ color: COLORS.brand }}
            >
              {expanded ? "HIDE" : "SHOW"}
            </Text>
          </View>
        </TouchableOpacity>
      )}
      {expanded && <View className="mt-4">{children}</View>}
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <Text className="mt-6 mb-3 text-white uppercase text-overline tracking-widest font-spaceBold">
      {text}
    </Text>
  );
}

type ChipProps = { label: string; selected: boolean; onPress: () => void };

function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-4 py-2 rounded-full border ${selected ? "bg-ink border-ink-muted" : "bg-white/10 border-white/20"
        }`}
    >
      <Text
        className={`text-label font-satoshiMedium ${selected ? "text-black" : "text-white"
          }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

