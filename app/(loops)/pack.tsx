import { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import EmptyState from "../../components/ui/emptyState";
import { BrandButton } from "../../components/ui/brandButton";
import {
  LoopRow,
  PackCover,
  SectionTitle,
  countOf,
  explainLocked,
} from "../../components/ui/storeParts";
import { ArrowRight, Musicnote } from "../../components/icons";
import { COLORS, LAYOUT, SHADOWS } from "../../constants/theme";
import {
  barsOf,
  coverUrlFor,
  fileFormatOf,
  formatBytes,
  formatPrice,
  formatReleased,
  formatSpecOf,
  genreOf,
  isPackUnlocked,
  keysOf,
  metersOf,
  packBytes,
  tempoRangeOf,
  type RemoteLoop,
} from "../../constants/loopStore";
import { useLoopStore } from "../../context/LoopStoreContext";

const HERO_COVER = 150;
const BACKDROP_HEIGHT = 260;

/** One fact beside the cover: a small label, then its value. */
const SpecLine = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row gap-2" accessible accessibilityLabel={`${label}: ${value}`}>
    <Text
      className="uppercase text-micro tracking-widest text-ink-muted font-spaceBold"
      style={{ width: 64, lineHeight: 18 }}
    >
      {label}
    </Text>
    <Text
      className="flex-1 text-overline text-white font-satoshiMedium"
      style={{ lineHeight: 18 }}
      numberOfLines={1}
    >
      {value}
    </Text>
  </View>
);

/** A file's own spec line: "104 BPM · 8 bars · A minor · WAV · 1.2 MB". */
const fileCaption = (loop: RemoteLoop) => {
  const bars = barsOf(loop);
  return [
    `${loop.bpm} BPM`,
    bars ? `${bars} ${bars === 1 ? "bar" : "bars"}` : undefined,
    loop.musicalKey,
    fileFormatOf(loop),
    formatBytes(loop.bytes) || undefined,
  ]
    .filter(Boolean)
    .join(" · ");
};

const PackScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { findPack, isDownloaded, downloadPack } = useLoopStore();

  const [downloadingAll, setDownloadingAll] = useState(false);

  const pack = findPack(id);

  if (!pack) {
    return (
      <Screen glows={["topLeftFar"]}>
        <ScreenHeader title="Pack" />
        <View className="items-center justify-center flex-1">
          <EmptyState
            icon={Musicnote}
            message="This pack isn't in the store any more."
            action={<BrandButton label="Back to the store" onPress={() => router.back()} />}
          />
        </View>
      </Screen>
    );
  }

  const unlocked = isPackUnlocked(pack);
  const total = pack.loops.length;
  const done = pack.loops.filter(isDownloaded).length;
  const allDone = done === total;
  const size = formatBytes(packBytes(pack));
  const spec = formatSpecOf(pack);
  const uri = coverUrlFor(pack);
  const released = formatReleased(pack.addedAt);
  const kind = pack.single ? "Single" : "Loop pack";

  const openInBits = () =>
    router.push({ pathname: "/(loops)/sounds", params: { artist: pack.artist } });

  const startAll = async () => {
    if (!unlocked) {
      explainLocked(pack);
      return;
    }
    setDownloadingAll(true);
    const { downloaded, failed } = await downloadPack(pack);
    setDownloadingAll(false);

    // Silence on a clean run: every row already shows its own state, and an
    // alert saying what the screen says would be one more tap for nothing.
    if (failed > 0) {
      Alert.alert(
        "Some loops didn't download",
        `${downloaded} of ${downloaded + failed} came through. Tap Download again to pick up the rest.`
      );
    }
  };

  // The one primary action, in whatever state the pack is in: the price on a
  // locked pack, Get on a free one, what's left part-way, and -- once it's all
  // on the phone -- the way to go and play it, as a shop's OPEN replaces GET.
  const primary = !unlocked
    ? { label: `${formatPrice(pack)} · Coming soon`, onPress: startAll }
    : allDone
      ? { label: "Open in Bits", onPress: openInBits }
      : done > 0
        ? { label: `Download remaining ${total - done}`, onPress: startAll }
        : {
          label: pack.single ? "Get loop" : `Get all ${countOf(pack)}`,
          onPress: startAll,
        };

  // The spec sheet. Each line only when the manifest gives enough to state it.
  const specs = [
    { label: "Contents", value: countOf(pack) },
    { label: "Size", value: size },
    { label: "Key", value: keysOf(pack) },
    { label: "Licence", value: pack.license ?? "" },
    { label: "Released", value: released },
  ].filter((entry) => entry.value);

  return (
    <Screen glows={["topLeftFar", "bottomLeft"]}>
      {/* No title up here: the pack's name is the headline under the cover. */}
      <ScreenHeader title="" />

      <ScrollView
        className="flex-1 px-screen"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* The backdrop: the artwork blurred out to the screen edges, fading
            into the page. Scrolls with the content so it never sits behind the
            spec sheet. */}
        {uri && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -24,
              left: -LAYOUT.screenPaddingX,
              right: -LAYOUT.screenPaddingX,
              height: BACKDROP_HEIGHT,
              opacity: 0.55,
            }}
          >
            <Image
              source={{ uri }}
              blurRadius={50}
              resizeMode="cover"
              style={{ width: "100%", height: "100%" }}
            />
            <LinearGradient
              colors={["rgba(16,17,22,0)", COLORS.surface]}
              style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" }}
            />
          </View>
        )}

        {/* The product: cover on the left, everything about it on the right. */}
        <View className="flex-row gap-4">
          <View style={[{ borderRadius: 12, alignSelf: "flex-start" }, SHADOWS.float]}>
            <PackCover pack={pack} size={HERO_COVER} radius={15}  />
          </View>

          <View className="flex-1 p-4">
            <Text
              className="uppercase text-micro tracking-widest font-spaceBold"
              style={{ color: COLORS.brandFrom }}
              numberOfLines={1}
            >
              {kind} · {genreOf(pack)}
            </Text>
            <Text
              className="mt-1 text-white font-satoshiBold"
              style={{ fontSize: 20, lineHeight: 24 }}
              numberOfLines={2}
            >
              {pack.title}
            </Text>
            <Text
              className="text-label text-white/70 font-satoshiMedium"
              numberOfLines={1}
            >
              {pack.artist}
            </Text>

            <View className="gap-1 mt-3">
              {specs.map((entry) => (
                <SpecLine key={entry.label} label={entry.label} value={entry.value} />
              ))}
            </View>

            {done > 0 && (
              <TouchableOpacity
                onPress={openInBits}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`View ${pack.artist}'s loops in Bits`}
                className="flex-row items-center self-start gap-1 px-3 mt-3 rounded-full"
                style={{ height: 30, backgroundColor: "rgba(255,255,255,0.12)" }}
              >
                <Text
                  className="uppercase text-overline font-spaceBold"
                  style={{ color: COLORS.brandFrom }}
                >
                  View in Bits
                </Text>
                <ArrowRight size={14} color={COLORS.brandFrom} />
              </TouchableOpacity>
            )}
          </View>
        </View>


        {pack.description && (
          <View className="gap-2 mt-4">
            <SectionTitle title="Description" />
            <Text className="text-label leading-5 text-white/70 font-satoshiRegular">
              {pack.description}
            </Text>
          </View>
        )}

        {pack.tags && pack.tags.length > 0 && (
          <View className="flex-row flex-wrap gap-2 mt-4">
            {pack.tags.map((tag) => (
              <View key={tag} className="px-3 py-1 rounded-full bg-white/10">
                <Text className="text-overline text-white/80 font-satoshiMedium">{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* The files, numbered, each with its own spec line and get button. */}
        <View className="gap-1 mt-6">
          {pack.loops.map((loop, i) => (
            <LoopRow
              key={loop.key}
              loop={loop}
              pack={pack}
              // leading={i + 1}
              subtitle={fileCaption(loop)}
              last={i === pack.loops.length - 1}
            />
          ))}
        </View>

        {/* The store and the browser are separate screens on purpose, and this
            is the sentence that connects them. */}
        <Text className="mt-6 text-overline text-ink-muted font-satoshiRegular">
          Downloaded loops appear in Bits, credited to {pack.artist}.
        </Text>
      </ScrollView>
    </Screen>
  );
};

export default PackScreen;
