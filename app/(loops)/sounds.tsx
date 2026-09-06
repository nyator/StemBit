import React, { useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";

import { useRouter } from "expo-router";

import ScreenHeader from "../../components/ui/screenHeader";
import Screen from "../../components/ui/screen";
import SearchField from "../../components/ui/searchField";
import SelectLoopView from "../../components/selectLoopView";
import NavButton from "../../components/ui/navButton";
import { BrandButton } from "../../components/ui/brandButton";
import {
  SHEET_BACKGROUND,
  SHEET_CONTENT,
  SHEET_HANDLE_INDICATOR,
  useSheetBackdrop,
} from "../../components/ui/sheet";
import {
  LOOP_CATEGORIES,
  getAllLoops,
  getArtists,
  getTimeSignatures,
  type Loop,
} from "../../constants/loops";
import { useUserLoops } from "../../context/UserLoopsContext";
import { Add, Download, MusicFilter, TickCircle } from "../../components/icons";
import { COLORS, SIZES } from "../../constants/theme";

// The three axes a loop can be narrowed by. Within an axis, checking more than
// one value is an OR -- "Worship" and "Afro" together get you either. Across
// axes it's an AND -- add "3 / 4" and that OR narrows further, to worship or
// afro loops that are also in three-four. That's the combination somebody
// actually means by checking boxes in more than one section.
type Axis = "categories" | "artists" | "meters";

const AXIS_LABEL: Record<Axis, string> = {
  categories: "Category",
  artists: "Artist",
  meters: "Meter",
};

/** Every checked value per axis. An empty array means "not narrowed by this one". */
type Filters = Record<Axis, string[]>;

const NO_FILTERS: Filters = { categories: [], artists: [], meters: [] };

const matches = (loop: Loop, filters: Filters) =>
  (filters.categories.length === 0 ||
    filters.categories.includes(loop.category)) &&
  (filters.artists.length === 0 || filters.artists.includes(loop.artist)) &&
  (filters.meters.length === 0 || filters.meters.includes(loop.timeSignature));

// The other half of "filter": the axes narrow by a fixed value, this finds a
// loop by name. Matches title, artist, category and meter, plus the bpm as a
// bare number -- "96" finds the loop recorded at 96, not just one titled 96.
const matchesQuery = (loop: Loop, query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    loop.title.toLowerCase().includes(needle) ||
    loop.artist.toLowerCase().includes(needle) ||
    loop.category.toLowerCase().includes(needle) ||
    loop.timeSignature.toLowerCase().includes(needle) ||
    String(loop.bpm).includes(needle)
  );
};

