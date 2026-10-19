
import React, { useRef } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { findLoopByKey, getAllLoops } from "../../constants/loops";
import { TONAL_PAD_PACKS, findPadPackByKey } from "../../constants/pads";
import { COLORS } from "../../constants/theme";
import { Folder, Musicnote, type IconComponent } from "../icons";
import CuePicker, {
  type CuePickerHandle,
  type PickerFacet,
  type PickerOption,
} from "./cuePicker";
import { BpmDial, StepperButton } from "./instrument";
import { useBpmControl } from "../../hooks/useBpmControl";
import { roundBpm } from "../../utils/bpm";

// What the session's pickers filter by: Bits' axes for loops, the pad
// browser's for pads (less Type -- a cue's pad is always a tonal one).
const LOOP_FACETS: PickerFacet[] = [
  { key: "category", label: "Category" },
  { key: "artist", label: "Artist" },
  { key: "meter", label: "Meter", chips: true },
];
const PAD_FACETS: PickerFacet[] = [
  { key: "artist", label: "Artist" },
  { key: "genre", label: "Genre" },
];

const MIN_BPM = 20;
const MAX_BPM = 320;

export const clampBpm = (bpm: number) =>
  Math.max(MIN_BPM, Math.min(MAX_BPM, roundBpm(bpm)));

/**
 * A tempo read from a set, kept to the hundredth Live shows it at.
 *
 * Not rounded to a whole number the way a typed tempo is: the stems were
 * rendered at exactly this tempo, and the click is laid over them. A set at
 * 92.5 clicked at 93 gains 14ms a bar on the music -- audibly off within a few
 * bars and a full beat adrift before the song ends.
 */
