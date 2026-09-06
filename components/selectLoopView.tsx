import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import React, { useState, useRef } from "react";

import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { useRouter } from "expo-router";
import { getAllLoops, isLoopOverridden, type Loop } from "../constants/loops";
import { COLORS } from "../constants/theme";
import { useLoopPlayback } from "../context/LoopPlaybackContext";
import { useUserLoops } from "../context/UserLoopsContext";
import { useSaveLoopAsMine } from "../hooks/useSaveLoopAsMine";
import { Musicnote } from "./icons";
import EmptyState from "./ui/emptyState";
import PreviewButton from "./ui/previewButton";

type SelectLoopViewProps = {
  // Which loops to show — defaults to everything (catalog + the user's
  // imports). The browser screen passes a filtered subset.
  loops?: Loop[];
  /**
   * What to say when there is nothing to show.
   *
   * The default reads as "the catalog is still small" and tells you to import
   * one, which is the right answer for an empty library and the wrong one for
   * a filter combination that matches nothing -- there the fix is to drop a
   * filter, not to go and make a loop.
   */
  emptyMessage?: string;
};

const SelectLoopView = ({
  loops = getAllLoops(),
  emptyMessage,
}: SelectLoopViewProps) => {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const soundRef = useRef<AudioPlayer | null>(null);
  const playbackSubscriptionRef =
    useRef<ReturnType<AudioPlayer["addListener"]> | null>(null);
  const router = useRouter();
  const { setSelectedLoopKey, selectedKey } = useLoopPlayback();
  const { removeUserLoop, clearLoopOverride, overriddenKeys } = useUserLoops();
  const { saveAsMine } = useSaveLoopAsMine();

  const unloadCurrentSound = async () => {
    if (!soundRef.current) return;

    const sound = soundRef.current;
    soundRef.current = null;
    setPlayingIndex(null);
    playbackSubscriptionRef.current?.remove();
    playbackSubscriptionRef.current = null;
    // Halt playback before releasing — remove() alone doesn't reliably stop
    // audio that's already sounding, so the old preview would bleed into the
    // new one (same reason loadLoop pauses before handing off).
    sound.pause();
    sound.remove();
  };

  const handlePlayPause = async (index: number) => {
    if (playingIndex === index) {
      if (soundRef.current) {
        soundRef.current.pause();
      }
      setPlayingIndex(null);
      return;
    }

    await unloadCurrentSound();

    const sound = createAudioPlayer(loops[index].source);
    soundRef.current = sound;
    sound.play();
    setPlayingIndex(index);
    playbackSubscriptionRef.current = sound.addListener(
      "playbackStatusUpdate",
      (status) => {
        if (!status.didJustFinish) return;
        setPlayingIndex(null);
        playbackSubscriptionRef.current?.remove();
        playbackSubscriptionRef.current = null;
      }
    );
  };

  React.useEffect(() => {
    return () => {
      if (soundRef.current) {
        playbackSubscriptionRef.current?.remove();
        soundRef.current.remove();
      }
    };
  }, []);

  // Row indices shift when the filter changes, so stop any running preview
  // rather than letting it point at the wrong row.
  React.useEffect(() => {
    unloadCurrentSound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loops]);

  const loadLoop = (loop: Loop) => {
    // Stop any preview that's still playing before handing off.
    if (soundRef.current) {
      soundRef.current.pause();
      soundRef.current.seekTo(0).catch(console.error);
    }
    setPlayingIndex(null);

    // Selection lives in LoopPlaybackContext (mirrors Pad's pattern), so the
    // Loop tab picks it up regardless of which screen instance is focused.
    // Just pop back to the already-mounted (tabs) navigator underneath,
    // instead of pushing into it from this sibling stack group.
    setSelectedLoopKey(loop.key);
    router.back();
  };

  // Native confirm dialog (iOS/Android system alert) instead of an in-app one.
  const handleRowPress = (loop: Loop) => {
    Alert.alert(
      "Load Loop",
      `Load "${loop.title}" at ${loop.bpm} BPM?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Load", onPress: () => loadLoop(loop) },
      ],
      { cancelable: true }
    );
  };

  const confirmDelete = (loop: Loop) => {
    Alert.alert(
      "Delete Loop",
      loop.packId
        ? `Remove "${loop.title}"? Its audio is deleted from the app — you can download it again from the store.`
        : `Remove "${loop.title}"? Its audio is deleted from the app — the original file on your device isn't touched.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await unloadCurrentSound();
            // Clear the transport if this was the loaded loop, so the Loop tab
            // isn't left pointing at something the engine can no longer find.
            if (selectedKey === loop.key) setSelectedLoopKey(undefined);
            removeUserLoop(loop.key).catch(console.error);
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Imported loops can be edited and removed again; the shipped ones can't.
  // Long press rather than controls on every row: both are occasional, and a row
  // this narrow has no space for buttons most rows would leave blank.
  // Shipped loops are editable too, just not removable. Their audio is bundled,
  // but the tempo the app believes it was recorded at is what every warp is
  // measured from -- so a catalog entry that's a beat out is worth correcting,
  // and putting it back is one tap.
  const handleRowLongPress = async (loop: Loop) => {
    const buttons: Parameters<typeof Alert.alert>[2] = [
      { text: "Cancel", style: "cancel" },
      {
        // Their own loop gets the short editor -- name and playback tempo. A
        // shipped one has neither to offer, so it goes to the import screen,
        // where correcting the tempo it was recorded at is all there is to do.
        text: loop.userAdded ? "Rename & set tempo" : "Correct its tempo",
        onPress: async () => {
          await unloadCurrentSound();
          if (loop.userAdded) {
            saveAsMine(loop); // already theirs: opens the editor, copies nothing
            return;
          }
          router.push({
            pathname: "/(loops)/import",
            params: { key: loop.key },
          });
        },
      },
    ];

    if (!loop.userAdded) {
      // The way to get a shipped loop's name, meter and category unlocked.
      // Editing one in place can only move its tempo and trim -- everything
      // else is a catalog fact -- so making it yours is a copy, not a mode.
      buttons.push({
        text: "Save as my loop",
        onPress: async () => {
          await unloadCurrentSound();
          saveAsMine(loop);
        },
      });
    }

    if (loop.userAdded) {
      buttons.push({
        text: "Delete",
        style: "destructive",
        onPress: () => confirmDelete(loop),
      });
    } else if (isLoopOverridden(loop.key)) {
      buttons.push({
        text: "Reset to original",
        style: "destructive",
        onPress: () => {
          clearLoopOverride(loop.key);
          // Reload it if it's the loaded one, so the engine picks the shipped
          // values back up rather than keeping the correction.
          if (selectedKey === loop.key) setSelectedLoopKey(loop.key);
        },
      });
    }

    Alert.alert(
      loop.title,
      loop.userAdded
        ? "Edit this loop's tempo, trim and details, or remove it."
        : "Editing changes what the app believes this loop's tempo is — its name and meter stay as they ship. Save a copy to make it yours and rename it.",
      buttons,
      { cancelable: true }
    );
  };

  if (loops.length === 0) {
    return (
      <View className="items-center justify-center flex-1">
        <EmptyState
          icon={Musicnote}
          message={
            emptyMessage ??
            "No loops here yet — they'll show up as the catalog grows, or add one of your own with + above."
          }
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* handled, not the default: the search field above can leave the
          keyboard up, and without this the first tap on a row only dismisses
          it -- the row's own onPress never fires, so nothing asks to load it
          until you tap a second time. */}
      <ScrollView
        className="flex-1 px-screen"
        keyboardShouldPersistTaps="handled"
      >
        {loops.map((item, i) => (
          <TouchableOpacity
            key={item.key}
            className="flex-row items-center justify-between py-4 border-b border-white/10"
            onPress={() => handleRowPress(item)}
            onLongPress={() => handleRowLongPress(item)}
            delayLongPress={400}
          >
            <PreviewButton
              isPlaying={playingIndex === i}
              onPress={() => handlePlayPause(i)}
              title={item.title}
            />

            <View className="w-2/6">
              <View className="flex-row items-center gap-2">
                <Text
                  className="text-white text-label font-satoshiBold"
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {item.title}
                </Text>
                {selectedKey === item.key && (
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 6,
                      backgroundColor: COLORS.brand,
                    }}
                  />
                )}
              </View>
              <View className="flex-row items-center justify-start gap-2">
                <Text className="text-ink-muted text-overline font-satoshiRegular">
                  {/* A downloaded loop is credited to whoever made the pack,
                      ahead of the "Imported" its userAdded flag would otherwise
                      give it. Both are the user's own copy, but only one of
                      them is theirs in the sense that caption means -- and the
                      artist's name is the reason an artist pack exists. */}
                  {item.packId
                    ? item.artist
                    : item.userAdded
                      ? "Imported"
                      : overriddenKeys.includes(item.key)
                        ? "Edited"
                        : `${item.artist} Artist`}
                </Text>
                <Text className="text-ink-muted text-overline font-satoshiRegular">
                  .
                </Text>
                <Text className="text-overline text-ink-muted font-satoshiRegular">
                  {item.category}
                </Text>
              </View>
            </View>

            <View className="flex items-center justify-between w-2/6">
              <Text className="text-white text-label font-satoshiRegular">
                {item.timeSignature}
              </Text>
              <Text className="text-label text-white font-satoshiRegular">
                {item.bpm} bpm
              </Text>
            </View>

          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default SelectLoopView;
