import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import React, { useRef, useState } from "react";

import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { PAD_PACKS, type PadPack } from "../constants/pads";
import { usePadLayers } from "../hooks/usePadLayers";
import { COLORS } from "../constants/theme";
import { Musicnote, PlayCircle, PauseCircle, TickCircle } from "./icons";

type SelectPadViewProps = {
  // Which packs to show -- defaults to the full catalog. The picker screen
  // passes an artist-sorted copy when browsing "By Artist".
  packs?: PadPack[];
  // Adds a small artist header above the first row of each artist group.
  groupByArtist?: boolean;
};

const SelectPadView = ({
  packs = PAD_PACKS,
  groupByArtist = false,
}: SelectPadViewProps) => {
  const { layerFor, addLayer, removeLayer, isFull } = usePadLayers();
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const soundRef = useRef<AudioPlayer | null>(null);
  const playbackSubscriptionRef =
    useRef<ReturnType<AudioPlayer["addListener"]> | null>(null);

  const unloadCurrentSound = async () => {
    if (!soundRef.current) return;

    const sound = soundRef.current;
    soundRef.current = null;
    setPlayingIndex(null);
    playbackSubscriptionRef.current?.remove();
    playbackSubscriptionRef.current = null;
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

    const sound = createAudioPlayer(packs[index].sources.C);
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
  }, [packs]);

  // Loading changes what the instrument sounds like, so it asks first — a
  // stray tap while scrolling the catalog shouldn't rearrange the mixer.
  // Unloading is confirmed the same way rather than being the one destructive
  // action that happens instantly.
  const handleRowPress = (pack: PadPack) => {
    // removeLayer runs its own confirmation, so unloading is one call.
    if (layerFor(pack.key)) {
      removeLayer(pack.key);
      return;
    }

    Alert.alert(
      "Load Pad",
      `Add "${pack.title}" to the mixer?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Load",
          onPress: () => {
            // The pack is about to be audible through the instrument, so the
            // preview has done its job.
            if (soundRef.current) {
              soundRef.current.pause();
              soundRef.current.seekTo(0).catch(console.error);
            }
            setPlayingIndex(null);
            addLayer(pack);
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (packs.length === 0) {
    return (
      <View className="items-center justify-center flex-1 px-10">
        <Musicnote size={40} color="rgba(255,255,255,0.3)" />
        <Text className="mt-4 text-center text-white/50 font-satoshiMedium">
          No pads here yet — they'll show up as the catalog grows.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {packs.map((item, i) => {
          const isNewArtistGroup =
            groupByArtist && (i === 0 || packs[i - 1].artist !== item.artist);

          const layer = layerFor(item.key);

          return (
            <View key={item.key}>
              {isNewArtistGroup && (
                <Text className="mt-4 mb-2 text-xs uppercase text-ink-muted font-spaceBold">
                  {item.artist}
                </Text>
              )}
              <TouchableOpacity
                className="flex-row items-center gap-[12px] p-[12px] mb-[6px] rounded-[12px]"
                activeOpacity={0.75}
                // Loaded packs are lit from the left by a brand bar and a
                // tinted fill, unloaded ones sit flat. A row still has to read
                // as a list item, and up to three can be lit at once, so the
                // state has to be legible without dominating the list.
                style={{
                  backgroundColor: layer ? "rgba(0,139,194,0.14)" : COLORS.surface,
                  borderWidth: 1,
                  borderColor: layer ? COLORS.brand : "transparent",
                  // Greys out packs you can't load until you free a channel,
                  // so a full mixer is visible before the alert says so.
                  opacity: !layer && isFull ? 0.45 : 1,
                }}
                onPress={() => handleRowPress(item)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!layer }}
                accessibilityLabel={`${item.title} by ${item.artist}, ${layer ? "loaded in the mixer" : "not loaded"
                  }`}
              >
                {/* Channel marker: filled and ticked when loaded, an empty
                    outline otherwise, so both states occupy the same space and
                    the rows don't shift as packs come and go. */}
                <View
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 16,
                    height: 16,
                    backgroundColor: layer ? COLORS.brand : "transparent",
                    borderWidth: layer ? 0 : 1,
                    borderColor: "rgba(255,255,255,0.2)",
                  }}
                >
                  {layer && <TickCircle size={12} color={COLORS.white} />}
                </View>

                <View className="flex-1">
                  <Text
                    className="text-white text-body font-satoshiMedium"
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text
                    className="text-ink-muted text-[11px] font-satoshiRegular"
                    numberOfLines={1}
                  >
                    {item.artist} · {item.genre}
                  </Text>
                </View>

                {layer?.muted && (
                  <Text
                    className="text-[10px] font-spaceBold px-[6px] py-[2px] rounded"
                    style={{
                      color: COLORS.danger,
                      backgroundColor: "rgba(239,68,68,0.15)",
                    }}
                  >
                    MUTED
                  </Text>
                )}

                <TouchableOpacity
                  onPress={() => handlePlayPause(i)}
                  accessibilityLabel={`Preview ${item.title}`}
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 34,
                    height: 34,
                    backgroundColor: "rgba(0,89,128,0.3)",
                  }}
                >
                  {playingIndex === i ? (
                    <PauseCircle size={24} color={COLORS.white} />
                  ) : (
                    <PlayCircle size={24} color={COLORS.white} />
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default SelectPadView;
