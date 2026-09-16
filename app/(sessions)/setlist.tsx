import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  PanResponder,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import {
  useSessions,
  UNTITLED_CUE,
  type CueSection,
  type SessionItem,
} from "../../context/SessionsContext";
import { removeStems } from "../../utils/importStems";
import { useSessionCue } from "../../context/SessionCueContext";
import { useSessionPlayback } from "../../context/SessionPlaybackContext";
import { useLiveSections } from "../../hooks/useLiveSections";
import SectionPad from "../../components/ui/sectionPad";
import { usePreferences } from "../../context/PreferencesContext";
import { hapticImpact } from "../../utils/haptics";
import { describeCue } from "../../utils/describeCue";

import ScreenHeader from "../../components/ui/screenHeader";
import Screen from "../../components/ui/screen";
import EmptyState from "../../components/ui/emptyState";
import { COLORS } from "../../constants/theme";
import {
  Add,
  ArrowRight,
  ChevronDown,
  DragHandle,
  Musicnote,
  PlayFilled,
  Stop,
} from "../../components/icons";
import NavButton from "../../components/ui/navButton";

function ArmedPulse({ active }: { active: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // TEMPORARY DIAGNOSTIC -- remove once the loop-swap pulse is confirmed working.
    // console.log("[ArmedPulse] active:", active, Date.now());
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 420,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [active, pulse]);

  if (!active) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        borderRadius: 16,
        backgroundColor: COLORS.brandFrom,
        opacity: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.12, 0.42],
        }),
      }}
    />
  );
}

// A small numbered chip standing in for the plain "N." prefix. Reads as a
// setlist position at a glance, and gives the row a left edge to anchor on
// instead of the title just floating flush with the play button.
function IndexBadge({ index, live }: { index: number; live: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
        backgroundColor: live ? COLORS.brandFrom : "rgba(255,255,255,0.06)",
      }}
    >
      <Text
        className="font-spaceBold"
        style={{
          fontSize: 11,
          color: live ? "#000" : COLORS.textMuted,
        }}
      >
        {index}
      </Text>
    </View>
  );
}

