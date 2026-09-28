import { useEffect, useRef, useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Musicnote } from "../icons";
import { COLORS, LAYOUT } from "../../constants/theme";
import type { RemotePack } from "../../constants/loopStore";
import { countOf, coverColors, usePackStatus } from "./storeParts";

// The big banner at the top of the Loop Store: featured and new packs and
// loops, one full-width slide at a time, advancing on its own.

const BANNER_HEIGHT = 300;
const MAX_SLIDES = 5;
/** Long enough to read a slide; short enough that the row visibly moves. */
const AUTO_ADVANCE_MS = 5000;

type Slide = { pack: RemotePack; label: string };

/**
 * What goes in the banner, from the manifest's optional `featured` and
 * `addedAt` fields: everything featured first, then the newest, up to five.
 * A catalogue using neither still gets a banner -- its first few entries --
 * labelled as simply being in the store, since calling them new or featured
 * would be making it up.
 */
export function pickBannerSlides(packs: RemotePack[]): Slide[] {
  const featured = packs.filter((pack) => pack.featured);
  const newest = packs
    .filter((pack) => !pack.featured && pack.addedAt)
    .sort((a, b) => Date.parse(b.addedAt!) - Date.parse(a.addedAt!));

  const slides: Slide[] = [
    ...featured.map((pack) => ({ pack, label: "Featured" })),
    ...newest.map((pack) => ({ pack, label: pack.single ? "New loop" : "New pack" })),
  ].slice(0, MAX_SLIDES);

  if (slides.length > 0) return slides;
  return packs.slice(0, 3).map((pack) => ({ pack, label: "In the store" }));
}

function BannerSlide({
  slide,
  width,
  onPress,
}: {
  slide: Slide;
  width: number;
  onPress: () => void;
}) {
  const { pack, label } = slide;
  const status = usePackStatus(pack);
  const loop = pack.loops[0];
  const subtitle = pack.single
    ? `${pack.artist} · ${loop.bpm} bpm · ${loop.timeSignature}`
    : `${pack.artist} · ${countOf(pack)}`;

  return (
    <View style={{ width, paddingHorizontal: LAYOUT.screenPaddingX }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${pack.title}, ${subtitle}, ${status.text}`}
      >
        <LinearGradient
          colors={coverColors(pack.id)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: BANNER_HEIGHT, borderRadius: 20, overflow: "hidden" }}
        >
          {/* The cover mark, huge and faded, off the top-right corner. */}
          <View style={{ position: "absolute", top: -30, right: -40, opacity: 0.2 }}>
            <Musicnote size={260} color={COLORS.white} />
          </View>

          {/* A dark fade under the text, so it reads on any cover colour. */}
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.55)"]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "65%" }}
          />

          <View className="justify-end flex-1 p-5">
            <View className="self-start px-2.5 py-1 mb-3 rounded-full bg-white/20">
              <Text className="uppercase text-micro tracking-widest text-white font-spaceBold">
                {label}
              </Text>
            </View>
            <Text
              className="text-white font-satoshiBold"
              style={{ fontSize: 30, lineHeight: 34 }}
              numberOfLines={2}
            >
              {pack.title}
            </Text>
            <View className="flex-row items-center justify-between mt-2">
              <Text className="flex-1 text-label text-white/80 font-satoshiMedium" numberOfLines={1}>
                {subtitle}
              </Text>
              <View className="px-4 py-2 ml-3 rounded-full bg-white">
                <Text className="uppercase text-overline font-spaceBold text-ink-inverse">
                  {status.text}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Full-width, one slide per page, advancing every few seconds. Touching it
 * stops the auto-advance for that swipe, so it never moves out from under a
 * finger; page dots underneath say where you are.
 */
export default function StoreBanner({
  slides,
  onOpen,
}: {
  slides: Slide[];
  onOpen: (pack: RemotePack) => void;
}) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [touching, setTouching] = useState(false);

  // Advance on a timer, restarted whenever the page changes -- including by
  // hand -- so a swipe always gets a full interval before the next move.
  useEffect(() => {
    if (slides.length < 2 || touching) return;
    const timer = setTimeout(() => {
      const next = (index + 1) % slides.length;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [index, slides.length, touching, width]);

  const onSettle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
    setTouching(false);
  };

  if (slides.length === 0) return null;

  return (
    // Bleeds past the page's side padding: each slide pads itself back in, so
    // the card lines up with the page while the swipe runs edge to edge.
    <View style={{ marginHorizontal: -LAYOUT.screenPaddingX }} className="gap-3">
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setTouching(true)}
        onMomentumScrollEnd={onSettle}
      >
        {slides.map((slide) => (
          <BannerSlide
            key={slide.pack.id}
            slide={slide}
            width={width}
            onPress={() => onOpen(slide.pack)}
          />
        ))}
      </ScrollView>

      {slides.length > 1 && (
        <View className="flex-row items-center justify-center gap-1.5">
          {slides.map((slide, i) => (
            <View
              key={slide.pack.id}
              style={{
                width: i === index ? 18 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === index ? COLORS.white : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
