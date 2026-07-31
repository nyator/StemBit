import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import React, { useState, useRef } from "react";

import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { useRouter } from "expo-router";
import { getAllLoops, isLoopOverridden, type Loop } from "../constants/loops";
import { COLORS } from "../constants/theme";
import { useLoopPlayback } from "../context/LoopPlaybackContext";
import { useUserLoops } from "../context/UserLoopsContext";
import { Musicnote, PauseCircle, PlayCircle } from "./icons";

type SelectLoopViewProps = {
  // Which loops to show — defaults to everything (catalog + the user's
  // imports). The browser screen passes a category- or artist-filtered subset.
  loops?: Loop[];
};

const SelectLoopView = ({ loops = getAllLoops() }: SelectLoopViewProps) => {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const soundRef = useRef<AudioPlayer | null>(null);
  const playbackSubscriptionRef =
    useRef<ReturnType<AudioPlayer["addListener"]> | null>(null);
  const router = useRouter();
  const { setSelectedLoopKey, selectedKey } = useLoopPlayback();
  const { removeUserLoop, clearLoopOverride, overriddenKeys } = useUserLoops();

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
      `Remove "${loop.title}"? Its audio is deleted from the app — the original file on your device isn't touched.`,
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
        text: "Edit tempo & trim",
        onPress: async () => {
          await unloadCurrentSound();
          router.push({
            pathname: "/(loops)/import",
            params: { key: loop.key },
          });
        },
      },
    ];

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
        : "Change what the app believes this loop's tempo is. Its audio isn't touched.",
      buttons,
      { cancelable: true }
    );
  };

  if (loops.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-10">
        <Musicnote size={40} color="rgba(255,255,255,0.3)" />
        <Text className="mt-4 text-center text-white/50 font-satoshiMedium">
          No loops here yet — they'll show up as the catalog grows, or add one of
          your own with + above.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView className="flex-1 px-5">
        {loops.map((item, i) => (
          <TouchableOpacity
            key={item.key}
            className="flex-row items-center justify-between py-4 border-b border-white/10"
            onPress={() => handleRowPress(item)}
            onLongPress={() => handleRowLongPress(item)}
            delayLongPress={400}
          >
            <TouchableOpacity
              onPress={() => handlePlayPause(i)}
              className="items-center justify-center rounded-full"
              style={{
                width: 34,
                height: 34,
                backgroundColor: "rgba(0,89,128,0.3)",
              }}>
              {playingIndex === i ? (
                <PauseCircle size={24} color="white" />
              ) : (
                <PlayCircle size={24} color="white" />
              )}
            </TouchableOpacity>

            <View className="w-2/6">
              <View className="flex-row items-center gap-2">
                <Text
                  className="text-white text-md font-satoshiBold"
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
                <Text className="text-ink-muted text-xs font-satoshiRegular">
                  {item.userAdded
                    ? "Imported"
                    : overriddenKeys.includes(item.key)
                      ? "Edited"
                      : `${item.artist} Artist`}
                </Text>
                <Text className="text-ink-muted text-xs font-satoshiRegular">
                  .
                </Text>
                <Text className="text-xs text-ink-muted font-satoshiRegular">
                  {item.category}
                </Text>
              </View>
            </View>

            <View className="flex items-center justify-between w-2/6">
              <Text className="text-white text-md font-satoshiRegular">
                {item.timeSignature}
              </Text>
              <Text className="text-sm text-white font-satoshiRegular">
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
