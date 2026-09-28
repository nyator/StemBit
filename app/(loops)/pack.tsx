import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import EmptyState from "../../components/ui/emptyState";
import { BrandButton } from "../../components/ui/brandButton";
import { LoopRow, PackCover, countOf, explainLocked } from "../../components/ui/storeParts";
import { Download, Lock, Musicnote, PlayCircle, TickCircle } from "../../components/icons";
import { COLORS, SHADOWS } from "../../constants/theme";
import {
  formatBytes,
  formatPrice,
  isPackUnlocked,
  packBytes,
} from "../../constants/loopStore";
import { useLoopStore } from "../../context/LoopStoreContext";

// One pack: what's in it, and a way to take any of it -- or all of it.
//
// Laid out like an Apple Music album: the cover centred and large, the title
// under it, the artist in the accent colour, two wide buttons side by side (where
// Apple Music puts Play and Shuffle: here, get the lot and go to Bits), then the
// loops as a numbered list -- each with its own price button, the way a shop
// puts one on every product.
//
// Downloads happen a loop at a time even from the big button, so the unit of
// success is a loop rather than a pack. Somebody on a hotel connection who gets
// nine of twelve has nine playable loops and a button that will fetch the other
// three, which is the outcome an all-or-nothing transfer denies them.

const HERO_COVER = 250;

/** One of the two wide buttons under the title. */
const PillButton = ({
  icon,
  label,
  onPress,
  disabled,
  tint = COLORS.brandFrom,
  accessibilityLabel,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tint?: string;
  accessibilityLabel?: string;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.75}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
    className="flex-row items-center justify-center flex-1 gap-2 rounded-xl"
    style={{ height: 48, backgroundColor: "rgba(255,255,255,0.10)" }}
  >
    {icon}
    <Text className="text-label font-satoshiBold" style={{ color: tint }} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

const PackScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { findPack, isDownloaded, downloadPack } = useLoopStore();

  const [downloadingAll, setDownloadingAll] = useState(false);

  const pack = findPack(id);

  // The catalogue is refreshed behind this screen and a pack can be pulled from
  // it; the id in the URL then names nothing. Better a plain sentence than a
  // screen of undefined.
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

  // The main button: the price on a paid pack, progress while it downloads,
  // how many are left part-way, and a tick once it's all on the phone.
  const main = !unlocked
    ? { icon: <Lock size={18} color={COLORS.white} />, label: formatPrice(pack), tint: COLORS.white }
    : downloadingAll
      ? { icon: <ActivityIndicator size="small" color={COLORS.brandFrom} />, label: "Downloading", tint: COLORS.brandFrom }
      : allDone
        ? { icon: <TickCircle size={18} color={COLORS.success} />, label: "Downloaded", tint: COLORS.success }
        : done > 0
          ? { icon: <Download size={18} color={COLORS.brandFrom} />, label: `Get ${total - done} more`, tint: COLORS.brandFrom }
          : { icon: <Download size={18} color={COLORS.brandFrom} />, label: "Get all", tint: COLORS.brandFrom };

  return (
    <Screen glows={["topLeftFar", "bottomLeft"]}>
      {/* No title up here: the pack's name is the headline under the cover. */}
      <ScreenHeader title="" />

      <ScrollView
        className="flex-1 px-screen"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover, title, artist, facts: centred, as Apple Music heads an album. */}
        <View className="items-center">
          <View style={[{ borderRadius: 10 }, SHADOWS.float]}>
            <PackCover id={pack.id} size={HERO_COVER} radius={10} />
          </View>
          <Text
            className="mt-5 text-center text-white font-satoshiBold"
            style={{ fontSize: 22, lineHeight: 28 }}
            numberOfLines={2}
          >
            {pack.title}
          </Text>
          <Text
            className="text-center font-satoshiMedium"
            style={{ fontSize: 20, lineHeight: 26, color: COLORS.brandFrom }}
            numberOfLines={1}
          >
            {pack.artist}
          </Text>
          <Text className="mt-1 text-center uppercase text-overline tracking-widest text-ink-muted font-spaceBold">
            Pack · {formatPrice(pack)}
          </Text>
        </View>

        {/* The two wide buttons. */}
        <View className="flex-row gap-3 mt-5">
          <PillButton
            icon={main.icon}
            label={main.label}
            tint={main.tint}
            onPress={startAll}
            disabled={downloadingAll || (unlocked && allDone)}
            accessibilityLabel={
              !unlocked
                ? `${pack.title} is a paid pack, ${formatPrice(pack)}`
                : allDone
                  ? "Every loop is downloaded"
                  : main.label
            }
          />
          {/* Only once there's something there: before the first download it
              would open Bits to an empty list. A pack is many loops with no
              obvious one to load, so this lands on the artist's loops to pick
              from, where a single loop's own button loads it directly. */}
          {done > 0 && (
            <PillButton
              icon={<PlayCircle size={18} color={COLORS.brandFrom} />}
              label="Open in Bits"
              onPress={() =>
                router.push({ pathname: "/(loops)/sounds", params: { artist: pack.artist } })
              }
            />
          )}
        </View>

        {/* Why a paid pack won't download, on the screen rather than only
            behind a tap. Somebody who can see the reason isn't going to spend
            three taps discovering it one loop at a time. */}
        {!unlocked && (
          <Text className="mt-3 text-overline text-ink-muted font-satoshiRegular">
            In-app purchasing isn&apos;t available yet, so this pack&apos;s loops
            can&apos;t be downloaded here. Free packs download today.
          </Text>
        )}

        {pack.description && (
          <Text className="mt-5 text-label leading-5 text-white/70 font-satoshiRegular">
            {pack.description}
          </Text>
        )}

        {/* The track list, numbered like an album. */}
        <View className="mt-5">
          {pack.loops.map((loop, i) => (
            <LoopRow
              key={loop.key}
              loop={loop}
              pack={pack}
              leading={i + 1}
              subtitle={`${loop.bpm} bpm · ${loop.timeSignature} · ${loop.category}`}
              last={i === pack.loops.length - 1}
            />
          ))}
        </View>

        {/* The album footer: how much, and where it goes. The store and the
            browser are separate screens on purpose, and this is the sentence
            that connects them. */}
        <View className="gap-1 mt-5">
          <Text className="text-overline text-ink-muted font-satoshiRegular">
            {countOf(pack)}
            {size ? `, ${size}` : ""}
          </Text>
          <Text className="text-overline text-ink-muted font-satoshiRegular">
            Downloaded loops appear in Bits, credited to {pack.artist}.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
};

export default PackScreen;
