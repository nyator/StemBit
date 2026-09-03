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
  CueSummary,
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
  Musicnote,
  PlayFilled,
  SortPad,
  Stop,
} from "../../components/icons";

// Playing one stem song.
//
// A song's worth of stems can't be performed from a row in a list, which is
// what it had before this: start, stop, and no way to touch a track. This is
// the surface you stand in front of for the length of the song, so everything
// on it is sized for a hand that is already busy, in the dark, with no time.
//
// The layout follows from that. Two columns rather than a list, because the
// tiles have to be big enough to hit without aiming and a list of full-width
// rows would put the last stem off the bottom of the screen. Mute state is
// carried by the whole tile -- fill and border, not a small control inside it
// -- so which parts are sounding reads from arm's length.
//
// That is the PERFORM view, and it is one of two, because a stem song is worked
// on in two completely different postures. On stage you are hitting things you
// cannot look at. Beforehand -- at a table, with time -- you are finding where
// the bridge starts, deciding how far under the band the guide keys sit, and
// checking the drums actually drop where you think they do. Those wants are not
// a compromise away from each other: one needs the biggest possible targets and
// no detail, the other needs detail and no targets at all. So STUDIO is the
// picture every DAW draws (stems stacked in time, one ruler, one playhead, a
// mixer under it) and PERFORM is section pads and track tiles, one tap away.
//
// Once the two exist, PERFORM stops needing a waveform at all. A waveform is
// for placing things precisely, which is a studio job and now has a studio
// surface with zoom on it; on stage it is a picture you cannot act on holding
// space that the pads and the emergency solo want. So the split is not just
// where the controls live, it is what each view is allowed to contain.
//
// What PERFORM does need is the header every stage rig ends up with -- MainStage
// and the Studio One show page both open with the same block, and they open with
// it because the questions it answers are the ones asked between songs: what is
// running, how far in, how long left, what is next. Nothing above it is worth
// the vertical space it would cost. Below that the surface is targets: section
// pads, then one tile per stem, then a transport whose buttons never move.
//
// Every cue opens here, not only the ones with stems in them.
//
// It started as the stem song's screen, which left the running order split in
// two: a song had somewhere to stand in front of and a loop cue did not, so
// PREV and NEXT went dead every time the set reached one. A set is played
// straight through -- the walk-in loop, the song, the altar-call pad -- and a
// way through it that skips two of those three is not a way through it.
//
// So both views take a loop cue too, and they mean the same thing they mean for
// a song. STUDIO is what the cue is made of, which for a song is stems in time
// and for a loop cue is the choices it holds: which loop, how fast, which pad,
// what key. PERFORM is that made ready to fire. What is deliberately identical
// across the two kinds is the frame -- the header, the block at the top, the
// two buttons that step through the set, the transport at the bottom -- because
// between songs you are not asking what kind of cue you opened.

/** What a stem sits at before anyone touches it, and what an old cue implies. */
const DEFAULT_MIX: TrackMix = { level: 1, pan: 0, muted: false };

/**
 * The shortest a section is allowed to get while an edge is dragged.
 *
 * Not a musical length -- it isn't there to say what a sensible section is, it
 * is there so the two edges can't cross. Small enough that a drag never feels
 * like it's being fought.
 */
const MIN_SECTION_SECONDS = 0.25;

/**
 * Detector confidence at or above which the reading is worth trusting on sight.
 *
 * Not a probability -- it is the winning tempo's share of all the candidate
 * intervals. Material with a clear pulse puts half of them or more on one
 * answer; material without spreads them, and the reading is a guess dressed as
 * a number. Either way the tempo is only ever offered here, so this decides
 * what the card says rather than whether it appears.
 */
const CLEAR_PULSE = 0.5;

/**
 * The cue's name, at the top of both STUDIO views.
 *
 * First because it is the first thing a new cue needs, and because the running
 * order is read by it. Its own component only so the two views can't drift
 * apart on where it sits or what it says.
 */
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
      // Saved on the way out of the field rather than per keystroke, which is
      // also when the name is finished being typed.
      onBlur={onCommit}
      onSubmitEditing={onCommit}
      placeholder="Opener, Altar call…"
      maxLength={40}
      returnKeyType="done"
    />
  );
}

/** One imported stem, with the way to take it back out. */
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

/** Picks stems, and says so while the copy is happening. */
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

/**
 * One full-width SectionPad's footprint on PERFORM: its own height plus the
 * `mb-2` under it. Used to compute where a pad sits without measuring it, so
 * the list can be scrolled to a section the instant it goes live rather than
 * waiting on a layout pass.
 */
const SECTION_PAD_ROW_HEIGHT = 66 + 8;

/**
 * Resolution of the flattened song shape behind PERFORM's transport bar.
 *
 * Far coarser than the 1200 each stem is measured at, because the bar it feeds
 * is a phone's width -- a few hundred bars at most, and it downsamples again to
 * fit. Merging at this size keeps the per-cue work small without costing
 * anything visible.
 */
const SONG_PEAK_BUCKETS = 400;

/** Stable identity, so an unmeasured cue doesn't rebuild the path every render. */
const EMPTY_PEAKS: number[] = [];

