import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { COLORS } from "../../constants/theme";

// Bottom navigation for the onboarding flow: Back on the left, page indicator
// in the middle, Next/Done on the right.
//
// Figma: 24pt icon boxes with a 1.5pt stroke at 30% white; labels are Satoshi
// Regular 13 in #9C9C9C. The indicator's active page is a 33x7 white pill and
// inactive pages are 7pt #9C9C9C dots, 8pt apart.

const ARROW_COLOR = COLORS.hairlineOnDark;
const MUTED = COLORS.textDim;

function Arrow({ direction }: { direction: "left" | "right" }) {
  // One path drawn pointing left, mirrored for the right variant.
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path
        d={direction === "left" ? "M19.5 12H5.5" : "M4.5 12H18.5"}
        stroke={ARROW_COLOR}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d={direction === "left" ? "M9.5 8L5.5 12L9.5 16" : "M14.5 8L18.5 12L14.5 16"}
        stroke={ARROW_COLOR}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function PageIndicator({ count, page }: { count: number; page: number }) {
  return (
    <View
      className="flex-row items-center gap-2"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: count, now: page + 1 }}
    >
      {Array.from({ length: count }).map((_, index) =>
        index === page ? (
          <View key={index} className="bg-white rounded-full h-[7px] w-[33px]" />
        ) : (
          <Svg key={index} width={7} height={7} viewBox="0 0 7 7">
            <Circle cx={3.5} cy={3.5} r={3.5} fill={MUTED} />
          </Svg>
        )
      )}
    </View>
  );
}

type OnboardingNavProps = {
  count: number;
  page: number;
  onBack: () => void;
  onNext: () => void;
  /** Label for the forward action -- "Next" on early pages, "Done" on the last. */
  nextLabel?: string;
};

export default function OnboardingNav({
  count,
  page,
  onBack,
  onNext,
  nextLabel = "Next",
}: OnboardingNavProps) {
  const canGoBack = page > 0;

  return (
    <View className="flex-row items-center justify-between px-8 py-3">
      {/* Kept mounted but invisible on the first page so the indicator stays
          centred rather than shifting when Back appears. */}
      <Pressable
        onPress={onBack}
        disabled={!canGoBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={{ opacity: canGoBack ? 1 : 0 }}
      >
        <View className="flex-row items-center">
          <Arrow direction="left" />
          <Text
            className="text-[13px] font-satoshiRegular tracking-wordmark"
            style={{ color: MUTED }}
          >
            Back
          </Text>
        </View>
      </Pressable>

      <PageIndicator count={count} page={page} />

      <Pressable
        onPress={onNext}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
      >
        <View className="flex-row items-center">
          <Text
            className="text-[13px] font-satoshiRegular tracking-wordmark"
            style={{ color: MUTED }}
          >
            {nextLabel}
          </Text>
          <Arrow direction="right" />
        </View>
      </Pressable>
    </View>
  );
}
