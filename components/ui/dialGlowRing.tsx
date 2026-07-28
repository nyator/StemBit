import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Circle, Defs, FeGaussianBlur, Filter } from "react-native-svg";

import { COLORS } from "../../constants/theme";

// The metronome dial's two halo rings (Figma: glow-ring / glow-ring-outer) --
// a brand-blue circle stroke blurred with feGaussianBlur, exactly as drawn.
// Unlike the corner ambient glow, this appears once per screen rather than on
// every screen, so a real SVG filter is cheap enough here to be worth the
// exact match over a gradient approximation. Shared between the Metronome and
// Loop screens, which use the same dial treatment.
export function GlowRing({
  size,
  radius,
  strokeWidth,
  blur,
  opacity,
}: {
  size: number;
  radius: number;
  strokeWidth: number;
  blur: number;
  opacity: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: "absolute" }}
    >
      <Defs>
        <Filter id="ringBlur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur stdDeviation={blur} />
        </Filter>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={COLORS.brand}
        strokeWidth={strokeWidth}
        opacity={opacity}
        filter="url(#ringBlur)"
      />
    </Svg>
  );
}

// The ring geometry both instrument screens draw, straight from the Figma.
// `rest` is the opacity the ring sits at between accents.
const RINGS = [
  { size: 288, radius: 119.5, strokeWidth: 1, blur: 12, rest: 0.15 },
  { size: 244, radius: 109, strokeWidth: 2, blur: 6, rest: 0.3 },
] as const;

// Multiples of the resting opacity the rings flare to. Every beat pulses; the
// accent just pulses harder, so the bar's shape is legible from the dial
// alone. These two are the numbers to turn if the pulse reads too strong or
// too subtle on device — keep ACCENT above BEAT or the accent stops leading.
const ACCENT_BRIGHTNESS = 2.5;
const BEAT_BRIGHTNESS = 1.6;

// Longest decay back to rest, used at slow tempos. Faster ones shorten it
// (see pulseDurationFor): a flare still fading when the next beat fires reads
// as a flicker rather than a pulse.
const PULSE_DECAY_MAX_MS = 260;
// ...but never shorter than this, or quick tempos just strobe.
const PULSE_DECAY_MIN_MS = 90;
// Fraction of the gap between beats a flare is allowed to occupy, so there's
// always a moment at rest to pulse away from.
const PULSE_DECAY_FRACTION = 0.7;

// One ring, dimmed from its accent brightness down to resting level.
//
// The flare has to be the *painted* opacity and the animation has to dim it,
// not the other way round: a View's opacity can only ever reduce what its
// children painted, so a ring painted at rest could never be animated
// brighter. Animating the wrapper rather than the SVG's own opacity prop is
// also what lets this run on the native driver, off the JS thread -- which
// matters when the JS thread is the one scheduling audio.
function PulsingRing({
  ring,
  pulse,
}: {
  ring: (typeof RINGS)[number];
  pulse: Animated.Value;
}) {
  const peak = Math.min(1, ring.rest * ACCENT_BRIGHTNESS);
  return (
    <Animated.View
      pointerEvents="none"
      // Sized and absolute so the parent's centring places it exactly where
      // the bare SVG used to sit; the SVG inside then fills it from 0,0.
      style={{
        position: "absolute",
        width: ring.size,
        height: ring.size,
        opacity: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [ring.rest / peak, 1],
        }),
      }}
    >
      <GlowRing
        size={ring.size}
        radius={ring.radius}
        strokeWidth={ring.strokeWidth}
        blur={ring.blur}
        opacity={peak}
      />
    </Animated.View>
  );
}

// Where on the 0..1 pulse scale a given brightness multiple lands.
//
// The scale is anchored by how PulsingRing interpolates: 0 is resting opacity
// and 1 is the accent flare, which is ACCENT_BRIGHTNESS times rest. Since that
// mapping is linear, a multiple m sits at (m - 1) / (ACCENT_BRIGHTNESS - 1) —
// 1x resolving to 0 and ACCENT_BRIGHTNESS to 1, as it should. Both rings share
// the scale because both flare by the same multiple of their own rest.
const pulseTargetFor = (brightness: number) =>
  (brightness - 1) / (ACCENT_BRIGHTNESS - 1);

const ACCENT_TARGET = pulseTargetFor(ACCENT_BRIGHTNESS);
const BEAT_TARGET = pulseTargetFor(BEAT_BRIGHTNESS);

type DialGlowRingsProps = {
  /** Index of the beat currently sounding; a change is what fires the pulse. */
  beat: number;
  /** Whether that beat is accented — accents flare harder than plain beats. */
  isAccent: boolean;
  isPlaying: boolean;
};

// The dial's halo rings, pulsing on every beat and flaring harder on the
// accents, so the pulse the metronome is keeping is visible from across a room
// rather than only in the beat dots.
export function DialGlowRings({ beat, isAccent, isPlaying }: DialGlowRingsProps) {
  // 0 = resting, 1 = full accent flare.
  const pulse = useRef(new Animated.Value(0)).current;
  // When the previous beat landed, for sizing the decay to the actual tempo.
  const lastPulseAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) return;

    // Time the decay off the observed gap between beats rather than a prop:
    // this way it tracks the BPM *and* the subdivision feel without either
    // screen having to work out its own pulse rate and pass it down.
    const now = Date.now();
    const gap =
      lastPulseAtRef.current === null ? null : now - lastPulseAtRef.current;
    lastPulseAtRef.current = now;
    const duration =
      gap === null
        ? PULSE_DECAY_MAX_MS
        : Math.min(
            PULSE_DECAY_MAX_MS,
            Math.max(PULSE_DECAY_MIN_MS, gap * PULSE_DECAY_FRACTION)
          );

    pulse.setValue(isAccent ? ACCENT_TARGET : BEAT_TARGET);
    const animation = Animated.timing(pulse, {
      toValue: 0,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
    // isAccent is deliberately not a dependency: it changes in step with the
    // beat, and listing it would fire a second pulse mid-beat whenever the
    // meter's accent pattern is edited during playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat, isPlaying]);

  // Stopping mid-flare would otherwise leave the rings stuck bright, and the
  // stale timestamp would give the first beat of the next run a wrong decay.
  useEffect(() => {
    if (!isPlaying) {
      pulse.setValue(0);
      lastPulseAtRef.current = null;
    }
  }, [isPlaying, pulse]);

  return (
    <>
      {RINGS.map((ring) => (
        <PulsingRing key={ring.size} ring={ring} pulse={pulse} />
      ))}
    </>
  );
}
