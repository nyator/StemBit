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

    // The infinite/hold option isn't really a peer of "play it 4 times" — it's
    // a different mode entirely (hold vs. count-then-continue), so it gets
    // pulled out of the number grid and given its own row rather than
    // competing for space as just another square.
    const numericChoices = REPEAT_CHOICES.filter(
      (choice) => repeatChoiceLabel(choice) !== "∞"
    );
    const infiniteChoice = REPEAT_CHOICES.find(
      (choice) => repeatChoiceLabel(choice) === "∞"
    );
    const selectedValue = repeats ?? 1;
    const isInfiniteSelected =
      infiniteChoice !== undefined && selectedValue === infiniteChoice;

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
          <Text className="mt-1 text-micro text-ink-muted font-satoshiRegular">
            {repeatDescription(repeats)}
          </Text>

          <View
            style={{
              height: 1,
              backgroundColor: "rgba(255,255,255,0.08)",
              marginTop: 14,
              marginBottom: 16,
            }}
          />

          <Text
            className="font-spaceBold"
            style={{
              fontSize: 10,
              letterSpacing: 1.5,
              color: COLORS.textMuted,
              marginBottom: 10,
            }}
          >
            PLAY THIS MANY TIMES
          </Text>

          <View className="flex-row flex-wrap">
            {numericChoices.map((choice) => {
              const selected = selectedValue === choice;
              return (
                <TouchableOpacity
                  key={choice}
                  onPress={() => choose(choice)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={repeatDescription(choice)}
                  accessibilityState={{ selected }}
                  className="items-center justify-center mb-2 mr-2 rounded-xl"
                  style={{
                    width: SIZES.minTouch + 8,
                    height: SIZES.minTouch,
                    backgroundColor: selected
                      ? COLORS.brand
                      : "rgba(255,255,255,0.04)",
                    borderWidth: 1.5,
                    borderColor: selected ? COLORS.brand : COLORS.border,
                    shadowColor: COLORS.brand,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: selected ? 0.35 : 0,
                    shadowRadius: 6,
                    elevation: selected ? 3 : 0,
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

          {infiniteChoice !== undefined && (
            <TouchableOpacity
              onPress={() => choose(infiniteChoice)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={repeatDescription(infiniteChoice)}
              accessibilityState={{ selected: isInfiniteSelected }}
              className="flex-row items-center mt-4 rounded-xl"
              style={{
                padding: 14,
                backgroundColor: isInfiniteSelected
                  ? COLORS.brand
                  : "rgba(255,255,255,0.04)",
                borderWidth: 1.5,
                borderColor: isInfiniteSelected ? COLORS.brand : COLORS.border,
              }}
            >
              <View
                className="items-center justify-center mr-3 rounded-lg"
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: isInfiniteSelected
                    ? "rgba(0,0,0,0.15)"
                    : "rgba(255,255,255,0.06)",
                }}
              >
                <Text
                  className="font-spaceBold"
                  style={{
                    fontSize: 20,
                    color: isInfiniteSelected ? COLORS.white : COLORS.textMuted,
                  }}
                >
                  ∞
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  className="font-satoshiBold text-body"
                  style={{ color: isInfiniteSelected ? COLORS.white : COLORS.white }}
                >
                  Hold section
                </Text>
                <Text
                  className="text-micro font-satoshiRegular mt-0.5"
                  style={{
                    color: isInfiniteSelected
                      ? "rgba(0,0,0,0.6)"
                      : COLORS.textMuted,
                  }}
                >
                  Loops until you hit another pad
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <View
            className="flex-row mt-5 rounded-xl"
            style={{
              padding: 12,
              backgroundColor: "rgba(255,255,255,0.03)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.06)",
            }}
          >
            <Text
              className="text-micro text-ink-muted font-satoshiRegular"
              style={{ flex: 1, lineHeight: 17 }}
            >
              Anything other than hold plays the section that many times, then
              the song carries on. Takes effect the next time this pad is hit.
            </Text>
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

export default RepeatPicker;