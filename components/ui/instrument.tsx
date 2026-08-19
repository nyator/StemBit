import type { ComponentType, ReactNode } from "react";
import { Text, TextInput, TouchableOpacity, View, type ViewStyle } from "react-native";

import InfoButton from "./infoButton";
import { DialGlowRings } from "./dialGlowRing";
import BeatGlow, { BEAT_GLOW_SIZE } from "./beatGlow";
import { BPM_ACCESSORY_ID } from "./bpmInputAccessory";
import { AddCircle, MinusCircle, PlayFilled, Stop } from "../icons";
import type { InfoTopicKey } from "../../constants/infoCopy";
import type { BpmControls } from "../../hooks/useBpmControl";
import { COLORS, SHADOWS, SIZES } from "../../constants/theme";

// The control surface the metronome, the loop player and the loop importer all
// share.
//
// These three screens were built one at a time and had converged on nearly the
// same layout by hand: the same dial, the same transport, the same tap tempo,
// the same subdivision row, the same "stop the other engine first" notice.
// Nearly, though -- the tempo readout was 48pt on two screens and 40 on the
// third, the picker pill had two different gaps, and the beat dots existed
// twice with the accent logic copied and then diverged. This file is those
// pieces once.
//
// Nothing here owns state or touches an engine. Every one of them takes what to
// show and what to call, so the screens keep their audio wiring exactly where
// it was.

/**
 * Vertical room the dial needs.
 *
 * The dial is 180 across, but the rings that flare on the beat are painted
 * outside it, and reserving their height keeps the transport from stepping up
 * a few pixels the moment playback starts.
 */
const DIAL_SLOT_HEIGHT = 249;

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The label above a control, with the tap target that explains it.
 *
 * Both instrument screens name every control this way, and the "i" is a real
 * button rather than decoration -- see infoButton.tsx.
 */
