import { useRef, useState } from "react";
import {
  Pressable,
  View,
  Text,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  Easing,
  Extrapolation,
  FadeInUp,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import { usePreferences } from "../../context/PreferencesContext";
import Screen, { GLOW_PLACEMENTS } from "../../components/ui/screen";
import PulsingGlow from "../../components/ui/pulsingGlow";
import OnboardingProgressBar from "../../components/ui/onboardingProgressBar";
import OnboardingSquircleButton from "../../components/ui/onboardingSquircleButton";
import OnboardingIllustration, {
  type IllustrationAccent,
} from "../../components/ui/onboardingIllustration";
import { BrandButton } from "../../components/ui/brandButton";
import { COLORS } from "../../constants/theme";
import {
  Clipboard,
  Loop,
  MetronomeFill,
  Musicnote,
  PadFill,
  PlayCircle,
  type IconComponent,
} from "../../components/icons";

// First-launch onboarding: swipeable feature slides, shown once (the seen
// flag persists via PreferencesContext; app/index.tsx routes past this for
// returning users).
//
// Layout follows a referenced travel-app carousel -- wordmark and Skip up
// top, one illustration, a bold two-line headline with one phrase in the
// brand colour, and a floating squircle button for Next -- recoloured for
// this app's own dark canvas rather than the reference's per-slide colour
// blocks, and illustrated with this app's own icon set rather than the
// reference's photoreal renders.
type TitleSegment = { text: string; highlight?: boolean };

const SLIDES: {
  id: string;
  title: TitleSegment[];
  subtitle: string;
  icon: IconComponent;
  accents: IllustrationAccent[];
}[] = [
  {
    id: "loops",
    title: [{ text: "Loops that never " }, { text: "stumble", highlight: true }],
    subtitle:
      "Backing loops for worship, praise and funk — looped sample-accurately, warped to any tempo without changing key.",
    icon: Loop,
    accents: [
      { icon: Musicnote, size: 26, top: "12%", left: "68%", rotate: "12deg" },
      { icon: Musicnote, size: 18, top: "70%", left: "22%", rotate: "-10deg" },
    ],
  },
  {
    id: "tools",
    title: [{ text: "Your " }, { text: "practice toolkit", highlight: true }],
    subtitle:
      "A rock-solid metronome with real meter accents, tap tempo, and sustained pads in every key — everything on one dark, stage-ready screen.",
    icon: MetronomeFill,
    accents: [
      { icon: PadFill, size: 24, top: "14%", left: "24%", rotate: "-8deg" },
      { icon: Musicnote, size: 18, top: "68%", left: "70%", rotate: "10deg" },
    ],
  },
  {
    id: "sessions",
    title: [{ text: "Built for " }, { text: "the show", highlight: true }],
    subtitle:
      "Turn your set into a session: an ordered list of loops you can fire instantly between songs. Rehearse it, then play it.",
    icon: Clipboard,
    accents: [
      { icon: PlayCircle, size: 26, top: "14%", left: "66%", rotate: "0deg" },
      { icon: Musicnote, size: 18, top: "70%", left: "24%", rotate: "-14deg" },
    ],
  },
];

/** Clears the illustration's own 128pt badge with room for the accents
 *  floating around it. */
const ILLUSTRATION_HEIGHT = 220;

type Slide = (typeof SLIDES)[number];

// One slide's own motion, derived from how far the shared scroll position is
// from ITS index -- 0 dead centre, ±1 a full page away in either direction.
// Everything here is a continuous function of that distance, so it tracks a
// slow drag exactly as smoothly as it resolves a fast flick; there's no
// separate "page changed" trigger to keep in sync with it.
function OnboardingSlide({
  item,
  index,
  width,
  scrollX,
}: {
  item: Slide;
  index: number;
  width: number;
  scrollX: SharedValue<number>;
}) {
  // Each style's own worklet computes the distance itself, rather than all
  // three calling one shared closure -- a worklet runs on its own UI-thread
  // runtime, and a plain JS function defined in component scope isn't
  // automatically usable from inside one just because it's in the same file.

  const illustrationStyle = useAnimatedStyle(() => {
    const d = scrollX.value / width - index;
    const scale = interpolate(d, [-1, 0, 1], [0.85, 1, 0.85], Extrapolation.CLAMP);
    const opacity = interpolate(d, [-0.7, 0, 0.7], [0, 1, 0], Extrapolation.CLAMP);
    return { opacity, transform: [{ scale }] };
  });

  // The pair peaks at the same point -- d=0, dead centre, which is where
  // paging actually comes to rest -- so neither is ever less than fully
  // visible while the carousel is sitting still. The "lag" is a narrower
  // range around that same centre, not a shifted one: subtitle stays
  // invisible longer while entering, then closes the gap faster to still
  // land at full opacity by d=0, and by the same logic fades out faster on
  // the way out. A shifted peak reads as lag too, but leaves the resting
  // state visibly translucent, which is the bug version of this idea.
  const titleStyle = useAnimatedStyle(() => {
    const d = scrollX.value / width - index;
    return {
      opacity: interpolate(d, [-0.6, 0, 0.6], [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(d, [-0.6, 0, 0.6], [16, 0, 16], Extrapolation.CLAMP) },
      ],
    };
  });

  const subtitleStyle = useAnimatedStyle(() => {
    const d = scrollX.value / width - index;
    return {
      opacity: interpolate(d, [-0.4, 0, 0.4], [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(d, [-0.4, 0, 0.4], [14, 0, 14], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <View style={{ width }} className="pt-10">
      <Animated.View style={illustrationStyle}>
        <OnboardingIllustration
          icon={item.icon}
          accents={item.accents}
          height={ILLUSTRATION_HEIGHT}
        />
      </Animated.View>

      <View className="items-start gap-4 px-8 mt-6">
        <Animated.Text
          style={titleStyle}
          className="text-left text-hero font-spaceBold text-ink"
        >
          {item.title.map((segment, i) => (
            <Text
              key={i}
              style={segment.highlight ? { color: COLORS.brand } : undefined}
            >
              {segment.text}
            </Text>
          ))}
        </Animated.Text>
        <Animated.Text
          style={subtitleStyle}
          className="text-left leading-[26px] text-body font-satoshiRegular text-ink-soft"
        >
          {item.subtitle}
        </Animated.Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { setPref } = usePreferences();
  const [page, setPage] = useState(0);
  const listRef = useRef<Animated.FlatList<Slide>>(null);
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const finish = () => {
    setPref("seenOnboarding", true);
    router.replace("/login");
  };

  const goTo = (index: number) => {
    listRef.current?.scrollToIndex({ index, animated: true });
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setPage(viewableItems[0].index);
      }
    }
  ).current;

  const isLast = page === SLIDES.length - 1;

  return (
    <Screen>
      <PulsingGlow style={GLOW_PLACEMENTS.bottomLeft} />

      <View className="flex-row items-center justify-between px-8 pt-4">
        <Text className="font-wordmark text-wordmarkSm tracking-wordmark text-ink">
          stembits
        </Text>
        <Pressable
          onPress={finish}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
        >
          <Text className="text-label font-satoshiMedium text-ink-muted">
            Skip
          </Text>
        </Pressable>
      </View>

      <View className="px-8 pt-4">
        <OnboardingProgressBar count={SLIDES.length} scrollX={scrollX} pageWidth={width} />
      </View>

      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item, index }) => (
          <OnboardingSlide item={item} index={index} width={width} scrollX={scrollX} />
        )}
      />

      <View className="items-end px-8 pb-4">
        {isLast ? (
          <Animated.View
            style={{ width: "100%" }}
            entering={FadeInUp.duration(380).easing(Easing.out(Easing.cubic))}
          >
            <BrandButton label="Get Started" onPress={finish} />
          </Animated.View>
        ) : (
          <OnboardingSquircleButton
            onPress={() => goTo(page + 1)}
            accessibilityLabel="Next"
          />
        )}
      </View>
    </Screen>
  );
}
