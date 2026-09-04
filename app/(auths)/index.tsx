import { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { useRouter } from "expo-router";
import Animated, {
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
import OnboardingNav from "../../components/ui/onboardingNav";
import { BrandButton } from "../../components/ui/brandButton";

// First-launch onboarding: swipeable feature slides, shown once (the seen flag
// persists via PreferencesContext; app/index.tsx routes past this for returning
// users).
//
// The copy and artwork below are the app's own. The Figma's onboarding frames
// still carry meditation-app template filler ("Find Your Inner Peace… guided
// meditation") in Inter rather than the design system's families, so only the
// layout was taken from them -- 280pt circular illustration, 32pt gap to the
// text group, 16pt between title and body.
const SLIDES = [
  {
    id: "loops",
    title: "Loops that never stumble",
    subtitle:
      "Backing loops for worship, praise and funk — looped sample-accurately, warped to any tempo without changing key.",
    image: require("../../assets/images/splash1.png"),
  },
  {
    id: "tools",
    title: "Your practice toolkit",
    subtitle:
      "A rock-solid metronome with real meter accents, tap tempo, and sustained pads in every key — everything on one dark, stage-ready screen.",
    image: require("../../assets/images/splash2.png"),
  },
  {
    id: "sessions",
    title: "Built for the show",
    subtitle:
      "Turn your set into a session: an ordered list of loops you can fire instantly between songs. Rehearse it, then play it.",
    image: require("../../assets/images/splash3.png"),
  },
];

const ILLUSTRATION = 280;

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

  const imageStyle = useAnimatedStyle(() => {
    const d = scrollX.value / width - index;
    const scale = interpolate(d, [-1, 0, 1], [0.82, 1, 0.82], Extrapolation.CLAMP);
    return { transform: [{ scale }] };
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
    <View style={{ width }} className="items-center px-8 pt-16">
      <Animated.View
        style={[
          {
            width: ILLUSTRATION,
            height: ILLUSTRATION,
            borderRadius: ILLUSTRATION / 2,
          },
          imageStyle,
        ]}
        className="items-center justify-center overflow-hidden"
      >
        <Image
          source={item.image}
          resizeMode="contain"
          style={{ width: "100%", height: "100%" }}
        />
      </Animated.View>

      <View className="items-center gap-4 mt-8">
        <Animated.Text
          style={titleStyle}
          className="text-center text-hero font-spaceBold text-ink"
        >
          {item.title}
        </Animated.Text>
        <Animated.Text
          style={subtitleStyle}
          className="text-body leading-[26px] text-center font-satoshiRegular text-ink-soft"
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

      <View className="gap-4 px-8 pb-2">
        {isLast && (
          <Animated.View entering={FadeInUp.duration(420).springify().damping(16)}>
            <BrandButton label="Get Started" onPress={finish} />
          </Animated.View>
        )}
      </View>

      <OnboardingNav
        count={SLIDES.length}
        page={page}
        scrollX={scrollX}
        pageWidth={width}
        onBack={() => goTo(page - 1)}
        onNext={() => (isLast ? finish() : goTo(page + 1))}
        nextLabel={isLast ? "Done" : "Next"}
      />
    </Screen>
  );
}
