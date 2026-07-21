import { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
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
          <View style={{ width }} className="items-center px-8 pt-16">
            <View
              style={{
                width: ILLUSTRATION,
                height: ILLUSTRATION,
                borderRadius: ILLUSTRATION / 2,
              }}
              className="items-center justify-center overflow-hidden"
            >
              <Image
                source={item.image}
                resizeMode="contain"
                style={{ width: "100%", height: "100%" }}
              />
            </View>

            <View className="items-center gap-4 mt-8">
              <Text className="text-[32px] leading-[38px] text-center font-spaceBold text-ink">
                {item.title}
              </Text>
              <Text className="text-body leading-[26px] text-center font-satoshiRegular text-ink-soft">
                {item.subtitle}
              </Text>
            </View>
          </View>
        )}
      />

      <View className="gap-4 px-8 pb-2">
        {isLast && <BrandButton label="Get Started" onPress={finish} />}
      </View>

      <OnboardingNav
        count={SLIDES.length}
        page={page}
        onBack={() => goTo(page - 1)}
        onNext={() => (isLast ? finish() : goTo(page + 1))}
        nextLabel={isLast ? "Done" : "Next"}
      />
    </Screen>
  );
}
