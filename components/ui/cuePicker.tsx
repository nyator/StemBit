import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";

import { COLORS } from "../../constants/theme";
import { TickCircle } from "../icons";
import { BrandInput } from "./brandInput";
import Chip from "./chip";
import {
  MAX_SHEET_HEIGHT,
  SHEET_BACKGROUND,
  SHEET_CONTENT,
  SHEET_HANDLE_INDICATOR,
  useSheetBackdrop,
} from "./sheet";

// Choosing one thing out of a catalog, for the cue editor.
//
// This replaced a wrapped row of chips, one per option. Chips are right for a
// closed set you can take in at a glance -- major or minor, one of twelve keys
// -- and wrong the moment the set can grow, which the loop catalog can: it ships
// with a handful and the user imports as many more as they like. At twenty loops
// the chips were eight rows of wrapped text pushing everything else off the
// screen, with no way to find one except to read all of them.
//
// So the choice collapses to a row showing what is currently chosen, and the
// catalog moves into a sheet that can afford to be a list. The sheet earns its
// extra tap by doing the things a wall of chips cannot: filter by category,
// search by name, and give each option's details a line of their own rather
// than compressing them into a label.
//
// It's a @gorhom/bottom-sheet modal, the same one the metronome hints, the
// session form and the loop picker use -- so everything that comes up from the
// bottom of this app slides, dims and drags away identically. A plain Modal got
// the layout right and none of that: no handle to pull, no rubber-banding, and
// a backdrop that dimmed by a different amount to every other sheet in the app.
//
// Sized to its content rather than to a fixed snap point, capped at most of the
// screen. Five pad packs get a short sheet and twenty loops get a tall one that
// scrolls, where a fixed height would have left the short list floating in an
// empty sheet.

/** Below this many options, finding one by eye beats typing. */
const SEARCH_FROM = 8;

export type PickerOption = {
  key: string;
  title: string;
  /** The line underneath -- artist, tempo, whatever tells two apart. */
  detail?: string;
  /** What the filter chips group by. Absent means it isn't filterable. */
  group?: string;
};

type CuePickerProps = {
  visible: boolean;
  /** What is being chosen: "Loop", "Pad". */
  title: string;
  options: PickerOption[];
  selectedKey?: string;
  /**
   * The row that clears the choice. Absent makes the choice required -- there
   * is no way to pick nothing.
   */
  noneLabel?: string;
  onSelect: (key: string | undefined) => void;
  /**
   * Called however the sheet goes away -- a choice, a drag down, a tap on the
   * backdrop. The caller owns `visible`, so it has to hear about the two of
   * those it didn't ask for.
   */
  onClose: () => void;
};

export default function CuePicker({
  visible,
  title,
  options,
  selectedKey,
  noneLabel,
  onSelect,
  onClose,
}: CuePickerProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);

  // The sheet is driven imperatively and this screen thinks in state, so the
  // two are bridged here rather than at every call site. Dismissing when it is
  // already dismissed is a no-op, which is what makes this safe to run on any
  // change.
  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  // A sheet opened again is opened fresh. Last time's search left in the field
  // would show a filtered catalog that looks like a catalog with things missing.
  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setGroup(null);
  }, [visible]);

  const renderBackdrop = useSheetBackdrop();

  const groups = useMemo(() => {
    const seen: string[] = [];
    for (const option of options) {
      if (option.group && !seen.includes(option.group)) seen.push(option.group);
    }
    return seen;
  }, [options]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options.filter((option) => {
      if (group && option.group !== group) return false;
      if (!needle) return true;
      // Detail as well as title, so "Stembit" or "96" finds a loop the same way
      // its name does -- which is how people actually remember them.
      return (
        option.title.toLowerCase().includes(needle) ||
        (option.detail?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [options, group, query]);

  // Only the choice is made here. Closing is left to onDismiss, which fires for
  // this and for the two ways out the user finds on their own.
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
      // The search field lives in here, so the sheet has to ride the keyboard
      // rather than sit under it.
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      // Without this Android pans the whole window instead of resizing it, and
      // the sheet has no room to move into.
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={SHEET_BACKGROUND}
      handleIndicatorStyle={SHEET_HANDLE_INDICATOR}
    >
      {/* Gorhom's scroll view, not React Native's: the sheet and the list are
          both reading the same vertical drag, and only this one hands the
          gesture back at the top of its content so the sheet can be pulled
          shut. A plain ScrollView here swallows it and the sheet won't drag. */}
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={SHEET_CONTENT}
      >
        <Text className="mb-3 text-white font-satoshiBold text-title">
          {title}
        </Text>

        {options.length >= SEARCH_FROM && (
          <BrandInput
            // Gorhom's input, not React Native's: the sheet only lifts itself
            // clear of the keyboard for fields it can see the focus of.
            InputComponent={BottomSheetTextInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            autoCorrect={false}
            returnKeyType="search"
          />
        )}

        {groups.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
            className="mb-3"
          >
            <Chip
              label="All"
              selected={group === null}
              onPress={() => setGroup(null)}
            />
            {groups.map((entry) => (
              <Chip
                key={entry}
                label={entry}
                selected={group === entry}
                onPress={() => setGroup(entry)}
              />
            ))}
          </ScrollView>
        )}

        {/* Clearing sits at the top rather than at the bottom of a list that
            scrolls: "take this off the cue" is a decision about the cue, not
            the last of the things you could put on it. */}
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
            Nothing matches that.
          </Text>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

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
  /** The clear row, which is an absence rather than a thing. */
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