export default function PerformanceScreen() {
  const { sessionId, itemId, view: viewParam } = useLocalSearchParams<{
    sessionId?: string;
    itemId?: string;
    /** Which view to land on -- see the note on `view` below. */
    view?: string;
  }>();
  const router = useRouter();
  const { findSession, updateItem, removeItem } = useSessions();
  const { prefs, setPref } = usePreferences();
  const session = useSessionPlayback();
  // A loop or pad cue is fired the same way the setlist row fires it -- through
  // the cue context, which loads the loop, sets the tempo and arms the pad in
  // the order those have to happen in. This screen doesn't reimplement that; it
  // just gives it somewhere bigger to be pressed from.
  const {
    armPad,
    releasePad,
    play: fireCue,
    stop: stopCue,
    stopTransport: stopCueTransport,
    liveItemId,
  } = useSessionCue();
  // Retained rather than read off the context: PERFORM's readout draws it, so
  // the engine reports its position for as long as this screen is up and stops
  // when it isn't. See useLoopPhase.
  const loopPhase = useLoopPhase();
  // Only for a tempo nudge landing on a loop that is already sounding. Everything
  // else about the loop engine is the cue context's business.
  const { setBpm: setEngineBpm } = useLoopPlayback();
  const pad = usePadPlayback();

  const setlist = findSession(sessionId);
  const cueIndex = setlist?.items.findIndex((item) => item.id === itemId) ?? -1;
  const cue = cueIndex >= 0 ? setlist?.items[cueIndex] : undefined;
  // What sits either side of this song in the running order. Only a stem cue
  // can be opened here -- a loop or pad cue has no per-track surface to stand
  // in front of and is fired from the setlist row itself -- so anything else is
  // shown as a name and nothing more.
  //
  // The immediate neighbour, not the nearest one with stems in it. Skipping the
  // loop cue between two songs would make NEXT point past something the set
  // says is coming, and a running order that quietly omits parts of itself is
  // worse than a button that says why it can't move.
  const prevCue = cueIndex > 0 ? setlist?.items[cueIndex - 1] : undefined;
  const nextCue = cueIndex >= 0 ? setlist?.items[cueIndex + 1] : undefined;
  const tracks = cue?.tracks ?? [];
  const sections = cue?.sections ?? [];
  const bpm = cue?.bpm ?? 120;

  // Which kind of cue this is, which decides what both views contain.
  //
  // A stem song is audio laid out in time, so STUDIO is a timeline and a mixer
  // and PERFORM is section pads. A loop cue has no such picture -- it is a
  // handful of choices about what to put in the room -- so STUDIO is those
  // choices and PERFORM is what they add up to. What does not change is the
  // frame: the same header, the same block at the top, the same two buttons for
  // moving through the set, the transport in the same place. Between songs you
  // are not asking which kind of cue you opened.
  const isStemCue = tracks.length > 0;
  const loop = cue?.loopKey ? findLoopByKey(cue.loopKey) : undefined;
  // A loop cue's transport lives in the cue context rather than in this screen,
  // so "is this one sounding" is a question about the set, not about an engine.
  const cueIsLive = !!cue && liveItemId === cue.id;
  /** Anything audible from this cue, whichever engine is producing it. */
  const isSounding = isStemCue ? session.isPlaying : cueIsLive;

  // Which posture the screen opens in, chosen by whoever opened it.
  //
  // The two views are now two different jobs rather than two levels of detail:
  // STUDIO is where a cue is built and named, PERFORM is where it is fired. So
  // the way in decides -- adding a cue or editing one lands in STUDIO, the
  // PERFORM buttons on the setlist land in PERFORM -- rather than everything
  // arriving at the same place and needing a tap to correct it.
  //
  // Read once, on the way in. Stepping to another cue doesn't remount this
  // screen, so whichever view you are working in is the one you stay in.
  const [view, setView] = useState<"studio" | "perform">(
    viewParam === "perform" ? "perform" : "studio"
  );

  // The mix, held here rather than read straight off the cue.
  //
  // Levels and pans are saved to the cue (they're a decision about the song,
  // made once and wanted again next time), but mute is not: dropping the vocal
  // because the singer is talking is a decision about tonight, and persisting
  // it would write to disk on every tap and bring last night's mutes back to
  // the next gig. So this starts from what was saved, with everything unmuted.
  const [mix, setMix] = useState<Record<string, TrackMix>>({});
  // Solo is separate from mute rather than derived from it. Dropping the vocal
  // and soloing the drums are different intents, and collapsing them means
  // clearing a solo has to guess which tracks you had muted beforehand.
  const [soloed, setSoloed] = useState<string | null>(null);
  // Everything down at once, without disturbing which tracks were muted.
  //
  // The one control on this screen that exists for a specific bad moment: the
  // wrong song is playing, or someone starts talking, and the whole thing has to
  // stop being audible immediately. Stop would do it too, but stop loses where
  // you were and the song can't be resumed from it; this is reversible.
  const [masterMuted, setMasterMuted] = useState(false);

  // Which section is sounding, and which has been hit but hasn't landed yet --
  // a launch is quantised to the next bar, so there is a real gap between the
  // press and the change, and a pad that lights instantly is lying about it.
  //
  // From a hook because the setlist's expanded row draws these same pads, and
  // two surfaces disagreeing about which section is live would be worse than
  // either answer on its own. It owns the playhead too, since a pad's fill is
  // interpolated straight off it.
  const {
    playheadSeconds: playheadValue,
    liveSectionId,
    armedSectionId,
    arm: armSection,
  } = useLiveSections(sections);

  // PERFORM's section list follows the song instead of being scrolled by
  // hand -- a long arrangement you have to drag to keep up with is fighting
  // you at the one moment there's no spare hand for it. It jumps to whichever
  // pad just went live on its own; see the effect below and the disabled
  // scroll on the list itself.
  const performSectionsRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (!liveSectionId) return;
    const index = sections.findIndex((section) => section.id === liveSectionId);
    if (index < 0) return;
    // One row short of the target, so the live pad lands just under the top
    // edge with the one before it still showing -- landing it flush at the
    // very top would cut off the context of what just finished.
    performSectionsRef.current?.scrollTo({
      y: Math.max(0, (index - 1) * SECTION_PAD_ROW_HEIGHT),
      animated: true,
    });
  }, [liveSectionId, sections]);

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  // The running order, over the top of the performance screen.
  //
  // The rail down the left of every desktop show page, which a phone has no
  // room for -- so it is a sheet you pull up instead. Same job: getting to
  // another song in the set without walking back out to the setlist and in
  // again, which is a lot of navigation for something you do between every song.
  const [browsingSet, setBrowsingSet] = useState(false);
  const setlistSheetRef = useRef<BottomSheetModal>(null);
  const renderBackdrop = useSheetBackdrop();

  // Which section's repeat count is being picked, or null. The id rather than
  // the section itself, so the sheet always reads the live one -- a count
  // written while it is open has to come back through the same list everything
  // else on this screen draws from.
  const [repeatsFor, setRepeatsFor] = useState<string | null>(null);
  const repeatSection = sections.find((section) => section.id === repeatsFor);
  const repeatPickerRef = useRef<RepeatPickerHandle>(null);

  // present() is called here, synchronously, rather than from an effect
  // reacting to `visible` the way every other sheet in this app is driven --
  // see the note on RepeatPickerHandle for why. Setting the state still
  // matters: it's what the picker reads to know which section it's showing.
  const openRepeats = (sectionId: string) => {
    setRepeatsFor(sectionId);
    repeatPickerRef.current?.present();
  };

  // The sheet is driven imperatively and this screen thinks in state, so the
  // two are bridged here. Dismissing an already-dismissed sheet is a no-op.
  useEffect(() => {
    if (browsingSet) setlistSheetRef.current?.present();
    else setlistSheetRef.current?.dismiss();
  }, [browsingSet]);

  // Close the picker if the section it is editing stops existing.
  //
  // `repeatsFor` is an id, so it can outlive what it points at: delete the
  // section under it, or step to the next cue with the sheet still up, and it
  // is left addressing nothing -- a sheet titled "Section", captioned for a
  // default, whose buttons write a count into a list that has no such id and
  // so change nothing at all.
  //
  // Guarded here rather than cleared at each place a section can vanish. Those
  // are two sites today and every future one is a silent reintroduction of
  // this bug; deriving it from whether the section is still there cannot be
  // forgotten.
  // Keyed on whether it was found, not on the section itself: `find` returns a
  // fresh reference every render, and this screen re-renders on every drag.
  const repeatSectionExists = !!repeatSection;
  useEffect(() => {
    if (repeatsFor && !repeatSectionExists) setRepeatsFor(null);
  }, [repeatsFor, repeatSectionExists]);

  // Where the transport will start from. Distinct from where the audio is: with
  // the transport stopped only this one exists, and it is the thing a drag on
  // the timeline moves.
  const [cursorSeconds, setCursorSeconds] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(false);

  // Held stable across renders, because dragging the playhead re-renders this
  // screen at the frame rate and the timeline only skips redrawing its
  // waveforms if the list it was handed is the same list it saw last time.
  const timelineTracks = useMemo(
    () => tracks.map((track) => ({ id: track.id, name: track.name })),
    [tracks]
  );

  // The song's shape, one measurement per stem. All of them, rather than one
  // picture of the song: seeing the drums drop out under the bridge while the
  // keys hold is the entire reason to have a timeline, and a single combined
  // waveform cannot show it.
  const [peaks, setPeaks] = useState<Record<string, number[]>>({});
  // Each stem's own length. The timeline doesn't need this -- every lane is
  // drawn against the same axis -- but flattening the stems into one envelope
  // does, because a stem's buckets are spread across ITS duration and a vocal
  // that stops early would otherwise be stretched over the whole song.
  const [trackDurations, setTrackDurations] = useState<Record<string, number>>({});
  const [duration, setDuration] = useState(0);
  const [timelineWidth, setTimelineWidth] = useState(0);

  // Driven straight from the engine's reports rather than through state: the
  // playhead and the meters move sixteen times a second, and as state that is
  // sixteen renders of this whole screen per second to shift a 2px line.
  const metersRef = useRef<Map<string, Animated.Value>>(new Map());
  const meterFor = (trackId: string) => {
    let value = metersRef.current.get(trackId);
    if (!value) {
      value = new Animated.Value(0);
      metersRef.current.set(trackId, value);
    }
    return value;
  };

  // Subscribed rather than read off the context: the transport reports 16 times
  // a second, and this keeps that traffic to this screen instead of the app.
  //
  // Nothing here reaches state. Every moving thing on this screen -- the
  // playhead, each meter -- is an Animated.Value, so the transport running does
  // not re-render anything at all. That is only possible because the bar/beat
  // counter is gone: a number on screen is the one thing that has to go through
  // React, and it was costing a render of the whole screen per beat.
  useEffect(
    () =>
      session.subscribePosition((next) => {
        metersRef.current.forEach((value, trackId) => {
          value.setValue(next.levels[trackId] ?? 0);
        });
      }),
    [session]
  );

  // Stopped, the playhead sits on the cursor -- that is where play would start,
  // and a playhead left where the audio stopped would be pointing at the past.
  useEffect(() => {
    if (!session.isPlaying) playheadValue.setValue(cursorSeconds);
  }, [cursorSeconds, session.isPlaying, playheadValue]);

  // A different cue: forget everything measured or decided about the last one.
  //
  // This screen is never remounted between cues -- PREV, NEXT and the setlist
  // sheet all rewrite its params rather than navigating, see openCue -- so
  // nothing here is cleared for us. Every piece of state that describes the cue
  // rather than the session has to be dropped by hand.
  //
  // Duration especially: it is accumulated with Math.max across the stems, so a
  // longer previous song's value would leave the progress bar and the remaining
  // time measuring against a song that isn't playing.
  useEffect(() => {
    setPeaks({});
    setTrackDurations({});
    setDuration(0);
    setCursorSeconds(0);
    setSoloed(null);
    setMasterMuted(false);
    // A section id belonging to the cue we just left, which would otherwise sit
    // there arming RENAME and DELETE against a section that isn't on screen.
    setSelectedSectionId(null);
    // A tempo read off another song's stems. Offering it here would be offering
    // it for this one.
    setDetecting(false);
    setSuggestion(null);
    detectKeyRef.current = null;
  }, [cue?.id]);

  // The stems are decoded on arrival so the first press starts immediately
  // rather than after a wait. Between soundcheck and the downbeat there is
  // time for this; between two songs there isn't.
  useEffect(() => {
    if (!cue?.id || tracks.length === 0) return;
    session.loadCue(cue.id, tracks).catch((error) => {
      console.error("Failed to load stems", error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.id]);

  // Seeded from the cue once the stems are in, then pushed to the engine, so a
  // level set last week is in place before a note sounds rather than snapping
  // in after the first fader touch.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Runs on readiness rather than on every mix change: the handlers below
    // already push their own change to the engine the moment it is made, and
    // repeating the whole mix on each of them would ramp every other track's
    // gain for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isReady, cue?.id]);

  // Measured one stem at a time. Each of these walks a whole decoded buffer
  // inside the WebView, and asking for four at once holds the page long enough
  // to be seen as a stall.
  useEffect(() => {
    // Readiness alone isn't enough to ask for a waveform: it is the engine's
    // answer about whatever cue it is holding, which during a swap is still the
    // last one. Measuring then asks for tracks it has never been given, and
    // every one of those waits out its timeout before admitting it.
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
          // No shape for one stem is survivable -- its lane draws empty and
          // everything else on the screen still works.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isReady, session.loadedCueId, cue?.id, tracks.length]);

  /**
   * The stems flattened to one envelope, for PERFORM's transport bar.
   *
   * The opposite call from the timeline's, and for the opposite reason. Down
   * there the whole point is seeing the stems apart -- the drums dropping out
   * under the bridge is the read. Up here there is one bar's worth of height and
   * one question ("how far through are we"), so what's wanted is the song as the
   * room hears it: one shape.
   *
   * The loudest stem per bucket, not the sum. Summing four stems that all hit on
   * the downbeat pins the bar at full height for most of the song and flattens
   * exactly the contrast that makes the shape recognisable; the max tracks
   * whatever is carrying the moment, which is what you'd point at.
   *
   * Mapped through time rather than by bucket index, because a stem's buckets
   * span its own length -- see trackDurations.
   */
  const songPeaks = useMemo(() => {
    const measured = Object.entries(peaks).filter(
      ([, shape]) => shape.length > 0
    );
    if (measured.length === 0 || duration <= 0) return EMPTY_PEAKS;

    const merged = new Array<number>(SONG_PEAK_BUCKETS).fill(0);
    for (const [trackId, shape] of measured) {
      // A stem measured but not yet timed can only be assumed to run the whole
      // song; it's the same length as the others in every ordinary case.
      const span = trackDurations[trackId] ?? duration;
      if (span <= 0) continue;
      // What fraction of the song's timeline this stem covers, and therefore how
      // much of the merged array it has any say over.
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

  /* ---------------------------------------------------------------------- */
  /* Mix                                                                     */
  /* ---------------------------------------------------------------------- */

  const mixOf = (trackId: string) => mix[trackId] ?? DEFAULT_MIX;

  /**
   * Whether a track is audible, from all three things that can silence it.
   *
   * One function because the answer has to be the same everywhere: the tile, the
   * channel strip, the timeline lane and the engine all have to agree, and three
   * of those are only showing what the fourth is doing.
   */
  const isSilent = (
    trackId: string,
    solo: string | null = soloed,
    master: boolean = masterMuted
  ) => master || (solo ? trackId !== solo : mixOf(trackId).muted);

  /** Pushes one track to the engine, with the master and any solo winning. */
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

  /**
   * Writes levels and pans back to the cue.
   *
   * Called on release rather than on every frame of a fader move: this
   * serialises the whole setlist to disk, and doing it per frame would write a
   * few hundred times per gesture.
   */
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
    // Soloing the track already soloed clears it, which is the fastest way back
    // to the full mix and the thing you want when the moment has passed.
    const next = soloed === trackId ? null : trackId;
    setSoloed(next);
    // Solo changes what every track hears, not just this one, so the whole mix
    // goes to the engine rather than one line of it.
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

  /* ---------------------------------------------------------------------- */
  /* Transport                                                               */
  /* ---------------------------------------------------------------------- */

  /**
   * The section a moment falls inside.
   *
   * The last one that has started and not yet ended. Both edges are checked
   * because sections no longer have to be contiguous -- a moment in the gap
   * between two of them is inside neither, and looping it against the section
   * before would loop a span nobody marked.
   */
  const containingSection = (seconds: number) =>
    [...sections]
      .reverse()
      .find(
        (section) =>
          seconds >= section.startSeconds - 0.001 &&
          (section.endSeconds === undefined || seconds < section.endSeconds)
      );

  /**
   * What STUDIO's play button launches: the song from the cursor.
   *
   * With LOOP on it launches the section the cursor is sitting in instead,
   * from that section's start. Looping an arbitrary cursor-to-section-end span
   * would be a length nobody chose; looping the section is the thing the button
   * is actually for.
   */
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
    // Immediately, not on the next bar: in the studio view you have pointed at
    // a spot and asked to hear it, and waiting a bar first is just a delay.
    session.play(tracks, bpm, 0, spanFromCursor());
  };

  /**
   * PERFORM's transport: one button, playing or stopped.
   *
   * This was two fixed buttons, on the reasoning that a toggle hit blind is a
   * coin toss on what state the app is in, and that getting it wrong either
   * kills the song or restarts it from the top. What that argument missed is
   * that the button is not the only thing saying which way round it is: it is
   * directly under a transport bar whose waveform is either filling or it
   * isn't, and under a title with a live dot beside it. Blind is the wrong
   * model for a surface you are already looking at to know where you are in the
   * song -- and paying for it with a permanent 76pt button that does nothing
   * for the whole song is the wrong trade at this size.
   *
   * The press stays destructive, so it stays deliberate: STOP is the danger
   * colour and PLAY is not, which is a difference you can catch in the corner
   * of your eye without reading either word.
   */
  const togglePerformTransport = () => {
    if (tracks.length === 0) return;
    hapticImpact(prefs.haptics, "heavy");
    if (session.isPlaying) {
      session.stop();
      return;
    }
    // From the top, through the whole arrangement.
    //
    // The section list goes with it, which is the difference between this and
    // what PLAY used to do. It sent one flat span from the top of the song to
    // the end of the file, so every repeat count on every section did nothing
    // unless that section's own pad was what started it -- a song set to play
    // its chorus four times played it once from here.
    //
    // Ends are resolved before they are sent. A section's `endSeconds` is
    // optional and the last one usually has none, but a span with no end is
    // not a thing that can be repeated, so each one falls back to the next
    // section's start and the final one to the measured length of the stems.
    session.play(tracks, bpm, 0, {
      id: "song",
      startSeconds: sections[0]?.startSeconds ?? 0,
      loop: false,
      arrangement: arrangementSpans,
    });
  };

  // Sections launch on the next bar rather than under the finger. That's the
  // whole point: you hit "Chorus" somewhere in the verse and the change lands
  // where the band expects it, not where your thumb happened to be.
  const launchSection = (section: CueSection) => {
    hapticImpact(prefs.haptics, "heavy");
    // `repeats` spelled out rather than left to the section's own field being
    // absent, because absent means something else to the engine: it falls back
    // to the old loop flag, which defaults ON. A section that has never had its
    // badge touched has no `repeats` at all, and without this it would loop
    // forever -- the behaviour the badge exists to replace.
    session.play(tracks, bpm, 4, {
      ...section,
      repeats: section.repeats ?? 1,
    });
    // Pending until the playhead reaches it.
    armSection(section.id);
  };

  /**
   * Hand this screen another cue from the running order.
   *
   * setParams, not a push or a replace. Moving along a setlist is not
   * navigation -- it is the same surface pointed at the next thing -- and both
   * of the navigating options say otherwise. A push stacks every cue played
   * tonight behind the back button; a replace looks right but isn't, because
   * expo-router gives the incoming route a fresh key, so the screen tears down
   * and rebuilds with the stack's slide animation over it. Which is exactly
   * what it looks like: pressing NEXT appeared to open a new screen.
   *
   * Rewriting the params instead re-renders this screen in place. Nothing
   * animates, nothing unmounts, and everything the screen was holding -- which
   * view you were in, the sheet, the mix in progress -- is still there. The
   * effects keyed on the cue's id still fire, which is what swaps the audio.
   *
   * It loads and stops there rather than playing. The stems take a moment to
   * decode, so a tap that meant "line this up next" would start the song some
   * unpredictable number of seconds later -- which on stage is the one thing
   * that must never happen. PLAY is a 76pt button directly below.
   */
  const openCue = (item: SessionItem) => {
    setBrowsingSet(false);
    if (item.id === cue?.id) return;
    hapticImpact(prefs.haptics, "medium");
    // Both transports, since the cue being left could have been running on
    // either. The pad is left sounding on purpose -- see togglePerformTransport.
    stopCueTransport();
    // Dropped here rather than in an effect: clearing it after the next render
    // would orphan the values the tiles are already holding, and their meters
    // would freeze. Cleared now, the render that follows builds fresh ones.
    // Without this the map keeps a value per stem of every song played tonight.
    metersRef.current.clear();
    // The screen doesn't unmount on the way to another cue, so the tidying the
    // unmount would have done has to happen here instead.
    leaveCue(cue);
    router.setParams({ itemId: item.id });
  };

  /**
   * A neighbouring cue, as the readout's PREV/NEXT buttons want it.
   *
   * The press is withheld -- leaving the name showing but the button dead --
   * while anything from this cue is sounding: moving means loading the next
   * one, and loading it would stop what the room is listening to.
   */
  const neighbour = (item: SessionItem | undefined) =>
    item
      ? {
          title: item.title,
          onPress: isSounding ? undefined : () => openCue(item),
        }
      : undefined;

  /* ---------------------------------------------------------------------- */
  /* Loop and pad cues                                                       */
  /* ---------------------------------------------------------------------- */

  /**
   * A loop cue's transport, which is one button in both views.
   *
   * Unlike a stem song there is nothing to be partway through: a loop is
   * running or it isn't, and pressing again starts it from the top of a pass.
   * So a toggle carries no risk of the ambiguity that made PERFORM split the
   * stem transport into two fixed buttons.
   */
  const toggleCueTransport = () => {
    if (!cue) return;
    hapticImpact(prefs.haptics, "heavy");
    if (cueIsLive) {
      stopCue();
      return;
    }
    fireCue(cue);
  };

  /** Whether this cue has anything to sound at all. */
  const cueIsEmpty = !isStemCue && !cue?.loopKey && !(cue?.padPack && cue?.padKey);

  /* ---------------------------------------------------------------------- */
  /* Building the cue                                                        */
  /* ---------------------------------------------------------------------- */

  // The name, held here while it's being typed.
  //
  // Not written per keystroke: updateItem serialises the whole setlist to disk,
  // so a forty-character name would be forty writes. Committed when the field
  // is left, which is also when the name is finished.
  const [draftTitle, setDraftTitle] = useState(cue?.title ?? "");
  useEffect(() => {
    setDraftTitle(cue?.title ?? "");
  }, [cue?.id, cue?.title]);

  const commitTitle = () => {
    if (!sessionId || !itemId || !cue) return;
    const next = draftTitle.trim();
    // A nameless cue can't be found in a running order, so an emptied field
    // goes back to what it was rather than saving nothing.
    if (!next) {
      setDraftTitle(cue.title);
      return;
    }
    if (next === cue.title) return;
    updateItem(sessionId, itemId, { title: next });
  };

  /**
   * A cue that was created and then left untouched.
   *
   * + makes the cue before you fill it in -- that is what lets STUDIO be the
   * only cue editor -- and the cost is that backing straight out would leave a
   * "Nothing set" row in the running order to find and delete by hand.
   *
   * Every condition, not any: naming a cue is intent to keep it even with
   * nothing in it yet, and a cue carrying a loop is obviously wanted whatever
   * it ended up called. Only the cue nobody touched at all is disposable.
   */
  const isAbandoned = (item: SessionItem) =>
    item.title === UNTITLED_CUE &&
    !item.tracks?.length &&
    !item.sections?.length &&
    !item.loopKey &&
    !item.padPack &&
    !item.padKey;

  /**
   * What becomes of a cue when you leave it -- for another cue, or off the
   * screen entirely.
   *
   * Two things, and only one can apply. A name typed but never committed is
   * saved, because leaving the screen is not a reason to lose it and the field
   * only commits on blur. Failing that, an untouched cue is dropped.
   *
   * The name is read from the draft rather than the cue, so a cue named in the
   * field and abandoned in the same breath is kept: what the user typed is what
   * they meant, whether or not the field lost focus first.
   */
  const leaveCue = (item: SessionItem | undefined) => {
    if (!sessionId || !item) return;

    const typed = draftTitle.trim();
    if (typed && typed !== item.title) {
      updateItem(sessionId, item.id, { title: typed });
      return;
    }

    if (isAbandoned(item)) removeItem(sessionId, item.id);
  };

  // Held in a ref and depended on with [], because it closes over the cue and
  // the draft name -- both new every render. As a dependency, React would run
  // the cleanup on each of those and delete the cue out from under the edit.
  const leaveRef = useRef(() => {});
  leaveRef.current = () => leaveCue(cue);
  useEffect(() => () => leaveRef.current(), []);

  const [importing, setImporting] = useState(false);

  /* ---------------------------------------------------------------------- */
  /* Tempo detection                                                         */
  /* ---------------------------------------------------------------------- */

  // Reading a tempo off freshly imported stems, and what it came back with.
  //
  // Only on import, and only ever offered. A cue opened later already has its
  // tempo -- either detected once and accepted, or typed -- and re-reading the
  // audio every time the screen opened would be work done to arrive at the
  // answer already stored. So this runs at the one moment there is nothing to
  // go on, and even then it asks: the detector reports a confidence for a
  // reason, and a tempo silently applied is one nobody checked.
  const [detecting, setDetecting] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    bpm: number;
    confidence: number;
    alternatives: number[];
  } | null>(null);
  // Which import the reading in flight belongs to, so an answer for stems that
  // have since been replaced is dropped rather than applied to the wrong song.
  const detectKeyRef = useRef<string | null>(null);

  const SHEET_SNAP_POINTS = ["50%"];


  /**
   * Read the tempo off one of the stems just imported.
   *
   * Asked of the stem engine, which has already decoded the audio for playback.
   * The alternative was a second engine mounted to read a second copy of the
   * same file -- at the one moment a whole multitrack song is already in
   * memory, which is the worst moment to hold another.
   *
   * One stem is enough: they are the same performance, and a bass part carries
   * the pulse as well as a full mix does.
   */
  const detectTempoFrom = async (track: CueTrack, cueId: string) => {
    detectKeyRef.current = cueId;
    setDetecting(true);
    try {
      const tempo = await session.detectTempo(track.id);
      // Moved on while it was reading: this answer describes a song that is no
      // longer on screen.
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

  /**
   * Add stems to this cue, which is also how a cue becomes a song.
   *
   * Copies the files into app storage before returning, so what lands in the
   * cue is already permanent -- the picker's URIs are cache handles the OS may
   * delete, and a setlist that loses its audio between soundcheck and the gig
   * is the worst failure this could have.
   */
  const pickStems = async () => {
    if (!sessionId || !itemId || !cue) return;
    setImporting(true);
    try {
      const picked = await importStems();
      if (picked.length === 0) return; // cancelled, or nothing readable

      // Asked here rather than before the file picker: only now is there
      // anything to describe. Choosing files is not the decision -- what they
      // do to the cue is, and that is only knowable once they are chosen.
      const displacedLoop = cue.loopKey ? findLoopByKey(cue.loopKey) : undefined;
      const ok = await confirm({
        title: `Add ${picked.length} ${picked.length === 1 ? "stem" : "stems"}?`,
        message: [
          tracks.length > 0
            ? `They join the ${tracks.length} already in this cue.`
            : `This cue becomes a stem song.`,
          // The one consequence that is genuinely surprising: a cue is stems OR
          // a loop, so importing into a loop cue quietly drops the loop.
          displacedLoop
            ? `${displacedLoop.title} is removed — a cue plays stems or a loop, not both.`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
        confirmLabel: "Add",
      });
      if (!ok) {
        // The files were copied into app storage before we got here, so they
        // have to be cleaned up -- otherwise a declined import silently leaves
        // its audio on the device with nothing naming it.
        removeStems(picked);
        return;
      }

      // Added to what's there, so a song can be built up in more than one pass
      // -- stems often live in more than one folder.
      const nextTracks = [...tracks, ...picked];
      const changes: Partial<SessionItem> = { tracks: nextTracks };

      // A cue is stems OR a loop: two different transports, and one cue meaning
      // both would only be confusing on stage. Importing into a loop cue is a
      // decision about which of the two it is.
      if (cue.loopKey) changes.loopKey = undefined;

      // Still called what it was created as, so the first stem names it -- the
      // same thing the cue editor used to do on import.
      if (!cue.title.trim() || cue.title === UNTITLED_CUE) {
        changes.title = picked[0].name;
      }

      // Free sections, when the export happened to carry them. Only for a cue
      // that has none: a later batch's markers would renumber sections the user
      // may already have named and launched.
      if (sections.length === 0) {
        const found = await readStemSections(picked);
        if (found.length > 0) changes.sections = found;
      }

      // The engine first, then the cue. Both land in one render, and the order
      // decides what that render sees: reloading marks the engine not-ready, so
      // the render that brings the new stems in already knows they haven't
      // decoded. The other way round, React renders once with the new tracks
      // and the *old* cue's readiness still true -- and the effect that
      // measures waveforms fires against stems the engine has never been given,
      // where every one of them hangs for five seconds and then gives up.
      reloadStems(nextTracks);
      updateItem(sessionId, itemId, changes);

      // Read the tempo off what just arrived. Only for fresh audio -- a cue
      // opened later already has its tempo, and this is the one moment there is
      // nothing to go on.
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

    // The only edit here that destroys something. removeStems below deletes the
    // copied file, and once the cue stops naming it nothing else can reach it --
    // so this is one tap away from audio the user cannot get back, and the
    // question says so rather than being a polite "are you sure".
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
    // Engine before cue, for the reason spelled out in pickStems.
    reloadStems(nextTracks);
    updateItem(sessionId, itemId, { tracks: nextTracks });
    // Its copied file goes with it. Nothing else can reach it once the cue
    // stops naming it, so leaving it behind would quietly fill the device with
    // audio the user can't see or delete.
    if (removed) removeStems([removed]);
  };

  /**
   * Hand the engine a changed set of stems for the cue it already has loaded.
   *
   * Forced, because the engine skips a load for the cue it is already holding
   * -- which is right for re-cueing the live song and wrong here, where the cue
   * is the same cue but its stems are not. Everything measured off the old set
   * is dropped with it: peaks are accumulated per track and the duration is a
   * running maximum, so a removed stem's length would otherwise keep the
   * progress bar measuring against audio that is gone.
   */
  const reloadStems = (nextTracks: CueTrack[]) => {
    if (!cue) return;
    setPeaks({});
    setDuration(0);
    // Both engines, not just the stem one: importing into a loop cue drops its
    // loop, and a loop left running under a song that has just replaced it is
    // two cues sounding at once.
    stopCueTransport();
    if (nextTracks.length === 0) return;
    session.loadCue(cue.id, nextTracks, true).catch((error) => {
      console.error("Failed to load stems", error);
    });
  };

  const setCueLoop = async (key: string | undefined) => {
    if (!sessionId || !itemId || !cue) return;
    const picked = key ? findLoopByKey(key) : undefined;
    // The loop's own tempo comes with it, the way it does in the cue editor.
    // Keeping the old one would leave the new loop warped by however far the
    // last one's tempo had been pushed, which is never what picking meant.
    const changes = { loopKey: key, bpm: picked?.bpm ?? cue.bpm };

    // Asked, because this writes to the setlist the moment it is chosen and
    // there is no undo. The tempo is named in the question rather than left to
    // be discovered: a cue nudged to 96 by ear silently jumping to the new
    // loop's 124 is the part of this nobody expects.
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

    // A cue that is sounding follows the change, rather than carrying on with
    // the loop you just replaced -- the point of choosing one from here rather
    // than from the cue editor is hearing it against the room.
    //
    // Re-fired from the merged item because the write above hasn't come back
    // through the context yet, so `cue` still names the old loop.
    if (!cueIsLive) return;
    if (key) fireCue({ ...cue, ...changes });
    else stopCueTransport();
  };

  const setCueBpm = (next: number) => {
    if (!sessionId || !itemId) return;
    const clamped = clampBpm(next);
    updateItem(sessionId, itemId, { bpm: clamped });
    // Straight to the engine when this cue is the one sounding, so a tempo
    // found by ear against a band lands while you can still hear whether it's
    // right. Stopped, the cue carries it to the next time it fires.
    if (cueIsLive) setEngineBpm(clamped);
  };

  const setCuePadPack = (packKey: string | undefined) => {
    if (!sessionId || !itemId) return;
    updateItem(sessionId, itemId, { padPack: packKey });

    // Only a pad already sounding follows the change. Choosing a pack while
    // silent is a decision about the cue, not an instruction to play one.
    if (!pad.isPlaying) return;
    if (packKey && cue?.padKey) armPad(packKey, cue.padKey, songMode);
    else if (!packKey) releasePad();
  };

  /** Moves the cursor under the finger. No audio -- that waits for release. */
  const scrub = (seconds: number) => setCursorSeconds(seconds);

  const seek = (seconds: number) => {
    setCursorSeconds(seconds);
    // Only while running. Dropping the cursor somewhere with the transport
    // stopped is a decision about where to start, not an instruction to start.
    if (!session.isPlaying) return;

    // A seek keeps the point you dropped it on -- snapping to the section start
    // the way the play button does would fight the drag. LOOP still bounds it
    // by the section, so the repeat is a musical length rather than everything
    // from here to the end of the file.
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

  /* ---------------------------------------------------------------------- */
  /* Key and pad                                                             */
  /* ---------------------------------------------------------------------- */

  // The song's key, and a pad tuned to it.
  //
  // The pad is deliberately not tied to the stem transport. It is a drone, not
  // a part -- you bring it in over the last chord and leave it running while
  // you talk, which is the whole reason to have one. So it starts and stops on
  // its own button and survives the song stopping.
  const songKey = cue?.padKey;
  const songMode = cue?.padMode ?? "major";
  // Falls back to the first pack rather than refusing to sound. Every pack
  // currently renders from the same master anyway (see constants/pads), so a
  // key with no pack chosen is an unset preference, not an unanswerable
  // question.
  const padPack = cue?.padPack ?? PAD_PACKS[0]?.key;

  // Voicing counts as well as root: a pad droning in C major under a song in C
  // minor is wrong in the way that matters, and a button claiming to be lit for
  // this song's key should not be lit for that.
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

  /**
   * Writes the key back to the cue, and retunes a sounding pad to it.
   *
   * Editable after the fact on purpose: the key is something you often work out
   * by playing along, which happens well after the stems were imported, and
   * having to go back to the cue editor to record it is how it ends up never
   * being recorded.
   */
  const setSongKey = (key: string | undefined, nextMode: "major" | "minor") => {
    if (!sessionId || !itemId) return;
    updateItem(sessionId, itemId, { padKey: key, padMode: nextMode });

    if (!key) {
      if (pad.isPlaying) releasePad();
      return;
    }
    // Only if it was already sounding: changing the key of a pad you can hear
    // should move it, changing it while silent should not start anything.
    if (padPack && pad.isPlaying) armPad(padPack, key, nextMode);
  };

  /* ---------------------------------------------------------------------- */
  /* Sections                                                                */
  /* ---------------------------------------------------------------------- */

  // Marked live, against the transport, because that's when you know where a
  // section starts -- you hear the chorus arrive. Typing timecodes into a form
  // would mean knowing them in advance, which nobody does.
  //
  // Sorted by start, which is the order the pads are laid out in and the order
  // the song plays them in. Ends are written exactly as authored.
  //
  // They used to be derived here -- each section's end overwritten with the
  // next one's start -- and that is what made a launched section loop the wrong
  // length. Mark four bars to loop out of a verse and the derived end pushed it
  // all the way to the next marker; the last section of a song got no end at
  // all, so holding on the outro looped it through whatever trailing silence
  // the file had. Both edges belong to the section now.
  const writeSections = (next: CueSection[]) => {
    if (!sessionId || !itemId) return;
    updateItem(sessionId, itemId, {
      sections: [...next].sort((a, b) => a.startSeconds - b.startSeconds),
    });
  };

  /**
   * Where a section placed at `start` should end, before anyone trims it.
   *
   * The next marker, or the end of the song -- which is exactly what the old
   * derived end would have given it. So placing a run of markers straight
   * through a song behaves as it always did; the difference is that the answer
   * is now written down and can be dragged.
   */
  const defaultEndFor = (start: number) => {
    const following = sections.find(
      (section) => section.startSeconds > start + 0.001
    );
    if (following) return following.startSeconds;
    // Unmeasured stems mean no known end, which stays unset and plays to the
    // end of the file -- see CueSection.
    return duration > 0 ? duration : undefined;
  };

  // Naming happens at the moment of placing, not afterwards.
  //
  // "Section 3" is no use on a pad you are about to hit in the dark -- the
  // whole value of a section is that it says "Chorus". Naming it later means a
  // second pass over a song you have already moved on from, so the marker is
  // placed and named in one gesture, with the timecode shown to confirm you are
  // marking the spot you meant.
  //
  // The same sheet renames an existing one, since "what is this section called"
  // is one question however you arrived at it -- `id` set means rename, unset
  // means place a new one.
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
    // Falls back rather than refusing: a marker in the right place with a dull
    // name beats losing the placement to a validation message.
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

  /**
   * Drag one edge of a section along the ruler.
   *
   * Each edge is clamped by the other rather than allowed to cross it. A
   * section whose end sits before its start is a span of negative length, and
   * the engine reads that the same way it reads no end at all -- so the loop
   * you were trying to tighten would silently become "play to the end of the
   * file", which is the exact bug this whole change is about.
   */
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

  /** The song's sections as spans for PLAY to walk. See arrangementFrom. */
  const arrangementSpans = useMemo(() => arrangementFrom(sections), [sections]);

  /**
   * Set a section's repeat count, from the picker.
   *
   * Written to the cue rather than held in this screen's state, so a count set
   * during soundcheck is still there at the gig -- and so the same section
   * behaves the same way whichever surface fires it.
   *
   * Deliberately does NOT touch what is playing. Changing the count on the
   * section currently running would either have to restart it or reach into a
   * launch already scheduled, and both are worse than the rule that this sets
   * what happens the NEXT time the pad is hit.
   */
  const setSectionRepeats = (sectionId: string, repeats: number) => {
    hapticImpact(prefs.haptics, "light");
    writeSections(
      sections.map((section) =>
        section.id === sectionId ? { ...section, repeats } : section
      )
    );
    setRepeatsFor(null);
  };

  /** Snaps an edge of the selected section to wherever the cursor is sitting. */
  const setEdgeAtCursor = (edge: "start" | "end") => {
    if (!selectedSectionId) return;
    hapticImpact(prefs.haptics, "light");
    moveSectionEdge(selectedSectionId, cursorSeconds, edge);
  };

  const removeSection = (sectionId: string) => {
    hapticImpact(prefs.haptics, "light");
    setSelectedSectionId(null);
    writeSections(sections.filter((section) => section.id !== sectionId));
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

      {/* The setlist's name up here in PERFORM, because the song's own name is
          about to be set six times larger directly underneath -- printing it
          twice would waste the one line that says where in the night you are.
          STUDIO has no such block, so it keeps the song. */}
      <ScreenHeader
        title={view === "perform" ? (setlist?.title ?? cue.title) : cue.title}
        action={
          view === "perform" && (setlist?.items.length ?? 0) > 1 ? (
            <TouchableOpacity
              onPress={() => {
                hapticImpact(prefs.haptics, "light");
                setBrowsingSet(true);
              }}
              accessibilityLabel="Open the setlist"
              className="p-2 rounded-full bg-white/10"
            >
              {/* The SET tab's own glyph, which is what makes it legible here:
                  the icon that means "setlist" in the tab bar means the same
                  thing on this button. */}
              <SortPad size={20} color={COLORS.white} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Which posture you're in. Two words rather than an icon: the difference
          between these views is not something a glyph can carry. */}
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

      {/* Four bodies: two views over two kinds of cue. Flat rather than nested
          so each one can be read on its own -- they share the frame around
          them, not their contents. */}
      {view === "studio" && isStemCue ? (
        <ScrollView
          className="flex-1 px-screen"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <CueNameField
            value={draftTitle}
            onChangeText={setDraftTitle}
            onCommit={commitTitle}
          />

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

          {/* Section editing sits with the timeline because that is where you
              can see what you are marking. */}
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

          {/* The selected section's span, and the exact way to set it.
              Dragging an edge on the ruler is the fast way and is right most of
              the time; this is for when it has to land on a specific beat --
              park the cursor where you can see it should go, then say which
              edge belongs there. */}
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
                {/* Bars first, seconds under them.

                    Which is the reverse of what this said before, and the
                    reverse of what the data is. Nothing about a section is
                    stored in bars -- the engine wants an offset in seconds and
                    that is what a section holds -- but "8 BARS" is the number
                    that tells you whether the chorus you just trimmed is the
                    right length, and "12.0s" never was. The clock stays
                    underneath because it is still what you match against a
                    stopwatch or a click track. */}
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

              {/* How many times it plays.

                  Here as well as on PERFORM's pads, because this is where a
                  section is edited: its name, both its edges and its deletion
                  are all on this row, and repeats was the one property of a
                  section you could not change from the place you change
                  sections. It was only reachable from a strip on a pad in the
                  other view -- so anyone setting a song up looked for it here,
                  did not find it, and reasonably concluded it was broken. */}
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

              {/* The exact way to set an edge, next to the fast one.
                  Both were 10px labels in a 24pt box leaning on hitSlop to be
                  hittable at all -- which works for a finger and does nothing
                  for anyone reading the screen. */}
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

          <Text className="mb-2 text-ink font-spaceMedium text-label">Mixer</Text>

          {/* Horizontal, like a console. Four stems fit; a set of twelve
              scrolls, which is what a console does too. */}
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
              />
            ))}
          </ScrollView>

          {/* The song's files, below the two surfaces that draw them. Building
              the song is something you do once, and looking at it is something
              you do every time, so the picture goes above the paperwork. */}
          <Text className="mt-6 mb-2 text-ink font-spaceMedium text-label">
            Stems
          </Text>

          {tracks.map((track) => (
            <StemRow
              key={track.id}
              name={track.name}
              onRemove={() => removeTrack(track.id)}
            />
          ))}

          <ImportStemsButton
            hasStems={tracks.length > 0}
            importing={importing}
            onPress={pickStems}
          />

          {/* What the detector read off the stems, offered rather than applied.
              It reports a confidence for a reason: a tempo taken silently is
              one nobody checked, and every quantised launch in the song is
              measured from it. Declining leaves whatever was already there. */}
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

          {/* Not optional the way it is for a loop cue, which can fall back to
              the tempo its loop was recorded at. A song has no such number, and
              everything on the grid -- where a launch lands, when a section
              changes -- is measured in beats from this one. */}
          <TempoStepper
            bpm={cue.bpm}
            onChange={setCueBpm}
            hint="Set the tempo — every quantised launch is measured from it."
          />
        </ScrollView>
      ) : isStemCue ? (
        <>
          {/* Outside the scroll view, because what is playing and how long is
              left are not things you should have to scroll back up to. */}
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
            // Not a surface you drag: see the effect that owns this ref.
            scrollEnabled={false}
            className="flex-1 px-screen"
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {/* Section pads, and nothing above them. No waveform here: it is
                a tool for placing things precisely, which is what STUDIO is
                for -- on stage it would be a picture you cannot act on,
                taking the space the pads want. No heading either: what's on
                screen is what's on screen, and a musician can count pads
                faster than they can read a number telling them how many
                there are. */}
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
                    // The last section has no next one to end at, so it runs to
                    // the end of the song -- which is only known once the stems
                    // have been measured.
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
        /* A loop cue's STUDIO: what the cue is made of, editable.
           No timeline, because there is nothing laid out in time to draw --
           the choices below are the whole of what this cue is. */
        <ScrollView
          className="flex-1 px-screen"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <CueNameField
            value={draftTitle}
            onChangeText={setDraftTitle}
            onCommit={commitTitle}
          />

          <CueElements
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
          />

          {/* The other kind of cue this could be.
              Last, because it is a decision about what this cue is rather than
              a setting on it -- importing here replaces the loop above with a
              song, since a cue is one or the other. */}
          <Text className="mt-6 mb-2 text-ink font-spaceMedium text-label">
            Stems
          </Text>
          <ImportStemsButton
            hasStems={false}
            importing={importing}
            onPress={pickStems}
          />
          <Text className="mt-2 text-micro text-ink-muted font-satoshiRegular">
            Open the folder and select every stem — they&apos;ll play locked
            together, and this becomes a song rather than a loop cue.
          </Text>
        </ScrollView>
      ) : (
        /* A loop cue's PERFORM: the same block a song gets, then the elements
           at a size you can check across a stage. */
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

          <ScrollView
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
          </ScrollView>
        </>
      )}

      {/* Key, pad and click: STUDIO only, all three. Setting the song's key is
          a table job, done once with time to work it out by ear, and the click
          is a rehearsal tool for finding where things land -- neither belongs
          on a stage screen that is otherwise just the pads and the transport. */}
      {view === "studio" && (
        <View className="flex-row items-center px-screen mb-2">
          <TouchableOpacity
            onPress={togglePad}
            disabled={!padPack}
            accessibilityRole="button"
            accessibilityLabel={
              padIsLive
                ? "Stop the pad"
                : songKey
                  ? `Play a ${songKey} ${songMode} pad`
                  : "Set the song key"
            }
            // It is a toggle that stays on for as long as you leave it on, and it
            // was the only one in this row not saying so.
            accessibilityState={{ selected: padIsLive, disabled: !padPack }}
            activeOpacity={0.85}
            className="flex-row items-center justify-center flex-1 py-3 mr-2 border-2 rounded-lg"
            style={{
              minHeight: SIZES.minTouch,
              backgroundColor: padIsLive ? COLORS.brand : "transparent",
              borderColor: padIsLive ? COLORS.brand : COLORS.border,
              // Disabled was drawn identically to enabled, so a cue with no pad
              // pack gave a button that looked pressable and did nothing.
              opacity: padPack ? 1 : 0.45,
            }}
          >
            <Text
              className="text-micro font-spaceBold"
              style={{ color: padIsLive ? COLORS.white : COLORS.textMuted }}
            >
              {songKey
                ? `PAD · ${songKey} ${songMode === "minor" ? "MIN" : "MAJ"}`
                : "SET KEY"}
            </Text>
          </TouchableOpacity>

          {/* The click, beside the pad because they are the same kind of thing:
              something you bring in over the song rather than part of it, and
              something you reach for while working the song out rather than
              performing it.

              Only over stems. A loop cue's click is the loop engine's own and is
              already switched on in Settings; a second button here meaning a
              different click on the same screen would be two switches for one
              sound. What it plays, how loud, and where it sits are the metronome's
              settings either way -- this is only whether. */}
          {isStemCue && (
            <TouchableOpacity
              onPress={() => {
                hapticImpact(prefs.haptics, "medium");
                setPref("stemClick", !prefs.stemClick);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                prefs.stemClick ? "Turn the click off" : "Play a click with the song"
              }
              accessibilityState={{ selected: prefs.stemClick }}
              activeOpacity={0.8}
              className="items-center justify-center px-4 py-3 mr-2 border-2 rounded-lg"
              style={{
                minHeight: SIZES.minTouch,
                backgroundColor: prefs.stemClick ? COLORS.brand : "transparent",
                borderColor: prefs.stemClick ? COLORS.brand : COLORS.border,
              }}
            >
              <Text
                className="text-micro font-spaceBold"
                style={{
                  color: prefs.stemClick ? COLORS.white : COLORS.textMuted,
                }}
              >
                CLICK
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              hapticImpact(prefs.haptics, "light");
              setEditingKey(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Change the song key"
            accessibilityHint={
              songKey
                ? `Currently ${songKey} ${songMode}.`
                : "No key set for this song yet."
            }
            activeOpacity={0.8}
            // border-2 to match the two beside it. At 1px it read as a different
            // class of control sitting in the same row as its own neighbours.
            className="items-center justify-center px-4 py-3 border-2 rounded-lg"
            style={{ minHeight: SIZES.minTouch, borderColor: COLORS.border }}
          >
            <Text className="text-micro text-ink-muted font-spaceBold">KEY</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* The transport spans the screen. It's the control most likely to be
          hit in a hurry, and the one where a miss is heard by the room. */}
      <View className="px-screen pb-4">
        {/* Return-to-zero and loop only mean anything against a timeline. */}
        {view === "studio" && isStemCue && (
          <View className="flex-row mb-2">
            <TouchableOpacity
              onPress={returnToZero}
              accessibilityLabel="Return to the start"
              activeOpacity={0.8}
              className="items-center justify-center flex-1 py-2 mr-2 border rounded-lg"
              style={{ borderColor: COLORS.border }}
            >
              <Text className="text-micro text-ink-muted font-spaceBold">
                RTZ
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                hapticImpact(prefs.haptics, "light");
                setLoopEnabled((previous) => !previous);
              }}
              accessibilityLabel={loopEnabled ? "Turn looping off" : "Loop the section"}
              accessibilityState={{ selected: loopEnabled }}
              activeOpacity={0.8}
              className="items-center justify-center flex-1 py-2 border rounded-lg"
              style={{
                backgroundColor: loopEnabled ? COLORS.brand : "transparent",
                borderColor: loopEnabled ? COLORS.brand : COLORS.border,
              }}
            >
              <Text
                className="text-micro font-spaceBold"
                style={{ color: loopEnabled ? COLORS.white : COLORS.textMuted }}
              >
                LOOP
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!isStemCue ? (
          // A loop cue's transport, and the same button in both views.
          //
          // A toggle, where a stem song's PERFORM bar splits into two fixed
          // buttons. That split exists because a stem song has a position to
          // lose: press the wrong thing blind and you either kill the song or
          // restart it from the top. A loop has neither -- it is running or it
          // isn't, and either way the next press does the obvious thing.
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
          // One button that toggles, which is fine here: you are looking at the
          // screen, and the thing you are working on is the timeline above it.
          <TouchableOpacity
            onPress={toggleStudioTransport}
            disabled={tracks.length === 0}
            accessibilityLabel={session.isPlaying ? "Stop" : "Play"}
            activeOpacity={0.85}
            className="flex-row items-center justify-center rounded-lg"
            style={{
              height: 60,
              backgroundColor: session.isPlaying ? COLORS.danger : COLORS.brand,
              opacity: tracks.length === 0 ? 0.4 : 1,
              ...SHADOWS.float,
            }}
          >
            {session.isPlaying ? <Stop size={40} /> : <PlayFilled size={40} />}
            <Text className="ml-3 text-heading text-white font-spaceBold">
              {session.isPlaying ? "STOP" : "PLAY"}
            </Text>
          </TouchableOpacity>
        ) : (
          /* PERFORM's bar: the transport, and mute.
             Mute stays hard right, where every show-page transport puts it and
             where a thumb finds it by feel. The transport takes everything
             else -- one button, the full width and the full 84pt, because it is
             the press with a downbeat attached to it. */
          <View className="flex-row" style={{ height: 84 }}>
            <TouchableOpacity
              onPress={togglePerformTransport}
              disabled={tracks.length === 0}
              accessibilityRole="button"
              accessibilityLabel={
                session.isPlaying ? "Stop" : "Play from the top"
              }
              // Stop loses the position -- there is no resume from here -- and
              // that is worth saying before it is pressed rather than after.
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
              {session.isPlaying ? <Stop size={34} /> : <PlayFilled size={34} />}
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
              // The difference between this and STOP, which is the thing you
              // need to know while reaching for one of them in a hurry.
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
                className="text-overline font-spaceBold"
                style={{ color: masterMuted ? COLORS.white : COLORS.textMuted }}
              >
                MUTE
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

      {/* The running order. A sheet rather than a screen, so getting to another
          song is one gesture out and one back rather than a navigation.

          Sized to its content up to most of the screen: a set of three should
          not open a sheet three quarters of the way up a phone. */}
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
        {/* Gorhom's scroll view, not React Native's: the sheet and the list
            both read the same vertical drag, and only this one hands it back at
            the top of its content so the sheet can be pulled shut. */}
        <BottomSheetScrollView
          contentContainerStyle={SHEET_CONTENT}
        >
          <Text className="mb-3 text-white font-satoshiBold text-title">
            {setlist?.title ?? "Setlist"}
          </Text>

          {setlist?.items.map((item, index) => {
                const isCurrent = item.id === cue.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => openCue(item)}
                    // Every cue opens here, whatever it holds. A loop cue gets
                    // its elements where a song gets its stems, which is what
                    // makes this a way through the whole night rather than
                    // through the songs with stems in them.
                    disabled={isCurrent}
                    activeOpacity={0.8}
                    accessibilityLabel={`Load ${item.title}`}
                    className="flex-row items-center px-3 py-3 mb-2 border rounded-lg"
                    style={{
                      backgroundColor: isCurrent
                        ? COLORS.surface
                        : "transparent",
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

      {/* How many times the selected section repeats.

          Its own component, like every other sheet in this app. Inline here
          it shared this screen's single renderBackdrop with the setlist sheet
          above -- one memoised component handed to two modals -- and opened
          onto nothing, which read as a button that did nothing. */}
      <RepeatPicker
        ref={repeatPickerRef}
        visible={!!repeatsFor}
        sectionName={repeatSection?.name}
        repeats={repeatSection?.repeats}
        onSelect={(choice) => repeatsFor && setSectionRepeats(repeatsFor, choice)}
        onClose={() => setRepeatsFor(null)}
      />

      {/* The song's key. A grid rather than a picker: twelve roots fit on one
          screen, and choosing from what you can see beats scrolling a wheel
          past eleven wrong answers. */}
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

      {/* Naming a section. A sheet rather than an inline field because the
          timecode has to be visible while you type -- it is the confirmation
          that you are naming the spot you meant, and an inline field would sit
          under the keyboard with the timeline hidden behind it. */}
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
            {/* The span, not just the start. It is what the section will loop
                when you hit its pad, so it is the thing to confirm before
                naming it -- and seeing it here is what tells you whether the
                default end needs dragging afterwards. */}
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
