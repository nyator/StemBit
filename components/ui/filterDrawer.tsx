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
import { BrandButton } from "./brandButton";
import GlassSurface from "./glassSurface";
import NavButton, { NAV_BUTTON_FOOTPRINT } from "./navButton";

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
  /**
   * One value, always set -- a sort rather than a filter. Picking it returns to
   * the list of rows, the way eBay's Sort does, since there's nothing else to
   * do in there; and there's no "All" chip, because there's no unset.
   */
  single?: boolean;
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
  section.single
    ? (section.selected[0] ?? "")
    : section.selected.length === 0
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
          {/* The header's own back button, glass and all. */}
          <NavButton
            icon={openSection ? ArrowLeft : Close}
            onPress={openSection ? () => setOpenKey(null) : onClose}
            accessibilityLabel={openSection ? "Back to all filters" : "Close filters"}
          />
          <Text
            className="flex-1 text-white font-satoshiBold text-title"
            numberOfLines={1}
          >
            {openSection ? openSection.label : "Filter"}
          </Text>
          {openSection ? (
            // A sort has no "nothing"; its Clear would only be a second way to
            // pick the default, so it has none.
            !openSection.single && (
              <GlassPill
                label="Clear"
                onPress={openSection.onClear}
                disabled={openSection.selected.length === 0}
              />
            )
          ) : (
            <GlassPill label="Reset" onPress={onReset} disabled={resetDisabled} />
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
                  single={openSection.single}
                  selected={openSection.selected.includes(option.value)}
                  onPress={() => {
                    openSection.onToggle(option.value);
                    if (openSection.single) setOpenKey(null);
                  }}
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
          <BrandButton label={resultLabel} onPress={onClose} />
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
        {!section.single && (
          <Chip
            label="All"
            selected={section.selected.length === 0}
            onPress={section.onClear}
          />
        )}
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
  single,
  selected,
  onPress,
}: {
  option: FilterOption;
  single?: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole={single ? "radio" : "checkbox"}
      accessibilityState={{ checked: selected }}
      activeOpacity={0.7}
      className="flex-row items-center py-4 border-b border-white/10 gap-3"
    >
      <Text
        className="flex-1 text-body font-satoshiMedium"
        style={{ color: selected ? COLORS.brand : COLORS.white,  }}
        numberOfLines={1}
      >
        {option.value}
      </Text>
      {option.count !== undefined && (
        <Text className="text-ink-muted text-overline font-satoshiRegular">
          {option.count}
        </Text>
      )}
      {/* <View
        className="items-center justify-center rounded-full"
        style={{
          width: 18,
          height: 18,
          backgroundColor: selected ? COLORS.brand : "transparent",
          borderWidth: selected ? 0 : 1.5,
          borderColor: COLORS.borderGlass,
        }}
      >
        {selected && <TickCircle size={14} color={COLORS.white} />}
      </View> */}
    </TouchableOpacity>
  );
}

// Reset / Clear. A glass pill, as tall as the NavButton beside the title.
function GlassPill({
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
      accessibilityState={{ disabled: !!disabled }}
      activeOpacity={0.7}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <GlassSurface
        style={{
          height: NAV_BUTTON_FOOTPRINT,
          borderRadius: NAV_BUTTON_FOOTPRINT / 2,
          paddingHorizontal: 20,
          justifyContent: "center",
        }}
      >
        <Text className="text-white text-label font-satoshiBold">{label}</Text>
      </GlassSurface>
    </TouchableOpacity>
  );
}
