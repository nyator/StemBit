import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";

import {
  useSessions,
  UNTITLED_CUE,
  type CueSection,
  type CueTrack,
  type SessionItem,
} from "../../context/SessionsContext";
import {
  importStems,
  readStemSections,
  removeStems,
} from "../../utils/importStems";
import { arrangementFrom } from "../../constants/arrangement";
import {
  useSessionPlayback,
  type PlaySpan,
  type TrackMix,
} from "../../context/SessionPlaybackContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useSessionCue } from "../../context/SessionCueContext";
import {
  useLoopPhase,
  useLoopPlayback,
} from "../../context/LoopPlaybackContext";
import { KEYS, usePadPlayback } from "../../context/PadPlaybackContext";
import { useLiveSections } from "../../hooks/useLiveSections";
import { PAD_PACKS } from "../../constants/pads";
import { findLoopByKey } from "../../constants/loops";
import { hapticImpact } from "../../utils/haptics";
import { confirm } from "../../utils/confirm";
import { describeCue } from "../../utils/describeCue";

import ScreenHeader from "../../components/ui/screenHeader";
import TrackTimeline from "../../components/ui/trackTimeline";
import { BrandInput } from "../../components/ui/brandInput";
import MixerStrip from "../../components/ui/mixerStrip";
import TransportReadout from "../../components/ui/transportReadout";
import RepeatPicker, {
  type RepeatPickerHandle,
} from "../../components/ui/repeatPicker";
import CueReadout from "../../components/ui/cueReadout";
import CueElements, {
  // CueSummary,
  TempoStepper,
  clampBpm,
} from "../../components/ui/cueElements";
import SectionPad from "../../components/ui/sectionPad";
import {
  MAX_SHEET_HEIGHT,
  SHEET_BACKGROUND,
  SHEET_CONTENT,
  SHEET_HANDLE_INDICATOR,
  useSheetBackdrop,
} from "../../components/ui/sheet";
import Screen from "../../components/ui/screen";
import EmptyState from "../../components/ui/emptyState";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";
import {
  barLabel,
  barSpan,
  repeatDescription,
  repeatLabel,
} from "../../constants/barGrid";
import {
  AudioStart,
  Musicnote,
  PlayFilled,
  SortPad,
  Stop,
} from "../../components/icons";
import NavButton from "../../components/ui/navButton";

/** What a stem sits at before anyone touches it, and what an old cue implies. */
const DEFAULT_MIX: TrackMix = { level: 1, pan: 0, muted: false };

/**
 * The shortest a section is allowed to get while an edge is dragged.
 */
const MIN_SECTION_SECONDS = 0.25;

/**
 * Detector confidence at or above which the reading is worth trusting on sight.
 */
const CLEAR_PULSE = 0.5;

function CueNameField({
  value,
  onChangeText,
  onCommit,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onCommit: () => void;
}) {
  return (
    <BrandInput
      label="Cue name"
      value={value}
      onChangeText={onChangeText}
      onBlur={onCommit}
      onSubmitEditing={onCommit}
      placeholder="Opener, Altar call…"
      maxLength={40}
      returnKeyType="done"
    />
  );
}

function StemRow({
  name,
  onRemove,
}: {
  name: string;
  onRemove: () => void;
}) {
  return (
    <View className="flex-row items-center px-3 py-2 mb-2 border rounded-lg bg-surface border-hairline">
      <Musicnote size={16} color={COLORS.textMuted} />
      <Text
        className="flex-1 ml-2 text-white font-satoshiMedium text-label"
        numberOfLines={1}
      >
        {name}
      </Text>
      <TouchableOpacity
        onPress={onRemove}
        accessibilityLabel={`Remove ${name}`}
        hitSlop={10}
      >
        <Text className="text-micro text-ink-muted font-spaceBold">REMOVE</Text>
      </TouchableOpacity>
    </View>
  );
}

