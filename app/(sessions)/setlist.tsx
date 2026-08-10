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
import { useLocalSearchParams } from "expo-router";

import { useSessions, type SessionItem } from "../../context/SessionsContext";
import { useSessionCue } from "../../context/SessionCueContext";
import LoopFillBar from "../../components/ui/loopFillBar";
import { usePreferences } from "../../context/PreferencesContext";
import { findLoopByKey, getAllLoops } from "../../constants/loops";
import { PAD_PACKS, findPadPackByKey } from "../../constants/pads";
import { KEYS } from "../../context/PadPlaybackContext";
import { hapticImpact } from "../../utils/haptics";

import ScreenHeader from "../../components/ui/screenHeader";
import AmbientGlow from "../../components/ui/ambientGlow";
import { GLOW_PLACEMENTS } from "../../components/ui/screen";
import { BrandInput } from "../../components/ui/brandInput";
import { BrandButton } from "../../components/ui/brandButton";
import { COLORS } from "../../constants/theme";
import { Add, PlayFilled, SortPad, Stop } from "../../components/icons";

// The running order, and the screen that gets used on stage.
//
// So the important thing about it is what a tap does: one press loads the cue's
// loop at its tempo, arms its pad at its key, and starts. No hunting through a
// catalog between songs, which is the whole reason the feature exists.

