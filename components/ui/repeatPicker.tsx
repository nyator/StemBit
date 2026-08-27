import { useEffect, useRef } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";

import { COLORS, LAYOUT, SIZES } from "../../constants/theme";
import {
  REPEAT_CHOICES,
  repeatChoiceLabel,
  repeatDescription,
} from "../../constants/barGrid";
import {
  MAX_SHEET_HEIGHT,
  SHEET_BACKGROUND,
  SHEET_HANDLE_INDICATOR,
  useSheetBackdrop,
} from "./sheet";

// How many times a section plays before the song carries on.
//
// Every count laid out at once rather than stepped through. The badge on a
// section pad used to advance the count on each press, which put "8" seven taps
// from "1" -- each of them a press on a chip sitting inside the button that
// starts the song. Nine options fit on one screen, so picking the one you want
// is a single press whichever it is.
//
// A component of its own rather than another sheet inline on the performance
// screen, and that is the whole reason this file exists. Written inline it
// shared that screen's single `renderBackdrop` with the setlist sheet -- and
// useSheetBackdrop returns a memoised component that gorhom holds per modal, so
// two modals were handed the same one. The first sheet worked; this one opened
// onto nothing, which looked exactly like a button doing nothing at all.
//
// Every working sheet in this app is built this way: its own file, its own ref,
// its own backdrop, driven by a `visible` prop. See cuePicker, which this
// follows deliberately.

type RepeatPickerProps = {
  visible: boolean;
  /** Shown as the sheet's title, so it is clear which pad is being changed. */
  sectionName?: string;
  /** The count as it stands. See CueSection.repeats. */
  repeats?: number;
  onSelect: (repeats: number) => void;
  onClose: () => void;
};

export default function RepeatPicker({
  visible,
  sectionName,
  repeats,
  onSelect,
  onClose,
}: RepeatPickerProps) {
  const sheetRef = useRef<BottomSheetModal>(null);

  // The sheet is driven imperatively and the screen thinks in state, so the two
  // are bridged here rather than at the call site. Dismissing an already
  // dismissed sheet is a no-op, which makes this safe to run on any change.
  useEffect(() => {
    if (visible) {
      // TEMPORARY DIAGNOSTIC -- remove with the one in performance.tsx.
      // Separates "the sheet was never told to open" from "it opened and could
      // not be seen", which no amount of reading the code has settled.
      Alert.alert(
        "3. picker",
        sheetRef.current
          ? "ref is attached, calling present()"
          : "REF IS NULL -- the sheet is not mounted"
      );
      sheetRef.current?.present();
    } else sheetRef.current?.dismiss();
  }, [visible]);

  const renderBackdrop = useSheetBackdrop();

  // Only the choice is made here. Closing is left to onDismiss, which fires for
  // this and for the two ways out the user finds on their own.
  const choose = (choice: number) => {
    onSelect(choice);
    sheetRef.current?.dismiss();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      maxDynamicContentSize={MAX_SHEET_HEIGHT}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={SHEET_BACKGROUND}
      handleIndicatorStyle={SHEET_HANDLE_INDICATOR}
    >
      {/* Gorhom's scroll view, not React Native's -- the sheet and its content
          read the same vertical drag, and only this one hands the gesture back
          at the top so the sheet can still be pulled shut. */}
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: LAYOUT.screenPaddingX,
          paddingTop: 4,
          paddingBottom: 40,
        }}
      >
        <Text className="text-white font-satoshiBold text-title">
          {sectionName ?? "Section"}
        </Text>
        <Text className="mt-1 mb-4 text-micro text-ink-muted font-satoshiRegular">
          {repeatDescription(repeats)}
        </Text>

        <View className="flex-row flex-wrap">
          {REPEAT_CHOICES.map((choice) => {
            const selected = (repeats ?? 1) === choice;
            return (
              <TouchableOpacity
                key={choice}
                onPress={() => choose(choice)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={repeatDescription(choice)}
                accessibilityState={{ selected }}
                className="items-center justify-center mb-2 mr-2 border-2 rounded-lg"
                style={{
                  // Square and at the touch floor, so the whole grid is
                  // thumbable without looking.
                  width: SIZES.minTouch + 8,
                  height: SIZES.minTouch,
                  backgroundColor: selected ? COLORS.brand : "transparent",
                  borderColor: selected ? COLORS.brand : COLORS.border,
                }}
              >
                <Text
                  className="text-readout font-spaceBold"
                  style={{
                    color: selected ? COLORS.white : COLORS.textMuted,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {repeatChoiceLabel(choice)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text className="mt-4 text-micro text-ink-muted font-satoshiRegular">
          ∞ holds the section until you hit another pad. Anything else plays it
          that many times, then the song carries on. Takes effect the next time
          this pad is hit.
        </Text>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
