import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import EmptyState from "../../components/ui/emptyState";
import SearchField from "../../components/ui/searchField";
import Chip from "../../components/ui/chip";
import { BrandButton } from "../../components/ui/brandButton";
import FilterDrawer, { type FilterSection } from "../../components/ui/filterDrawer";
import FilterBar, { type ActiveFilterPill } from "../../components/ui/filterBar";
import {
  LoopRow,
  PackCover,
  ProductCard,
  SectionTitle,
  productMetaOf,
  usePackStatus,
} from "../../components/ui/storeParts";
import StoreBanner, { pickBannerSlides } from "../../components/ui/storeBanner";
import { ArrowRight, Musicnote } from "../../components/icons";
import { COLORS, LAYOUT } from "../../constants/theme";
import { genreOf, type RemoteLoop, type RemotePack } from "../../constants/loopStore";
import {
  DEFAULT_SORT,
  NO_STORE_FILTERS,
  STORE_AXES,
  STORE_SORTS,
  activeFilters,
  matchesFilters,
  optionsFor,
  sortPacks,
  type StoreAxis,
  type StoreFilters,
  type StoreSort,
} from "../../constants/storeFilters";
import { useLoopStore } from "../../context/LoopStoreContext";

// What is in the bucket, and what it takes to get it onto this phone.
//
// The Bits browser next door lists what the device already has -- shipped loops
// plus everything imported or downloaded. This lists what it could have. They
// are deliberately separate screens: a row here is a thing to acquire and a row
// there is a thing to play, and merging them would put a download button beside
// loops that are already local and a play button beside audio that isn't there.
//
// Laid out as a digital storefront: a featured banner, genre filters, a shelf
// of new releases, then every pack as a grid of artwork with the price on it --
// the cover is what sells a pack, so it is the biggest thing on every card. A
// search swaps all of it for results.
//
// Filter & sort (constants/storeFilters.ts) narrow and order the grid and the
// singles, from the same eBay-style drawer as Bits (components/ui/filterDrawer). While either is in use the banner and the New releases shelf step
// aside: they show picks from the whole store, and a screen that has been
// asked for "slow Gospel packs, newest first" should show exactly that.

/** Gap between the two columns of the pack grid, and between shelf cards. */
const GRID_GAP = 14;
/** Width of one card on the New releases shelf. */
const SHELF_CARD = 150;
/** Most a shelf shows; the grid below has everything. */
const SHELF_MAX = 8;
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
      accessibilityLabel={`${pack.title} by ${pack.artist}, ${productMetaOf(pack)}, ${status.text}`}
      className="flex-row items-center gap-3"
    >
      <PackCover pack={pack} size={56} radius={8} />
      <View
        className={`flex-1 flex-row items-center gap-3 py-3 ${last ? "" : "border-b border-white/10"}`}
        style={{ minHeight: 80 }}
      >
        <View className="flex-1 gap-1">
          <Text className="text-white text-label font-satoshiMedium" numberOfLines={1}>
            {pack.title}
          </Text>
          <Text className="text-ink-muted text-overline font-satoshiRegular" numberOfLines={1}>
            {pack.artist} · {productMetaOf(pack)}
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
 * What a query matches: packs by title, artist, description, genre or tag, and
 * loops from any pack by title, artist, category, tempo, meter or key. Loops are
 * searched across every pack, not just singles, so "that 70 bpm pad" turns up
 * even when it lives inside an album.
 */
function searchStore(packs: RemotePack[], query: string) {
  const needle = query.trim().toLowerCase();
  const has = (value: string | number | undefined) =>
    value !== undefined && String(value).toLowerCase().includes(needle);

  const packHits = packs.filter(
    (pack) =>
      !pack.single &&
      (has(pack.title) ||
        has(pack.artist) ||
        has(pack.description) ||
        has(genreOf(pack)) ||
        (pack.tags ?? []).some(has))
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
        has(loop.musicalKey) ||
        has(pack.title)
      ) {
        loopHits.push({ loop, pack });
      }
    }
  }
  return { packHits, loopHits };
}

/** "92 BPM · 8 bars" style caption for a loop row outside its pack. */
const loopCaption = (loop: RemoteLoop, pack: RemotePack, withPack: boolean) =>
  [
    loop.artist,
    withPack ? (pack.single ? "Single" : pack.title) : undefined,
    `${loop.bpm} BPM`,
    loop.musicalKey,
  ]
    .filter(Boolean)
    .join(" · ");

/* -------------------------------------------------------------------------- */
/* Screen                                                                      */
/* -------------------------------------------------------------------------- */

