import { useRef } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { findLoopByKey, getAllLoops } from "../../constants/loops";
import { PAD_PACKS, findPadPackByKey } from "../../constants/pads";
import { COLORS, SIZES } from "../../constants/theme";
import { ChevronDown, Musicnote } from "../icons";
import CuePicker, { type CuePickerHandle, type PickerOption } from "./cuePicker";

const MIN_BPM = 20;
const MAX_BPM = 320;

type CueElementsProps = {
  loopKey?: string;
  bpm?: number;
  padPack?: string;
  padKey?: string;
  padMode: "major" | "minor";
  isLive: boolean;
  onChangeLoop: (key: string | undefined) => void;
  onChangeBpm: (bpm: number) => void;
  onChangePadPack: (key: string | undefined) => void;
  onEditKey: () => void;
};

export default function CueElements({
  loopKey,
  bpm,
  padPack,
  padKey,
  padMode,
  isLive,
  onChangeLoop,
  onChangeBpm,
  onChangePadPack,
  onEditKey,
}: CueElementsProps) {
  const loops = getAllLoops();
  const loop = loopKey ? findLoopByKey(loopKey) : undefined;
  const pack = padPack ? findPadPackByKey(padPack) : undefined;
  const tempo = bpm ?? loop?.bpm ?? 120;

  const loopPickerRef = useRef<CuePickerHandle>(null);
  const padPickerRef = useRef<CuePickerHandle>(null);

  const loopOptions: PickerOption[] = loops.map((entry) => ({
    key: entry.key,
    title: entry.title,
    detail: `${entry.artist}   ·   ${entry.bpm} BPM   ·   ${entry.timeSignature}`,
    group: entry.category,
  }));

  const padOptions: PickerOption[] = PAD_PACKS.map((entry) => ({
    key: entry.key,
    title: entry.title,
    detail: `${entry.artist}   ·   ${entry.genre}`,
    group: entry.genre,
  }));

  const isLoopActive = Boolean(loop);
  const isPadActive = Boolean(pack);

  return (
    <View className="gap-y-3 gap-3">
      {/* 2-Column Sound Engines (BITS & PAD) */}
      <View className="flex-row items-stretch gap-3">
        {/* LOOP / BITS ENGINE */}
        <TouchableOpacity
          onPress={() => loopPickerRef.current?.present()}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Loop engine: ${loop?.title ?? "Empty"}`}
          className="flex-1 p-2 rounded-2xl border border-hairline justify-between min-h-[110px]"
          style={{
            backgroundColor: isLoopActive ? COLORS.surface : "rgba(255,255,255,0.02)",
            borderColor: isLoopActive ? COLORS.brand : COLORS.borderSegment,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View
                className="w-2 h-2 rounded-full mr-2"
                style={{
                  backgroundColor: isLoopActive ? COLORS.brand : COLORS.textMuted,
                  opacity: isLoopActive ? 1 : 0.4,
                }}
              />
              <Text
                className="text-micro font-spaceBold tracking-widest"
                style={{ color: isLoopActive ? COLORS.brand : COLORS.textMuted }}
              >
                BITS
              </Text>
            </View>
            <ChevronDown size={14} color={isLoopActive ? COLORS.brand : COLORS.textMuted} />
          </View>

          <View className="my-auto">
            <Text
              numberOfLines={1}
              className="text-body font-satoshiBold"
              style={{ color: isLoopActive ? COLORS.white : COLORS.textMuted }}
            >
              {loop?.title ?? "No Loop"}
            </Text>
            <Text
              numberOfLines={1}
              className="mt-0.5 text-micro text-ink-muted font-spaceBold"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {loop ? `${loop.timeSignature}` : "TAP TO LOAD"}
            </Text>
            {/* <Text
              className="text-micro font-spaceBold"
              style={{ color: isLoopActive ? COLORS.brand : COLORS.textMuted }}
            >
              {isLoopActive ? "LOADED" : "OFF"}
            </Text> */}
          </View>

        </TouchableOpacity>

        {/* AMBIENT PAD ENGINE */}
        <TouchableOpacity
          onPress={() => padPickerRef.current?.present()}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Pad engine: ${pack?.title ?? "Empty"}`}
          className="flex-1 p-2 rounded-2xl border border-hairline justify-between min-h-[110px]"
          style={{
            backgroundColor: isPadActive ? COLORS.surface : "rgba(255,255,255,0.02)",
            borderColor: isPadActive ? COLORS.brand : COLORS.borderSegment,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View
                className="w-2 h-2 rounded-full mr-2"
                style={{
                  backgroundColor: isPadActive ? COLORS.brand : COLORS.textMuted,
                  opacity: isPadActive ? 1 : 0.4,
                }}
              />
              <Text
                className="text-micro font-spaceBold tracking-widest"
                style={{ color: isPadActive ? COLORS.brand : COLORS.textMuted }}
              >
                PAD
              </Text>
            </View>
            <ChevronDown size={14} color={isPadActive ? COLORS.brand : COLORS.textMuted} />
          </View>

          <View className="my-auto">
            <Text
              numberOfLines={1}
              className="text-body font-satoshiBold"
              style={{ color: isPadActive ? COLORS.white : COLORS.textMuted }}
            >
              {pack?.title ?? "No Pad"}
            </Text>
            <Text
              numberOfLines={1}
              className="mt-0.5 text-micro text-ink-muted font-spaceBold"
            >
              {pack?.genre ?? "TAP TO LOAD"}
            </Text>
            {/* <Text
              className="text-micro font-spaceBold"
              style={{ color: isPadActive ? COLORS.brand : COLORS.textMuted }}
            >
              {isPadActive ? "LOADED" : "OFF"}
            </Text> */}
          </View>
        </TouchableOpacity>
      </View>

      {/* TONALITY STRIP (Shown when PAD is assigned) */}
      {padPack && (
        <TouchableOpacity
          onPress={onEditKey}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Open key picker"
          className="flex-row items-center justify-between px-4 py-3 rounded-xl border bg-surface/40"
          style={{ borderColor: COLORS.border }}
        >
          <View className="flex-row items-center">
            <View className="items-center justify-center w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 mr-3">
            </View>
            <View>
              <Text className="text-overline font-satoshiBold text-white">
                {padKey ? `${padKey} ${padMode === "minor" ? "MINOR" : "MAJOR"}` : "SELECT KEY "}
              </Text>
            </View>
          </View>

          <View className="px-3 py-1.5 rounded-lg border border-border bg-white/5">
            <Text className="text-micro font-spaceBold text-brand">SET KEY</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* CLOCK / BPM CONTROLLER (Shown when LOOP is loaded) */}
      {loop && (
        <View
          className="p-4 rounded-2xl bg-surface/50"
          style={{ borderColor: COLORS.border }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Text className="text-micro text-ink-muted font-spaceBold tracking-widest">
                TEMPO
              </Text>
              {isLive && (
                <View className="flex-row items-center ml-2.5 px-2 py-0.5 rounded-full bg-brand/10 border border-brand/30">
                  <View className="w-1.5 h-1.5 rounded-full bg-brand mr-1.5" />
                  <Text className="text-micro text-brand font-spaceBold">LIVE</Text>
                </View>
              )}
            </View>

            {loop.bpm && (
              <Text
                className="text-micro text-ink-muted font-spaceBold"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {loop.bpm} BPM *
              </Text>
            )}
          </View>

          <TempoStepper
            bpm={tempo}
            onChange={onChangeBpm}
            nativeBpm={loop.bpm}
            isLive={isLive}
          />
        </View>
      )}

      {/* EMPTY CUE ADVISORY */}
      {!loopKey && !padPack && (
        <View
          className="items-center py-6 px-4 rounded-2xl border border-dashed"
          style={{
            backgroundColor: "rgba(255,255,255,0.01)",
            borderColor: COLORS.borderSegment,
          }}
        >
          <View className="w-10 h-10 rounded-full items-center justify-center bg-white/5 mb-2.5">
            <Musicnote size={18} color={COLORS.textMuted} />
          </View>
          <Text className="text-body font-satoshiBold text-white">Empty Scene</Text>
          <Text className="mt-0.5 text-center text-micro text-ink-muted font-satoshiRegular max-w-[240px]">
            Select a beat loop or ambient pad above to prepare this stage cue.
          </Text>
        </View>
      )}

      {/* BOTTOM SHEET PICKERS */}
      <CuePicker
        ref={loopPickerRef}
        title="Beat Loops"
        options={loopOptions}
        selectedKey={loopKey}
        noneLabel="Bypass Loop"
        onSelect={onChangeLoop}
      />

      <CuePicker
        ref={padPickerRef}
        title="Pad Packs"
        options={padOptions}
        selectedKey={padPack}
        noneLabel="Bypass Pad"
        onSelect={onChangePadPack}
      />
    </View>
  );
}

type TempoStepperProps = {
  bpm?: number;
  onChange: (bpm: number) => void;
  nativeBpm?: number;
  isLive?: boolean;
  hint?: string;
};

export function TempoStepper({
  bpm,
  onChange,
  nativeBpm,
  hint,
}: TempoStepperProps) {
  const from = bpm ?? nativeBpm ?? 120;

  return (
    <View>
      <View className="flex-row items-center justify-between">
        {/* Decrement Group */}
        <View className="flex-row items-center gap-2">
          <Step label="−5" onPress={() => onChange(from - 5)} />
          <Step label="−1" onPress={() => onChange(from - 1)} />
        </View>

        {/* Center Digital Display */}
        <View className="items-center px-4">
          <Text
            className="text-white text-display font-spaceBold tracking-tight"
            style={{ fontVariant: ["tabular-nums"], fontSize: 34, lineHeight: 38 }}
          >
            {bpm ?? "--"}
          </Text>
          <Text className="text-micro text-brand font-spaceBold tracking-widest">
            BPM
          </Text>
        </View>

        {/* Increment Group */}
        <View className="flex-row items-center gap-2">
          <Step label="+1" onPress={() => onChange(from + 1)} />
          <Step label="+5" onPress={() => onChange(from + 5)} />
        </View>
      </View>

      {/* Reset to Native Action */}
      {nativeBpm !== undefined && bpm !== nativeBpm && (
        <View className="mt-3 pt-2 border-t border-hairline border-white/5 items-center">
          <TouchableOpacity
            onPress={() => onChange(nativeBpm)}
            hitSlop={10}
            activeOpacity={0.7}
            className="px-3 py-1 rounded-full bg-brand/10 border border-brand/25"
          >
            <Text
              className="text-micro text-brand font-spaceBold tracking-widest"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              RESET TO {nativeBpm} BPM
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {bpm === undefined && hint && (
        <Text className="mt-2 text-micro text-ink-muted font-satoshiRegular text-center">
          {hint}
        </Text>
      )}
    </View>
  );
}

function Step({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={`Nudge tempo ${label}`}
      activeOpacity={0.75}
      className="items-center justify-center rounded-xl border bg-canvas"
      style={{
        width: 48,
        height: 48,
        borderColor: COLORS.border,
      }}
    >
      <Text className="text-label text-white font-spaceBold">{label}</Text>
    </TouchableOpacity>
  );
}

export const clampBpm = (bpm: number) =>
  Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)));

type CueSummaryProps = {
  loopKey?: string;
  bpm?: number;
  padPack?: string;
  padKey?: string;
  padMode: "major" | "minor";
  loopIsLive: boolean;
  padIsLive: boolean;
};

export function CueSummary({
  loopKey,
  bpm,
  padPack,
  padKey,
  padMode,
  loopIsLive,
  padIsLive,
}: CueSummaryProps) {
  const loop = loopKey ? findLoopByKey(loopKey) : undefined;
  const pack = padPack ? findPadPackByKey(padPack) : undefined;

  return (
    <View className="gap-y-2">
      <Text className="text-micro font-spaceBold text-ink-muted tracking-widest mb-1">
        ELEMENTS
      </Text>

      <Element
        badge="BITS"
        title={loop?.title ?? "None"}
        detail={loop ? `${bpm ?? loop.bpm} BPM · ${loop.timeSignature}` : "BYPASSED"}
        isLive={loopIsLive && Boolean(loop)}
      />
      <Element
        badge="PAD"
        title={pack?.title ?? "None"}
        detail={
          pack && padKey
            ? `${padKey} ${padMode === "minor" ? "MIN" : "MAJ"}`
            : pack
              ? "NO KEY SET"
              : "BYPASSED"
        }
        isLive={padIsLive && Boolean(pack)}
      />
    </View>
  );
}

function Element({
  badge,
  title,
  detail,
  isLive,
}: {
  badge: string;
  title: string;
  detail: string;
  isLive: boolean;
}) {
  return (
    <View
      className="flex-row items-center justify-between rounded-2xl mt-2 mb-2 border-b last:border-0"
      style={{
        backgroundColor: isLive ? COLORS.surface : "transparent",
        borderColor: isLive ? COLORS.brand : COLORS.border,
      }}
    >
      <View className="flex-1 mr-3 p-2 ">
        <View className="flex-row items-center">
          <Text
            className="text-micro font-spaceBold tracking-widest mr-2"
            style={{ color: isLive ? COLORS.brand : COLORS.textMuted }}
          >
            {badge}
          </Text>
          {isLive && (
            <View className="w-1.5 h-1.5 rounded-full bg-brand" />
          )}
        </View>

        <Text
          numberOfLines={1}
          className="text-title text-white font-satoshiBold mt-0.5"
        >
          {title}
        </Text>
      </View>

      <View
        className="px-2.5 py-1 rounded-sm border"
        style={{
          borderColor: isLive ? COLORS.brand : COLORS.border,
          backgroundColor: isLive ? "rgba(255,255,255,0.04)" : "transparent",
        }}
      >
        <Text
          className="text-micro font-spaceBold"
          style={{
            color: isLive ? COLORS.white : COLORS.textMuted,
            fontVariant: ["tabular-nums"],
          }}
        >
          {detail}
        </Text>
      </View>
    </View>
  );
}