export function ControlLabel({
  text,
  topic,
  className = "",
}: {
  text: string;
  topic: InfoTopicKey;
  className?: string;
}) {
  return (
    <View className={`flex-row items-center gap-1.5 ${className}`}>
      <Text className="text-white text-label font-spaceBold">{text}</Text>
      <InfoButton topic={topic} />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Picker                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The white pill that opens a picker: an icon, a hairline, and what is loaded.
 *
 * The loop screen's "SELECT LOOP" and the metronome's time signature are the
 * same button. Width comes from the caller, since one of them is sized to a
 * meter (4/4) and the other has to take a loop title and truncate it.
 */
export function PickerButton({
  icon: Icon,
  label,
  onPress,
  style,
  accessibilityLabel,
}: {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      className="flex-row items-center justify-center gap-2 px-4 py-2 bg-white rounded-sm"
    >
      <Icon size={SIZES.rowIcon} color={COLORS.black} />
      <View style={{ width: 1, height: 18, backgroundColor: "rgba(0,0,0,0.2)" }} />
      <Text className="text-black shrink text-title font-spaceBold" numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* -------------------------------------------------------------------------- */
/* Dial                                                                        */
/* -------------------------------------------------------------------------- */

type BpmDialProps = {
  controls: BpmControls;
  isPlaying: boolean;
  /**
   * "full" is the instrument screens' dial: a fixed circle in a reserved slot,
   * ringed by the beat flares. "compact" is the importer's, which sits inline
   * between two steppers and has no transport to flare against.
   */
  variant?: "full" | "compact";
  /** Which beat the rings are on. Full variant only. */
  beat?: number;
  isAccent?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
};

/**
 * The tempo, as a number you can type into.
 *
 * A TextInput rather than a Text with a picker behind it, because the fastest
 * way to get to 137 is to type 137. The steppers beside it are for nudging, and
 * the two have to agree -- so the draft/commit handling lives in useBpmControl
 * and both read from it.
 */
export function BpmDial({
  controls,
  isPlaying,
  variant = "full",
  beat = 0,
  isAccent = true,
  onFocus,
  onBlur,
}: BpmDialProps) {
  const isFull = variant === "full";

  const field = (
    <View
      className="items-center justify-center bg-surface-sunken border-hairline-dial rounded-dial"
      style={
        isFull
          ? {
              width: SIZES.dial,
              height: SIZES.dial,
              borderWidth: 3,
              ...SHADOWS.glow,
            }
          : { paddingHorizontal: 12, paddingVertical: 4 }
      }
    >
      <TextInput
        className="p-0 text-center text-display font-spaceBold"
        style={{ minWidth: 110, color: isPlaying ? COLORS.brand : COLORS.white }}
        value={controls.bpmText}
        onChangeText={controls.handleBpmTextChange}
        onEndEditing={controls.commitBpmText}
        keyboardType="numeric"
        maxLength={3}
        selectTextOnFocus
        underlineColorAndroid="transparent"
        inputAccessoryViewID={BPM_ACCESSORY_ID}
        onFocus={onFocus}
        onBlur={onBlur}
        accessibilityLabel="Tempo in beats per minute"
      />
      <Text className="uppercase text-label text-ink-muted font-satoshiBold">
        BPM
      </Text>
    </View>
  );

  if (!isFull) return field;

  return (
    <View
      className="items-center justify-center w-full mb-5"
      style={{ height: DIAL_SLOT_HEIGHT }}
    >
      <DialGlowRings beat={beat} isAccent={isAccent} isPlaying={isPlaying} />
      {field}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                   */
/* -------------------------------------------------------------------------- */

/** A minus/plus stepper. Tap to nudge, hold to run. */
export function StepperButton({
  direction,
  controls,
  label,
}: {
  direction: "up" | "down";
  controls: BpmControls;
  label: string;
}) {
  const up = direction === "up";
  const Icon = up ? AddCircle : MinusCircle;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={up ? controls.increase : controls.decrease}
      onLongPress={up ? controls.startHoldIncrease : controls.startHoldDecrease}
      onPressOut={controls.endHold}
      className="p-2 rounded-lg bg-white/10"
    >
      <Icon size={SIZES.transportSecondary} color={COLORS.white} />
    </TouchableOpacity>
  );
}

/**
 * Nudge down, start/stop, nudge up.
 *
 * The play button answers on touch-down, not on release: it is the one control
 * on these screens a player hits mid-count, and waiting for the finger to lift
 * puts the downbeat wherever the lift happened to land.
 */
export function TransportRow({
  controls,
  isPlaying,
  blocked = false,
  onToggle,
  playLabel,
  stopLabel,
}: {
  controls: BpmControls;
  isPlaying: boolean;
  /** Another engine holds the audio, so starting this one is refused. */
  blocked?: boolean;
  onToggle: () => void;
  playLabel: string;
  stopLabel: string;
}) {
  const disabled = !isPlaying && blocked;
  return (
    <View className="flex-row items-center gap-3 mt-3">
      <StepperButton direction="down" controls={controls} label="Decrease BPM" />

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? stopLabel : playLabel}
        accessibilityState={{ disabled }}
        onPressIn={onToggle}
        disabled={disabled}
        style={disabled ? { opacity: 0.4 } : undefined}
      >
        {isPlaying ? (
          <Stop size={SIZES.transportPrimary} />
        ) : (
          <PlayFilled size={SIZES.transportPrimary} />
        )}
      </TouchableOpacity>

      <StepperButton direction="up" controls={controls} label="Increase BPM" />
    </View>
  );
}

/**
 * Tap tempo.
 *
 * onPressIn for the same reason the transport uses it, and a stronger one: the
 * beat is where the finger lands, not where it lifts, and how long a tap is
 * held varies far more than when it starts.
 */
export function TapTempoButton({
  onPress,
  className = "",
}: {
  onPress: () => void;
  className?: string;
}) {
  return (
    <TouchableOpacity
      onPressIn={onPress}
      accessibilityRole="button"
      accessibilityLabel="Tap tempo"
      className={`items-center justify-center px-3 py-3 border-2 border-hairline-strong rounded-sm ${className}`}
    >
      <Text className="text-white text-title font-spaceBold">TAP TEMPO</Text>
    </TouchableOpacity>
  );
}

/** An outlined square button sized to sit beside TAP TEMPO. */
export function InstrumentIconButton({
  children,
  onPress,
  accessibilityLabel,
  disabled,
  active = false,
}: {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  /** Filled white rather than outlined -- the control is on. */
  active?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, selected: active }}
      style={disabled ? { opacity: 0.4 } : undefined}
      className={`items-center justify-center px-3 py-3 rounded-sm border-2 ${
        active ? "bg-white border-white" : "border-hairline-strong"
      }`}
    >
      {children}
    </TouchableOpacity>
  );
}

/**
 * The one-line reason a transport is refused, in a slot that is always there.
 *
 * Fixed height so the message appearing does not shove the controls below it
 * down the screen -- which, on an instrument, moves the button out from under a
 * finger that is already on its way to it.
 */
export function EngineNotice({ show, message }: { show: boolean; message: string }) {
  return (
    <View className="justify-center w-full h-4 mt-2">
      {show ? (
        <Text
          numberOfLines={1}
          className="text-center text-overline text-white/60 font-satoshiMedium"
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Beat visuals                                                                */
/* -------------------------------------------------------------------------- */

type BeatDotsProps = {
  /** How many beats in the bar. */
  count: number;
  currentBeat: number;
  isPlaying: boolean;
  /** Whether the beat now sounding is one the engine accented. */
  isAccent: boolean;
  /**
   * Beats besides the downbeat that this meter groups on -- 6/8 accents its
   * fourth. Left empty (the loop player, which has no meter) the row is just a
   * downbeat and the rest.
   */
  accents?: readonly number[];
};

/**
 * A row of dots, one per beat, with the current one lit.
 *
 * Both screens drew this and the two copies had already drifted apart. Which
 * beat flares comes from the engine rather than from the dot's position: the
 * engine decides which beats get the accent sample, so it should decide which
 * dot gets the halo.
 */
export function BeatDots({
  count,
  currentBeat,
  isPlaying,
  isAccent,
  accents = [],
}: BeatDotsProps) {
  const dots = [];
  for (let i = 0; i < count; i++) {
    const isCurrent = i === currentBeat;
    const isSecondaryAccent = i !== 0 && accents.includes(i);
    const activeColor =
      i === 0 ? COLORS.brand : isSecondaryAccent ? COLORS.brandFrom : COLORS.text;
    // Idle group accents sit brighter than plain beats, so the meter's grouping
    // is readable before anything is playing.
    const idleColor = isSecondaryAccent
      ? "rgba(0,139,194,0.3)"
      : "rgba(255,255,255,0.15)";
    const size = isCurrent ? 12 : 8;
    // Gated on isPlaying as well as the accent: currentBeat resets to 0 on
    // stop, and without it the downbeat would glow at a stopped metronome.
    const showGlow = isPlaying && isCurrent && isAccent;

    dots.push(
      <View
        key={i}
        style={{ marginHorizontal: 3, alignItems: "center", justifyContent: "center" }}
      >
        {showGlow && (
          <BeatGlow
            color={activeColor}
            // Centres the painted box on the dot without it joining layout.
            style={{
              left: (size - BEAT_GLOW_SIZE) / 2,
              top: (size - BEAT_GLOW_SIZE) / 2,
            }}
          />
        )}
        <View
          style={{
            width: size,
            height: size,
            borderRadius: 6,
            backgroundColor: isCurrent ? activeColor : idleColor,
          }}
        />
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-center" style={{ height: 12 }}>
      {dots}
    </View>
  );
}
