import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import EmptyState from "../../components/ui/emptyState";
import { BrandButton } from "../../components/ui/brandButton";
import DownloadButton from "../../components/ui/downloadButton";
import { ArrowRight, Musicnote } from "../../components/icons";
import { COLORS } from "../../constants/theme";
import {
  formatBytes,
  formatPrice,
  isPackUnlocked,
  packBytes,
  type RemotePack,
} from "../../constants/loopStore";
import { useLoopStore } from "../../context/LoopStoreContext";

// What is in the bucket, and what it takes to get it onto this phone.
//
// The Bits browser next door lists what the device already has -- shipped loops
// plus everything imported or downloaded. This lists what it could have. They
// are deliberately separate screens: a row here is a thing to acquire and a row
// there is a thing to play, and merging them would put a download button beside
// loops that are already local and a play button beside audio that isn't there.

const LOCKED_MESSAGE =
  "This pack is paid. Buying inside the app isn't available yet — it needs App Store and Play Store purchasing, which is coming.";

const PackCard = ({ pack, onPress }: { pack: RemotePack; onPress: () => void }) => {
  const { isDownloaded } = useLoopStore();
  const downloaded = pack.loops.filter(isDownloaded).length;
  const unlocked = isPackUnlocked(pack);
  const size = formatBytes(packBytes(pack));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className="flex-row items-center gap-3 p-4 rounded-lg"
      style={{ backgroundColor: COLORS.surface }}
    >
      <View className="flex-1 gap-1">
        <Text className="text-white text-label font-satoshiBold" numberOfLines={1}>
          {pack.title}
        </Text>
        <Text className="text-ink-muted text-overline font-satoshiRegular" numberOfLines={1}>
          {pack.artist} · {pack.loops.length}{" "}
          {pack.loops.length === 1 ? "loop" : "loops"}
          {size ? ` · ${size}` : ""}
        </Text>
      </View>

      {/* Whichever of the two facts is the one the user needs. A pack part-way
          through downloading says so; otherwise the price is what decides
          whether opening it is worth the tap. */}
      {downloaded > 0 ? (
        <Text className="text-overline font-spaceBold" style={{ color: COLORS.success }}>
          {downloaded === pack.loops.length
            ? "Downloaded"
            : `${downloaded}/${pack.loops.length}`}
        </Text>
      ) : (
        <Text
          className="text-overline font-spaceBold"
          style={{ color: unlocked ? COLORS.brandFrom : COLORS.textMuted }}
        >
          {formatPrice(pack)}
        </Text>
      )}

      <ArrowRight size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
};

const SingleRow = ({ pack }: { pack: RemotePack }) => {
  const { isDownloaded, progressFor, downloadLoop } = useLoopStore();
  const loop = pack.loops[0];
  const unlocked = isPackUnlocked(pack);
  const progress = progressFor(loop);

  const status = isDownloaded(loop)
    ? "downloaded"
    : progress !== undefined
      ? "downloading"
      : unlocked
        ? "idle"
        : "locked";

  const start = async () => {
    if (!unlocked) {
      Alert.alert(pack.title, LOCKED_MESSAGE);
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

  return (
    <View className="flex-row items-center justify-between py-3 border-b border-white/10">
      <View className="flex-1 gap-1 pr-3">
        <Text className="text-white text-label font-satoshiBold" numberOfLines={1}>
          {loop.title}
        </Text>
        <Text className="text-ink-muted text-overline font-satoshiRegular" numberOfLines={1}>
          {loop.artist} · {loop.bpm} bpm · {loop.timeSignature}
          {unlocked ? "" : ` · ${formatPrice(pack)}`}
        </Text>
      </View>
      <DownloadButton
        status={status}
        progress={progress}
        onPress={start}
        label={loop.title}
      />
    </View>
  );
};

const LoopStoreScreen = () => {
  const router = useRouter();
  const { packs, status, error, configured, refresh } = useLoopStore();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const albums = packs.filter((pack) => !pack.single);
  const singles = packs.filter((pack) => pack.single);

  const body = () => {
    if (!configured) {
      return (
        <EmptyState
          icon={Musicnote}
          message="The loop store isn't pointed at a bucket yet. Set EXPO_PUBLIC_LOOP_STORE_URL to your R2 domain and restart the dev server."
        />
      );
    }

    // A spinner only when there is genuinely nothing to show. With a cached
    // catalogue on screen the refresh happens under the pull-to-refresh
    // indicator instead, which is where the user asked for it.
    if (status === "loading" && packs.length === 0) {
      return <ActivityIndicator color={COLORS.brandFrom} />;
    }

    if (status === "error" && packs.length === 0) {
      return (
        <EmptyState
          icon={Musicnote}
          message={`Couldn't load the store. ${error ?? ""}`.trim()}
          action={<BrandButton label="Try again" onPress={onRefresh} />}
        />
      );
    }

    if (packs.length === 0) {
      return (
        <EmptyState
          icon={Musicnote}
          message="No packs in the store yet. Artist packs will show up here as they're published."
        />
      );
    }

    return (
      <View className="gap-6">
        {albums.length > 0 && (
          <View className="gap-2">
            <Text className="uppercase text-overline font-spaceBold text-white/70">
              Artist packs
            </Text>
            <View className="gap-2">
              {albums.map((pack) => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  onPress={() =>
                    router.push({
                      pathname: "/(loops)/pack",
                      params: { id: pack.id },
                    })
                  }
                />
              ))}
            </View>
          </View>
        )}

        {/* Singles get rows with the download on them rather than cards that
            open a screen listing one loop. Same data, one tap less. */}
        {singles.length > 0 && (
          <View className="gap-2">
            <Text className="uppercase text-overline font-spaceBold text-white/70">
              Singles
            </Text>
            <View>
              {singles.map((pack) => (
                <SingleRow key={pack.id} pack={pack} />
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen glows={["topLeftFar", "bottomLeft"]}>
      <ScreenHeader title="Loop Store" />

      <ScrollView
        className="flex-1 px-screen"
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1, justifyContent: packs.length === 0 ? "center" : "flex-start" }}
        refreshControl={
          configured ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.brandFrom}
            />
          ) : undefined
        }
      >
        {/* A failed refresh with a cached list still on screen. Said here rather
            than in an alert: the list below is real, just possibly out of date,
            and an alert would imply it isn't. */}
        {status === "ready" && error && packs.length > 0 && (
          <Text className="mb-3 text-overline text-ink-muted font-satoshiRegular">
            Showing the last catalogue — couldn&apos;t reach the store.
          </Text>
        )}
        {body()}
      </ScrollView>
    </Screen>
  );
};

export default LoopStoreScreen;
