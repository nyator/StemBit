import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { BottomSheetModal, BottomSheetScrollView, BottomSheetView } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import EmptyState from "../../components/ui/emptyState";
import SearchField from "../../components/ui/searchField";
import Chip from "../../components/ui/chip";
import { BrandButton } from "../../components/ui/brandButton";
import {
  SHEET_BACKGROUND,
  SHEET_CONTENT,
  SHEET_HANDLE_INDICATOR,
  useSheetBackdrop,
} from "../../components/ui/sheet";
import {
  LoopRow,
  PackCover,
  ProductCard,
  SectionTitle,
  productMetaOf,
  usePackStatus,
} from "../../components/ui/storeParts";
import StoreBanner, { pickBannerSlides } from "../../components/ui/storeBanner";
import {
  ArrowRight,
  ChevronDown,
  Musicnote,
  Filter,
} from "../../components/icons";
import { COLORS, LAYOUT, SIZES } from "../../constants/theme";
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
// singles. While either is in use the banner and the New releases shelf step
// aside: they show picks from the whole store, and a screen that has been
// asked for "slow Gospel packs, newest first" should show exactly that.

/** Gap between the two columns of the pack grid, and between shelf cards. */
const GRID_GAP = 14;
/** Width of one card on the New releases shelf. */
const SHELF_CARD = 150;
/** Most a shelf shows; the grid below has everything. */
const SHELF_MAX = 8;
/* -------------------------------------------------------------------------- */
/* Filter & sort sheet                                                         */
/* -------------------------------------------------------------------------- */

/**
 * One choice in a sheet; its circle fills brand blue when selected. `kind` tells a
 * screen reader whether it's one of several (a filter) or one of one (a sort).
 * A plain row with a rule above every one but the first, drawn like the rows
 * in Bits' filter sheet so the sheets read as one control.
 */
const OptionRow = ({
  label,
  selected,
  onPress,
  kind,
  count,
  first,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  kind: "checkbox" | "radio";
  count?: number;
  first?: boolean;
}) => (
  <TouchableOpacity
    onPress={onPress}
    accessibilityRole={kind}
    accessibilityState={{ checked: selected }}
    activeOpacity={0.75}
    className={`flex-row items-center gap-3 py-3 pl-2 ${first ? "" : "border-t border-white/5"}`}
  >
    {/* Just the circle: outlined when off, filled brand blue when on. */}
    <View
      className="rounded-full"
      style={{
        width: 16,
        height: 16,
        backgroundColor: selected ? COLORS.brand : "transparent",
        borderWidth: selected ? 0 : 1,
        borderColor: "rgba(255,255,255,0.2)",
      }}
    />
    <Text className="flex-1 text-white text-body font-satoshiMedium">{label}</Text>
    {count !== undefined && (
      <Text className="text-ink-muted text-overline font-satoshiRegular">{count}</Text>
    )}
  </TouchableOpacity>
);

/**
 * A folding section of the filter sheet, the same as Bits': one ruled row
 * that names what's picked inside, and unfolds to its options.
 */