export default function SetlistScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { findSession, addItem, removeItem, reorderItems } = useSessions();
  const { prefs } = usePreferences();
  const { play, stop, endSession, liveItemId, armedItemId } = useSessionCue();

  const stems = useSessionPlayback();
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

  const performCue =
    items.find((item) => item.id === liveItemId) ?? loadedStemCue ?? items[0];

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

    if (!(section && isRunning)) stop();
    stems.loadCue(item.id, stemTracks).catch((error) => {
      console.error("Failed to load stems", error);
    });

    stems.play(
      stemTracks,
      item.bpm ?? 120,
      section && isRunning ? 4 : 0,
      section ?? {
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
    <Screen glows={["topLeftFar"]}>
      <ScreenHeader
        title={session?.title ?? "Session"}
        action={
          <NavButton
            icon={Add}
            onPress={addCue}
            tint="brand"
            accessibilityLabel="Add a cue"
          />
        }
      />

      {!session ? (
        <Text className="px-screen text-body text-white/60 font-satoshiMedium">
          That session couldn&apos;t be found — it may have been deleted.
        </Text>
      ) : (
        <>
          <ScrollView
            className="flex-1 px-screen"
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
            scrollEnabled={!dragId}
          >
            {session.items.length === 0 ? (
              <View className="mt-10">
                <EmptyState
                  icon={Musicnote}
                  message="No cues yet. Add them in the order you'll play them — each one opens in studio, where you give it its stems, its loop, or its pad."
                />
              </View>
            ) : null}

            {items.map((item, index) => {
              const isStemCue = (item.tracks?.length ?? 0) > 0;
              const isLoaded = stems.loadedCueId === item.id;

              const live = isStemCue
                ? isLoaded && stems.isPlaying
                : liveItemId === item.id;

              const armed = armedItemId === item.id;
              const held = dragId === item.id;
              const expanded = expandedId === item.id;

              const isLoading = isStemCue && isLoaded && !stems.isReady;

              const fire = () => {
                if (isStemCue) {
                  fireStems(item);
                  return;
                }
                hapticImpact(prefs.haptics, "medium");

                stems.stop();
                if (live) stop();
                else play(item);
              };

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
                    if (expanded) return;
                    rowHeightRef.current = event.nativeEvent.layout.height;
                  }}
                  className={`mb-2.5 rounded-2xl overflow-hidden ${live
                    ? "bg-surface border-brand"
                    : armed
                      ? "bg-surface border-brand-from"
                      : held
                        ? "bg-surface border-white/40"
                        : "bg-surface border-hairline"
                    }`}
                  style={[
                    {
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: held ? 8 : 2 },
                      shadowOpacity: held ? 0.35 : 0.18,
                      shadowRadius: held ? 14 : 6,
                      elevation: held ? 10 : 2,
                    },
                    held
                      ? { transform: [{ translateY: dragOffset }, { scale: 1.015 }], zIndex: 10 }
                      : undefined,
                  ]}
                >
                  {/* <ArmedPulse active={armed} /> */}

                  <View
                    className="flex-row items-center px-3"
                    style={{ minHeight: 84 }}
                  >
                    <TouchableOpacity
                      onPress={fire}
                      activeOpacity={0.75}
                      accessibilityLabel={
                        live
                          ? `Stop ${item.title}`
                          : armed
                            ? `${item.title} starts on the next bar`
                            : `Play ${item.title}`
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      className="items-center justify-center mr-3 rounded-xl"
                      style={{
                        width: 52,
                        height: 52,
                        backgroundColor: live
                          ? COLORS.surfaceField
                          : armed
                            ? COLORS.brandFrom
                            : COLORS.borderBrand,
                        // borderWidth: live ? 1.5 : 0,
                        // borderColor: live ? COLORS.brand : "transparent",
                      }}
                    >
                      {live ? <Stop size={30} /> : <PlayFilled size={30} />}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={openOrFire}
                      onLongPress={() => openCueActions(item)}
                      delayLongPress={400}
                      activeOpacity={0.7}
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
                      {/* <IndexBadge index={index + 1} live={live} /> */}

                      <View style={{ flex: 1, justifyContent: "center" }}>
                        <Text
                          className="text-title text-white font-satoshiBold"
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text
                          className="text-ink-muted font-spaceMedium"
                          numberOfLines={1}
                        >
                          {isLoading ? "Loading…" : describeCue(item)}
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

                    <View
                      style={{
                        width: 1,
                        height: 32,
                        marginHorizontal: 6,
                        backgroundColor: "rgba(255,255,255,0.08)",
                      }}
                    />

                    <View
                      {...(dragResponders[item.id]?.panHandlers ?? {})}
                      accessibilityLabel={`Reorder ${item.title}`}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      className="items-end justify-center"
                      style={{ width: 34, height: 68 }}
                    >
                      <DragHandle
                        size={24}
                        color={held ? COLORS.brand : COLORS.textMuted}
                      />
                    </View>
                  </View>

                  {isStemCue && expanded && (
                    <View
                      style={{
                        marginHorizontal: 10,
                        marginBottom: 12,
                        borderRadius: 14,
                        padding: 10,
                        backgroundColor: "rgba(255,255,255,0.03)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.01)",
                      }}
                    >
                      <Text
                        className="font-spaceBold"
                        style={{
                          fontSize: 10,
                          letterSpacing: 1.5,
                          color: COLORS.textMuted,
                          marginBottom: 8,
                          marginLeft: 2,
                        }}
                      >
                        SECTIONS
                      </Text>

                      {(item.sections?.length ?? 0) === 0 ? (
                        <Text className="mb-2 text-micro text-ink-muted font-satoshiRegular">
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
                        activeOpacity={0.75}
                        accessibilityLabel={`Open ${item.title} in performance mode`}
                        className="items-center py-3 mt-2 rounded-xl"
                        style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                      >
                        <Text className="text-micro text-brand font-spaceBold tracking-widest">
                          PERFORMANCE MODE
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {performCue && (
            <View
              className="absolute bottom-0 left-0 right-0 px-screen pb-6 pt-3 bg-canvas/95 border-t border-white/[0.08]"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
                elevation: 12,
              }}
            >
              <TouchableOpacity
                onPress={() => openPerformance(performCue)}
                accessibilityRole="button"
                accessibilityLabel={`Go to performance view for ${performCue.title}`}
                activeOpacity={0.85}
                className="flex-row items-center justify-between px-4 py-3.5 rounded-2xl bg-surface"
                style={{
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.06)",
                }}
              >
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center gap-2">
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: COLORS.brand,
                      }}
                    />
                    <Text className="text-[10px] text-brand font-spaceBold tracking-widest">
                      PERFORM DECK
                    </Text>
                  </View>
                  <Text
                    className="text-body font-satoshiBold text-white mt-0.5"
                    numberOfLines={1}
                  >
                    {performCue.title}
                  </Text>
                </View>

                <View
                  className="flex-row items-center justify-center rounded-xl"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: "rgba(255,255,255,0.06)",
                  }}
                >
                  <ArrowRight size={18} color={COLORS.brand} />
                </View>
              </TouchableOpacity>
            </View>
          )}

        </>
      )}
    </Screen>
  );
}