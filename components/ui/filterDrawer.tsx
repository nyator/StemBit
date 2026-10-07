import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SIZES } from "../../constants/theme";
import { ArrowLeft, ArrowRight, Close, TickCircle } from "../icons";

// A filter panel that slides in from the right over a dimmed screen, the way
// eBay's does: one row per filter showing what it's currently set to, a tap
// on a row drills into its values, and "Show N results" pinned to the bottom
// so the effect of every change is a number you can see before you leave.
//
// Rows rather than every value laid out at once: a long axis (artists) would
// otherwise push the short ones off the bottom, and a row that reads "All" or
// "Worship, Afro" says what's set without opening anything. An axis with only a
// handful of values can be shown as chips under its label instead, where one
// tap beats two.

const PANEL_WIDTH = Math.min(Dimensions.get("window").width * 0.82, 420);
const SLIDE_MS = 240;

export type FilterOption = { value: string; count?: number };

export type FilterSection = {
  key: string;
  label: string;
  /** "list" drills into its values; "chips" shows them inline. */
  kind: "list" | "chips";
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
};

type FilterDrawerProps = {
  visible: boolean;
  onClose: () => void;
  onReset: () => void;
  /** Nothing is set, so Reset has nothing to do. */
  resetDisabled?: boolean;
  sections: FilterSection[];
  /** The footer button's text, e.g. "Show 12 results". */
  resultLabel: string;
};

const summaryOf = (section: FilterSection) =>
  section.selected.length === 0
    ? "All"
    : section.selected.length <= 2
      ? section.selected.join(", ")
      : `${section.selected.length} selected`;

export default function FilterDrawer({
  visible,
  onClose,
  onReset,
  resetDisabled,
  sections,
  resultLabel,
}: FilterDrawerProps) {
  const insets = useSafeAreaInsets();
  // Stays mounted through the slide out; the Modal only goes away once the
  // panel is off screen.
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  /** The section drilled into, or null for the list of rows. */
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setOpenKey(null);
    }
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: SLIDE_MS,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);

  if (!mounted) return null;

  const openSection = sections.find((section) => section.key === openKey);

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={openSection ? () => setOpenKey(null) : onClose}
    >
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          opacity: progress,
        }}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close filters"
        />
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: PANEL_WIDTH,
          backgroundColor: COLORS.surfaceSheet,
          borderTopLeftRadius: 24,
          borderBottomLeftRadius: 24,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 12,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [PANEL_WIDTH, 0],
              }),
            },
          ],
        }}
      >
        {/* Header: close (or back, inside a section), the title, Reset. */}
        <View className="flex-row items-center px-5 pb-4 gap-3">
          <CircleButton
            onPress={openSection ? () => setOpenKey(null) : onClose}
            accessibilityLabel={openSection ? "Back to all filters" : "Close filters"}
          >
            {openSection ? (
              <ArrowLeft size={20} color={COLORS.white} />
            ) : (
              <Close size={18} color={COLORS.white} />
            )}
          </CircleButton>
          <Text
            className="flex-1 text-white font-satoshiBold text-title"
            numberOfLines={1}
          >
            {openSection ? openSection.label : "Filter"}
          </Text>
          {openSection ? (
            <OutlinePill
              label="Clear"
              onPress={openSection.onClear}
              disabled={openSection.selected.length === 0}
            />
          ) : (
            <OutlinePill label="Reset" onPress={onReset} disabled={resetDisabled} />
          )}
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {openSection
            ? openSection.options.map((option) => (
                <OptionRow
                  key={option.value}
                  option={option}
                  selected={openSection.selected.includes(option.value)}
                  onPress={() => openSection.onToggle(option.value)}
                />
              ))
            : sections.map((section) =>
                section.kind === "chips" ? (
                  <ChipSection key={section.key} section={section} />
                ) : (
                  <TouchableOpacity
                    key={section.key}
                    onPress={() => setOpenKey(section.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`${section.label}, ${summaryOf(section)}`}
                    activeOpacity={0.7}
                    className="flex-row items-center py-5 border-b border-white/10 gap-3"
                  >
                    <Text className="text-white text-body font-satoshiMedium">
                      {section.label}
                    </Text>
                    <Text
                      className="flex-1 text-right text-body font-satoshiRegular"
                      style={{
                        color:
                          section.selected.length > 0
                            ? COLORS.brand
                            : COLORS.textMuted,
                      }}
                      numberOfLines={1}
                    >
                      {summaryOf(section)}
                    </Text>
                    <ArrowRight size={18} color={COLORS.white} />
                  </TouchableOpacity>
                )
              )}
        </ScrollView>

        <View className="px-5 pt-3 border-t border-white/10">
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            activeOpacity={0.85}
            className="items-center justify-center rounded-full bg-brand"
            style={{ height: 56 }}
          >
            <Text className="text-white text-body font-spaceBold">
              {resultLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

function ChipSection({ section }: { section: FilterSection }) {
  return (
    <View className="py-5 border-b border-white/10">
      <Text className="mb-3 text-white text-body font-satoshiMedium">
        {section.label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {/* "All" is the axis left un-narrowed, as on eBay's All Listings. */}
        <Chip
          label="All"
          selected={section.selected.length === 0}
          onPress={section.onClear}
        />
        {section.options.map((option) => (
          <Chip
            key={option.value}
            label={option.value}
            selected={section.selected.includes(option.value)}
            onPress={() => section.onToggle(option.value)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      activeOpacity={0.75}
      className="justify-center px-5 border rounded-full"
      style={{
        height: SIZES.minTouch,
        backgroundColor: selected ? COLORS.white : "transparent",
        borderColor: selected ? COLORS.white : COLORS.borderGlass,
      }}
    >
      <Text
        className="text-label font-satoshiMedium"
        style={{ color: selected ? COLORS.black : COLORS.white }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function OptionRow({
  option,
  selected,
  onPress,
}: {
  option: FilterOption;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      activeOpacity={0.7}
      className="flex-row items-center py-4 border-b border-white/10 gap-3"
    >
      <Text
        className="flex-1 text-body font-satoshiMedium"
        style={{ color: selected ? COLORS.brand : COLORS.white }}
        numberOfLines={1}
      >
        {option.value}
      </Text>
      {option.count !== undefined && (
        <Text className="text-ink-muted text-overline font-satoshiRegular">
          {option.count}
        </Text>
      )}
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: 22,
          height: 22,
          backgroundColor: selected ? COLORS.brand : "transparent",
          borderWidth: selected ? 0 : 1.5,
          borderColor: COLORS.borderGlass,
        }}
      >
        {selected && <TickCircle size={14} color={COLORS.white} />}
      </View>
    </TouchableOpacity>
  );
}

function CircleButton({
  onPress,
  accessibilityLabel,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="items-center justify-center border rounded-full"
      style={{
        width: SIZES.minTouch,
        height: SIZES.minTouch,
        borderColor: COLORS.borderGlass,
      }}
    >
      {children}
    </TouchableOpacity>
  );
}

function OutlinePill({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className="justify-center px-5 border rounded-full"
      style={{
        height: SIZES.minTouch,
        borderColor: COLORS.borderGlass,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text className="text-white text-label font-satoshiBold">{label}</Text>
    </TouchableOpacity>
  );
}
