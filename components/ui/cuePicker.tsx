import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
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

const SEARCH_FROM = 8;

export type PickerOption = {
  key: string;
  title: string;
  detail?: string;
  group?: string;
};

export type CuePickerHandle = {
  present: () => void;
  dismiss: () => void;
};

type CuePickerProps = {
  /** What is being chosen: "Loop", "Pad". */
  title: string;
  options: PickerOption[];
  selectedKey?: string;
  noneLabel?: string;
  onSelect: (key: string | undefined) => void;
  onClose?: () => void;
};

const CuePicker = forwardRef<CuePickerHandle, CuePickerProps>(function CuePicker(
  { title, options, selectedKey, noneLabel, onSelect, onClose },
  ref
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    present: () => {
      setQuery("");
      setGroup(null);
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

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
      return (
        option.title.toLowerCase().includes(needle) ||
        (option.detail?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [options, group, query]);

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

        {options.length >= SEARCH_FROM && (
          <BrandInput
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