import { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { useRouter } from "expo-router";

import { usePreferences } from "../../context/PreferencesContext";
import Screen from "../../components/ui/screen";
import OnboardingNav from "../../components/ui/onboardingNav";
import { BrandButton } from "../../components/ui/brandButton";

// First-launch onboarding: swipeable feature slides, shown once (the seen flag
// persists via PreferencesContext; app/index.tsx routes past this for returning
// users).
//
// The illustrations are drawn to float directly on a dark background rather
// than sit in a frame -- no card, no circular crop, just the artwork at a
// size generous enough to read as the point of the slide rather than a
// decoration beside the text.
const SLIDES = [
  {
    id: "loops",
    title: "Loops that never stumble",
    subtitle:
      "Backing loops for worship, praise and funk — looped sample-accurately, warped to any tempo without changing key.",
    image: require("../../assets/images/guitar_player.png"),
  },
  {
    id: "tools",
    title: "Your practice toolkit",
    subtitle:
      "A rock-solid metronome with real meter accents, tap tempo, and sustained pads in every key — everything on one dark, stage-ready screen.",
    image: require("../../assets/images/drummer.png"),
  },
  {
    id: "sessions",
    title: "Built for the show",
    subtitle:
      "Turn your set into a session: an ordered list of loops you can fire instantly between songs. Rehearse it, then play it.",
    image: require("../../assets/images/bass_player.png"),
  },
];

/** Generous enough to read as the point of the slide; contain (not cover)
 *  so none of the differently-proportioned illustrations get cropped. */
const ILLUSTRATION_HEIGHT = 240;

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { setPref } = usePreferences();
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);

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
    <Screen glows={["bottomLeft"]}>
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

      {/* One segment per slide, filled up to the current page -- plain state,
          matching how the rest of this screen already tracks page rather
          than reaching for a continuously-animated version of the same
          thing. */}
      <View className="flex-row px-8 pt-4 gap-1.5">
        {SLIDES.map((slide, index) => (
          <View
            key={slide.id}
            className={`flex-1 rounded-full ${index <= page ? "bg-white" : "bg-white/15"}`}
            style={{ height: 4 }}
          />
        ))}
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View style={{ width }} className="items-start px-8 pt-10">
            <Image
              source={item.image}
              resizeMode="contain"
              style={{ width: "100%", height: ILLUSTRATION_HEIGHT }}
            />

            <View className="items-start gap-4 mt-8">
              <Text className="text-left text-hero font-spaceBold text-ink">
                {item.title}
              </Text>
              <Text className="text-left leading-[26px] text-body font-satoshiRegular text-ink-soft">
                {item.subtitle}
              </Text>
            </View>
          </View>
        )}
      />

      <View className="gap-4 px-8 pb-2">
        {isLast && <BrandButton label="Get Started" onPress={finish} />}
      </View>

      {/* Not shown on the last slide -- Get Started above is the only
          action there, and a "Done" link beside it would just repeat it. */}
      {!isLast && (
        <OnboardingNav
          page={page}
          onBack={() => goTo(page - 1)}
          onNext={() => goTo(page + 1)}
        />
      )}
    </Screen>
  );
}
