import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import SearchField from "../../components/ui/searchField";
import { BrandButton } from "../../components/ui/brandButton";
import {
  LoopRow,
  PackCover,
  SectionTitle,
  countOf,
  usePackStatus,
} from "../../components/ui/storeParts";
import StoreBanner, { pickBannerSlides } from "../../components/ui/storeBanner";
import { ArrowRight, Musicnote } from "../../components/icons";
import { COLORS, LAYOUT } from "../../constants/theme";
import type { RemoteLoop, RemotePack } from "../../constants/loopStore";
import { useLoopStore } from "../../context/LoopStoreContext";

// What is in the bucket, and what it takes to get it onto this phone.
//
// The Bits browser next door lists what the device already has -- shipped loops
// plus everything imported or downloaded. This lists what it could have. They
// are deliberately separate screens: a row here is a thing to acquire and a row
// there is a thing to play, and merging them would put a download button beside
// loops that are already local and a play button beside audio that isn't there.
//
// Laid out like Apple Music's Browse tab -- a large title, wide featured cards
// that page sideways, shelves of covers -- with a shop's habit of putting the
// price on everything, and a search that swaps it all for results.

/** Width of one cover on the Artist packs shelf. */
const SHELF_COVER = 160;

/* -------------------------------------------------------------------------- */
/* Browse                                                                      */
/* -------------------------------------------------------------------------- */

/** One cover on the shelf: art, title, artist, price. */
const ShelfItem = ({ pack, onPress }: { pack: RemotePack; onPress: () => void }) => {
  const status = usePackStatus(pack);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${pack.title} by ${pack.artist}, ${countOf(pack)}, ${status.text}`}
      style={{ width: SHELF_COVER }}
      className="gap-2"
    >
      <PackCover id={pack.id} size={SHELF_COVER} radius={8} />
      <View>
        <Text className="text-white text-label font-satoshiMedium" numberOfLines={1}>
          {pack.title}
        </Text>
        <Text className="text-ink-muted text-label font-satoshiRegular" numberOfLines={1}>
          {pack.artist}
        </Text>
        <Text
          className="mt-0.5 text-overline font-spaceBold"
          style={{ color: status.color }}
          numberOfLines={1}
        >
          {status.text}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

/* -------------------------------------------------------------------------- */
/* Search                                                                      */
/* -------------------------------------------------------------------------- */

/** A pack in the search results: the whole row opens it. */
const PackResultRow = ({
  pack,
  last,
  onPress,
}: {
  pack: RemotePack;
  last: boolean;
  onPress: () => void;
}) => {
  const status = usePackStatus(pack);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${pack.title} by ${pack.artist}, ${countOf(pack)}, ${status.text}`}
      className="flex-row items-center gap-3"
    >
      <PackCover id={pack.id} size={48} radius={6} />
      <View
        className={`flex-1 flex-row items-center gap-3 py-3 ${last ? "" : "border-b border-white/10"}`}
        style={{ minHeight: 72 }}
      >
        <View className="flex-1 gap-1">
          <Text className="text-white text-label font-satoshiMedium" numberOfLines={1}>
            {pack.title}
          </Text>
          <Text className="text-ink-muted text-overline font-satoshiRegular" numberOfLines={1}>
            Pack · {pack.artist} · {countOf(pack)}
          </Text>
        </View>
        <Text className="text-overline font-spaceBold" style={{ color: status.color }}>
          {status.text}
        </Text>
        <ArrowRight size={16} color={COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  );
};

type LoopHit = { loop: RemoteLoop; pack: RemotePack };

/**
 * What a query matches: packs by title, artist or description, and loops from
 * any pack by title, artist, category, tempo or meter. Loops are searched
 * across every pack, not just singles, so "that 70 bpm pad" turns up even when
 * it lives inside an album.
 */
