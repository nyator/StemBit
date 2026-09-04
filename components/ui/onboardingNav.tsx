import { Pressable, Text, View } from "react-native";

import { COLORS } from "../../constants/theme";

// Bottom navigation for the onboarding flow: Back on the left, Next on the
// right, plain text -- no arrow glyphs. The page indicator that used to sit
// between them now lives at the top of the screen instead (a segmented bar,
// alongside the wordmark and Skip), so this is just the two actions. Not
// shown at all on the last slide, where Get Started is the only action.
const MUTED = COLORS.textDim;

type OnboardingNavProps = {
  page: number;
  onBack: () => void;
  onNext: () => void;
};

export default function OnboardingNav({ page, onBack, onNext }: OnboardingNavProps) {
  const canGoBack = page > 0;

  return (
    <View className="flex-row items-center justify-between px-8 py-3">
      {/* Kept mounted but invisible on the first page, rather than not
          rendered, so Next doesn't shift when Back appears. */}
      <Pressable
        onPress={onBack}
        disabled={!canGoBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={{ opacity: canGoBack ? 1 : 0 }}
      >
        <Text
          className="text-label font-satoshiRegular tracking-wordmark"
          style={{ color: MUTED }}
        >
          Back
        </Text>
      </Pressable>

      <Pressable
        onPress={onNext}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Next"
      >
        <Text
          className="text-label font-satoshiRegular tracking-wordmark"
          style={{ color: MUTED }}
        >
          Next
        </Text>
      </Pressable>
    </View>
  );
}
