import React, { useMemo, useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import ScreenHeader from "../../components/ui/screenHeader";
import Screen from "../../components/ui/screen";
import SearchField from "../../components/ui/searchField";
import SelectLoopView from "../../components/selectLoopView";
import NavButton from "../../components/ui/navButton";
import FilterDrawer, {
  type FilterSection,
} from "../../components/ui/filterDrawer";
import FilterBar, { type ActiveFilterPill } from "../../components/ui/filterBar";
import {
  LOOP_CATEGORIES,
  getAllLoops,
  getArtists,
  getTimeSignatures,
  type Loop,
} from "../../constants/loops";
import { useUserLoops } from "../../context/UserLoopsContext";
import { Add, Download } from "../../components/icons";

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

  const [filtersOpen, setFiltersOpen] = useState(false);
  const openFilters = () => {
    Keyboard.dismiss();
    setFiltersOpen(true);
  };

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

  // The search counts as a filter here: it narrows the same list.
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

  // Category and Artist can run long, so each is a row that opens its list.
  // Meter is a handful of values at most, so it's chips you tap in place.
  const sections: FilterSection[] = (["categories", "artists", "meters"] as Axis[]).map(
    (axis) => ({
      key: axis,
      label: AXIS_LABEL[axis],
      kind: axis === "meters" ? "chips" : "list",
      options: axisValues[axis].map((value) => ({
        value,
        count: countFor(axis, value),
      })),
      selected: filters[axis],
      onToggle: (value: string) => toggle(axis, value),
      onClear: () => clearAxis(axis),
    })
  );

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
      <View className="mb-3 px-screen">
        <FilterBar
          search={
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Search loops"
              accessibilityLabel="Search loops by name, artist or category"
            />
          }
          onOpen={openFilters}
          pills={pills}
        />
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
      </Pressable>

      <FilterDrawer
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={() => setFilters(NO_FILTERS)}
        resetDisabled={active.length === 0}
        sections={sections}
        resultLabel={`Show ${filteredLoops.length} ${filteredLoops.length === 1 ? "result" : "results"}`}
      />
    </Screen>
  );
};

export default LoopBrowserScreen;
