import React, { useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";

import { useLocalSearchParams, useRouter } from "expo-router";

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
import { Add, ChevronDown, Download, Filter } from "../../components/icons";
import { COLORS, LAYOUT, SIZES } from "../../constants/theme";

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
  // `?artist=` opens the browser already narrowed to one artist -- how the
  // store's "Open in Bits" lands on the loops it just downloaded. It sets the
  // ordinary Artist filter, so it shows as a chip and clears like any other.
  const { artist } = useLocalSearchParams<{ artist?: string }>();
  const [filters, setFilters] = useState<Filters>(() =>
    artist ? { ...NO_FILTERS, artists: [artist] } : NO_FILTERS
  );
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

  // Which sheet sections are unfolded. They start folded so all three
  // headings fit on one screen -- the artist list alone can run long -- except
  // one already narrowed (an `?artist=` arrival), which opens to show it.
  const [open, setOpen] = useState<Record<Axis, boolean>>(() => ({
    categories: false,
    artists: !!artist,
    meters: false,
  }));
  const toggleOpen = (axis: Axis) =>
    setOpen((current) => ({ ...current, [axis]: !current[axis] }));

  const renderSection = (axis: Axis) => {
    const isOpen = open[axis];
    const ticked = filters[axis].length;
    return (
      // One row per section, ruled above and below like a settings list: the
      // first section draws the top rule, every section draws its bottom one.
      <View
        key={axis}
        className={`w-full border-b border-white/10 ${axis === "categories" ? "border-t" : ""}`}
      >
        <View className="flex-row items-center" style={{ minHeight: 52 }}>
          {/* The whole row folds the section; folded, it still says how many
              are ticked inside so nothing is hidden silently. */}
          <TouchableOpacity
            onPress={() => toggleOpen(axis)}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            accessibilityLabel={`${AXIS_LABEL[axis]}${ticked ? `, ${ticked} selected` : ""}`}
            className="flex-row items-center flex-1 gap-2 py-3"
          >
            <Text className="flex-1 text-white text-body font-satoshiMedium">
              {AXIS_LABEL[axis]}
            </Text>
            {/* What's picked, by name -- readable without unfolding. */}
            {ticked > 0 && (
              <Text
                className="text-brand-from text-overline font-satoshiMedium"
                style={{ maxWidth: "55%" }}
                numberOfLines={1}
              >
                {filters[axis].join(", ")}
              </Text>
            )}
            <ChevronDown
              size={16}
              color={COLORS.textMuted}
              style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}
            />
          </TouchableOpacity>
        </View>
        {isOpen && (
          <View className="pb-2">
            {ticked > 0 && (
              <TouchableOpacity
                onPress={() => clearAxis(axis)}
                accessibilityLabel={`Clear ${AXIS_LABEL[axis]} filter`}
                className="self-end pb-1"
              >
                <Text className="text-brand-from text-overline font-satoshiMedium">
                  Clear
                </Text>
              </TouchableOpacity>
            )}
            {axisValues[axis].map((value, i) => {
              const selected = filters[axis].includes(value);
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => toggle(axis, value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  activeOpacity={0.75}
                  // Plain rows with a rule between them, indented under the
                  // section's heading.
                  className={`flex-row items-center gap-3 py-3 pl-2 ${
                    i > 0 ? "border-t border-white/5" : ""
                  }`}
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
        )}
      </View>
    );
  };

  return (
    <Screen glows={["topLeftFar", "bottomLeft"]}>
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
      {/* A tap on any empty space closes the search keyboard, as on the Loop
          and Metronome screens. The controls inside still get their own taps
          first. */}
      <Pressable onPress={Keyboard.dismiss} accessible={false} className="flex-1">
      {/* Search and the filter button share a row, as in the Loop Store: the
          search takes what's left, the button sits at its end at the same
          height. */}
      <View className="flex-row items-center gap-2 px-screen mb-3">
        <View className="flex-1">
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search loops"
            accessibilityLabel="Search loops by name, artist or category"
          />
        </View>
        <TouchableOpacity
          onPress={openFilters}
          accessibilityRole="button"
          accessibilityLabel={
            active.length > 0 ? `Filters, ${active.length} active` : "Filters"
          }
          className="items-center justify-center rounded-full bg-white/5"
          style={{ width: SIZES.control, height: SIZES.control }}
        >
          <Filter size={SIZES.rowIcon} color={COLORS.white} />
          {/* Filters only: the search is right beside it and says itself. */}
          {active.length > 0 && (
            <View
              className="absolute items-center justify-center rounded-full bg-brand"
              style={{ top: -2, right: -2, minWidth: 18, height: 18, paddingHorizontal: 4 }}
            >
              <Text className="text-white text-micro font-spaceBold">
                {active.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Each active filter is a pill that removes itself -- on its own row,
          so it never squeezes the search. */}
      {active.length > 0 && (
        <View className="mb-3">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
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
        </View>
      )}

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
      </Pressable>

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
          // No gap: each section rules its own edges, and the rows meet.
          contentContainerStyle={{ ...SHEET_CONTENT, paddingTop: 0 }}
        >
          {renderSection("categories")}
          {renderSection("artists")}
          {renderSection("meters")}
        </BottomSheetScrollView>

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