const LoopBrowserScreen = () => {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [query, setQuery] = useState("");

  const sheetRef = useRef<BottomSheetModal>(null);
  const openFilters = () => sheetRef.current?.present();
  const renderBackdrop = useSheetBackdrop();

  // The shipped catalog plus the user's imports. Re-derived when the imports
  // change so a loop added (or deleted) shows up here immediately; every filter
  // below works off this one list, which is what keeps a row's count and its
  // contents from disagreeing.
  const { userLoops } = useUserLoops();
  const allLoops = useMemo(() => getAllLoops(), [userLoops]);

  // Categories are the fixed curated list, so an empty one still shows as a
  // row reading (0) -- it is a slot waiting to be filled. Artists and meters
  // are derived from the loops, because a row that selects nothing there is
  // noise rather than an invitation.
  const axisValues: Record<Axis, string[]> = useMemo(
    () => ({
      categories: [...LOOP_CATEGORIES],
      artists: getArtists(allLoops),
      meters: getTimeSignatures(allLoops),
    }),
    [allLoops]
  );

  const filteredLoops = useMemo(
    () =>
      allLoops.filter(
        (loop) => matches(loop, filters) && matchesQuery(loop, query)
      ),
    [allLoops, filters, query]
  );

  // A row's count is always "how many would I get if I also checked this",
  // holding this axis to just this one value regardless of what else is
  // checked in it -- so checking a second category doesn't shrink the first
  // one's count, the way it would if this counted against the whole axis's
  // current selection. It's still measured against the OTHER axes and the
  // search box, so typing "worship" and opening Meter shows the meters
  // worship loops actually come in, not the whole catalog's.
  const countFor = (axis: Axis, value: string) =>
    allLoops.filter(
      (loop) =>
        matches(loop, { ...filters, [axis]: [value] }) &&
        matchesQuery(loop, query)
    ).length;

  // Checking a row adds it to that axis's set; unchecking removes just that
  // one value, leaving the rest of the axis (and every other axis) alone.
  const toggle = (axis: Axis, value: string) =>
    setFilters((current) => {
      const set = current[axis];
      return {
        ...current,
        [axis]: set.includes(value)
          ? set.filter((v) => v !== value)
          : [...set, value],
      };
    });

  const clearAxis = (axis: Axis) =>
    setFilters((current) => ({ ...current, [axis]: [] }));

  // Flattened to one entry per checked value, not one per axis -- an axis with
  // two boxes checked shows two pills, each removable on its own.
  const active = (Object.keys(filters) as Axis[]).flatMap((axis) =>
    filters[axis].map((value) => ({ axis, value }))
  );

  const activeCount = active.length + (query.trim().length > 0 ? 1 : 0);

  // One section of the sheet: an axis's name, a Clear link when it's set, and
  // a row per value with a live count of what tapping it would leave.
  const renderSection = (axis: Axis) => (
    <View key={axis} className="w-full gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="uppercase text-overline font-spaceBold text-white/70">
          {AXIS_LABEL[axis]}
        </Text>
        {filters[axis].length > 0 && (
          <TouchableOpacity
            onPress={() => clearAxis(axis)}
            accessibilityLabel={`Clear ${AXIS_LABEL[axis]} filter`}
          >
            <Text className="text-brand-from text-overline font-satoshiMedium">
              Clear
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <View className="gap-2">
        {axisValues[axis].map((value) => {
          const selected = filters[axis].includes(value);
          return (
            <TouchableOpacity
              key={value}
              onPress={() => toggle(axis, value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              activeOpacity={0.75}
              className="flex-row items-center gap-3 p-3 rounded-md"
              style={{
                backgroundColor: selected
                  ? "rgba(0,139,194,0.14)"
                  : COLORS.surface,
                borderWidth: 1,
                borderColor: selected ? COLORS.brand : "transparent",
              }}
            >
              <View
                className="items-center justify-center rounded-full"
                style={{
                  width: 16,
                  height: 16,
                  backgroundColor: selected ? COLORS.brand : "transparent",
                  borderWidth: selected ? 0 : 1,
                  borderColor: "rgba(255,255,255,0.2)",
                }}
              >
                {selected && <TickCircle size={12} color={COLORS.white} />}
              </View>
              <Text className="flex-1 text-white text-body font-satoshiMedium">
                {value}
              </Text>
              <Text className="text-ink-muted text-overline font-satoshiRegular">
                {countFor(axis, value)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <Screen glows={["topLeftFar", "bottomLeft"]}>
      {/* The two ways to get another loop, both in the header rather than in
          the list: neither is one of the loops, they're what make another one.
          The store comes first and is the quieter of the two -- it's a place to
          go and look, where + is the one that ends in a loop you made, so only
          that one takes the brand tint. */}
      <ScreenHeader
        title="Bits"
        action={
          <View className="flex-row items-center gap-2">
            <NavButton
              icon={Download}
              onPress={() => router.push("/(loops)/store")}
              accessibilityLabel="Browse the loop store"
            />
            <NavButton
              icon={Add}
              tint="brand"
              onPress={() => router.push("/(loops)/import")}
              accessibilityLabel="Add your own loop"
            />
          </View>
        }
      />

      {/* Find one by name, combined with whatever Filters is set to rather
          than replacing it -- "worship" typed here and 3/4 chosen there give
          the worship loops in three-four together. */}
      <View className="px-screen mb-3">
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search loops"
          accessibilityLabel="Search loops by name, artist or category"
        />
      </View>

      {/* Filters opens the sheet below; what it's currently set to (plus the
          search text) trails it as removable pills, so a filter set earlier
          is never invisible -- just a short list with no visible reason. */}
      <View className="flex-row items-center mb-3 px-screen gap-2">
        <TouchableOpacity
          onPress={openFilters}
          accessibilityLabel={
            activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"
          }
          className="flex-row items-center gap-2 px-4 rounded-full bg-white/5"
          style={{ height: SIZES.minTouch }}
        >
          <MusicFilter size={SIZES.rowIcon} color={COLORS.white} />
          <Text className="text-white text-label font-satoshiMedium">
            Filters
          </Text>
          {activeCount > 0 && (
            <View
              className="items-center justify-center rounded-full bg-brand"
              style={{ minWidth: 18, height: 18, paddingHorizontal: 4 }}
            >
              <Text className="text-white text-micro font-spaceBold">
                {activeCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {activeCount > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, alignItems: "center" }}
            style={{ flexShrink: 1 }}
          >
            {query.trim().length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery("")}
                accessibilityLabel={`Remove "${query.trim()}" search`}
                className="flex-row items-center px-3 py-1 rounded-full gap-1.5 bg-brand/20 border border-brand/40"
              >
                <Text className="text-brand-from text-overline font-satoshiMedium">
                  &quot;{query.trim()}&quot;
                </Text>
                <Text className="text-brand-from text-overline">✕</Text>
              </TouchableOpacity>
            )}
            {active.map(({ axis, value }) => (
              <TouchableOpacity
                key={`${axis}:${value}`}
                onPress={() => toggle(axis, value)}
                accessibilityLabel={`Remove ${value} filter`}
                className="flex-row items-center px-3 py-1 rounded-full gap-1.5 bg-brand/20 border border-brand/40"
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

      <SelectLoopView
        loops={filteredLoops}
        emptyMessage={
          active.length > 0
            ? "No loops match this combination. Drop one of the filters above."
            : query.trim().length > 0
              ? `No loops match "${query.trim()}".`
              : undefined
        }
      />

      {/* Every axis at once, rather than one at a time behind a picker --
          Category, Artist and Meter combine, so seeing all three together is
          what makes combining them ("Worship" + "3/4") an obvious thing to
          do rather than something you'd only find by trying each tab. */}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["75%"]}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={SHEET_BACKGROUND}
        handleIndicatorStyle={SHEET_HANDLE_INDICATOR}
      >
        <View className="flex-row items-center justify-between px-screen pt-1 pb-3">
          <Text className="text-white font-satoshiBold text-title">
            Filters
          </Text>
          {activeCount > 0 && (
            <TouchableOpacity
              onPress={() => {
                setFilters(NO_FILTERS);
                setQuery("");
              }}
              accessibilityLabel="Clear all filters"
            >
              <Text className="text-ink-faint text-overline font-satoshiMedium underline">
                Clear all
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ ...SHEET_CONTENT, paddingTop: 0, gap: 20 }}
        >
          {renderSection("categories")}
          {renderSection("artists")}
          {renderSection("meters")}
        </BottomSheetScrollView>

        {/* A fixed footer below the scrolling sections, not another row inside
            them -- the count it shows depends on every section at once, so it
            has to stay on screen while any of them scroll past. */}
        <View
          className="pt-3 border-t px-screen border-hairline"
          style={{ paddingBottom: SHEET_CONTENT.paddingBottom }}
        >
          <BrandButton
            label={`Show ${filteredLoops.length} ${filteredLoops.length === 1 ? "loop" : "loops"}`}
            onPress={() => sheetRef.current?.dismiss()}
          />
        </View>
      </BottomSheetModal>
    </Screen>
  );
};

export default LoopBrowserScreen;