const LoopStoreScreen = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { packs, status, error, configured, refresh } = useLoopStore();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<StoreFilters>(NO_STORE_FILTERS);
  const [sort, setSort] = useState<StoreSort>(DEFAULT_SORT);

  // The same drawer as Bits'. Sort is its first row, the way eBay puts Sort at
  // the top of its filter panel: one place to shape the list, not two sheets.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const openFilters = () => {
    Keyboard.dismiss();
    setFiltersOpen(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const openPack = (pack: RemotePack) =>
    router.push({ pathname: "/(loops)/pack", params: { id: pack.id } });

  // What each sheet section offers, from the catalogue as it is now. A section
  // with fewer than two options filters nothing, so it isn't shown.
  const options = useMemo(
    () =>
      Object.fromEntries(STORE_AXES.map(({ axis }) => [axis, optionsFor(packs, axis)])) as Record<
        StoreAxis,
        string[]
      >,
    [packs]
  );
  const genres = options.genres;

  // A refresh can take away a value that was ticked. Only the ones still on
  // offer count, so a vanished genre can't silently empty the store.
  const liveFilters = useMemo(
    () =>
      Object.fromEntries(
        STORE_AXES.map(({ axis }) => [
          axis,
          filters[axis].filter((value) => options[axis].includes(value)),
        ])
      ) as StoreFilters,
    [filters, options]
  );
  const active = activeFilters(liveFilters);
  const refining = active.length > 0 || sort !== DEFAULT_SORT;

  const toggle = (axis: StoreAxis, value: string) =>
    setFilters((current) => ({
      ...current,
      [axis]: current[axis].includes(value)
        ? current[axis].filter((v) => v !== value)
        : [...current[axis], value],
    }));
  const clearAxis = (axis: StoreAxis) => setFilters((current) => ({ ...current, [axis]: [] }));
  const clearFilters = () => setFilters(NO_STORE_FILTERS);
  // The drawer's Reset puts back everything it shapes, the sort included.
  const resetAll = () => {
    clearFilters();
    setSort(DEFAULT_SORT);
  };

  const sortLabel = STORE_SORTS.find((option) => option.id === sort)?.label ?? "";

  // Filtered, then sorted. Search runs over the filtered list too, so
  // "A minor" typed into the box while Gospel is ticked finds Gospel loops.
  const visible = useMemo(
    () => sortPacks(packs.filter((pack) => matchesFilters(pack, liveFilters)), sort),
    [packs, liveFilters, sort]
  );
  const albums = visible.filter((pack) => !pack.single);
  const singles = visible.filter((pack) => pack.single);
  const bannerSlides = useMemo(() => pickBannerSlides(packs), [packs]);

  // How many results a row would give if it were ticked alone in its section,
  // against everything ticked elsewhere -- the same count Bits' sheet shows, so
  // ticking a second genre doesn't shrink the first one's number.
  const countFor = (axis: StoreAxis, value: string) =>
    packs.filter((pack) => matchesFilters(pack, { ...liveFilters, [axis]: [value] })).length;

  // The drawer's rows, by Bits' rule: an axis that can run long (genre, key,
  // artist) is a row that opens its list; a handful of values (type, tempo)
  // is chips tapped in place. One with fewer than two options filters
  // nothing, so it isn't offered.
  const CHIP_AXES: StoreAxis[] = ["types", "tempos"];
  const sections: FilterSection[] = [
    {
      key: "sort",
      label: "Sort",
      kind: "list",
      single: true,
      options: STORE_SORTS.map((option) => ({ value: option.label })),
      selected: [sortLabel],
      onToggle: (label) => {
        const next = STORE_SORTS.find((option) => option.label === label);
        if (next) setSort(next.id);
      },
      onClear: () => setSort(DEFAULT_SORT),
    },
    ...STORE_AXES.filter(({ axis }) => options[axis].length > 1).map(
      ({ axis, label }): FilterSection => ({
        key: axis,
        label,
        kind: CHIP_AXES.includes(axis) ? "chips" : "list",
        options: options[axis].map((value) => ({ value, count: countFor(axis, value) })),
        selected: liveFilters[axis],
        onToggle: (value) => toggle(axis, value),
        onClear: () => clearAxis(axis),
      })
    ),
  ];

  // As in Bits, the search counts as a filter: it narrows the same list.
  const pills: ActiveFilterPill[] = [
    ...(query.trim().length > 0
      ? [
          {
            key: "query",
            label: `"${query.trim()}"`,
            onRemove: () => setQuery(""),
            accessibilityLabel: `Remove "${query.trim()}" search`,
          },
        ]
      : []),
    ...active.map(({ axis, value }) => ({
      key: `${axis}:${value}`,
      label: value,
      onRemove: () => toggle(axis, value),
      accessibilityLabel: `Remove ${value} filter`,
    })),
  ];

  // A shelf of the newest packs, but only once the grid is long enough that
  // the newest aren't already on screen. Four packs in a grid don't need a
  // shelf repeating two of them above it.
  const newReleases = albums
    .filter((pack) => pack.addedAt)
    .sort((a, b) => Date.parse(b.addedAt!) - Date.parse(a.addedAt!))
    .slice(0, SHELF_MAX);
  const showNewReleases = !refining && albums.length > 4 && newReleases.length >= 2;

  const cardWidth = Math.floor((width - LAYOUT.screenPaddingX * 2 - GRID_GAP) / 2);

  const searching = query.trim().length > 0;
  const results = useMemo(
    () => (searching ? searchStore(visible, query) : null),
    [visible, query, searching]
  );

  const renderResults = () => {
    if (!results) return null;
    const { packHits, loopHits } = results;

    if (packHits.length === 0 && loopHits.length === 0) {
      return (
        <Text className="mt-10 text-center text-label text-ink-muted font-satoshiRegular">
          Nothing in the store matches “{query.trim()}”
          {active.length > 0 ? " with these filters" : ""}.
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
                subtitle={loopCaption(loop, pack, true)}
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
      {!refining && <StoreBanner slides={bannerSlides} onOpen={openPack} />}

      {genres.length > 1 && (
        // Edge to edge, like the shelves, with the first chip on the page
        // margin. A shortcut into the sheet's Genre section: the same ticks,
        // so a genre picked here shows there and the other way round.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -LAYOUT.screenPaddingX }}
          contentContainerStyle={{ paddingHorizontal: LAYOUT.screenPaddingX, gap: 8 }}
        >
          <Chip
            label="All"
            selected={liveFilters.genres.length === 0}
            onPress={() => clearAxis("genres")}
          />
          {genres.map((name) => (
            <Chip
              key={name}
              label={name}
              selected={liveFilters.genres.includes(name)}
              onPress={() => toggle("genres", name)}
            />
          ))}
        </ScrollView>
      )}

      {showNewReleases && (
        <View className="gap-3">
          <SectionTitle title="New releases" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -LAYOUT.screenPaddingX }}
            contentContainerStyle={{ paddingHorizontal: LAYOUT.screenPaddingX, gap: GRID_GAP }}
          >
            {newReleases.map((pack) => (
              <ProductCard
                key={pack.id}
                pack={pack}
                width={SHELF_CARD}
                onPress={() => openPack(pack)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {albums.length > 0 && (
        <View className="gap-3">
          <SectionTitle
            title="Loop Packs"
            // A count only while narrowed, when "how many did that leave" is
            // the question.
            caption={
              refining ? `${albums.length} ${albums.length === 1 ? "pack" : "packs"}` : undefined
            }
          />
          <View className="flex-row flex-wrap" style={{ columnGap: GRID_GAP, rowGap: 20 }}>
            {albums.map((pack) => (
              <ProductCard
                key={pack.id}
                pack={pack}
                width={cardWidth}
                onPress={() => openPack(pack)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Singles get rows with the price button on them rather than cards
          that open a screen listing one loop. Same data, one tap less. */}
      {singles.length > 0 && (
        <View className="gap-1">
          <SectionTitle title="Singles" caption="One loop, ready to play" />
          {singles.map((pack, i) => {
            const loop = pack.loops[0];
            return (
              <LoopRow
                key={pack.id}
                loop={loop}
                pack={pack}
                leading="cover"
                subtitle={`${loopCaption(loop, pack, false)} · ${loop.timeSignature}`}
                last={i === singles.length - 1}
              />
            );
          })}
        </View>
      )}

      {albums.length === 0 && singles.length === 0 && (
        <View className="items-center gap-3 mt-6">
          <Text className="text-center text-label text-ink-muted font-satoshiRegular">
            Nothing in the store matches these filters.
          </Text>
          <TouchableOpacity onPress={clearFilters} accessibilityRole="button">
            <Text className="text-label font-spaceBold" style={{ color: COLORS.brandFrom }}>
              Clear filters
            </Text>
          </TouchableOpacity>
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
      <ScreenHeader title="Loop Store" />

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
        {/* Only once there's a catalogue to search. */}
        {packs.length > 0 && (
          // The same bar as Bits: search and Filter on one row, pills below.
          <View className="mb-6">
            <FilterBar
              search={
                <SearchField
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Packs, loops, artists"
                  accessibilityLabel="Search the loop store"
                />
              }
              onOpen={openFilters}
              pills={pills}
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

      <FilterDrawer
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={resetAll}
        resetDisabled={!refining}
        sections={sections}
        resultLabel={`Show ${visible.length} ${visible.length === 1 ? "result" : "results"}`}
      />
    </Screen>
  );
};

export default LoopStoreScreen;
