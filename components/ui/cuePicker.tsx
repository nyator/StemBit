import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Keyboard, ScrollView, Text, TouchableOpacity, View } from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";

import { COLORS } from "../../constants/theme";
import { TickCircle } from "../icons";
import Chip from "./chip";
import FilterBar, { type ActiveFilterPill } from "./filterBar";
import FilterDrawer, { type FilterSection } from "./filterDrawer";
import SearchField from "./searchField";
import {
  MAX_SHEET_HEIGHT,
  SHEET_BACKGROUND,
  SHEET_CONTENT,
  SHEET_HANDLE_INDICATOR,
  useSheetBackdrop,
} from "./sheet";

// Choosing a cue's loop or pad, browsed the way every catalogue in the app
// is: the Loop Store's search field with its filter button, a removable pill
// for everything narrowing the list, the same drawer behind the button, and
// the store's chip row for the one filter worth a shortcut. A cue is set up
// from the same catalogues Bits and the pad browser show, so it is searched
// the same way rather than with a sheet-only cousin of those controls.

export type PickerOption = {
  key: string;
  title: string;
  detail?: string;
  /**
   * What this option is filtered by, keyed by facet -- e.g.
   * { category: "Worship", artist: "DJ Koda", meter: "6 / 8" }.
   */
  facets?: Record<string, string>;
};

/** One way the list can be narrowed. */
export type PickerFacet = {
  key: string;
  /** The drawer row's name: "Category", "Artist". */
  label: string;
  /** A handful of values, shown inline in the drawer rather than drilled into. */
  chips?: boolean;
};

export type CuePickerHandle = {
  present: () => void;
  dismiss: () => void;
};

type CuePickerProps = {
  /** What is being chosen, plural: "Beat Loops", "Pad Packs". Also names the search. */
  title: string;
  options: PickerOption[];
  /** The filters the drawer offers, in order. */
  facets?: PickerFacet[];
  /** The facet the chip row under the search is a shortcut into. */
  rowFacet?: string;
  selectedKey?: string;
  noneLabel?: string;
  onSelect: (key: string | undefined) => void;
  onClose?: () => void;
};

/** Every checked value per facet. Absent or empty means "not narrowed by it". */
type Filters = Record<string, string[]>;

const matchesFilters = (option: PickerOption, filters: Filters) =>
  Object.entries(filters).every(
    ([facet, values]) =>
      values.length === 0 || values.includes(option.facets?.[facet] ?? "")
  );

const matchesQuery = (option: PickerOption, query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [option.title, option.detail ?? "", ...Object.values(option.facets ?? {})].some(
    (field) => field.toLowerCase().includes(needle)
  );
};