function ImportStemsButton({
  hasStems,
  importing,
  onPress,
}: {
  hasStems: boolean;
  importing: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={importing}
      accessibilityLabel="Import stems"
      className="items-center py-3 border rounded-lg border-hairline"
      style={importing ? { opacity: 0.5 } : undefined}
    >
      <Text className="text-overline text-white font-spaceBold">
        {importing
          ? "IMPORTING…"
          : hasStems
            ? "ADD MORE STEMS"
            : "IMPORT STEMS"}
      </Text>
    </TouchableOpacity>
  );
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

const SECTION_PAD_ROW_HEIGHT = 66 + 8;
const SONG_PEAK_BUCKETS = 400;
const EMPTY_PEAKS: number[] = [];

export default function PerformanceScreen() {
  const { sessionId, itemId, view: viewParam } = useLocalSearchParams<{
    sessionId?: string;
    itemId?: string;
    view?: string;
  }>();
  const router = useRouter();
  const { findSession, updateItem, removeItem } = useSessions();
  const { prefs, setPref } = usePreferences();
  const session = useSessionPlayback();
  const {
    armPad,
    releasePad,
    play: fireCue,
    stop: stopCue,
    stopTransport: stopCueTransport,
    liveItemId,
  } = useSessionCue();
  const loopPhase = useLoopPhase();
  const { setBpm: setEngineBpm } = useLoopPlayback();
  const pad = usePadPlayback();

  const setlist = findSession(sessionId);
  const cueIndex = setlist?.items.findIndex((item) => item.id === itemId) ?? -1;
  const cue = cueIndex >= 0 ? setlist?.items[cueIndex] : undefined;

  const prevCue = cueIndex > 0 ? setlist?.items[cueIndex - 1] : undefined;
  const nextCue = cueIndex >= 0 ? setlist?.items[cueIndex + 1] : undefined;
  const tracks = cue?.tracks ?? [];
  const sections = cue?.sections ?? [];
  const bpm = cue?.bpm ?? 120;

  const isStemCue = tracks.length > 0;
  const cueIsLive = !!cue && liveItemId === cue.id;
  const isSounding = isStemCue ? session.isPlaying : cueIsLive;

  const [view, setView] = useState<"studio" | "perform">(
    viewParam === "perform" ? "perform" : "studio"
  );

  const [mix, setMix] = useState<Record<string, TrackMix>>({});
  const [soloed, setSoloed] = useState<string | null>(null);
  const [masterMuted, setMasterMuted] = useState(false);

  const {
    playheadSeconds: playheadValue,
    liveSectionId,
    armedSectionId,
    arm: armSection,
  } = useLiveSections(sections);

  const performSectionsRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (!liveSectionId) return;
    const index = sections.findIndex((section) => section.id === liveSectionId);
    if (index < 0) return;
    performSectionsRef.current?.scrollTo({
      y: Math.max(0, (index - 1) * SECTION_PAD_ROW_HEIGHT),
      animated: true,
    });
  }, [liveSectionId, sections]);

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [browsingSet, setBrowsingSet] = useState(false);
  const setlistSheetRef = useRef<BottomSheetModal>(null);
  const renderBackdrop = useSheetBackdrop();

  const [repeatsFor, setRepeatsFor] = useState<string | null>(null);
  const repeatSection = sections.find((section) => section.id === repeatsFor);
  const repeatPickerRef = useRef<RepeatPickerHandle>(null);

  const openRepeats = (sectionId: string) => {
    hapticImpact(prefs.haptics, "light");
    setRepeatsFor(sectionId);
    requestAnimationFrame(() => {
      repeatPickerRef.current?.present();
    });
  };

  const openSetlist = () => {
    hapticImpact(prefs.haptics, "light");
    setBrowsingSet(true);
    setlistSheetRef.current?.present();
  };

  const removeSection = (sectionId: string) => {
    hapticImpact(prefs.haptics, "light");
    if (repeatsFor === sectionId) {
      repeatPickerRef.current?.dismiss();
      setRepeatsFor(null);
    }
    setSelectedSectionId(null);
    writeSections(sections.filter((section) => section.id !== sectionId));
  };

  const [cursorSeconds, setCursorSeconds] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(false);

  const timelineTracks = useMemo(
    () => tracks.map((track) => ({ id: track.id, name: track.name })),
    [tracks]
  );

  const [peaks, setPeaks] = useState<Record<string, number[]>>({});
  const [trackDurations, setTrackDurations] = useState<Record<string, number>>({});
  const [duration, setDuration] = useState(0);
  const [timelineWidth, setTimelineWidth] = useState(0);

  const metersRef = useRef<Map<string, Animated.Value>>(new Map());
  const meterFor = (trackId: string) => {
    let value = metersRef.current.get(trackId);
    if (!value) {
      value = new Animated.Value(0);
      metersRef.current.set(trackId, value);
    }
    return value;
  };

  useEffect(
    () =>
      session.subscribePosition((next) => {
        metersRef.current.forEach((value, trackId) => {
          value.setValue(next.levels[trackId] ?? 0);
        });
      }),
    [session]
  );

  useEffect(() => {
    if (!session.isPlaying) playheadValue.setValue(cursorSeconds);
  }, [cursorSeconds, session.isPlaying, playheadValue]);

  useEffect(() => {
    setPeaks({});
    setTrackDurations({});
    setDuration(0);
    setCursorSeconds(0);
    setSoloed(null);
    setMasterMuted(false);
    setSelectedSectionId(null);
    setDetecting(false);
    setSuggestion(null);
    detectKeyRef.current = null;
  }, [cue?.id]);

  useEffect(() => {
    if (!cue?.id || tracks.length === 0) return;
    session.loadCue(cue.id, tracks).catch((error) => {
      console.error("Failed to load stems", error);
    });
  }, [cue?.id]);

  useEffect(() => {
    if (tracks.length === 0) return;
    const seeded: Record<string, TrackMix> = {};
    tracks.forEach((track) => {
      seeded[track.id] = {
        level: typeof track.level === "number" ? track.level : 1,
        pan: typeof track.pan === "number" ? track.pan : 0,
        muted: false,
      };
    });
    setMix(seeded);
  }, [cue?.id, tracks.length]);

  useEffect(() => {
    if (!session.isReady) return;
    Object.entries(mix).forEach(([trackId, track]) => {
      session.setTrack(trackId, {
        level: track.level,
        pan: track.pan,
        muted: masterMuted || (soloed ? trackId !== soloed : track.muted),
      });
    });
  }, [session.isReady, cue?.id]);

  useEffect(() => {
    if (
      !session.isReady ||
      session.loadedCueId !== cue?.id ||
      tracks.length === 0
    ) {
      return;
    }
    let cancelled = false;

    (async () => {
      for (const track of tracks) {
        try {
          const measured = await session.getPeaks(track.id);
          if (cancelled) return;
          setPeaks((previous) => ({ ...previous, [track.id]: measured.peaks }));
          setTrackDurations((previous) => ({
            ...previous,
            [track.id]: measured.duration,
          }));
          setDuration((previous) => Math.max(previous, measured.duration));
        } catch {
          // Lane renders empty if retrieval fails
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session.isReady, session.loadedCueId, cue?.id, tracks.length]);

  const songPeaks = useMemo(() => {
    const measured = Object.entries(peaks).filter(
      ([, shape]) => shape.length > 0
    );
    if (measured.length === 0 || duration <= 0) return EMPTY_PEAKS;

    const merged = new Array<number>(SONG_PEAK_BUCKETS).fill(0);
    for (const [trackId, shape] of measured) {
      const span = trackDurations[trackId] ?? duration;
      if (span <= 0) continue;
      const reach = Math.min(1, span / duration);
      const covered = Math.max(1, Math.round(SONG_PEAK_BUCKETS * reach));
      for (let bucket = 0; bucket < covered; bucket++) {
        const at = Math.min(
          shape.length - 1,
          Math.floor((bucket / covered) * shape.length)
        );
        if (shape[at] > merged[bucket]) merged[bucket] = shape[at];
      }
    }
    return merged;
  }, [peaks, trackDurations, duration]);

  const mixOf = (trackId: string) => mix[trackId] ?? DEFAULT_MIX;

  const isSilent = (
    trackId: string,
    solo: string | null = soloed,
    master: boolean = masterMuted
  ) => master || (solo ? trackId !== solo : mixOf(trackId).muted);

  const pushTrack = (
    trackId: string,
    next: TrackMix,
    solo: string | null,
    master: boolean
  ) => {
    session.setTrack(trackId, {
      level: next.level,
      pan: next.pan,
      muted: master || (solo ? trackId !== solo : next.muted),
    });
  };

  const changeMix = (trackId: string, changes: Partial<TrackMix>) => {
    const next = { ...mixOf(trackId), ...changes };
    setMix((previous) => ({ ...previous, [trackId]: next }));
    pushTrack(trackId, next, soloed, masterMuted);
  };

  const saveMix = () => {
    if (!sessionId || !itemId || tracks.length === 0) return;
    updateItem(sessionId, itemId, {
      tracks: tracks.map<CueTrack>((track) => ({
        ...track,
        level: mixOf(track.id).level,
        pan: mixOf(track.id).pan,
      })),
    });
  };

  const toggleMute = (trackId: string) => {
    hapticImpact(prefs.haptics, "medium");
    changeMix(trackId, { muted: !mixOf(trackId).muted });
  };

  const toggleSolo = (trackId: string) => {
    hapticImpact(prefs.haptics, "heavy");
    const next = soloed === trackId ? null : trackId;
    setSoloed(next);
    tracks.forEach((track) =>
      pushTrack(track.id, mixOf(track.id), next, masterMuted)
    );
  };

  const toggleMasterMute = () => {
    hapticImpact(prefs.haptics, "heavy");
    const next = !masterMuted;
    setMasterMuted(next);
    tracks.forEach((track) => pushTrack(track.id, mixOf(track.id), soloed, next));
  };

  const containingSection = (seconds: number) =>
    [...sections]
      .reverse()
      .find(
        (section) =>
          seconds >= section.startSeconds - 0.001 &&
          (section.endSeconds === undefined || seconds < section.endSeconds)
      );

  const spanFromCursor = (): PlaySpan => {
    const containing = loopEnabled ? containingSection(cursorSeconds) : undefined;
    if (containing) {
      return {
        id: containing.id,
        startSeconds: containing.startSeconds,
        endSeconds: containing.endSeconds,
        loop: true,
      };
    }
    return { id: "cursor", startSeconds: cursorSeconds, loop: loopEnabled };
  };

  const toggleStudioTransport = () => {
    hapticImpact(prefs.haptics, "heavy");
    if (session.isPlaying) {
      session.stop();
      return;
    }
    session.play(tracks, bpm, 0, spanFromCursor());
  };

  const togglePerformTransport = () => {
    if (tracks.length === 0) return;
    hapticImpact(prefs.haptics, "heavy");
    if (session.isPlaying) {
      session.stop();
      return;
    }
    session.play(tracks, bpm, 0, {
      id: "song",
      startSeconds: sections[0]?.startSeconds ?? 0,
      loop: false,
      arrangement: arrangementSpans,
    });
  };

  const launchSection = (section: CueSection) => {
    hapticImpact(prefs.haptics, "heavy");
    session.play(tracks, bpm, 4, {
      ...section,
      repeats: section.repeats ?? 1,
    });
    armSection(section.id);
  };

  const openCue = (item: SessionItem) => {
    setlistSheetRef.current?.dismiss();
    setBrowsingSet(false);
    if (item.id === cue?.id) return;
    hapticImpact(prefs.haptics, "medium");
    stopCueTransport();
    metersRef.current.clear();
    leaveCue(cue);
    router.setParams({ itemId: item.id });
  };

  const neighbour = (item: SessionItem | undefined) =>
    item
      ? {
        title: item.title,
        onPress: isSounding ? undefined : () => openCue(item),
      }
      : undefined;

  const toggleCueTransport = () => {
    if (!cue) return;
    hapticImpact(prefs.haptics, "heavy");
    if (cueIsLive) {
      stopCue();
      return;
    }
    fireCue(cue);
  };

  const cueIsEmpty = !isStemCue && !cue?.loopKey && !(cue?.padPack && cue?.padKey);

  const [draftTitle, setDraftTitle] = useState(cue?.title ?? "");
  useEffect(() => {
    setDraftTitle(cue?.title ?? "");
  }, [cue?.id, cue?.title]);

  const commitTitle = () => {
    if (!sessionId || !itemId || !cue) return;
    const next = draftTitle.trim();
    if (!next) {
      setDraftTitle(cue.title);
      return;
    }
    if (next === cue.title) return;
    updateItem(sessionId, itemId, { title: next });
  };

  const isAbandoned = (item: SessionItem) =>
    item.title === UNTITLED_CUE &&
    !item.tracks?.length &&
    !item.sections?.length &&
    !item.loopKey &&
    !item.padPack &&
    !item.padKey;

  const leaveCue = (item: SessionItem | undefined) => {
    if (!sessionId || !item) return;
    const typed = draftTitle.trim();
    if (typed && typed !== item.title) {
      updateItem(sessionId, item.id, { title: typed });
      return;
    }
    if (isAbandoned(item)) removeItem(sessionId, item.id);
  };

  const leaveRef = useRef(() => { });
  leaveRef.current = () => leaveCue(cue);
  useEffect(() => () => leaveRef.current(), []);

  const [importing, setImporting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    bpm: number;
    confidence: number;
    alternatives: number[];
  } | null>(null);
  const detectKeyRef = useRef<string | null>(null);

  const SHEET_SNAP_POINTS = ["50%"];

  const detectTempoFrom = async (track: CueTrack, cueId: string) => {
    detectKeyRef.current = cueId;
    setDetecting(true);
    try {
      const tempo = await session.detectTempo(track.id);
      if (detectKeyRef.current !== cueId) return;
      setDetecting(false);
      if (tempo) setSuggestion(tempo);
    } catch (error) {
      console.error("Tempo detection failed", error);
      if (detectKeyRef.current === cueId) setDetecting(false);
    }
  };

  const applySuggestedTempo = () => {
    if (suggestion) setCueBpm(suggestion.bpm);
    setSuggestion(null);
  };

  const pickStems = async () => {
    if (!sessionId || !itemId || !cue) return;
    setImporting(true);
    try {
      const picked = await importStems();
      if (picked.length === 0) return;

      const displacedLoop = cue.loopKey ? findLoopByKey(cue.loopKey) : undefined;
      const ok = await confirm({
        title: `Add ${picked.length} ${picked.length === 1 ? "stem" : "stems"}?`,
        message: [
          tracks.length > 0
            ? `Joins the ${tracks.length} already in this cue.`
            : `This cue becomes a stem song.`,
          displacedLoop
            ? `${displacedLoop.title} is removed — a cue plays stems or a loop, not both.`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
        confirmLabel: "Add",
      });
      if (!ok) {
        removeStems(picked);
        return;
      }

      const nextTracks = [...tracks, ...picked];
      const changes: Partial<SessionItem> = { tracks: nextTracks };

      if (cue.loopKey) changes.loopKey = undefined;

      if (!cue.title.trim() || cue.title === UNTITLED_CUE) {
        changes.title = picked[0].name;
      }

      if (sections.length === 0) {
        const found = await readStemSections(picked);
        if (found.length > 0) changes.sections = found;
      }

      reloadStems(nextTracks);
      updateItem(sessionId, itemId, changes);
      detectTempoFrom(picked[0], cue.id);
    } catch (error) {
      console.error("Stem import failed", error);
      Alert.alert("Import failed", "Those files couldn't be read.");
    } finally {
      setImporting(false);
    }
  };

  const removeTrack = async (trackId: string) => {
    if (!sessionId || !itemId) return;
    const removed = tracks.find((track) => track.id === trackId);

    const ok = await confirm({
      title: `Remove ${removed?.name ?? "this stem"}?`,
      message:
        "Its audio is deleted from the app for good. The original file on your device isn't touched.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;

    hapticImpact(prefs.haptics, "light");
    const nextTracks = tracks.filter((track) => track.id !== trackId);
    reloadStems(nextTracks);
    updateItem(sessionId, itemId, { tracks: nextTracks });
    if (removed) removeStems([removed]);
  };

  const reloadStems = (nextTracks: CueTrack[]) => {
    if (!cue) return;
    setPeaks({});
    setDuration(0);
    stopCueTransport();
    if (nextTracks.length === 0) return;
    session.loadCue(cue.id, nextTracks, true).catch((error) => {
      console.error("Failed to load stems", error);
    });
  };

  const setCueLoop = async (key: string | undefined) => {
    if (!sessionId || !itemId || !cue) return;
    const picked = key ? findLoopByKey(key) : undefined;
    const changes = { loopKey: key, bpm: picked?.bpm ?? cue.bpm };

    const replacing = cue.loopKey ? findLoopByKey(cue.loopKey) : undefined;
    const tempoMoves = picked && picked.bpm !== cue.bpm;
    const ok = await confirm({
      title: key
        ? replacing
          ? `Replace ${replacing.title}?`
          : `Use ${picked?.title ?? "this loop"}?`
        : "Remove the loop?",
      message: key
        ? [
          `This cue will play ${picked?.title ?? "the selected loop"}.`,
          tempoMoves ? `Its tempo goes to ${picked.bpm} BPM.` : null,
        ]
          .filter(Boolean)
          .join(" ")
        : "The cue keeps everything else, but has nothing to play.",
      confirmLabel: key ? (replacing ? "Replace" : "Use it") : "Remove",
      destructive: !key,
    });
    if (!ok) return;

    updateItem(sessionId, itemId, changes);

    if (!cueIsLive) return;
    if (key) fireCue({ ...cue, ...changes });
    else stopCueTransport();
  };

  const setCueBpm = (next: number) => {
    if (!sessionId || !itemId) return;
    const clamped = clampBpm(next);
    updateItem(sessionId, itemId, { bpm: clamped });
    if (cueIsLive) setEngineBpm(clamped);
  };

  const setCuePadPack = (packKey: string | undefined) => {
    if (!sessionId || !itemId) return;
    updateItem(sessionId, itemId, { padPack: packKey });

    if (!pad.isPlaying) return;
    if (packKey && cue?.padKey) armPad(packKey, cue.padKey, songMode);
    else if (!packKey) releasePad();
  };

  const scrub = (seconds: number) => setCursorSeconds(seconds);

  const seek = (seconds: number) => {
    setCursorSeconds(seconds);
    if (!session.isPlaying) return;

    session.play(tracks, bpm, 0, {
      id: "cursor",
      startSeconds: seconds,
      endSeconds: loopEnabled ? containingSection(seconds)?.endSeconds : undefined,
      loop: loopEnabled,
    });
  };

  const returnToZero = () => {
    hapticImpact(prefs.haptics, "light");
    setCursorSeconds(0);
    if (session.isPlaying) seek(0);
  };

  const songKey = cue?.padKey;
  const songMode = cue?.padMode ?? "major";
  const padPack = cue?.padPack ?? PAD_PACKS[0]?.key;

  const padIsLive =
    pad.isPlaying &&
    songKey !== undefined &&
    pad.activeKeyIndex === KEYS.indexOf(songKey) &&
    pad.mode === songMode;

  const [editingKey, setEditingKey] = useState(false);

  const togglePad = () => {
    hapticImpact(prefs.haptics, "medium");
    if (padIsLive) {
      releasePad();
      return;
    }
    if (!songKey || !padPack) {
      setEditingKey(true);
      return;
    }
    armPad(padPack, songKey, songMode);
  };

  const setSongKey = (key: string | undefined, nextMode: "major" | "minor") => {
    if (!sessionId || !itemId) return;
    updateItem(sessionId, itemId, { padKey: key, padMode: nextMode });

    if (!key) {
      if (pad.isPlaying) releasePad();
      return;
    }
    if (padPack && pad.isPlaying) armPad(padPack, key, nextMode);
  };

  const writeSections = (next: CueSection[]) => {
    if (!sessionId || !itemId) return;
    updateItem(sessionId, itemId, {
      sections: [...next].sort((a, b) => a.startSeconds - b.startSeconds),
    });
  };

  const defaultEndFor = (start: number) => {
    const following = sections.find(
      (section) => section.startSeconds > start + 0.001
    );
    if (following) return following.startSeconds;
    return duration > 0 ? duration : undefined;
  };

  const [naming, setNaming] = useState<{
    id?: string;
    startSeconds: number;
    endSeconds?: number;
    name: string;
  } | null>(null);

  const beginSectionAt = (seconds: number) => {
    hapticImpact(prefs.haptics, "medium");
    setNaming({
      startSeconds: seconds,
      endSeconds: defaultEndFor(seconds),
      name: "",
    });
  };

  const beginRename = (section: CueSection) => {
    hapticImpact(prefs.haptics, "light");
    setNaming({
      id: section.id,
      startSeconds: section.startSeconds,
      endSeconds: section.endSeconds,
      name: section.name,
    });
  };

  const commitSection = () => {
    if (!naming) return;
    const name = naming.name.trim() || `Section ${sections.length + 1}`;

    if (naming.id) {
      const id = naming.id;
      setNaming(null);
      writeSections(
        sections.map((section) =>
          section.id === id ? { ...section, name } : section
        )
      );
      return;
    }

    const next: CueSection = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      startSeconds: naming.startSeconds,
      endSeconds: naming.endSeconds,
    };
    setNaming(null);
    setSelectedSectionId(next.id);
    writeSections([...sections, next]);
  };

  const moveSectionEdge = (
    sectionId: string,
    seconds: number,
    edge: "start" | "end"
  ) => {
    writeSections(
      sections.map((section) => {
        if (section.id !== sectionId) return section;

        if (edge === "start") {
          const limit =
            section.endSeconds !== undefined
              ? section.endSeconds - MIN_SECTION_SECONDS
              : undefined;
          return {
            ...section,
            startSeconds:
              limit !== undefined ? Math.min(seconds, limit) : seconds,
          };
        }

        return {
          ...section,
          endSeconds: Math.max(
            seconds,
            section.startSeconds + MIN_SECTION_SECONDS
          ),
        };
      })
    );
  };

  const arrangementSpans = useMemo(() => arrangementFrom(sections), [sections]);

  const setSectionRepeats = (sectionId: string, repeats: number) => {
    hapticImpact(prefs.haptics, "light");
    writeSections(
      sections.map((section) =>
        section.id === sectionId ? { ...section, repeats } : section
      )
    );
    setRepeatsFor(null);
  };

  const setEdgeAtCursor = (edge: "start" | "end") => {
    if (!selectedSectionId) return;
    hapticImpact(prefs.haptics, "light");
    moveSectionEdge(selectedSectionId, cursorSeconds, edge);
  };

  if (!cue) {
    return (
      <Screen>
        <ScreenHeader title="Song" />
        <View className="mt-10">
          <EmptyState message="This cue is no longer in the setlist." />
        </View>
      </Screen>
    );
  }

  const selectedSection = sections.find(
    (section) => section.id === selectedSectionId
  );

  return (
    <Screen glows={["topLeftFar"]}>
      <ScreenHeader
        title={(setlist?.title ?? cue.title)}
        subTitle={cue?.title}
        action={
          (setlist?.items.length ?? 0) > 1 ? (
            <NavButton
              icon={SortPad}
              onPress={openSetlist}
              tint="neutral"
              accessibilityLabel="Open the setlist"
            />
          ) : undefined
        }
      />

      <View className="flex-row px-screen mb-3">
        {(["studio", "perform"] as const).map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => {
              hapticImpact(prefs.haptics, "light");
              setView(option);
            }}
            accessibilityLabel={`${option} view`}
            accessibilityState={{ selected: view === option }}
            activeOpacity={0.8}
            className="items-center flex-1 py-2 mr-2 border rounded-lg"
            style={{
              backgroundColor:
                view === option ? COLORS.brand : COLORS.surfaceMuted,
              borderColor: view === option ? COLORS.brand : COLORS.borderSegment,
            }}
          >
            <Text
              className="text-micro font-spaceBold"
              style={{ color: view === option ? COLORS.white : COLORS.textMuted }}
            >
              {option.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {view === "studio" && isStemCue ? (
        <ScrollView
          className="flex-1 px-screen"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View onLayout={(event) => setTimelineWidth(event.nativeEvent.layout.width)}>
            {timelineWidth > 0 && tracks.length > 0 && (
              <TrackTimeline
                tracks={timelineTracks}
                peaks={peaks}
                duration={duration}
                bpm={bpm}
                sections={sections}
                mix={mix}
                soloed={soloed}
                masterMuted={masterMuted}
                onToggleMute={toggleMute}
                onToggleSolo={toggleSolo}
                playheadSeconds={playheadValue}
                isPlaying={session.isPlaying}
                cursorSeconds={cursorSeconds}
                onScrub={scrub}
                onSeek={seek}
                onMoveSection={moveSectionEdge}
                selectedSectionId={selectedSectionId}
                onSelectSection={setSelectedSectionId}
                width={timelineWidth}
              />
            )}
          </View>

          <View className="flex-row items-center justify-between mt-3">
            <TouchableOpacity
              onPress={() => beginSectionAt(cursorSeconds)}
              hitSlop={10}
              accessibilityLabel="Add a section at the cursor"
            >
              <Text className="text-micro text-brand font-spaceBold">
                + SECTION AT {clock(cursorSeconds)}
              </Text>
            </TouchableOpacity>

            {selectedSection && (
              <View className="flex-row">
                <TouchableOpacity
                  onPress={() => beginRename(selectedSection)}
                  hitSlop={10}
                  accessibilityLabel={`Rename ${selectedSection.name}`}
                >
                  <Text className="text-micro text-white font-spaceBold">
                    RENAME
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeSection(selectedSection.id)}
                  hitSlop={10}
                  className="ml-4"
                >
                  <Text className="text-micro text-danger font-spaceBold">
                    DELETE
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {selectedSection ? (
            <View
              className="flex-row items-center px-3 py-2 mt-3 mb-4 border rounded-lg"
              style={{ borderColor: COLORS.border }}
            >
              <View className="flex-1">
                <Text
                  className="text-micro text-white font-satoshiBold"
                  numberOfLines={1}
                >
                  {selectedSection.name}
                </Text>

                <Text
                  className="mt-0.5 text-micro text-white font-spaceBold"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {selectedSection.endSeconds !== undefined
                    ? `BAR ${barLabel(selectedSection.startSeconds, bpm)} → ${barLabel(
                      selectedSection.endSeconds,
                      bpm
                    )}   ·   ${barSpan(
                      selectedSection.startSeconds,
                      selectedSection.endSeconds,
                      bpm
                    )} BARS`
                    : `BAR ${barLabel(selectedSection.startSeconds, bpm)} → END`}
                </Text>
                <Text
                  className="mt-0.5 text-micro text-ink-muted font-spaceBold"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {clock(selectedSection.startSeconds)} →{" "}
                  {selectedSection.endSeconds !== undefined
                    ? `${clock(selectedSection.endSeconds)}   ·   ${(
                      selectedSection.endSeconds -
                      selectedSection.startSeconds
                    ).toFixed(1)}s`
                    : "END OF SONG"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => openRepeats(selectedSection.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Repeats: ${repeatDescription(
                  selectedSection.repeats
                ).toLowerCase()}`}
                accessibilityHint="Opens the repeat picker for this section."
                className="items-center justify-center px-2.5 ml-2 border rounded"
                style={{
                  minHeight: SIZES.minTouch,
                  borderColor:
                    selectedSection.repeats && selectedSection.repeats !== 1
                      ? COLORS.brand
                      : COLORS.border,
                }}
              >
                <Text className="text-micro text-white font-spaceBold">
                  {repeatLabel(selectedSection.repeats)}
                </Text>
                <Text className="mt-0.5 text-nav text-ink-muted font-spaceBold tracking-widest">
                  REP
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setEdgeAtCursor("start")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Start this section at the cursor"
                accessibilityHint="Exact, unlike dragging the edge, which snaps to the bar grid."
                className="justify-center px-2.5 ml-2 border rounded"
                style={{ minHeight: SIZES.minTouch, borderColor: COLORS.border }}
              >
                <Text className="text-micro text-white font-spaceBold">
                  START HERE
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEdgeAtCursor("end")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="End this section at the cursor"
                accessibilityHint="Exact, unlike dragging the edge, which snaps to the bar grid."
                className="justify-center px-2.5 ml-2 border rounded"
                style={{ minHeight: SIZES.minTouch, borderColor: COLORS.border }}
              >
                <Text className="text-micro text-white font-spaceBold">
                  END HERE
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="mb-4" />
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            {tracks.map((track) => (
              <MixerStrip
                key={track.id}
                name={track.name}
                mix={mixOf(track.id)}
                isSilent={isSilent(track.id)}
                isSolo={soloed === track.id}
                meter={meterFor(track.id)}
                onLevel={(level) => changeMix(track.id, { level })}
                onLevelCommit={saveMix}
                onPan={(pan) => changeMix(track.id, { pan })}
                onPanCommit={saveMix}
                onToggleMute={() => toggleMute(track.id)}
                onToggleSolo={() => toggleSolo(track.id)}
                defaultMix={DEFAULT_MIX}
                onRemove={() => removeTrack(track.id)}
              />
            ))}
          </ScrollView>

          <ImportStemsButton
            hasStems={tracks.length > 0}
            importing={importing}
            onPress={pickStems}
          />

          {detecting && (
            <Text className="mt-4 text-micro text-brand font-satoshiRegular">
              Reading the tempo off the stems…
            </Text>
          )}

          {suggestion && (
            <View
              className="px-4 py-3 mt-4 border-2 rounded-lg"
              style={{ borderColor: COLORS.brand }}
            >
              <Text className="text-micro text-brand font-spaceBold tracking-widest">
                DETECTED TEMPO
              </Text>
              <Text
                className="mt-1 text-heading text-white font-spaceBold"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {suggestion.bpm} BPM
              </Text>
              <Text className="mt-0.5 text-micro text-ink-muted font-satoshiRegular">
                {suggestion.confidence >= CLEAR_PULSE
                  ? "A clear pulse — this is very likely right."
                  : "The pulse was hard to read — worth checking against the audio."}
                {suggestion.alternatives.length > 0
                  ? `  Also possible: ${suggestion.alternatives
                    .slice(0, 2)
                    .join(", ")}.`
                  : ""}
              </Text>

              <View className="flex-row mt-3">
                <TouchableOpacity
                  onPress={() => setSuggestion(null)}
                  accessibilityLabel="Keep the tempo already set"
                  activeOpacity={0.8}
                  className="items-center justify-center flex-1 py-3 mr-2 border rounded-lg"
                  style={{ borderColor: COLORS.border }}
                >
                  <Text className="text-overline text-ink-muted font-spaceBold">
                    KEEP {cue.bpm ?? 120}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={applySuggestedTempo}
                  accessibilityLabel={`Use ${suggestion.bpm} BPM`}
                  activeOpacity={0.8}
                  className="items-center justify-center flex-1 py-3 rounded-lg"
                  style={{ backgroundColor: COLORS.brand }}
                >
                  <Text className="text-overline text-white font-spaceBold">
                    USE {suggestion.bpm}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TempoStepper
            bpm={cue.bpm}
            onChange={setCueBpm}
          // hint="Set the tempo — every quantised launch is measured from it."
          />
        </ScrollView>
      ) : isStemCue ? (
        <>
          <View className="px-screen pb-4">
            <TransportReadout
              title={cue.title}
              duration={duration}
              isPlaying={session.isPlaying}
              playheadSeconds={playheadValue}
              peaks={songPeaks}
              sections={sections}
              bpm={bpm}
              prev={neighbour(prevCue)}
              next={neighbour(nextCue)}
            />
          </View>

          <View
            className="mx-5 mb-3"
            style={{ height: 1, backgroundColor: COLORS.border }}
          />

          <ScrollView
            ref={performSectionsRef}
            scrollEnabled={false}
            className="flex-1 px-screen"
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {sections.length === 0 ? (
              <Text className="mb-4 text-micro text-ink-muted font-satoshiRegular">
                No sections yet — mark them on the timeline in STUDIO.
              </Text>
            ) : (
              <View className="mb-4">
                {sections.map((section, index) => (
                  <SectionPad
                    key={section.id}
                    name={section.name}
                    index={index}
                    startSeconds={section.startSeconds}
                    endSeconds={section.endSeconds ?? (duration || undefined)}
                    isLive={liveSectionId === section.id}
                    isArmed={armedSectionId === section.id}
                    playheadSeconds={playheadValue}
                    onPress={() => launchSection(section)}
                    repeats={section.repeats}
                    onEditRepeats={() => openRepeats(section.id)}
                    fullWidth
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </>
      ) : view === "studio" ? (
        <ScrollView
          className="flex-1 px-screen"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* <CueElements
            loopKey={cue.loopKey}
            bpm={cue.bpm}
            padPack={cue.padPack}
            padKey={cue.padKey}
            padMode={songMode}
            isLive={cueIsLive}
            onChangeLoop={setCueLoop}
            onChangeBpm={setCueBpm}
            onChangePadPack={setCuePadPack}
            onEditKey={() => setEditingKey(true)}
          /> */}
        </ScrollView>
      ) : (
        <>
          <View className="px-screen pb-4">
            <CueReadout
              title={cue.title}
              subtitle={describeCue(cue)}
              isPlaying={cueIsLive}
              phase={loopPhase}
              position={{
                index: cueIndex + 1,
                total: setlist?.items.length ?? 1,
              }}
              prev={neighbour(prevCue)}
              next={neighbour(nextCue)}
            />
          </View>

          <View
            className="mx-5 mb-3"
            style={{ height: 1, backgroundColor: COLORS.border }}
          />

          {/* <ScrollView
            className="flex-1 px-screen"
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <CueSummary
              loopKey={cue.loopKey}
              bpm={cue.bpm}
              padPack={cue.padPack}
              padKey={cue.padKey}
              padMode={songMode}
              loopIsLive={cueIsLive}
              padIsLive={padIsLive}
            />
          </ScrollView> */}
        </>
      )}

      {/* REDESIGNED CONTROLS STRIP */}
      {view === "studio" && (
        <View className="flex-row items-center px-screen mb-3 gap-2">
          {/* COMBINED PAD & KEY CONTROL PILL */}
          <View
            className="flex-1 flex-row items-stretch rounded-xl overflow-hidden"
            style={{
              height: 52,
              borderColor: padIsLive ? COLORS.brand : COLORS.border,
              backgroundColor: padIsLive
                ? "rgba(88,190,236,0.28)"
                : "rgba(255,255,255,0.02)",
            }}
          >
            {/* Play / Stop Toggle Zone */}
            <TouchableOpacity
              onPress={togglePad}
              disabled={!padPack}
              accessibilityRole="button"
              accessibilityLabel={padIsLive ? "Stop pad" : "Start pad"}
              activeOpacity={0.8}
              className="flex-1 flex-row items-center pl-4 pr-2"
            >
              {/* Pulse status indicator */}
              {/* <View
                className="w-2.5 h-2.5 rounded-full mr-3"
                style={{
                  backgroundColor: padIsLive ? COLORS.brand : "rgba(255,255,255,0.15)",
                  shadowColor: COLORS.brand,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: padIsLive ? 0.8 : 0,
                  shadowRadius: 4,
                }}
              /> */}
              <View className="flex-1 pl-2">
                <Text className="text-[10px] tracking-wider font-spaceBold text-ink-muted uppercase">
                  PAD - Tap to Play
                </Text>
                <Text
                  className="text-sm font-satoshiBold"
                  style={{ color: padIsLive ? COLORS.brand : COLORS.white }}
                >
                  {songKey
                    ? `${songKey} ${songMode === "minor" ? "Minor" : "Major"}`
                    : "SELECT A KEY"}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Change/Edit Key Target Area */}
            <TouchableOpacity
              onPress={() => {
                hapticImpact(prefs.haptics, "light");
                setEditingKey(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Change song key"
              activeOpacity={0.7}
              className="px-4 justify-center items-center border-l"
              style={{
                borderColor: padIsLive ? "rgba(88,190,236,0.2)" : COLORS.border,
                backgroundColor: "rgba(255,255,255,0.03)",
              }}
            >
              <Text className="text-[10px] font-spaceBold text-brand">
                {songKey ? "KEY" : "SET KEY"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* METRONOME CLICK PILL */}
          {isStemCue && (
            <TouchableOpacity
              onPress={() => {
                hapticImpact(prefs.haptics, "medium");
                setPref("stemClick", !prefs.stemClick);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                prefs.stemClick ? "Turn click off" : "Turn click on"
              }
              activeOpacity={0.8}
              className="px-5 items-center justify-center rounded-xl"
              style={{
                height: 52,
                backgroundColor: prefs.stemClick
                  ? "rgba(245,158,11,0.38)"
                  : "transparent",
                borderColor: prefs.stemClick ? COLORS.warning : COLORS.border,
              }}
            >
              <View className="flex-row items-center gap-1.5">
                {/* <View
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: prefs.stemClick ? COLORS.warning : "rgba(255,255,255,0.2)",
                  }}
                /> */}
                <Text
                  className="text-micro font-spaceBold tracking-wider"
                  style={{
                    color: prefs.stemClick ? COLORS.warning : COLORS.textMuted,
                  }}
                >
                  CLICK
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View className="px-screen pb-4">
        {!isStemCue ? (
          <TouchableOpacity
            onPress={toggleCueTransport}
            disabled={cueIsEmpty}
            accessibilityLabel={cueIsLive ? "Stop this cue" : "Play this cue"}
            activeOpacity={0.85}
            className="flex-row items-center justify-center rounded-lg"
            style={{
              height: view === "perform" ? 84 : 60,
              backgroundColor: cueIsLive ? COLORS.danger : COLORS.brand,
              opacity: cueIsEmpty ? 0.4 : 1,
              ...SHADOWS.float,
            }}
          >
            {cueIsLive ? <Stop size={40} /> : <PlayFilled size={40} />}
            <Text className="ml-3 text-heading text-white font-spaceBold">
              {cueIsLive ? "STOP" : "PLAY"}
            </Text>
          </TouchableOpacity>
        ) : view === "studio" ? (
          <View className="flex-row items-center w-full gap-2" style={{ height: 60 }}>
            {/* Return to Zero (RTZ) Button */}
            <TouchableOpacity
              onPress={returnToZero}
              disabled={tracks.length === 0}
              accessibilityRole="button"
              accessibilityLabel="Return to start"
              activeOpacity={0.85}
              className="items-center justify-center rounded-lg border border-hairline"
              style={{
                width: 60,
                height: 60,
                borderColor: COLORS.border,
                backgroundColor: COLORS.surfaceMuted,
                opacity: tracks.length === 0 ? 0.4 : 1,
              }}
            >
              <AudioStart size={28} color={COLORS.white} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleStudioTransport}
              disabled={tracks.length === 0}
              accessibilityRole="button"
              accessibilityLabel={session.isPlaying ? "Stop" : "Play"}
              activeOpacity={0.85}
              className="flex-1 flex-row items-center justify-center rounded-lg"
              style={{
                height: 60,
                backgroundColor: session.isPlaying ? COLORS.danger : COLORS.brand,
                opacity: tracks.length === 0 ? 0.4 : 1,
                ...SHADOWS.float,
              }}
            >
              {session.isPlaying ? <Stop size={34} /> : <PlayFilled size={34} />}
              <Text className="ml-3 text-heading text-white font-spaceBold">
                {session.isPlaying ? "STOP" : "PLAY"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row" style={{ height: 60 }}>
            <TouchableOpacity
              onPress={togglePerformTransport}
              disabled={tracks.length === 0}
              accessibilityRole="button"
              accessibilityLabel={
                session.isPlaying ? "Stop" : "Play from the top"
              }
              accessibilityHint={
                session.isPlaying
                  ? "Stops the song. Playing again starts from the top."
                  : undefined
              }
              accessibilityState={{ disabled: tracks.length === 0 }}
              activeOpacity={0.85}
              className="flex-row items-center justify-center flex-1 mr-2 rounded-lg"
              style={{
                backgroundColor: session.isPlaying
                  ? COLORS.danger
                  : COLORS.brand,
                borderWidth: 2,
                borderColor: session.isPlaying ? COLORS.danger : COLORS.brand,
                opacity: tracks.length === 0 ? 0.4 : 1,
                ...SHADOWS.float,
              }}
            >
              {session.isPlaying ? <Stop size={40} /> : <PlayFilled size={40} />}
              <Text className="ml-3 text-readout text-white font-spaceBold">
                {session.isPlaying ? "STOP" : "PLAY"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleMasterMute}
              disabled={tracks.length === 0}
              accessibilityRole="button"
              accessibilityLabel={
                masterMuted ? "Unmute everything" : "Mute everything"
              }
              accessibilityHint="Silences the song without stopping it, so it can be brought back where it is."
              accessibilityState={{
                selected: masterMuted,
                disabled: tracks.length === 0,
              }}
              activeOpacity={0.85}
              className="items-center justify-center border-2 rounded-lg"
              style={{
                width: 76,
                backgroundColor: masterMuted ? COLORS.danger : "transparent",
                borderColor: masterMuted ? COLORS.danger : COLORS.border,
                opacity: tracks.length === 0 ? 0.4 : 1,
              }}
            >
              <Text
                className="text-title text-center font-spaceBold"
                style={{ color: masterMuted ? COLORS.white : COLORS.textMuted }}
              >
                SOLO CLICK
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!session.isReady && tracks.length > 0 && (
          <Text className="mt-2 text-center text-micro text-ink-muted font-satoshiRegular">
            Loading stems — play will start as soon as they&apos;re ready.
          </Text>
        )}
      </View>

      <BottomSheetModal
        ref={setlistSheetRef}
        enableDynamicSizing
        snapPoints={SHEET_SNAP_POINTS}
        maxDynamicContentSize={MAX_SHEET_HEIGHT}
        onDismiss={() => setBrowsingSet(false)}
        backdropComponent={renderBackdrop}
        backgroundStyle={SHEET_BACKGROUND}
        handleIndicatorStyle={SHEET_HANDLE_INDICATOR}
      >
        <BottomSheetScrollView contentContainerStyle={SHEET_CONTENT}>
          <Text className="mb-3 text-white font-satoshiBold text-title">
            {setlist?.title ?? "Setlist"}
          </Text>

          {setlist?.items.map((item, index) => {
            const isCurrent = item.id === cue.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => openCue(item)}
                disabled={isCurrent}
                activeOpacity={0.8}
                accessibilityLabel={`Load ${item.title}`}
                className="flex-row items-center px-3 py-3 mb-2 border rounded-lg"
                style={{
                  backgroundColor: isCurrent ? COLORS.surface : "transparent",
                  borderColor: isCurrent ? COLORS.brand : COLORS.border,
                }}
              >
                <Text
                  className="w-6 text-label text-ink-muted font-spaceBold"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {index + 1}
                </Text>
                <View className="flex-1 ml-1">
                  <Text
                    className="text-white font-satoshiBold text-body"
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text className="mt-0.5 text-micro text-ink-muted font-satoshiRegular">
                    {describeCue(item)}
                  </Text>
                </View>
                {isCurrent && (
                  <Text className="text-nav text-brand font-spaceBold tracking-widest">
                    HERE
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}

          <Text className="mt-2 text-micro text-ink-muted font-satoshiRegular">
            Tapping a cue loads it and stops there — press PLAY when
            you&apos;re ready.
          </Text>
        </BottomSheetScrollView>
      </BottomSheetModal>

      <RepeatPicker
        key={repeatsFor ?? "repeat-sheet"}
        ref={repeatPickerRef}
        sectionName={repeatSection?.name}
        repeats={repeatSection?.repeats}
        onSelect={(choice) => {
          if (repeatsFor) {
            setSectionRepeats(repeatsFor, choice);
          }
        }}
        onClose={() => setRepeatsFor(null)}
      />

      <Modal
        visible={editingKey}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingKey(false)}
      >
        <View
          className="items-center justify-center flex-1 px-8"
          style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
        >
          <View
            className="w-full p-5 border rounded-lg bg-canvas"
            style={{ borderColor: COLORS.border }}
          >
            <Text className="mb-1 text-white font-satoshiBold text-title">
              Song key
            </Text>
            <Text className="mb-4 text-micro text-ink-muted font-satoshiRegular">
              What a pad plays underneath this song.
            </Text>

            <View className="flex-row flex-wrap gap-2">
              {KEYS.map((key) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setSongKey(key, songMode)}
                  accessibilityLabel={`Key of ${key}`}
                  accessibilityState={{ selected: songKey === key }}
                  activeOpacity={0.8}
                  className="items-center justify-center border rounded-lg"
                  style={{
                    width: 52,
                    height: 40,
                    backgroundColor:
                      songKey === key ? COLORS.brand : "transparent",
                    borderColor: songKey === key ? COLORS.brand : COLORS.border,
                  }}
                >
                  <Text
                    className="text-overline font-spaceBold"
                    style={{
                      color: songKey === key ? COLORS.white : COLORS.textMuted,
                    }}
                  >
                    {key}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row gap-2 mt-4">
              {(["major", "minor"] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setSongKey(songKey, option)}
                  accessibilityLabel={option}
                  accessibilityState={{ selected: songMode === option }}
                  activeOpacity={0.8}
                  className="items-center flex-1 py-3 border rounded-lg"
                  style={{
                    backgroundColor:
                      songMode === option ? COLORS.brand : "transparent",
                    borderColor:
                      songMode === option ? COLORS.brand : COLORS.border,
                  }}
                >
                  <Text
                    className="text-micro font-spaceBold"
                    style={{
                      color:
                        songMode === option ? COLORS.white : COLORS.textMuted,
                    }}
                  >
                    {option.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row mt-4">
              {songKey && (
                <TouchableOpacity
                  onPress={() => {
                    setSongKey(undefined, songMode);
                    setEditingKey(false);
                  }}
                  accessibilityLabel="Clear the key"
                  activeOpacity={0.8}
                  className="items-center justify-center flex-1 py-3 mr-2 border rounded-lg"
                  style={{ borderColor: COLORS.border }}
                >
                  <Text className="text-overline text-ink-muted font-spaceBold">
                    CLEAR
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setEditingKey(false)}
                accessibilityLabel="Done"
                activeOpacity={0.8}
                className="items-center justify-center flex-1 py-3 rounded-lg"
                style={{ backgroundColor: COLORS.brand }}
              >
                <Text className="text-overline text-white font-spaceBold">DONE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={naming !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setNaming(null)}
      >
        <View
          className="items-center justify-center flex-1 px-8"
          style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
        >
          <View
            className="w-full p-5 border rounded-lg bg-canvas border-hairline"
            style={{ borderColor: COLORS.border }}
          >
            <Text className="mb-1 text-white font-satoshiBold text-title">
              {naming?.id ? "Rename section" : "New section"}
            </Text>
            <Text
              className="mb-1 text-micro text-ink-muted font-spaceBold"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {clock(naming?.startSeconds ?? 0)} →{" "}
              {naming?.endSeconds !== undefined
                ? clock(naming.endSeconds)
                : "END OF SONG"}
            </Text>
            <Text className="mb-4 text-micro text-ink-muted font-satoshiRegular">
              Drag either edge on the timeline to trim it.
            </Text>

            <BrandInput
              value={naming?.name ?? ""}
              onChangeText={(name) =>
                setNaming((current) => (current ? { ...current, name } : current))
              }
              placeholder="Chorus, Bridge, Last verse…"
              maxLength={24}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={commitSection}
            />

            <View className="flex-row mt-2">
              <TouchableOpacity
                onPress={() => setNaming(null)}
                accessibilityLabel="Cancel"
                activeOpacity={0.8}
                className="items-center justify-center flex-1 py-3 mr-2 border rounded-lg"
                style={{ borderColor: COLORS.border }}
              >
                <Text className="text-overline text-ink-muted font-spaceBold">
                  CANCEL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={commitSection}
                accessibilityLabel={naming?.id ? "Save the name" : "Add the section"}
                activeOpacity={0.8}
                className="items-center justify-center flex-1 py-3 rounded-lg"
                style={{ backgroundColor: COLORS.brand }}
              >
                <Text className="text-overline text-white font-spaceBold">
                  {naming?.id ? "SAVE" : "ADD"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
