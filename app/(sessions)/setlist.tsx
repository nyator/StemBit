import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  PanResponder,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import {
  useSessions,
  UNTITLED_CUE,
  type CueSection,
  type SessionItem,
} from "../../context/SessionsContext";
import { removeStems } from "../../utils/importStems";
import { useSessionCue } from "../../context/SessionCueContext";
import { useLoopPhase } from "../../context/LoopPlaybackContext";
import { useSessionPlayback } from "../../context/SessionPlaybackContext";
import { useLiveSections } from "../../hooks/useLiveSections";
import LoopFillBar from "../../components/ui/loopFillBar";
import SectionPad from "../../components/ui/sectionPad";
import { usePreferences } from "../../context/PreferencesContext";
import { hapticImpact } from "../../utils/haptics";
import { describeCue } from "../../utils/describeCue";

import ScreenHeader from "../../components/ui/screenHeader";
import AmbientGlow from "../../components/ui/ambientGlow";
import { GLOW_PLACEMENTS } from "../../components/ui/screen";
import { COLORS } from "../../constants/theme";
import {
  Add,
  ArrowRight,
  ChevronDown,
  DragHandle,
  PlayFilled,
  Stop,
} from "../../components/icons";

// The running order, and the screen that gets used on stage.
//
// So the important thing about it is what a tap does: one press loads the cue's
// loop at its tempo, arms its pad at its key, and starts. No hunting through a
// catalog between songs, which is the whole reason the feature exists.
//
// That now holds for a stem song too. It used to be the exception -- tapping one
// opened the performance screen instead of playing it, on the grounds that a
// song with per-track controls is something you want to be standing in front of
// before it starts. True when the song needs mixing, wrong when it doesn't: most
// cues in a set are hit once and left alone, and making those the one kind of
// cue you cannot fire from the running order meant a screen in the way of every
// song. So the transport fires stems from the row like everything else, and the
// row opens to show the song's sections -- the performance screen is still a tap
// away for when the song does need hands on it.
//
// It no longer builds cues, either. There was a form here -- name, stems, tempo,
// loop, pad, key -- from when this was the only screen a cue had. Then STUDIO
// grew the same controls for every kind of cue, because a loop or a tempo is
// something you want to change against a room rather than in a list, and the two
// were the same form in two places with only one of them able to make a sound
// while you used it. So + creates the cue and opens it, and this screen went
// back to being the running order.

