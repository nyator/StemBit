import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import EmptyState from "../../components/ui/emptyState";
import { BrandButton } from "../../components/ui/brandButton";
import DownloadButton from "../../components/ui/downloadButton";
import { Lock, Musicnote } from "../../components/icons";
import { COLORS } from "../../constants/theme";
import {
  formatBytes,
  formatPrice,
  isPackUnlocked,
  packBytes,
  type RemoteLoop,
} from "../../constants/loopStore";
import { useLoopStore } from "../../context/LoopStoreContext";

// One pack: what's in it, and a way to take any of it -- or all of it.
//
// Downloads happen a loop at a time even from the Download All button, so the
// unit of success is a loop rather than a pack. Somebody on a hotel connection
// who gets nine of twelve has nine playable loops and a button that will fetch
// the other three, which is the outcome an all-or-nothing transfer denies them.

const PackScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { findPack, isDownloaded, progressFor, downloadLoop, downloadPack } =
    useLoopStore();

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
  const remaining = pack.loops.filter((loop) => !isDownloaded(loop));
  const size = formatBytes(packBytes(pack));

  const explainLock = () =>
    Alert.alert(
      pack.title,
      `${formatPrice(pack)}. Buying inside the app isn't available yet — it needs App Store and Play Store purchasing, which is coming. Free packs download today.`
    );

  const startOne = async (loop: RemoteLoop) => {
    if (!unlocked) {
      explainLock();
      return;
    }
    try {
      await downloadLoop(loop);
    } catch (error) {
      Alert.alert(
        "Download failed",
        error instanceof Error ? error.message : "Try again in a moment."
      );
    }
  };

  const startAll = async () => {
    if (!unlocked) {
      explainLock();
      return;
    }
    setDownloadingAll(true);
    const { downloaded, failed } = await downloadPack(pack);
    setDownloadingAll(false);

    // Silence on a clean run: every row already shows its own tick, and an
    // alert saying what the screen says would be one more tap for nothing.
    if (failed > 0) {
      Alert.alert(
        "Some loops didn't download",
        `${downloaded} of ${downloaded + failed} came through. Tap Download again to pick up the rest.`
      );
    }
  };

  return (
    <Screen glows={["topLeftFar", "bottomLeft"]}>
      <ScreenHeader title={pack.title} />

      <ScrollView
        className="flex-1 px-screen"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="gap-1 mb-4">
          <Text className="text-white text-title font-satoshiBold">
            {pack.artist}
          </Text>
          <Text className="text-ink-muted text-overline font-satoshiRegular">
            {pack.loops.length} {pack.loops.length === 1 ? "loop" : "loops"}
            {size ? ` · ${size}` : ""} · {formatPrice(pack)}
          </Text>
          {pack.description && (
            <Text className="mt-2 text-white/70 text-body font-satoshiRegular">
              {pack.description}
            </Text>
          )}
        </View>

        {/* Why a paid pack won't download, on the screen rather than only
            behind a tap. Somebody who can see the reason isn't going to spend
            three taps discovering it one loop at a time. */}
        {!unlocked && (
          <View
            className="flex-row items-start gap-3 p-4 mb-4 rounded-lg"
            style={{ backgroundColor: COLORS.surface }}
          >
            <Lock size={20} color={COLORS.textMuted} />
            <Text className="flex-1 text-overline text-ink-muted font-satoshiRegular">
              This is a paid pack. In-app purchasing isn&apos;t available yet, so
              its loops can&apos;t be downloaded here. Free packs download today.
            </Text>
          </View>
        )}

        {unlocked && remaining.length > 0 && (
          <View className="mb-5">
            <BrandButton
              label={
                remaining.length === pack.loops.length
                  ? `Download all ${pack.loops.length}`
                  : `Download remaining ${remaining.length}`
              }
              onPress={startAll}
              loading={downloadingAll}
            />
          </View>
        )}

        {unlocked && remaining.length === 0 && (
          <View className="mb-5">
            <Text
              className="text-center text-overline font-spaceBold"
              style={{ color: COLORS.success }}
            >
              Every loop in this pack is on your device
            </Text>
          </View>
        )}

        {pack.loops.map((loop) => {
          const progress = progressFor(loop);
          const status = isDownloaded(loop)
            ? "downloaded"
            : progress !== undefined
              ? "downloading"
              : unlocked
                ? "idle"
                : "locked";

          return (
            <View
              key={loop.key}
              className="flex-row items-center justify-between py-3 border-b border-white/10"
            >
              <View className="flex-1 gap-1 pr-3">
                <Text
                  className="text-white text-label font-satoshiBold"
                  numberOfLines={1}
                >
                  {loop.title}
                </Text>
                <Text className="text-ink-muted text-overline font-satoshiRegular">
                  {loop.bpm} bpm · {loop.timeSignature} · {loop.category}
                  {formatBytes(loop.bytes) ? ` · ${formatBytes(loop.bytes)}` : ""}
                </Text>
              </View>
              <DownloadButton
                status={status}
                progress={progress}
                onPress={() => startOne(loop)}
                label={loop.title}
              />
            </View>
          );
        })}

        {/* Where the loops actually went. The store and the browser are
            separate screens on purpose, and this is the sentence that connects
            them -- without it, a finished download is a tick and no next step. */}
        <Text className="mt-6 text-center text-overline text-ink-muted font-satoshiRegular">
          Downloaded loops appear in Bits, credited to {pack.artist}.
        </Text>
      </ScrollView>
    </Screen>
  );
};

export default PackScreen;
