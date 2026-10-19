import React, { useMemo, useState } from "react";
import { Keyboard, Pressable, ScrollView, View } from "react-native";

import ScreenHeader from "../../components/ui/screenHeader";
import Screen from "../../components/ui/screen";
import Chip from "../../components/ui/chip";
import SearchField from "../../components/ui/searchField";
import FilterDrawer, { type FilterSection } from "../../components/ui/filterDrawer";
import FilterBar, { type ActiveFilterPill } from "../../components/ui/filterBar";
import SelectPadView from "../../components/selectPadView";
import PadMixer from "../../components/padMixer";
import {
  PAD_KIND_LABEL,
  PAD_PACKS,
  type PadKind,
  type PadPack,
} from "../../constants/pads";
import { LAYOUT } from "../../constants/theme";

// Searched and filtered the way the Loop Store and Bits are: the same field
// with a filter button beside it, a pill for everything narrowing the list,
// and the same drawer behind the button. Three catalogues that are browsed
// alike are learned once.

type Axis = "kinds" | "artists" | "genres";

const AXIS_LABEL: Record<Axis, string> = {
  kinds: "Type",
  artists: "Artist",
  genres: "Genre",
};

/** Every checked value per axis. An empty array means "not narrowed by this one". */
type Filters = Record<Axis, string[]>;

const NO_FILTERS: Filters = { kinds: [], artists: [], genres: [] };

type Sort = "name" | "artist";

const SORT_LABEL: Record<Sort, string> = {
  name: "Name",
  artist: "Artist",
};

const KINDS = Object.keys(PAD_KIND_LABEL) as PadKind[];

const valueOf = (pack: PadPack, axis: Axis) =>
  axis === "kinds"
    ? PAD_KIND_LABEL[pack.kind]
    : axis === "artists"
      ? pack.artist
      : pack.genre;

const matches = (pack: PadPack, filters: Filters) =>
  (Object.keys(filters) as Axis[]).every(
    (axis) => filters[axis].length === 0 || filters[axis].includes(valueOf(pack, axis))
  );

const matchesQuery = (pack: PadPack, query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [pack.title, pack.artist, pack.genre, PAD_KIND_LABEL[pack.kind]].some(
    (field) => field.toLowerCase().includes(needle)
  );
};

const distinct = (values: string[]) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b));

export default function PadSoundsScreen() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<Sort>("name");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const axisValues: Record<Axis, string[]> = useMemo(
    () => ({
      kinds: KINDS.map((kind) => PAD_KIND_LABEL[kind]),
      artists: distinct(PAD_PACKS.map((pack) => pack.artist)),
      genres: distinct(PAD_PACKS.map((pack) => pack.genre)),
    }),
    []
  );

  const packs = useMemo(() => {
    const shown = PAD_PACKS.filter(
      (pack) => matches(pack, filters) && matchesQuery(pack, query)
    );
    // By artist groups the list under artist headings; by name keeps the
    // catalogue's own order, which is how it was always shown.
    return sort === "artist"
      ? [...shown].sort((a, b) => a.artist.localeCompare(b.artist))
      : shown;
  }, [filters, query, sort]);

  // A row's count is what checking it would show, held against the other
  // axes and the search -- the same reading Bits gives.
  const countFor = (axis: Axis, value: string) =>
    PAD_PACKS.filter(
      (pack) =>
        matches(pack, { ...filters, [axis]: [value] }) && matchesQuery(pack, query)
    ).length;

  const toggle = (axis: Axis, value: string) =>
    setFilters((current) => ({
      ...current,
      [axis]: current[axis].includes(value)
        ? current[axis].filter((v) => v !== value)
        : [...current[axis], value],
    }));

  const clearAxis = (axis: Axis) =>
    setFilters((current) => ({ ...current, [axis]: [] }));

  const active = (Object.keys(filters) as Axis[]).flatMap((axis) =>
    filters[axis].map((value) => ({ axis, value }))
  );

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

  const sections: FilterSection[] = [
    {
      key: "sort",
      label: "Sort",
      kind: "list",
      single: true,
      options: (Object.keys(SORT_LABEL) as Sort[]).map((id) => ({
        value: SORT_LABEL[id],
      })),
      selected: [SORT_LABEL[sort]],
      onToggle: (label) => {
        const next = (Object.keys(SORT_LABEL) as Sort[]).find(
          (id) => SORT_LABEL[id] === label
        );
        if (next) setSort(next);
      },
      onClear: () => setSort("name"),
    },
    // Type is two values, so it's chips tapped in place; the others can run
    // long, so each is a row that opens its list.
    ...(["kinds", "artists", "genres"] as Axis[])
      .filter((axis) => axisValues[axis].length > 1)
      .map(
        (axis): FilterSection => ({
          key: axis,
          label: AXIS_LABEL[axis],
          kind: axis === "kinds" ? "chips" : "list",
          options: axisValues[axis].map((value) => ({
            value,
            count: countFor(axis, value),
          })),
          selected: filters[axis],
          onToggle: (value) => toggle(axis, value),
          onClear: () => clearAxis(axis),
        })
      ),
  ];

  const openFilters = () => {
    Keyboard.dismiss();
    setFiltersOpen(true);
  };

  return (
    <Screen glows={["topLeftFar", "bottomLeft"]} className="items-center justify-start">
      <ScreenHeader title="Select Pad" />

      {/* A tap on any empty space closes the search keyboard, as on the Loop
          and Metronome screens. The controls inside still get their own taps
          first. */}
      <Pressable
        onPress={Keyboard.dismiss}
        accessible={false}
        className="flex-1 w-full px-screen"
      >
        <View className="mb-3">
          <FilterBar
            search={
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder="Search pads"
                accessibilityLabel="Search pads and ambience by name, artist or genre"
              />
            }
            onOpen={openFilters}
            pills={pills}
          />
        </View>

        {/* The store's genre row, here for the one split that matters most:
            a drone to play in key, or a room to stand in. A shortcut into the
            drawer's Type section -- the same ticks, both ways. */}
        {/* <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-grow-0 mb-3"
          style={{ marginHorizontal: -LAYOUT.screenPaddingX }}
          contentContainerStyle={{ paddingHorizontal: LAYOUT.screenPaddingX, gap: 8 }}
        >
          <Chip
            label="All"
            selected={filters.kinds.length === 0}
            onPress={() => clearAxis("kinds")}
          />
          {axisValues.kinds.map((label) => (
            <Chip
              key={label}
              label={label}
              selected={filters.kinds.includes(label)}
              onPress={() => toggle("kinds", label)}
            />
          ))}
        </ScrollView> */}

        <SelectPadView
          packs={packs}
          groupByArtist={sort === "artist"}
          emptyMessage={
            active.length > 0
              ? "Nothing matches this combination. Drop one of the filters above."
              : query.trim().length > 0
                ? `Nothing matches "${query.trim()}".`
                : undefined
          }
        />
        <PadMixer />
      </Pressable>

      <FilterDrawer
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={() => {
          setFilters(NO_FILTERS);
          setSort("name");
        }}
        resetDisabled={active.length === 0 && sort === "name"}
        sections={sections}
        resultLabel={`Show ${packs.length} ${packs.length === 1 ? "result" : "results"}`}
      />
    </Screen>
  );
}
