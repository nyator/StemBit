import { useMemo, useRef } from "react";
import { Animated, PanResponder, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../../constants/theme";
import VerticalFader from "./verticalFader";
import type { TrackMix } from "../../context/SessionPlaybackContext";

// One stem's channel strip: meter, fader, pan, mute, solo.
//
// The performance view already has mute and solo on big tiles, and this does
// not replace that -- it is the other thing a mixer is for. Muting a stem is a
// decision you make in a second on stage; setting how loud the guide keys sit
// under a live band is one you make once, carefully, and want to keep. So this
// strip carries the controls with a value, and the tiles carry the ones with a
// state.
//
// The meter is post-fader and drives an Animated.Value rather than state: it
// updates sixteen times a second, and a strip per stem re-rendering at that
// rate would cost more frames than the audio does.

const STRIP_WIDTH = 74;
const METER_HEIGHT = 132;
const PAN_WIDTH = 58;
const PAN_HEIGHT = 22;
// Anything inside this of centre snaps to it, so a pan can be put back to the
// middle with a finger instead of a steady hand.
const PAN_DETENT = 0.06;

type MixerStripProps = {
  name: string;
  mix: TrackMix;
  /** True when another track is soloed, so this one is silent regardless. */
  isSilent: boolean;
  isSolo: boolean;
  /** Post-fader RMS, 0–1, as an Animated.Value. */
  meter: Animated.Value;
  onLevel: (level: number) => void;
  /** Fires on release. Persist here -- not on every frame of a fader move. */
  onLevelCommit: (level: number) => void;
  onPan: (pan: number) => void;
  onPanCommit: (pan: number) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
};

export default function MixerStrip({
  name,
  mix,
  isSilent,
  isSolo,
  meter,
  onLevel,
  onLevelCommit,
  onPan,
  onPanCommit,
  onToggleMute,
  onToggleSolo,
}: MixerStripProps) {
  const panRef = useRef({ onPan, onPanCommit });
  panRef.current = { onPan, onPanCommit };
  const latestPanRef = useRef(mix.pan);
  latestPanRef.current = mix.pan;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => handlePan(event.nativeEvent.locationX),
        onPanResponderMove: (event) => handlePan(event.nativeEvent.locationX),
        onPanResponderRelease: () =>
          panRef.current.onPanCommit(latestPanRef.current),
        onPanResponderTerminate: () =>
          panRef.current.onPanCommit(latestPanRef.current),
      }),
    []
  );

  const handlePan = (locationX: number) => {
    const raw = (Math.max(0, Math.min(PAN_WIDTH, locationX)) / PAN_WIDTH) * 2 - 1;
    const next = Math.abs(raw) < PAN_DETENT ? 0 : raw;
    latestPanRef.current = next;
    panRef.current.onPan(next);
  };

  // Meters are read in RMS, which is a small number for anything but a
  // sustained tone -- a drum stem peaking at 0dB reads about 0.2. Rooted rather
  // than shown raw so the bar uses its height instead of twitching near the
  // bottom of it.
  const meterHeight = meter.interpolate({
    inputRange: [0, 0.05, 0.25, 0.6, 1],
    outputRange: [0, METER_HEIGHT * 0.18, METER_HEIGHT * 0.55, METER_HEIGHT, METER_HEIGHT],
    extrapolate: "clamp",
  });

  const panLabel =
    mix.pan === 0
      ? "C"
      : `${mix.pan < 0 ? "L" : "R"}${Math.round(Math.abs(mix.pan) * 100)}`;

  return (
    <View
      style={{
        width: STRIP_WIDTH,
        alignItems: "center",
        paddingVertical: 10,
        marginRight: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: isSolo ? COLORS.warning : COLORS.border,
        backgroundColor: COLORS.surface,
        opacity: isSilent ? 0.5 : 1,
      }}
    >
      <Text
        numberOfLines={1}
        className="text-[10px] text-white font-satoshiBold"
        style={{ maxWidth: STRIP_WIDTH - 10, marginBottom: 8 }}
      >
        {name}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        {/* Meter beside the fader, the way a console puts them, so you can see
            what a stem is doing and change it without moving your eyes. */}
        <View
          style={{
            width: 6,
            height: METER_HEIGHT,
            marginRight: 2,
            borderRadius: 3,
            overflow: "hidden",
            backgroundColor: COLORS.track,
            justifyContent: "flex-end",
          }}
        >
          <Animated.View
            style={{
              height: meterHeight,
              width: "100%",
              backgroundColor: COLORS.success,
            }}
          />
        </View>

        <VerticalFader
          value={mix.level}
          onChange={onLevel}
          onComplete={onLevelCommit}
          accessibilityLabel={`${name} level`}
        />
      </View>

      <Text className="mt-1 text-[9px] text-ink-muted font-spaceBold">
        {Math.round(mix.level * 100)}
      </Text>

      {/* Pan as a bar rather than a rotary knob: a knob wants a circular drag,
          which is a poor gesture on glass, and this has to be usable with one
          thumb. The centre line is the detent you can feel for. */}
      <View
        {...panResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={`${name} pan`}
        accessibilityValue={{ min: -100, max: 100, now: Math.round(mix.pan * 100) }}
        style={{
          width: PAN_WIDTH,
          height: PAN_HEIGHT,
          marginTop: 6,
          justifyContent: "center",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            height: 3,
            borderRadius: 2,
            backgroundColor: COLORS.track,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: PAN_WIDTH / 2 - 0.5,
            top: 4,
            width: 1,
            height: PAN_HEIGHT - 8,
            backgroundColor: "rgba(255,255,255,0.3)",
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: ((mix.pan + 1) / 2) * (PAN_WIDTH - 10),
            top: PAN_HEIGHT / 2 - 5,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: COLORS.brand,
          }}
        />
      </View>

      <Text className="mt-1 text-[9px] text-ink-muted font-spaceBold">
        {panLabel}
      </Text>

      <View style={{ flexDirection: "row", marginTop: 8 }}>
        <StripButton
          label="M"
          active={mix.muted}
          activeColor={COLORS.danger}
          onPress={onToggleMute}
          accessibilityLabel={`${mix.muted ? "Unmute" : "Mute"} ${name}`}
        />
        <StripButton
          label="S"
          active={isSolo}
          activeColor={COLORS.warning}
          onPress={onToggleSolo}
          accessibilityLabel={`${isSolo ? "Clear solo on" : "Solo"} ${name}`}
        />
      </View>
    </View>
  );
}

function StripButton({
  label,
  active,
  activeColor,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      activeOpacity={0.7}
      style={{
        width: 26,
        height: 22,
        marginHorizontal: 2,
        borderRadius: 4,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? activeColor : "rgba(255,255,255,0.08)",
      }}
    >
      <Text
        className="text-[11px] font-spaceBold"
        style={{ color: active ? COLORS.black : COLORS.textMuted }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
