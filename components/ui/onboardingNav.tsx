import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import Animated, {
  clamp,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

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

// A worm rather than a snap: the active pill crawls and elastically stretches
// toward whichever dot you're dragging past, instead of jumping there the
// instant a page settles. The dots underneath never change -- every one of
// them is drawn at the plain inactive size, and the pill is a single overlay
// riding on top, which is what lets it move continuously between them rather
// than teleporting from one dot's slot to the next.
const DOT_SIZE = 7;
const DOT_GAP = 8;
const DOT_STEP = DOT_SIZE + DOT_GAP;
const PILL_WIDTH = 33;
// How much wider than PILL_WIDTH the pill gets at the midpoint of a crawl --
// enough to read as elastic, not so much it looks like a different shape.
const PILL_STRETCH = 14;

function PageIndicator({
  count,
  page,
  scrollX,
  pageWidth,
}: {
  count: number;
  page: number;
  /** The carousel's raw scroll offset, in px -- not the settled page. */
  scrollX: SharedValue<number>;
  /** One page's width, to turn that offset into a page position. */
  pageWidth: number;
}) {
  const trackWidth = count * DOT_SIZE + (count - 1) * DOT_GAP;

  const pillStyle = useAnimatedStyle(() => {
    const raw = pageWidth > 0 ? scrollX.value / pageWidth : 0;
    const p = clamp(raw, 0, count - 1);
    const frac = p - Math.floor(p);
    // Widest exactly halfway between two dots, back to resting width once
    // it's landed on either one -- continuous, so it never pops or jumps.
    const stretch = Math.sin(frac * Math.PI) * PILL_STRETCH;
    const width = PILL_WIDTH + stretch;
    const centerX = p * DOT_STEP + DOT_SIZE / 2;
    return { width, transform: [{ translateX: centerX - width / 2 }] };
  });

  return (
    <View
      style={{ width: trackWidth, height: DOT_SIZE }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: count, now: page + 1 }}
    >
      <View className="absolute flex-row items-center" style={{ gap: DOT_GAP }}>
        {Array.from({ length: count }).map((_, index) => (
          <Svg key={index} width={DOT_SIZE} height={DOT_SIZE} viewBox="0 0 7 7">
            <Circle cx={3.5} cy={3.5} r={3.5} fill={MUTED} />
          </Svg>
        ))}
      </View>
      <Animated.View
        className="absolute bg-white rounded-full"
        style={[{ height: DOT_SIZE }, pillStyle]}
      />
    </View>
  );
}

type OnboardingNavProps = {
  count: number;
  page: number;
  /** The carousel's raw scroll offset, driving the worm indicator. */
  scrollX: SharedValue<number>;
  /** One page's width, to turn that offset into a page position. */
  pageWidth: number;
  onBack: () => void;
  onNext: () => void;
  /** Label for the forward action -- "Next" on early pages, "Done" on the last. */
  nextLabel?: string;
};

export default function OnboardingNav({
  count,
  page,
  scrollX,
  pageWidth,
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
            className="text-label font-satoshiRegular tracking-wordmark"
            style={{ color: MUTED }}
          >
            Back
          </Text>
        </View>
      </Pressable>

      <PageIndicator count={count} page={page} scrollX={scrollX} pageWidth={pageWidth} />

      <Pressable
        onPress={onNext}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
      >
        <View className="flex-row items-center">
          <Text
            className="text-label font-satoshiRegular tracking-wordmark"
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
