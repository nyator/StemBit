import { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  useWindowDimensions,
  StatusBar,
  type ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { usePreferences } from "../../context/PreferencesContext";
import { COLORS } from "../../constants/theme";

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

// First-launch onboarding: swipeable feature slides, shown once (the seen
// flag persists via PreferencesContext; app/index.tsx routes past this for
// returning users).
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
    <SafeAreaView className="flex-1 bg-primary">
      <StatusBar barStyle="light-content" />

      {/* Top bar: brand + skip */}
      <View className="flex-row items-center justify-between px-6 pt-2">
        <View className="flex-row">
          <Text className="text-2xl text-white font-rBlack">Stem</Text>
          <Text className="text-2xl text-accent font-rBlack">Bits</Text>
        </View>
        {!isLast && (
          <TouchableOpacity onPress={finish} hitSlop={8}>
            <Text className="text-base text-white/60 font-rMedium">Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Swipeable slides */}
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
          <View style={{ width }} className="items-center justify-center px-8">
            <View
              style={{ width: width * 0.8, height: width * 0.8 }}
              className="items-center justify-center mb-8 overflow-hidden"
            >
              <Image
                source={item.image}
                resizeMode="contain"
                style={{ width: "100%", height: "100%" }}
              />
            </View>
            <Text className="mb-3 text-3xl text-center text-white font-rBold">
              {item.title}
            </Text>
            <Text className="text-base leading-6 text-center text-white/60 font-rRegular">
              {item.subtitle}
            </Text>
          </View>
        )}
      />

      {/* Bottom bar: dots + next / get started */}
      <View className="px-8 pb-6">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            {SLIDES.map((slide, idx) => (
              <TouchableOpacity key={slide.id} onPress={() => goTo(idx)} hitSlop={6}>
                <View
                  style={{
                    height: 8,
                    width: page === idx ? 24 : 8,
                    borderRadius: 4,
                    marginRight: 8,
                    backgroundColor:
                      page === idx ? COLORS.accent : "rgba(255,255,255,0.25)",
                  }}
                />
              </TouchableOpacity>
            ))}
          </View>

          {isLast ? (
            <TouchableOpacity
              onPress={finish}
              className="flex-row items-center px-6 py-3 rounded-full bg-accent"
            >
              <Text className="mr-2 text-base text-black font-rBold">
                Get Started
              </Text>
              <Ionicons name="arrow-forward" size={18} color="black" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => goTo(page + 1)}
              className="p-4 rounded-full bg-accent"
              accessibilityLabel="Next"
            >
              <Ionicons name="chevron-forward" size={22} color="black" />
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-row justify-center mt-5">
          <Text className="text-white/40 font-rMedium">by </Text>
          <Text className="text-accent font-rMedium">nehtek</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
