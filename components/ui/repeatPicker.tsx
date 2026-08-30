import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";

import { COLORS, LAYOUT, SIZES } from "../../constants/theme";
import {
  REPEAT_CHOICES,
  repeatChoiceLabel,
  repeatDescription,
} from "../../constants/barGrid";
import {
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
// Every working sheet in this app shares this chrome: its own file, its own
// ref, its own backdrop. See cuePicker.
//
// PRESENT IS CALLED BY THE CALLER, NOT FROM AN EFFECT HERE. It used to be:
// this sheet watched a `visible` prop and called present() from a `useEffect`
// reacting to it, the same as every gorhom sheet in the codebase. Under this
// app's specific Reanimated 4 / Worklets 0.5.1 combo, that indirection is the
// actual bug -- present() called one render after the press that asked for it
// never animates at all (no error, no onChange, nothing), where present()
// called synchronously inside the original press handler works every time.
// metro.tsx's time-signature sheet does the direct call and has never shown
// the bug; every sheet on the performance screen did the deferred one and
// always did. So the caller now holds this ref and calls .present() itself,
// in the same handler that decides to open it -- see openRepeats in
// performance.tsx.
export type RepeatPickerHandle = {
  present: () => void;
};

type RepeatPickerProps = {
  visible: boolean;
  /** Shown as the sheet's title, so it is clear which pad is being changed. */
  sectionName?: string;
  /** The count as it stands. See CueSection.repeats. */
  repeats?: number;
  onSelect: (repeats: number) => void;
  onClose: () => void;
};

const RepeatPicker = forwardRef<RepeatPickerHandle, RepeatPickerProps>(
  function RepeatPicker({ visible, sectionName, repeats, onSelect, onClose }, handleRef) {
    const sheetRef = useRef<BottomSheetModal>(null);

    useImperativeHandle(handleRef, () => ({
      present: () => sheetRef.current?.present(),
    }));

    // Dismissing still follows `visible` going false -- closing by another
    // route (the section it points at disappearing, say) still has to take
    // the sheet down. Only presenting moved to the caller.
    useEffect(() => {
      if (!visible) sheetRef.current?.dismiss();
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
        // enableDynamicSizing defaults to true in @gorhom/bottom-sheet even
        // when snapPoints is set -- it has to be turned off explicitly. See
        // metro.tsx's time signature sheet, which does the same.
        snapPoints={["45%"]}
        enableDynamicSizing={false}
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
);

export default RepeatPicker;
