import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { usePathname } from "expo-router";
import Svg, { Defs, Mask, Rect } from "react-native-svg";

import { useFeatureTour, type TourFrame } from "../../context/FeatureTourContext";
import { usePreferences } from "../../context/PreferencesContext";
import { COLORS, RADII, SHADOWS, TYPE } from "../../constants/theme";

// First-run tour over the floating tab bar.
//
// The three tabs are labelled BITS / PAD / CLICK -- brand names, not
// descriptions -- so a new user has no way to tell what any of them do without
// tapping all three. That's the gap this closes, and it's why the tour points
// at the tab bar rather than at controls inside a screen: the labels are the
// confusing part, not the instruments.
//
// Deliberately built from Views and react-native-svg rather than a coach-mark
// library. The ones worth using (react-native-ui-lib's FeatureHighlight, for
// one) ship native views, which would rule out Expo Go for the whole project.

/** Ids match the expo-router route names the tab bar registers under. */
const STEPS: readonly { target: string; title: string; body: string }[] = [
  {
    target: "loop",
    title: "BITS",
    body: "Drum loops to play along with. Browse the catalogue, match a loop to your tempo, or import your own.",
  },
  {
    target: "pad",
    title: "PAD",
    body: "Sustained pads in any key. Stack several packs together and blend ambience underneath.",
  },
  {
    target: "metro",
    title: "CLICK",
    body: "The metronome. Set tempo by tap or dial, then shape the time signature, accents and click sounds.",
  },
];

// Breathing room between the control and the edge of the spotlight, so the
// cutout frames the tab rather than cropping it.
const SPOTLIGHT_PADDING = 10;
const CARD_GAP = 20;

const TAB_PATHS = ["/loop", "/pad", "/metro"];

/** Grows a measured frame by the spotlight padding, clamped to the screen. */
function inflate(frame: TourFrame) {
  return {
    x: Math.max(0, frame.x - SPOTLIGHT_PADDING),
    y: Math.max(0, frame.y - SPOTLIGHT_PADDING),
    width: frame.width + SPOTLIGHT_PADDING * 2,
    height: frame.height + SPOTLIGHT_PADDING * 2,
  };
}

export default function FeatureTour() {
  const { prefs, isLoaded, setPref } = usePreferences();
  const tour = useFeatureTour();
  const pathname = usePathname();
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState(0);

  // One fade driver reused across steps: it runs to 1 on mount and is bounced
  // back through 0 whenever the step changes, so the card and spotlight swap
  // without a hard cut.
  const fade = useRef(new Animated.Value(0)).current;

  const frames = tour?.frames ?? {};
  const current = STEPS[step];
  const frame = current ? frames[current.target] : undefined;

  // Every target has to be measured before the first frame is drawn. Showing
  // the tour with only some of them known would spotlight the right tab now and
  // jump to a stale position later, which reads as a glitch.
  const allMeasured = STEPS.every((s) => frames[s.target]);

  const isVisible =
    isLoaded &&
    !prefs.seenFeatureTour &&
    TAB_PATHS.includes(pathname) &&
    allMeasured &&
    frame != null;

  useEffect(() => {
    if (!isVisible) return;
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isVisible, step, fade]);

  if (!isVisible || !current || !frame) return null;

  const hole = inflate(frame);
  const isLast = step === STEPS.length - 1;

  const finish = () => setPref("seenFeatureTour", true);
  const next = () => (isLast ? finish() : setStep((s) => s + 1));

  // The tab bar sits at the bottom of the screen, so the card always hangs
  // above the spotlight. Measured from the bottom edge rather than the top so
  // it stays put regardless of how tall the copy runs.
  const cardBottom = height - hole.y + CARD_GAP;

  return (
    <View
      // Swallows every touch: the point of a spotlight is that the highlighted
      // control is the only thing on screen, and letting taps through to the
      // real tab bar would navigate away mid-tour.
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      accessibilityViewIsModal
    >
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <Svg width={width} height={height} style={{ position: "absolute" }}>
          <Defs>
            {/* White keeps the scrim, black punches the hole through it. */}
            <Mask id="spotlight">
              <Rect x={0} y={0} width={width} height={height} fill="white" />
              <Rect
                x={hole.x}
                y={hole.y}
                width={hole.width}
                height={hole.height}
                rx={RADII.lg}
                fill="black"
              />
            </Mask>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="rgba(0,0,0,0.82)"
            mask="url(#spotlight)"
          />
        </Svg>

        <Pressable
          onPress={next}
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: cardBottom,
            padding: 20,
            borderRadius: RADII.lg,
            backgroundColor: COLORS.surfaceField,
            borderWidth: 1,
            borderColor: COLORS.borderBrand,
            ...SHADOWS.float,
          }}
        >
          <Text style={{ ...TYPE.label, color: COLORS.brand, letterSpacing: 1 }}>
            {current.title}
          </Text>
          <Text
            style={{ ...TYPE.caption, color: COLORS.textSoft, marginTop: 8 }}
          >
            {current.body}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 20,
            }}
          >
            <View style={{ flexDirection: "row", gap: 6 }}>
              {STEPS.map((s, index) => (
                <View
                  key={s.target}
                  style={{
                    width: index === step ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor:
                      index === step ? COLORS.brand : COLORS.borderIdle,
                  }}
                />
              ))}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
              {!isLast && (
                <Pressable onPress={finish} hitSlop={10}>
                  <Text style={{ ...TYPE.meta, color: COLORS.textMuted }}>
                    Skip
                  </Text>
                </Pressable>
              )}
              <Pressable onPress={next} hitSlop={10}>
                <Text style={{ ...TYPE.button, color: COLORS.brand }}>
                  {isLast ? "Got it" : "Next"}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