const SheetSection = ({
  title,
  selected,
  open,
  onToggle,
  onClear,
  first,
  children,
}: {
  title: string;
  selected: string[];
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
  first: boolean;
  children: ReactNode;
}) => (
  // Ruled above and below like a settings list: the first section draws the
  // top rule, every section its bottom one.
  <View className={`w-full border-b border-white/10 ${first ? "border-t" : ""}`}>
    <TouchableOpacity
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${title}${selected.length ? `, ${selected.join(", ")}` : ""}`}
      className="flex-row items-center gap-2 py-3"
      style={{ minHeight: 52 }}
    >
      <Text className="flex-1 text-white text-body font-satoshiMedium">{title}</Text>
      {/* What's picked, by name -- readable without unfolding. */}
      {selected.length > 0 && (
        <Text
          className="text-brand-from text-overline font-satoshiMedium"
          style={{ maxWidth: "55%" }}
          numberOfLines={1}
        >
          {selected.join(", ")}
        </Text>
      )}
      <ChevronDown
        size={16}
        color={COLORS.textMuted}
        style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
      />
    </TouchableOpacity>
    {open && (
      <View className="pb-2">
        {selected.length > 0 && (
          <TouchableOpacity
            onPress={onClear}
            accessibilityLabel={`Clear ${title}`}
            className="self-end pb-1"
          >
            <Text className="text-brand-from text-overline font-satoshiMedium">Clear</Text>
          </TouchableOpacity>
        )}
        {children}
      </View>
    )}
  </View>
);

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

  // Two sheets, because they are two questions: filters decide what's in the
  // list, sort decides what order it's in.
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const sortSheetRef = useRef<BottomSheetModal>(null);
  const renderBackdrop = useSheetBackdrop();

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

  // Which filter sections are unfolded. All start folded, so every heading
  // fits on screen at once; the headings name what's picked inside them.
  const [openAxes, setOpenAxes] = useState<Record<StoreAxis, boolean>>({
    types: false,
    genres: false,
    tempos: false,
    keys: false,
    artists: false,
  });
  const toggleAxisOpen = (axis: StoreAxis) =>
    setOpenAxes((current) => ({ ...current, [axis]: !current[axis] }));

  // A sort is one choice, so picking it is the whole job: the sheet closes.
  const pickSort = (next: StoreSort) => {
    setSort(next);
    sortSheetRef.current?.dismiss();
  };
  const sortLabel = STORE_SORTS.find((option) => option.id === sort)?.label;

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
          <View className="gap-3 mb-6">
            {/* Search and the filter button share a row: the search takes
                what's left, the button sits at its end at the same height. */}
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <SearchField
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Packs, loops, artists"
                  accessibilityLabel="Search the loop store"
                />
              </View>

              <TouchableOpacity
                onPress={() => sortSheetRef.current?.present()}
                accessibilityRole="button"
                accessibilityLabel={
                  active.length > 0 ? `Filters, ${active.length} active` : "Filters"
                }
                className="items-center justify-center rounded-full bg-white/5"
                style={{ width: SIZES.control, height: SIZES.control }}
              >
                <Filter size={SIZES.rowIcon} color={COLORS.white} />
                {/* The count on the corner, where an icon button carries one. */}
                {active.length > 0 && (
                  <View
                    className="absolute items-center justify-center rounded-full bg-brand"
                    style={{ top: -2, right: -2, minWidth: 18, height: 18, paddingHorizontal: 4 }}
                  >
                    <Text className="text-white text-micro font-spaceBold">{active.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Each active filter is a pill that removes itself, as in Bits --
                on its own row, so it never squeezes the search. */}
            {active.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -LAYOUT.screenPaddingX }}
                contentContainerStyle={{
                  paddingHorizontal: LAYOUT.screenPaddingX,
                  gap: 6,
                  alignItems: "center",
                }}
              >
                {active.map(({ axis, value }) => (
                  <TouchableOpacity
                    key={`${axis}:${value}`}
                    onPress={() => toggle(axis, value)}
                    accessibilityLabel={`Remove ${value} filter`}
                    className="flex-row items-center px-3 py-2 rounded-full gap-1.5 bg-brand/20 border border-brand/40"
                  >
                    <Text className="text-brand-from text-overline font-satoshiMedium">
                      {value}
                    </Text>
                    <Text className="text-brand-from text-overline">✕</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
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

      {/* Every filter at once, as in Bits: seeing the sections together is
          what makes combining them an obvious thing to do. */}
      <BottomSheetModal
        ref={filterSheetRef}
        snapPoints={["80%"]}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={SHEET_BACKGROUND}
        handleIndicatorStyle={SHEET_HANDLE_INDICATOR}
      >
        <View className="flex-row items-center justify-between px-screen pt-1 pb-3">
          <Text className="text-white font-satoshiBold text-title">Filters</Text>
          {active.length > 0 && (
            <TouchableOpacity onPress={clearFilters} accessibilityLabel="Clear all filters">
              <Text className="text-ink-faint text-overline font-satoshiMedium underline">
                Clear all
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          // No gap: each section rules its own edges, and the rows meet.
          contentContainerStyle={{ ...SHEET_CONTENT, paddingTop: 0 }}
        >
          {STORE_AXES.filter(({ axis }) => options[axis].length > 1).map(
            ({ axis, label }, index) => (
              <SheetSection
                key={axis}
                title={label}
                selected={liveFilters[axis]}
                open={openAxes[axis]}
                onToggle={() => toggleAxisOpen(axis)}
                onClear={() => clearAxis(axis)}
                first={index === 0}
              >
                {options[axis].map((value, i) => (
                  <OptionRow
                    key={value}
                    kind="checkbox"
                    label={value}
                    selected={liveFilters[axis].includes(value)}
                    onPress={() => toggle(axis, value)}
                    count={countFor(axis, value)}
                    first={i === 0}
                  />
                ))}
              </SheetSection>
            )
          )}
        </BottomSheetScrollView>

        <View
          className="pt-3 border-t px-screen border-hairline"
          style={{ paddingBottom: SHEET_CONTENT.paddingBottom }}
        >
          <BrandButton
            label={`Show ${visible.length} ${visible.length === 1 ? "result" : "results"}`}
            onPress={() => filterSheetRef.current?.dismiss()}
          />
        </View>
      </BottomSheetModal>

      <BottomSheetModal
        ref={sortSheetRef}
        backdropComponent={renderBackdrop}
        backgroundStyle={SHEET_BACKGROUND}
        handleIndicatorStyle={SHEET_HANDLE_INDICATOR}
      >
        <BottomSheetView style={{ ...SHEET_CONTENT, gap: 12 }}>
          <Text className="text-white font-satoshiBold text-title">Filter by</Text>
          {/* Ruled rows, top and bottom, like the filter sheet's. */}
          <View className="border-t border-b border-white/10">
            {STORE_SORTS.map((option, i) => (
              <OptionRow
                key={option.id}
                kind="radio"
                label={option.label}
                selected={sort === option.id}
                onPress={() => pickSort(option.id)}
                first={i === 0}
              />
            ))}
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </Screen>
  );
};

export default LoopStoreScreen;