const CuePicker = forwardRef<CuePickerHandle, CuePickerProps>(function CuePicker(
  { title, options, facets = [], rowFacet, selectedKey, noneLabel, onSelect, onClose },
  ref
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    present: () => {
      // Each opening starts from the whole catalogue: a filter left over from
      // choosing the last cue's loop would hide this one's.
      setQuery("");
      setFilters({});
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const renderBackdrop = useSheetBackdrop();

  // Each facet's values, from the options as they are. A facet with fewer
  // than two filters nothing, so it isn't offered.
  const values = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const facet of facets) {
      out[facet.key] = [
        ...new Set(
          options.flatMap((option) => {
            const value = option.facets?.[facet.key];
            return value ? [value] : [];
          })
        ),
      ].sort((a, b) => a.localeCompare(b));
    }
    return out;
  }, [options, facets]);
  const offered = facets.filter((facet) => (values[facet.key]?.length ?? 0) > 1);

  const shown = useMemo(
    () =>
      options.filter(
        (option) => matchesFilters(option, filters) && matchesQuery(option, query)
      ),
    [options, filters, query]
  );

  const checked = (facet: string) => filters[facet] ?? [];

  const toggle = (facet: string, value: string) =>
    setFilters((current) => {
      const set = current[facet] ?? [];
      return {
        ...current,
        [facet]: set.includes(value)
          ? set.filter((v) => v !== value)
          : [...set, value],
      };
    });

  const clearFacet = (facet: string) =>
    setFilters((current) => ({ ...current, [facet]: [] }));

  // What checking a value would show, held against the other facets and the
  // search -- the count Bits and the store give.
  const countFor = (facet: string, value: string) =>
    options.filter(
      (option) =>
        matchesFilters(option, { ...filters, [facet]: [value] }) &&
        matchesQuery(option, query)
    ).length;

  const active = offered.flatMap((facet) =>
    checked(facet.key).map((value) => ({ facet: facet.key, value }))
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
    ...active.map(({ facet, value }) => ({
      key: `${facet}:${value}`,
      label: value,
      onRemove: () => toggle(facet, value),
      accessibilityLabel: `Remove ${value} filter`,
    })),
  ];

  const sections: FilterSection[] = offered.map((facet) => ({
    key: facet.key,
    label: facet.label,
    kind: facet.chips ? "chips" : "list",
    options: values[facet.key].map((value) => ({
      value,
      count: countFor(facet.key, value),
    })),
    selected: checked(facet.key),
    onToggle: (value) => toggle(facet.key, value),
    onClear: () => clearFacet(facet.key),
  }));

  const row = offered.find((facet) => facet.key === rowFacet);

  const openFilters = () => {
    Keyboard.dismiss();
    setFiltersOpen(true);
  };

  const choose = (key: string | undefined) => {
    onSelect(key);
    sheetRef.current?.dismiss();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      maxDynamicContentSize={MAX_SHEET_HEIGHT}
      onDismiss={onClose}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={SHEET_BACKGROUND}
      handleIndicatorStyle={SHEET_HANDLE_INDICATOR}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={SHEET_CONTENT}
      >
        <Text className="mb-3 text-white font-satoshiBold text-title">
          {title}
        </Text>

        <View className="mb-3">
          {offered.length > 0 ? (
            <FilterBar
              search={
                <SearchField
                  InputComponent={BottomSheetTextInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={`Search ${title.toLowerCase()}`}
                  accessibilityLabel={`Search ${title.toLowerCase()}`}
                />
              }
              onOpen={openFilters}
              pills={pills}
            />
          ) : (
            <SearchField
              InputComponent={BottomSheetTextInput}
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${title.toLowerCase()}`}
              accessibilityLabel={`Search ${title.toLowerCase()}`}
            />
          )}
        </View>

        {/* The store's genre row: a shortcut into one drawer section, with
            the same ticks both ways. */}
        {/* {row && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
            className="mb-3"
          >
            <Chip
              label="All"
              selected={checked(row.key).length === 0}
              onPress={() => clearFacet(row.key)}
            />
            {values[row.key].map((value) => (
              <Chip
                key={value}
                label={value}
                selected={checked(row.key).includes(value)}
                onPress={() => toggle(row.key, value)}
              />
            ))}
          </ScrollView>
        )} */}

        {noneLabel && (
          <Row
            title={noneLabel}
            isSelected={!selectedKey}
            muted
            onPress={() => choose(undefined)}
          />
        )}

        {shown.map((option) => (
          <Row
            key={option.key}
            title={option.title}
            detail={option.detail}
            isSelected={selectedKey === option.key}
            onPress={() => choose(option.key)}
          />
        ))}

        {shown.length === 0 && (
          <Text className="mt-6 text-center text-label text-ink-muted font-satoshiRegular">
            {active.length > 0
              ? "Nothing matches this combination. Drop one of the filters above."
              : "Nothing matches that."}
          </Text>
        )}
      </BottomSheetScrollView>

      {/* A Modal of its own, so it opens over the sheet rather than inside it. */}
      <FilterDrawer
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={() => setFilters({})}
        resetDisabled={active.length === 0}
        sections={sections}
        resultLabel={`Show ${shown.length} ${shown.length === 1 ? "result" : "results"}`}
      />
    </BottomSheetModal>
  );
});

export default CuePicker;

function Row({
  title,
  detail,
  isSelected,
  muted,
  onPress,
}: {
  title: string;
  detail?: string;
  isSelected: boolean;
  muted?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={title}
      accessibilityState={{ selected: isSelected }}
      activeOpacity={0.8}
      className="flex-row items-center px-3 py-3 mb-2 border rounded-lg"
      style={{
        backgroundColor: isSelected ? COLORS.surface : "transparent",
        borderColor: isSelected ? COLORS.brand : COLORS.border,
      }}
    >
      <View className="flex-1">
        <Text
          className="text-body font-satoshiBold"
          numberOfLines={1}
          style={{ color: muted ? COLORS.textMuted : COLORS.white }}
        >
          {title}
        </Text>
        {detail && (
          <Text
            className="mt-0.5 text-micro text-ink-muted font-satoshiRegular"
            numberOfLines={1}
          >
            {detail}
          </Text>
        )}
      </View>

      {isSelected && <TickCircle size={18} color={COLORS.brand} />}
    </TouchableOpacity>
  );
}