import { useCallback, useRef } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";

import { Information } from "../icons";
import { COLORS } from "../../constants/theme";
import { INFO_TOPICS, type InfoTopicKey } from "../../constants/infoCopy";

// The Information icons next to the instrument labels were decorative -- they
// rendered but had no press target. This makes them do the job the icon
// promises: tap one and a sheet explains the control it sits beside.
//
// Copy lives in constants/infoCopy.ts, not here, so the same control explained
// on two screens can't drift into two different explanations.
//
// Sizing is deliberately dynamic (enableDynamicSizing) rather than a fixed
// snap point like the time-signature picker uses: these topics differ a lot in
// length, and a fixed height would either clip the long ones or leave the short
// ones floating in empty space.

type InfoButtonProps = {
  topic: InfoTopicKey;
  size?: number;
  color?: string;
};

export default function InfoButton({
  topic,
  size = 16,
  color = COLORS.white,
}: InfoButtonProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const { title, body, points } = INFO_TOPICS[topic];

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.7}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <>
      <TouchableOpacity
        onPress={() => sheetRef.current?.present()}
        accessibilityRole="button"
        // The label has to name the control, not just say "info" -- with four
        // of these on screen, a bare "More information" tells a screen reader
        // user nothing about which one they've landed on.
        accessibilityLabel={`About ${title}`}
        accessibilityHint="Opens an explanation of this control"
        // The icon is 16px, well under the 44px minimum touch target, so the
        // press area is padded out without disturbing the row's layout.
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.6}
      >
        <Information size={size} color={color} />
      </TouchableOpacity>

      <BottomSheetModal
        ref={sheetRef}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: "#090B10",
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
        }}
        handleIndicatorStyle={{
          backgroundColor: "rgba(255,255,255,0.4)",
          width: 48,
        }}
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: 44,
          }}
        >
          <Text className="mb-3 text-white text-2xl font-spaceBold">
            {title}
          </Text>

          <Text className="text-base leading-6 text-white/70 font-satoshiRegular">
            {body}
          </Text>

          {points && (
            <View className="mt-6 gap-4">
              {points.map((point) => (
                <View key={point.term} className="flex-row gap-3">
                  {/* Fixed-width term column so the details line up down the
                      sheet instead of starting at a different x per row. */}
                  <Text
                    style={{ width: 62 }}
                    className="text-sm text-white font-spaceBold"
                  >
                    {point.term}
                  </Text>
                  <Text className="flex-1 text-sm leading-5 text-white/60 font-satoshiRegular">
                    {point.detail}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  );
}
