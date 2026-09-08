import { forwardRef, useImperativeHandle, useRef } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";

import { COLORS, SIZES } from "../../constants/theme";
import {
  REPEAT_CHOICES,
  repeatChoiceLabel,
  repeatDescription,
} from "../../constants/barGrid";
import {
  SHEET_BACKGROUND,
  SHEET_CONTENT,
  SHEET_HANDLE_INDICATOR,
  useSheetBackdrop,
} from "./sheet";

export type RepeatPickerHandle = {
  present: () => void;
  dismiss: () => void;
};

type RepeatPickerProps = {
  /** Shown as the sheet's title, so it is clear which pad is being changed. */
  sectionName?: string;
  /** The count as it stands. See CueSection.repeats. */
  repeats?: number;
  onSelect: (repeats: number) => void;
  onClose: () => void;
};

const RepeatPicker = forwardRef<RepeatPickerHandle, RepeatPickerProps>(
  function RepeatPicker({ sectionName, repeats, onSelect, onClose }, handleRef) {
    const sheetRef = useRef<BottomSheetModal>(null);

    useImperativeHandle(handleRef, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const renderBackdrop = useSheetBackdrop();

    const choose = (choice: number) => {
      onSelect(choice);
      sheetRef.current?.dismiss();
    };

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["45%"]}
        enableDynamicSizing={false}
        onDismiss={onClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={SHEET_BACKGROUND}
        handleIndicatorStyle={SHEET_HANDLE_INDICATOR}
      >
        <BottomSheetScrollView contentContainerStyle={SHEET_CONTENT}>
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