export default function SetlistScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { findSession, addItem, removeItem, reorderItems } = useSessions();
  const { prefs } = usePreferences();
  const { play, stop, endSession, liveItemId } = useSessionCue();
  // Retained rather than read off the context: the row's fill bar is the only
  // thing here that draws it, so the engine reports its position for exactly as
  // long as this screen is up. See useLoopPhase.
  const loopPhase = useLoopPhase();
  // Stem songs run on their own engine -- multi-track and sample-locked, which
  // only works inside one AudioContext -- so firing one from here means talking
  // to that engine directly rather than through the cue context.
  const stems = useSessionPlayback();

  // Leaving the setlist ends the set: the loop and pad tabs get back whatever
  // they held before it started. Deliberately not on every stop -- see the note
  // on endSession for why restoring between cues made the next one hang.
  //
  // Held in a ref and depended on with [], because endSession is a new closure
  // every render. As `useEffect(() => endSession, [endSession])` the dependency
  // changed on each render, so React ran the cleanup each time too -- ending the
  // set continuously while the screen was in use rather than once on the way
  // out.
  //
  // Stems go quiet with it. They run on their own engine, which knows nothing
  // about sets ending, and a song fired from a row here would otherwise still
  // be playing after the setlist it belongs to has been left. Only on the way
  // out of the stack -- pushing the performance screen leaves this one mounted,
  // so nothing is cut off by going in to mix a song.
  const endSessionRef = useRef(() => {
    endSession();
    stems.stop();
  });
  endSessionRef.current = () => {
    endSession();
    stems.stop();
  };
  useEffect(() => () => endSessionRef.current(), []);
  const session = findSession(id);

  // --- Stem cues ----------------------------------------------------------
  // Which song's sections are open. One at a time: the pads are only useful for
  // the song you are on, and a list of every song's sections at once is a list
  // you have to read rather than a set of targets you can hit.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // The stem engine holds one song at a time, so what it has loaded is the
  // answer to "which cue is this" -- no separate state needed to track it.
  const loadedStemCue = session?.items.find(
    (item) => item.id === stems.loadedCueId
  );
  const { playheadSeconds, liveSectionId, armedSectionId, arm } =
    useLiveSections(loadedStemCue?.sections ?? []);

  // --- Reordering ---------------------------------------------------------
  // Hand-rolled rather than a draggable-list library: this is one short list,
  // and the libraries for it lean on Reanimated internals that the new
  // architecture keeps moving. A row's height is all the maths needs.
  //
  // While a drag is live the order lives here, so the list reorders under the
  // finger; it's written back to the session once, on release.
  const [order, setOrder] = useState<SessionItem[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const orderRef = useRef<SessionItem[]>([]);
  const startIndexRef = useRef(0);
  const rowHeightRef = useRef(76);

  const items = order ?? session?.items ?? [];
  orderRef.current = items;

  // The cue the PERFORM bar opens: whatever is live, and failing that the top
  // of the set.
  //
  // Live first because that is the one you were last standing in front of --
  // coming back to it is far more common than choosing a different cue, and it
  // is the case the per-row entry serves worst, since reaching that means
  // opening a row or holding one.
  // Sounding beats merely loaded: the stem engine keeps the last song in memory
  // after it stops, so a loop cue playing now with a stale song still decoded is
  // a real pairing -- and the loop is the one you are standing in front of.
  const performCue =
    items.find((item) => item.id === liveItemId) ?? loadedStemCue ?? items[0];

  /**
   * Into a song's own surface -- timeline, mixer, section pads.
   *
   * A push rather than a replace: this screen stays mounted underneath, which
   * is what keeps a song fired from a row here sounding while you go in to put
   * hands on it. See the note on endSession above.
   */
  const openPerformance = (
    item: SessionItem,
    view: "studio" | "perform" = "perform"
  ) => {
    hapticImpact(prefs.haptics, "light");
    router.push({
      pathname: "/performance",
      params: { sessionId: id, itemId: item.id, view },
    });
  };

  // One responder per cue, rebuilt only when the saved order changes -- never
  // mid-drag, since nothing is saved until the finger lifts.
  const dragResponders = useMemo(() => {
    const responders: Record<string, ReturnType<typeof PanResponder.create>> = {};

    const finish = () => {
      if (id) reorderItems(id, orderRef.current.map((item) => item.id));
      setDragId(null);
      setOrder(null);
      setDragOffset(0);
    };

    (session?.items ?? []).forEach((item) => {
      responders[item.id] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // The grip sits in a ScrollView; without this a vertical drag is stolen
        // by the scroll the moment it starts, which is every drag.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          hapticImpact(prefs.haptics, "light");
          // Closed first: an open row is taller than the rest, and the drag
          // counts distance in rows of one height.
          setExpandedId(null);
          startIndexRef.current = orderRef.current.findIndex(
            (entry) => entry.id === item.id
          );
          setOrder(orderRef.current);
          setDragId(item.id);
          setDragOffset(0);
        },
        onPanResponderMove: (_event, gesture) => {
          const height = rowHeightRef.current;
          const from = orderRef.current.findIndex(
            (entry) => entry.id === item.id
          );
          const target = Math.max(
            0,
            Math.min(
              orderRef.current.length - 1,
              startIndexRef.current + Math.round(gesture.dy / height)
            )
          );

          if (target !== from && from >= 0) {
            const next = [...orderRef.current];
            const [moved] = next.splice(from, 1);
            next.splice(target, 0, moved);
            orderRef.current = next;
            setOrder(next);
          }

          // What's left after the rows it has already displaced: the row tracks
          // the finger exactly rather than snapping a whole row at a time.
          const settled = orderRef.current.findIndex(
            (entry) => entry.id === item.id
          );
          setDragOffset(gesture.dy - (settled - startIndexRef.current) * height);
        },
        onPanResponderRelease: finish,
        onPanResponderTerminate: finish,
      });
    });

    return responders;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.items, id]);

  /**
   * Add a cue, and go straight into it.
   *
   * Empty rather than filled in first. A cue is built in STUDIO now, so a form
   * here would be a second place to answer the same questions -- and the worse
   * of the two, since nothing on this screen can play the loop you are choosing
   * while you choose it.
   *
   * The cost is a cue in the running order before it holds anything, which is
   * why it gets a name rather than a blank row. Backing out leaves it there to
   * be filled in or held and removed; that beats losing a set of imported stems
   * to a mistyped tempo, which is what a form that validates before saving
   * does.
   */
  const addCue = () => {
    if (!id) return;
    hapticImpact(prefs.haptics, "light");
    const created = addItem(id, { title: UNTITLED_CUE });
    router.push({
      pathname: "/performance",
      params: { sessionId: id, itemId: created.id, view: "studio" },
    });
  };

  /**
   * Fire a stem song from its row -- or, given a section, from that section.
   *
   * The section case is what makes the row worth expanding: rehearsing the last
   * chorus, or picking the song back up after a false start, without opening
   * anything.
   */
  const fireStems = (item: SessionItem, section?: CueSection) => {
    const stemTracks = item.tracks ?? [];
    if (stemTracks.length === 0) return;
    hapticImpact(prefs.haptics, "heavy");

    const isLoaded = stems.loadedCueId === item.id;
    const isRunning = isLoaded && stems.isPlaying;

    // The transport of the song already running stops it. A section pad never
    // stops -- it moves.
    if (!section && isRunning) {
      stems.stop();
      return;
    }

    // One cue at a time. A loop cue left running underneath is two cues from
    // the same setlist sounding at once, which is never what the press meant.
    stop();

    // Returns immediately for a song already decoded, so re-firing the live one
    // doesn't stall. play() holds until the stems are in either way.
    stems.loadCue(item.id, stemTracks).catch((error) => {
      console.error("Failed to load stems", error);
    });

    stems.play(
      stemTracks,
      item.bpm ?? 120,
      // On the bar only when the song is already running: landing a section
      // change where the band expects it is the whole point of quantising, but
      // waiting a bar for the first sound is just a delay.
      section && isRunning ? 4 : 0,
      section ?? {
        // Spelled out rather than handing over the first section. A section
        // carries the end of itself and the engine loops a span by default --
        // which is what a section pad wants and the opposite of what the
        // transport means, so passing one here would repeat the intro.
        id: "song",
        startSeconds: item.sections?.[0]?.startSeconds ?? 0,
        loop: false,
      }
    );

    if (section) arm(section.id);
    // Its sections come into view as it starts, since that is when they become
    // the thing you are most likely to reach for next.
    setExpandedId(item.id);
  };

  const confirmRemove = (item: SessionItem) =>
    id &&
    Alert.alert(
      "Remove cue",
      `Take "${item.title}" out of this setlist?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removeItem(id, item.id);
            // The cue's copied stems go with it. Nothing else can reach them
            // once the cue is gone, so leaving them behind would quietly fill
            // the device with audio the user can't see or delete.
            if (item.tracks?.length) removeStems(item.tracks);
          },
        },
      ],
      { cancelable: true }
    );

  // Editing and removing both live behind the long press rather than on the row
  // itself. The row is the stage surface -- one tap fires the cue, and every
  // extra control on it is something to hit by mistake in the dark. Changing a
  // setlist is something you do beforehand, and it can afford a second step.
  //
  // Performance mode is here too, and for a loop cue this is the only way in.
  // A stem row opens to a button for it, but a loop cue's row has no sections
  // to expand and so nothing to hang one off -- and it needs the screen just as
  // much, since that is where its loop, tempo and pad can be changed against a
  // room rather than in a form.
  const openCueActions = (item: SessionItem) =>
    Alert.alert(
      item.title,
      undefined,
      [
        { text: "Performance mode", onPress: () => openPerformance(item) },
        {
          text: "Edit in studio",
          onPress: () => openPerformance(item, "studio"),
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => confirmRemove(item),
        },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <StatusBar barStyle="light-content" />
      <AmbientGlow style={GLOW_PLACEMENTS.topLeftFar} />

      <ScreenHeader
        title={session?.title ?? "Session"}
        action={
          <TouchableOpacity
            onPress={addCue}
            accessibilityLabel="Add a cue"
            className="p-2 rounded-full bg-brand"
          >
            <Add size={22} color={COLORS.white} />
          </TouchableOpacity>
        }
      />

      {!session ? (
        <Text className="px-5 text-white/60 font-satoshiMedium">
          That session couldn&apos;t be found — it may have been deleted.
        </Text>
      ) : (
        <>
          <ScrollView
            className="flex-1 px-5"
            contentContainerStyle={{ paddingBottom: 24 }}
            // The list holds still while a row is in hand, or the drag and the
            // scroll fight each other for the same finger.
            scrollEnabled={!dragId}
          >
          {session.items.length === 0 ? (
            <Text className="mt-10 text-center text-white/50 font-satoshiMedium">
              No cues yet. Add them in the order you&apos;ll play them — each one
              opens in studio, where you give it its stems, its loop, or its pad.
            </Text>
          ) : null}

          {items.map((item, index) => {
            const isStemCue = (item.tracks?.length ?? 0) > 0;
            const isLoaded = stems.loadedCueId === item.id;
            // Sounding right now, whichever engine is doing it.
            const live = isStemCue
              ? isLoaded && stems.isPlaying
              : liveItemId === item.id;
            const held = dragId === item.id;
            const expanded = expandedId === item.id;
            // Decoding. A song is tens of megabytes and the engine holds the
            // press until its stems are in, so without this the row would sit
            // there looking untouched for the second or two before it sounds.
            const isLoading = isStemCue && isLoaded && !stems.isReady;

            // One handler behind both the transport and the title, so the two
            // can never disagree about what a tap on this row does.
            const fire = () => {
              if (isStemCue) {
                fireStems(item);
                return;
              }
              hapticImpact(prefs.haptics, "medium");
              // A loop cue and a stem song can't sound at once, so firing one
              // silences the other.
              stems.stop();
              if (live) stop();
              else play(item);
            };

            // The title opens a stem song's sections instead of firing it. It
            // is the one row with something more to say, the transport beside
            // it is 68pt of unmissable target, and a song you can only fire
            // from the top is a song you can't rehearse the last chorus of.
            const openOrFire = () => {
              if (!isStemCue) {
                fire();
                return;
              }
              hapticImpact(prefs.haptics, "light");
              setExpandedId((current) => (current === item.id ? null : item.id));
            };

            return (
              <View
                key={item.id}
                onLayout={(event) => {
                  // Measured rather than assumed: the row's height is the unit a
                  // drag counts in, and it moves with the system font size.
                  //
                  // Only while collapsed, since an open row is taller than its
                  // neighbours and the drag maths counts in one uniform row.
                  if (expanded) return;
                  rowHeightRef.current = event.nativeEvent.layout.height + 12;
                }}
                // overflow-hidden so the sweeping fill is clipped to the row's
                // rounded corners instead of squaring them off.
                className={`mb-3 border-hairline border-2 rounded-lg overflow-hidden ${live
                  ? "bg-surface border-brand"
                  : held
                    ? "bg-surface border-white"
                    : "bg-surface border-hairline"
                  }`}
                style={
                  held
                    ? {
                      transform: [{ translateY: dragOffset }],
                      // Lifted clear of its neighbours so it's obvious which
                      // row is in hand.
                      zIndex: 10,
                      elevation: 10,
                    }
                    : undefined
                }
              >
                <View
                  className="flex-row items-center p-3"
                  style={{ minHeight: 84 }}
                >
                  {/* Behind the row's content, and only while a loop cue is
                      live: fills across in time with the loop and restarts each
                      pass. A stem song's progress is carried by its section
                      pads instead, which know where they are in the song. */}
                  {!isStemCue && live && <LoopFillBar phase={loopPhase} />}

                  {/* One tap: load the loop at its tempo, arm the pad at its
                      key, and go. Between songs there is no time for anything
                      else. */}
                  {/* The transport is deliberately oversized. A 44pt target is
                      the accessibility floor for someone sitting still; this
                      gets hit in the dark, mid-song, by a hand that is already
                      busy, and a missed cue is heard by the whole room. */}
                  <TouchableOpacity
                    onPress={fire}
                    accessibilityLabel={
                      live ? `Stop ${item.title}` : `Play ${item.title}`
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                    className="items-center justify-center mr-3 rounded-full"
                    style={{
                      width: 68,
                      height: 68,
                      // Filled while live so the thing you need to hit next --
                      // stop -- is the brightest object on the row.
                      backgroundColor: live
                        ? COLORS.brand
                        : "rgba(255,255,255,0.08)",
                    }}
                  >
                    {live ? <Stop size={40} /> : <PlayFilled size={40} />}
                  </TouchableOpacity>

                  {/* Long-press still removes, so the destructive action stays
                      behind a deliberate gesture rather than a tap. */}
                  <TouchableOpacity
                    onPress={openOrFire}
                    onLongPress={() => openCueActions(item)}
                    delayLongPress={400}
                    accessibilityLabel={
                      isStemCue
                        ? `${expanded ? "Hide" : "Show"} sections of ${item.title}`
                        : live
                          ? `Stop ${item.title}`
                          : `Play ${item.title}`
                    }
                    className="flex-row items-center"
                    style={{ flex: 1, minHeight: 68 }}
                  >
                    <View style={{ flex: 1, justifyContent: "center" }}>
                      <Text
                        className="text-lg text-white font-satoshiBold"
                        numberOfLines={1}
                      >
                        {index + 1}. {item.title}
                      </Text>
                      <Text
                        className="text-[13px] font-satoshiRegular mt-[3px]"
                        numberOfLines={1}
                        style={{
                          color: isLoading ? COLORS.brand : COLORS.textMuted,
                        }}
                      >
                        {isLoading ? "Loading stems…" : describeCue(item)}
                      </Text>
                    </View>

                    {isStemCue && (
                      <ChevronDown
                        size={18}
                        color={expanded ? COLORS.brand : COLORS.textMuted}
                        style={{
                          transform: [{ rotate: expanded ? "180deg" : "0deg" }],
                        }}
                      />
                    )}
                  </TouchableOpacity>

                  {/* The grip. Dragging is confined to it rather than the whole
                      row, because the row has to stay tappable -- on stage, a
                      thumb that drags when it meant to fire a cue is a worse
                      mistake than one that doesn't reorder. */}
                  <View
                    {...(dragResponders[item.id]?.panHandlers ?? {})}
                    accessibilityLabel={`Reorder ${item.title}`}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="items-center justify-center ml-1"
                    style={{ width: 40, height: 68 }}
                  >
                    <DragHandle
                      size={24}
                      color={held ? COLORS.brand : COLORS.textMuted}
                    />
                  </View>
                </View>

                {/* The song's sections, in the row. The same pads the
                    performance screen draws, at the size a row can spare: what
                    they do is identical, so they had better look and behave
                    identically too. */}
                {isStemCue && expanded && (
                  <View className="px-3 pb-3">
                    {(item.sections?.length ?? 0) === 0 ? (
                      <Text className="mb-3 text-[11px] text-ink-muted font-satoshiRegular">
                        No sections yet — mark them on the timeline in studio.
                      </Text>
                    ) : (
                      <View className="flex-row flex-wrap justify-between">
                        {item.sections?.map((section, sectionIndex) => (
                          <SectionPad
                            key={section.id}
                            name={section.name}
                            index={sectionIndex}
                            startSeconds={section.startSeconds}
                            endSeconds={section.endSeconds}
                            // Only the loaded song has a playhead in it, so
                            // only its pads can claim to be running.
                            isLive={
                              isLoaded &&
                              stems.isPlaying &&
                              liveSectionId === section.id
                            }
                            isArmed={isLoaded && armedSectionId === section.id}
                            playheadSeconds={playheadSeconds}
                            onPress={() => fireStems(item, section)}
                            compact
                          />
                        ))}
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => openPerformance(item)}
                      accessibilityLabel={`Open ${item.title} in performance mode`}
                      className="items-center py-3 mt-1 border rounded-lg border-hairline"
                    >
                      <Text className="text-[11px] text-brand font-spaceBold tracking-widest">
                        PERFORMANCE MODE
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {items.length > 0 && (
            <Text className="mt-2 text-[11px] text-ink-muted font-satoshiRegular">
              Tap the transport to play a cue, tap again to stop. Tap a song&apos;s
              name to open its sections. Drag the grip to reorder, hold a cue to
              open, edit or remove it.
            </Text>
          )}
          </ScrollView>

          {/* Performance mode, where a thumb actually lands.
            The set is a list you scroll and then act on, and the act is nearly
            always "take me into the cue I'm on". As a pill in the top corner
            that lived in the one part of a phone a hand holding it can't
            reach. Full width along the bottom edge instead, outside the scroll
            so it is the same target whether the set is empty or forty long.

            Deliberately not shaped like a row's transport. Those are round,
            brand-filled, and make a sound the moment they're hit; this one
            opens a screen, and a control that looks like PLAY but navigates is
            the worst thing to find under a thumb in the dark. Hence a name,
            an outline, and the cue it will open written underneath. */}
          {performCue && (
            <View className="px-5 pt-2 pb-1">
              <TouchableOpacity
                onPress={() => openPerformance(performCue)}
                accessibilityLabel={`Open ${performCue.title} in performance mode`}
                activeOpacity={0.85}
                className="flex-row items-center px-4 border-2 rounded-lg"
                style={{
                  height: 60,
                  borderColor: COLORS.brand,
                  backgroundColor: COLORS.surface,
                }}
              >
                <View className="flex-1">
                  <Text className="text-[10px] text-brand font-spaceBold tracking-widest">
                    PERFORM
                  </Text>
                  <Text
                    className="mt-[2px] text-white font-satoshiBold text-[15px]"
                    numberOfLines={1}
                  >
                    {performCue.title}
                  </Text>
                </View>
                <ArrowRight size={18} color={COLORS.brand} />
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