export default function SetlistScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { findSession, addItem, updateItem, removeItem, reorderItems } =
    useSessions();
  const { prefs } = usePreferences();
  const { play, stop, endSession, liveItemId, loopPhase } = useSessionCue();

  // Leaving the setlist ends the set: the loop and pad tabs get back whatever
  // they held before it started. Deliberately not on every stop -- see the note
  // on endSession for why restoring between cues made the next one hang.
  //
  // Held in a ref and depended on with [], because endSession is a new closure
  // every render. As `useEffect(() => endSession, [endSession])` the dependency
  // changed on each render, so React ran the cleanup each time too -- ending the
  // set continuously while the screen was in use rather than once on the way
  // out.
  const endSessionRef = useRef(endSession);
  endSessionRef.current = endSession;
  useEffect(() => () => endSessionRef.current(), []);
  const session = findSession(id);

  const [adding, setAdding] = useState(false);
  // Id of the cue being edited, or null when the form is making a new one. The
  // draft fields below serve both: an edit is the same form, seeded.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [loopKey, setLoopKey] = useState<string | undefined>();
  const [padPack, setPadPack] = useState<string | undefined>();
  const [padKey, setPadKey] = useState<string | undefined>();

  const loops = getAllLoops();

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

  const resetDraft = () => {
    setTitle("");
    setLoopKey(undefined);
    setPadPack(undefined);
    setPadKey(undefined);
    setAdding(false);
    setEditingId(null);
  };

  // Open the same form over an existing cue. Nothing is written until save, so
  // backing out with CANCEL leaves the cue as it was.
  const startEdit = (item: SessionItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setLoopKey(item.loopKey);
    setPadPack(item.padPack);
    setPadKey(item.padKey);
    setAdding(true);
  };

  const canAdd = !!title.trim() && (!!loopKey || (!!padPack && !!padKey));

  const save = () => {
    if (!id || !canAdd) return;
    const loop = loopKey ? findLoopByKey(loopKey) : null;
    const draft = {
      title: title.trim(),
      loopKey,
      // The loop's own tempo unless it's changed later: a cue that says nothing
      // about tempo should sound exactly like loading the loop by hand.
      bpm: loop?.bpm,
      padPack,
      padKey,
      padMode: "major" as const,
    };

    if (editingId) updateItem(id, editingId, draft);
    else addItem(id, draft);

    resetDraft();
  };

  const describe = (item: SessionItem) => {
    const parts: string[] = [];
    const loop = item.loopKey ? findLoopByKey(item.loopKey) : null;
    if (loop) parts.push(`${loop.title}${item.bpm ? ` · ${item.bpm} BPM` : ""}`);
    const pack = item.padPack ? findPadPackByKey(item.padPack) : null;
    if (pack && item.padKey) parts.push(`${pack.title} in ${item.padKey}`);
    return parts.length ? parts.join("   ·   ") : "Nothing set";
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
          onPress: () => removeItem(id, item.id),
        },
      ],
      { cancelable: true }
    );

  // Editing and removing both live behind the long press rather than on the row
  // itself. The row is the stage surface -- one tap fires the cue, and every
  // extra control on it is something to hit by mistake in the dark. Changing a
  // setlist is something you do beforehand, and it can afford a second step.
  const openCueActions = (item: SessionItem) =>
    Alert.alert(
      item.title,
      undefined,
      [
        { text: "Edit cue", onPress: () => startEdit(item) },
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
            // Always resets to a blank new cue rather than toggling. Toggling
            // left editingId set when the form was open over an existing cue,
            // so the next save would quietly overwrite that one instead of
            // adding.
            onPress={() => (adding ? resetDraft() : setAdding(true))}
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
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          // The list holds still while a row is in hand, or the drag and the
          // scroll fight each other for the same finger.
          scrollEnabled={!dragId}
        >
          {adding && (
            <View className="p-4 mb-4 border rounded-lg bg-surface border-hairline">
              <Text className="mb-3 text-white font-satoshiBold text-title">
                {editingId ? "Edit cue" : "New cue"}
              </Text>
              <BrandInput
                label="Cue name"
                value={title}
                onChangeText={setTitle}
                placeholder="Opener, Altar call…"
                maxLength={40}
              />

              <Text className="mt-1 mb-2 text-ink font-spaceMedium text-label">
                Loop
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <Chip
                  label="None"
                  selected={!loopKey}
                  onPress={() => setLoopKey(undefined)}
                />
                {loops.map((loop) => (
                  <Chip
                    key={loop.key}
                    label={loop.title}
                    selected={loopKey === loop.key}
                    onPress={() => setLoopKey(loop.key)}
                  />
                ))}
              </View>

              <Text className="mt-4 mb-2 text-ink font-spaceMedium text-label">
                Pad
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <Chip
                  label="None"
                  selected={!padPack}
                  onPress={() => {
                    setPadPack(undefined);
                    setPadKey(undefined);
                  }}
                />
                {PAD_PACKS.map((pack) => (
                  <Chip
                    key={pack.key}
                    label={pack.title}
                    selected={padPack === pack.key}
                    onPress={() => setPadPack(pack.key)}
                  />
                ))}
              </View>

              {padPack && (
                <>
                  <Text className="mt-4 mb-2 text-ink font-spaceMedium text-label">
                    Key
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {KEYS.map((key) => (
                      <Chip
                        key={key}
                        label={key}
                        selected={padKey === key}
                        onPress={() => setPadKey(key)}
                      />
                    ))}
                  </View>
                </>
              )}

              <BrandButton
                label={editingId ? "Save changes" : "Add to setlist"}
                onPress={save}
                disabled={!canAdd}
                style={{ marginTop: 20 }}
              />
              <TouchableOpacity onPress={resetDraft} className="items-center py-3">
                <Text className="text-xs text-ink-muted font-spaceBold">
                  CANCEL
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {session.items.length === 0 && !adding ? (
            <Text className="mt-10 text-center text-white/50 font-satoshiMedium">
              No cues yet. Add the songs in the order you&apos;ll play them, each
              with its loop, its pad, or both.
            </Text>
          ) : null}

          {items.map((item, index) => {
            const live = liveItemId === item.id;
            const held = dragId === item.id;
            // One handler behind both the transport and the title, so the two
            // can never disagree about what a tap on this row does.
            const fire = () => {
              hapticImpact(prefs.haptics, "medium");
              if (live) stop();
              else play(item);
            };
            return (
              <View
                key={item.id}
                onLayout={(event) => {
                  // Measured rather than assumed: the row's height is the unit a
                  // drag counts in, and it moves with the system font size.
                  rowHeightRef.current = event.nativeEvent.layout.height + 12;
                }}
                // overflow-hidden so the sweeping fill is clipped to the row's
                // rounded corners instead of squaring them off.
                // overflow-hidden so the fill is clipped to the rounded corners
                // instead of squaring them off.
                className={`flex-row items-center p-3 mb-3 border-hairline border-2 rounded-lg overflow-hidden ${live
                  ? "bg-surface border-brand"
                  : held
                    ? "bg-surface border-white"
                    : "bg-surface border-hairline"
                  }`}
                style={
                  held
                    ? {
                      minHeight: 84,
                      transform: [{ translateY: dragOffset }],
                      // Lifted clear of its neighbours so it's obvious which
                      // row is in hand.
                      zIndex: 10,
                      elevation: 10,
                    }
                    : { minHeight: 84 }
                }
              >
                {/* Behind the row's content, and only while this cue is live:
                    fills across in time with the loop and restarts each pass. */}
                {live && <LoopFillBar phase={loopPhase} />}

                {/* One tap: load the loop at its tempo, arm the pad at its key,
                    and go. Between songs there is no time for anything else. */}
                {/* The transport is deliberately oversized. A 44pt target is
                    the accessibility floor for someone sitting still; this gets
                    hit in the dark, mid-song, by a hand that is already busy,
                    and a missed cue is heard by the whole room. */}
                <TouchableOpacity
                  onPress={fire}
                  accessibilityLabel={live ? `Stop ${item.title}` : `Play ${item.title}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                  className="items-center justify-center mr-3 rounded-full"
                  style={{
                    width: 68,
                    height: 68,
                    // Filled while live so the thing you need to hit next --
                    // stop -- is the brightest object on the row.
                    backgroundColor: live ? COLORS.brand : "rgba(255,255,255,0.08)",
                  }}
                >
                  {live ? <Stop size={40} /> : <PlayFilled size={40} />}
                </TouchableOpacity>

                {/* The title fires the cue too, roughly tripling the target.
                    Long-press still removes, so the destructive action stays
                    behind a deliberate gesture rather than a tap. */}
                <TouchableOpacity
                  onPress={fire}
                  onLongPress={() => openCueActions(item)}
                  delayLongPress={400}
                  accessibilityLabel={live ? `Stop ${item.title}` : `Play ${item.title}`}
                  style={{ flex: 1, justifyContent: "center", minHeight: 68 }}
                >
                  <Text
                    className={`font-satoshiBold text-lg ${live ? "text-white" : "text-white"}`}
                    numberOfLines={1}
                  >
                    {index + 1}. {item.title}
                  </Text>
                  <Text
                    className="text-ink-muted text-[13px] font-satoshiRegular mt-[3px]"
                    numberOfLines={1}
                  >
                    {describe(item)}
                  </Text>
                </TouchableOpacity>

                {/* The grip. Dragging is confined to it rather than the whole
                    row, because the row has to stay tappable -- on stage, a
                    thumb that drags when it meant to fire a cue is a worse
                    mistake than one that doesn't reorder. */}
                <View
                  {...(dragResponders[item.id]?.panHandlers ?? {})}
                  accessibilityLabel={`Reorder ${item.title}`}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  className="items-center justify-center ml-2"
                  style={{ width: 48, height: 68 }}
                >
                  <SortPad size={26} color={held ? COLORS.brand : COLORS.white} />
                </View>
              </View>
            );
          })}

          {items.length > 0 && (
            <Text className="mt-2 text-[11px] text-ink-muted font-satoshiRegular">
              Tap to play a cue, tap again to stop. Drag the grip to reorder,
              hold a cue to remove it.
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
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
        className={`text-sm font-satoshiMedium ${selected ? "text-black" : "text-white"
          }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
