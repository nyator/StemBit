
import React, { useRef } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { findLoopByKey, getAllLoops } from "../../constants/loops";
import { PAD_PACKS, findPadPackByKey } from "../../constants/pads";
import { COLORS } from "../../constants/theme";
import { ChevronDown, Musicnote } from "../icons";
import CuePicker, { type CuePickerHandle, type PickerOption } from "./cuePicker";

const MIN_BPM = 20;
const MAX_BPM = 320;

export const clampBpm = (bpm: number) =>
  Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)));

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
  const currentBpm = bpm ?? loop?.bpm ?? 120;

  const loopPickerRef = useRef<CuePickerHandle>(null);
  const padPickerRef = useRef<CuePickerHandle>(null);

  const loopOptions: PickerOption[] = loops.map((entry) => ({
    key: entry.key,
    title: entry.title,
    detail: `${entry.artist}  ·  ${entry.bpm} BPM  ·  ${entry.timeSignature}`,
    group: entry.category,
  }));

  const padOptions: PickerOption[] = PAD_PACKS.map((entry) => ({
    key: entry.key,
    title: entry.title,
    detail: `${entry.artist}  ·  ${entry.genre}`,
    group: entry.genre,
  }));

  return (
    <View className="gap-3">
      {/* 2-Column Sound Engines */}
      <View className="flex-row items-stretch gap-3">
        <EngineSlotCard
          badge="BITS"
          title={loop?.title ?? "No Loop"}
          subtitle={loop ? loop.timeSignature : "TAP TO LOAD"}
          isActive={Boolean(loop)}
          onPress={() => loopPickerRef.current?.present()}
        />
        <EngineSlotCard
          badge="PAD"
          title={pack?.title ?? "No Pad"}
          subtitle={pack ? pack.genre : "TAP TO LOAD"}
          isActive={Boolean(pack)}
          onPress={() => padPickerRef.current?.present()}
        />
      </View>

      {/* Tonality Strip (pad active) */}
      {Boolean(padPack) && (
        <TouchableOpacity
          onPress={onEditKey}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Set root key, currently ${padKey ? `${padKey} ${padMode}` : "unassigned"}`}
          className="flex-row items-center justify-between px-4 py-3 rounded-2xl border bg-surface/60 active:bg-surface/90"
          style={{ borderColor: COLORS.border }}
        >
          <View className="flex-row items-center gap-3">
            <View className="items-center justify-center w-8 h-8 rounded-xl bg-brand/10 border border-brand/20">
              <Musicnote size={15} color={COLORS.brand} />
            </View>
            <View>
              <Text className="text-[10px] font-spaceBold text-ink-muted tracking-widest">
                TONIC KEY
              </Text>
              <Text className="text-body font-satoshiBold text-white mt-0.5">
                {padKey ? `${padKey} ${padMode.toUpperCase()}` : "Select Musical Key"}
              </Text>
            </View>
          </View>

          <View className="px-3 py-1.5 rounded-lg border border-brand/40 bg-brand/10">
            <Text className="text-micro font-spaceBold text-brand">
              {padKey ? "CHANGE" : "SET KEY"}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Tempo Control (loop active) */}
      {Boolean(loop) && (
        <View
          className="p-4 rounded-2xl border bg-surface/50"
          style={{ borderColor: COLORS.border }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Text className="text-micro text-ink-muted font-spaceBold tracking-widest">
                TEMPO CLOCK
              </Text>
              {isLive && (
                <View className="flex-row items-center px-2 py-0.5 rounded-full bg-brand/15 border border-brand/30">
                  <View className="w-1.5 h-1.5 rounded-full bg-brand mr-1.5" />
                  <Text className="text-[10px] text-brand font-spaceBold tracking-wide">
                    LIVE
                  </Text>
                </View>
              )}
            </View>

            {loop?.bpm && (
              <Text
                className="text-micro text-ink-muted font-spaceBold"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                ORIGINAL: {loop.bpm} BPM
              </Text>
            )}
          </View>

          <TempoStepper
            bpm={currentBpm}
            nativeBpm={loop?.bpm}
            onChange={(val) => onChangeBpm(clampBpm(val))}
          />
        </View>
      )}

      {/* Empty State Prompt */}
      {!loopKey && !padPack && (
        <View
          className="items-center py-7 px-4 rounded-2xl border border-dashed"
          style={{
            backgroundColor: "rgba(255,255,255,0.015)",
            borderColor: COLORS.borderSegment,
          }}
        >
          <View className="w-10 h-10 rounded-full items-center justify-center bg-white/5 mb-2">
            <Musicnote size={18} color={COLORS.textMuted} />
          </View>
          <Text className="text-body font-satoshiBold text-white">Empty Cue</Text>
          <Text className="mt-1 text-center text-micro text-ink-muted font-satoshiRegular max-w-[220px]">
            Assign a beat loop or ambient pad to prepare this playback slot.
          </Text>
        </View>
      )}

      {/* Pickers */}
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

function EngineSlotCard({
  badge,
  title,
  subtitle,
  isActive,
  onPress,
}: {
  badge: string;
  title: string;
  subtitle: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${badge} engine: ${title}`}
      className="flex-1 p-3.5 rounded-2xl border justify-between min-h-[116px]"
      style={{
        backgroundColor: isActive ? COLORS.surface : "rgba(255,255,255,0.02)",
        borderColor: isActive ? COLORS.brand : COLORS.borderSegment,
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <View
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: isActive ? COLORS.brand : COLORS.textMuted,
              opacity: isActive ? 1 : 0.4,
            }}
          />
          <Text
            className="text-micro font-spaceBold tracking-widest"
            style={{ color: isActive ? COLORS.brand : COLORS.textMuted }}
          >
            {badge}
          </Text>
        </View>
        <ChevronDown size={14} color={isActive ? COLORS.brand : COLORS.textMuted} />
      </View>

      <View className="mt-2">
        <Text
          numberOfLines={1}
          className="text-body font-satoshiBold leading-tight"
          style={{ color: isActive ? COLORS.white : COLORS.textMuted }}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          className="mt-1 text-[11px] font-spaceBold text-ink-muted"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function TempoStepper({
  bpm = 120,
  nativeBpm,
  onChange,
}: {
  bpm?: number;
  nativeBpm?: number;
  onChange: (bpm: number) => void;
}) {
  const canDec1 = bpm > MIN_BPM;
  const canDec5 = bpm - 5 >= MIN_BPM;
  const canInc1 = bpm < MAX_BPM;
  const canInc5 = bpm + 5 <= MAX_BPM;

  return (
    <View>
      <View className="flex-row items-center justify-between">
        {/* Nudge Down */}
        <View className="flex-row items-center gap-2">
          <StepButton label="−5" disabled={!canDec5} onPress={() => onChange(bpm - 5)} />
          <StepButton label="−1" disabled={!canDec1} onPress={() => onChange(bpm - 1)} />
        </View>

        {/* Readout */}
        <View className="items-center px-4">
          <Text
            className="text-white font-spaceBold tracking-tight"
            style={{ fontVariant: ["tabular-nums"], fontSize: 36, lineHeight: 40 }}
          >
            {bpm}
          </Text>
          <Text className="text-[10px] text-brand font-spaceBold tracking-widest mt-0.5">
            BPM
          </Text>
        </View>

        {/* Nudge Up */}
        <View className="flex-row items-center gap-2">
          <StepButton label="+1" disabled={!canInc1} onPress={() => onChange(bpm + 1)} />
          <StepButton label="+5" disabled={!canInc5} onPress={() => onChange(bpm + 5)} />
        </View>
      </View>

      {/* Quick Reset */}
      {nativeBpm !== undefined && bpm !== nativeBpm && (
        <View className="mt-3 pt-2.5 border-t border-white/5 items-center">
          <TouchableOpacity
            onPress={() => onChange(nativeBpm)}
            hitSlop={8}
            activeOpacity={0.7}
            className="px-3 py-1 rounded-full bg-brand/10 border border-brand/20"
          >
            <Text
              className="text-[10px] text-brand font-spaceBold tracking-widest"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              RESET TO {nativeBpm} BPM
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function StepButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityLabel={`Adjust tempo by ${label}`}
      className="items-center justify-center rounded-xl border bg-canvas"
      style={{
        width: 46,
        height: 46,
        borderColor: disabled ? "rgba(255,255,255,0.05)" : COLORS.border,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {/* <View className="bg-white h-8 w-8 items-center justify-center rounded-full"> */}
      <Text className="text-sm text-white font-spaceBold">{label}</Text>
      {/* </View> */}
    </TouchableOpacity>
  );
}
