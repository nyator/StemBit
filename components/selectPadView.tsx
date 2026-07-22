import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import React, { useRef, useState } from "react";

import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { useRouter } from "expo-router";
import { PAD_PACKS, type PadPack } from "../constants/pads";
import { COLORS } from "../constants/theme";
import { Musicnote, Pause, Play } from "./icons";

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
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const soundRef = useRef<AudioPlayer | null>(null);
  const playbackSubscriptionRef =
    useRef<ReturnType<AudioPlayer["addListener"]> | null>(null);
  const router = useRouter();

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

    const sound = createAudioPlayer(packs[index].source);
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

  // TODO: pad.tsx always plays the one recorded chromatic sample set
  // (PAD_SOURCES) regardless of which pack is "loaded" here -- there's no
  // per-pack audio yet, so this just returns to the Pad screen.
  const loadPack = () => {
    if (soundRef.current) {
      soundRef.current.pause();
      soundRef.current.seekTo(0).catch(console.error);
    }
    setPlayingIndex(null);
    router.back();
  };

  const handleRowPress = (pack: PadPack) => {
    Alert.alert(
      "Load Pad",
      `Load "${pack.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Load", onPress: loadPack },
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
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {packs.map((item, i) => {
          const isNewArtistGroup =
            groupByArtist && (i === 0 || packs[i - 1].artist !== item.artist);

          return (
            <View key={item.key}>
              {isNewArtistGroup && (
                <Text className="mt-4 mb-2 text-xs uppercase text-ink-muted font-spaceBold">
                  {item.artist}
                </Text>
              )}
              <TouchableOpacity
                className="flex-row items-center gap-[10px] p-[12px] mb-1 bg-surface rounded-[12px]"
                onPress={() => handleRowPress(item)}
              >
                <View className="flex-1">
                  <Text className="text-white text-body font-satoshiMedium">
                    {item.title}
                  </Text>
                  <Text className="text-ink-muted text-[11px] font-satoshiRegular">
                    {item.artist} · {item.genre}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handlePlayPause(i)}
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 34,
                    height: 34,
                    backgroundColor: "rgba(0,89,128,0.3)",
                  }}
                >
                  {playingIndex === i ? (
                    <Pause size={18} color={COLORS.white} />
                  ) : (
                    <Play size={18} color={COLORS.white} />
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