export const clampSetBpm = (bpm: number) =>
  Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm * 100) / 100));

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
    // The axes Bits filters by, so a cue's loop is narrowed the same way.
    facets: {
      category: entry.category,
      artist: entry.artist,
      meter: entry.timeSignature,
    },
  }));

  // Tonal pads only. A cue's pad plays in the song's key, and ambience has
  // none -- it's stacked from the Pad tab's mixer, not chosen per song.
  const padOptions: PickerOption[] = TONAL_PAD_PACKS.map((entry) => ({
    key: entry.key,
    title: entry.title,
    detail: `${entry.artist}  ·  ${entry.genre}`,
    facets: { artist: entry.artist, genre: entry.genre },
  }));

  return (
    <View className="gap-3">
      {/* What the cue plays: one row each, stacked so a long title has the
          whole width rather than half of it. */}
      <View className="gap-2">
        <EngineSlotCard
          icon={Folder}
          label="Bits"
          title={loop?.title}
          detail={loop ? `${loop.bpm} BPM · ${loop.timeSignature}` : undefined}
          emptyTitle="Choose a loop"
          onPress={() => loopPickerRef.current?.present()}
        />
        <EngineSlotCard
          icon={Musicnote}
          label="Pad"
          title={pack?.title}
          detail={pack?.genre}
          emptyTitle="Choose a pad"
          onPress={() => padPickerRef.current?.present()}
        />
      </View>

      {/* No key control here: the pad pill above the transport sets the key
          and plays the pad, and a second control for the same thing only
          raised the question of which one was in charge. */}

      {/* Tempo Control (loop active) */}
      {Boolean(loop) && (
        <View
          className="p-4"
          // className="p-4 rounded-2xl border bg-surface/50"
          style={{ borderColor: COLORS.border }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              {/* <Text className="text-micro text-ink-muted font-spaceBold tracking-widest">
                TEMPO CLOCK
              </Text> */}
            </View>

            {/* {loop?.bpm && (
              <Text
                className="text-micro text-ink-muted font-spaceBold"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                ORIGINAL: {loop.bpm} BPM
              </Text>
            )} */}
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
        title="Loops"
        options={loopOptions}
        facets={LOOP_FACETS}
        rowFacet="category"
        selectedKey={loopKey}
        noneLabel="Bypass Loop"
        onSelect={onChangeLoop}
      />
      <CuePicker
        ref={padPickerRef}
        title="Pad Packs"
        options={padOptions}
        facets={PAD_FACETS}
        rowFacet="genre"
        selectedKey={padPack}
        noneLabel="Bypass Pad"
        onSelect={onChangePadPack}
      />
    </View>
  );
}

// One sound source in the cue. The same row as the import screen's file row
// -- icon, what's loaded, an action word -- so choosing what a cue plays looks
// like choosing a file everywhere else in the app.
function EngineSlotCard({
  icon: Icon,
  label,
  title,
  detail,
  emptyTitle,
  onPress,
}: {
  icon: IconComponent;
  label: string;
  title?: string;
  detail?: string;
  emptyTitle: string;
  onPress: () => void;
}) {
  const loaded = !!title;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={
        loaded ? `${label}: ${title}. Change` : `${label}: ${emptyTitle}`
      }
      className="flex-row items-center gap-3 px-4 py-3 border rounded-md bg-surface-field border-hairline"
    >
      <View
        className="items-center justify-center rounded-md bg-white/10"
        style={{ width: 40, height: 40 }}
      >
        <Icon size={20} color={loaded ? COLORS.white : COLORS.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text className="text-ink-muted text-micro font-satoshiRegular">
          {label}
        </Text>
        <Text
          numberOfLines={1}
          className="text-body font-satoshiBold"
          style={{ color: loaded ? COLORS.white : COLORS.textMuted }}
        >
          {loaded ? title : emptyTitle}
        </Text>
        {loaded && detail ? (
          <Text
            numberOfLines={1}
            className="text-ink-muted text-micro font-satoshiRegular"
          >
            {detail}
          </Text>
        ) : null}
      </View>
      <Text className="text-micro font-spaceBold" style={{ color: COLORS.brand }}>
        {loaded ? "CHANGE" : "CHOOSE"}
      </Text>
    </TouchableOpacity>
  );
}

export function TempoStepper({
  bpm = 120,
  nativeBpm,
  onChange,
  disabled = false,
}: {
  bpm?: number;
  nativeBpm?: number;
  onChange: (bpm: number) => void;
  /**
   * Shown but not touchable -- the session's Studio locks the tempo while a
   * song plays, where a nudged + would audibly restart a warped song.
   */
  disabled?: boolean;
}) {
  // The hook wants a state setter, and hold-to-run calls it with an updater
  // many times between renders. Reading the latest value from a ref rather
  // than the render's `bpm` keeps a held + climbing instead of repeating the
  // same step.
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const setBpm: React.Dispatch<React.SetStateAction<number>> = (value) => {
    const next = typeof value === "function" ? value(bpmRef.current) : value;
    bpmRef.current = next;
    onChange(next);
  };

  // The same controls as the Metronome and Loop screens -- minus/plus that nudge
  // on a tap and run on a hold, either side of a dial you can type into -- so a
  // tempo is set the same way wherever it is set.
  const controls = useBpmControl({
    bpm,
    setBpm,
    minBpm: MIN_BPM,
    maxBpm: MAX_BPM,
  });

  return (
    <View
      pointerEvents={disabled ? "none" : "auto"}
      accessibilityState={{ disabled }}
      style={disabled ? { opacity: 0.4 } : undefined}
    >
      <View className="flex-row items-center self-center gap-3">
        <StepperButton
          direction="down"
          controls={controls}
          label="Decrease tempo"
        />
        <BpmDial controls={controls} isPlaying={false} variant="compact" />
        <StepperButton
          direction="up"
          controls={controls}
          label="Increase tempo"
        />
      </View>

      {/* Quick Reset */}
      {nativeBpm !== undefined && bpm !== nativeBpm && (
        <View className="mt-3 pt-2.5 border-white/5 items-center">
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

/**
 * Moves a stem song against the click, a few milliseconds at a time.
 *
 * Shown as what happens to the stems -- negative is earlier -- because the
 * complaint it answers is "the music is late", and the fix for that reads as
 * a minus. Usually already set by the measurement an MP3 song gets on its
 * first load; this is for the ear to finish the job.
 */
export function SyncNudge({
  offsetSeconds = 0,
  onChange,
}: {
  offsetSeconds?: number;
  onChange: (seconds: number) => void;
}) {
  const ms = Math.round(offsetSeconds * 1000);
  // A quarter of a second is far past any padding; further is a mistake.
  const nudge = (by: number) =>
    onChange(Math.max(-250, Math.min(250, ms + by)) / 1000);

  const button = (label: string, by: number, description: string) => (
    <TouchableOpacity
      onPress={() => nudge(by)}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityLabel={description}
      className="items-center justify-center rounded-lg border bg-canvas"
      style={{ width: 40, height: 32, borderColor: COLORS.border }}
    >
      <Text className="text-xs text-white font-spaceBold">{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-[10px] tracking-wider font-spaceBold text-ink-muted uppercase">
        Stem sync
      </Text>
      <View className="flex-row items-center gap-1.5">
        {button("−5", -5, "Move stems 5 milliseconds earlier")}
        {button("−1", -1, "Move stems 1 millisecond earlier")}
        <Text
          className="text-sm text-white font-spaceBold text-center"
          style={{ fontVariant: ["tabular-nums"], minWidth: 64 }}
        >
          {ms > 0 ? `+${ms}` : ms} ms
        </Text>
        {button("+1", 1, "Move stems 1 millisecond later")}
        {button("+5", 5, "Move stems 5 milliseconds later")}
      </View>
    </View>
  );
}