function searchStore(packs: RemotePack[], query: string) {
  const needle = query.trim().toLowerCase();
  const has = (value: string | number | undefined) =>
    value !== undefined && String(value).toLowerCase().includes(needle);

  const packHits = packs.filter(
    (pack) => !pack.single && (has(pack.title) || has(pack.artist) || has(pack.description))
  );
  const loopHits: LoopHit[] = [];
  for (const pack of packs) {
    for (const loop of pack.loops) {
      if (
        has(loop.title) ||
        has(loop.artist) ||
        has(loop.category) ||
        has(loop.bpm) ||
        has(loop.timeSignature) ||
        has(pack.title)
      ) {
        loopHits.push({ loop, pack });
      }
    }
  }
  return { packHits, loopHits };
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                      */
/* -------------------------------------------------------------------------- */

const LoopStoreScreen = () => {
  const router = useRouter();
  const { packs, status, error, configured, refresh } = useLoopStore();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const openPack = (pack: RemotePack) =>
    router.push({ pathname: "/(loops)/pack", params: { id: pack.id } });

  const albums = packs.filter((pack) => !pack.single);
  const singles = packs.filter((pack) => pack.single);
  const bannerSlides = useMemo(() => pickBannerSlides(packs), [packs]);

  const searching = query.trim().length > 0;
  const results = useMemo(
    () => (searching ? searchStore(packs, query) : null),
    [packs, query, searching]
  );

  const renderResults = () => {
    if (!results) return null;
    const { packHits, loopHits } = results;

    if (packHits.length === 0 && loopHits.length === 0) {
      return (
        <Text className="mt-10 text-center text-label text-ink-muted font-satoshiRegular">
          Nothing in the store matches “{query.trim()}”.
        </Text>
      );
    }

    return (
      <View className="gap-6">
        {packHits.length > 0 && (
          <View className="gap-1">
            <SectionTitle title="Packs" />
            {packHits.map((pack, i) => (
              <PackResultRow
                key={pack.id}
                pack={pack}
                last={i === packHits.length - 1}
                onPress={() => openPack(pack)}
              />
            ))}
          </View>
        )}
        {loopHits.length > 0 && (
          <View className="gap-1">
            <SectionTitle title="Loops" />
            {loopHits.map(({ loop, pack }, i) => (
              <LoopRow
                key={`${pack.id}:${loop.key}`}
                loop={loop}
                pack={pack}
                leading="cover"
                subtitle={`${loop.artist} · ${pack.single ? "Single" : pack.title} · ${loop.bpm} bpm`}
                last={i === loopHits.length - 1}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderBrowse = () => (
    <View className="gap-8">
      <StoreBanner slides={bannerSlides} onOpen={openPack} />

      {albums.length > 0 && (
        <View className="gap-3">
          <SectionTitle title="Artist packs" />
          {/* Runs to the screen edges, like an Apple Music shelf, while its
              first cover still lines up with everything else on the page. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -LAYOUT.screenPaddingX }}
            contentContainerStyle={{ paddingHorizontal: LAYOUT.screenPaddingX, gap: 12 }}
          >
            {albums.map((pack) => (
              <ShelfItem key={pack.id} pack={pack} onPress={() => openPack(pack)} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Singles get rows with the price button on them rather than covers
          that open a screen listing one loop. Same data, one tap less. */}
      {singles.length > 0 && (
        <View className="gap-1">
          <SectionTitle title="Singles" />
          {singles.map((pack, i) => {
            const loop = pack.loops[0];
            return (
              <LoopRow
                key={pack.id}
                loop={loop}
                pack={pack}
                leading="cover"
                subtitle={`${loop.artist} · ${loop.bpm} bpm · ${loop.timeSignature}`}
                last={i === singles.length - 1}
              />
            );
          })}
        </View>
      )}
    </View>
  );

  const body = () => {
    if (!configured) {
      return (
        <EmptyState
          icon={Musicnote}
          // The setup hint is for us; a release build missing the variable
          // shouldn't show App Review a message about R2 buckets.
          message={
            __DEV__
              ? "The loop store isn't pointed at a bucket yet. Set EXPO_PUBLIC_LOOP_STORE_URL to your R2 domain and restart the dev server."
              : "The loop store isn't available right now. Check back soon."
          }
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
          message={
            __DEV__
              ? `Couldn't load the store. ${error ?? ""}`.trim()
              : "Couldn't load the store. Check your connection and try again."
          }
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

    return searching ? renderResults() : renderBrowse();
  };

  return (
    <Screen glows={["topLeftFar", "bottomLeft"]}>
      {/* Back button only: the title is the large one below, as in Apple Music. */}
      <ScreenHeader title="" />

      <ScrollView
        className="flex-1 px-screen"
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
        <Text className="text-white font-satoshiBold" style={{ fontSize: 34, lineHeight: 40 }}>
          Loop Store
        </Text>

        {/* Only once there's a catalogue to search. */}
        {packs.length > 0 && (
          <View className="mt-3 mb-6">
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Packs, loops, artists"
              accessibilityLabel="Search the loop store"
            />
          </View>
        )}

        {/* A failed refresh with a cached list still on screen. Said here rather
            than in an alert: the list below is real, just possibly out of date,
            and an alert would imply it isn't. */}
        {status === "ready" && error && packs.length > 0 && (
          <Text className="mb-3 text-overline text-ink-muted font-satoshiRegular">
            Showing the last catalogue — couldn&apos;t reach the store.
          </Text>
        )}

        <View
          className="flex-1"
          style={{ justifyContent: packs.length === 0 ? "center" : "flex-start" }}
        >
          {body()}
        </View>
      </ScrollView>
    </Screen>
  );
};

export default LoopStoreScreen;
