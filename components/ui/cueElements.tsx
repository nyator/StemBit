import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { findLoopByKey, getAllLoops } from "../../constants/loops";
import { PAD_PACKS, findPadPackByKey } from "../../constants/pads";
import { COLORS } from "../../constants/theme";
import { ChevronDown } from "../icons";
import CuePicker, { type PickerOption } from "./cuePicker";

// What a loop or pad cue is made of, and the two ways you look at it.
//
// A stem song has a timeline in STUDIO because it is audio laid out in time and
// there is a right answer to where the bridge starts. A loop cue has no such
// picture: it is a handful of choices -- which loop, how fast, which pad, what
// key -- that were made in the cue editor and are worth changing again once you
// have heard them against a room. So STUDIO here is those choices, live, rather
// than a waveform of nothing.
//
// The same facts appear in PERFORM as CueSummary, and there they are only
// facts. On stage you are checking that the cue about to fire is the one you
// meant; a chip you could nudge with a thumb while reaching for PLAY is a way
// to change the tempo of the next song by accident.

const MIN_BPM = 20;
const MAX_BPM = 320;

type CueElementsProps = {
  loopKey?: string;
  bpm?: number;
  padPack?: string;
  padKey?: string;
  padMode: "major" | "minor";
  /** True while this cue is the one sounding, so edits can say they landed. */
  isLive: boolean;
  onChangeLoop: (key: string | undefined) => void;
  onChangeBpm: (bpm: number) => void;
  onChangePadPack: (key: string | undefined) => void;
  /** Opens the key grid, which the performance screen already owns. */
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
  const tempo = bpm ?? loop?.bpm;

  // Which catalog is open over this screen, if either.
  const [picking, setPicking] = useState<"loop" | "pad" | null>(null);

  // Built per render rather than memoised. getAllLoops() hands back a fresh
  // array every time -- it has to, since a user import can land at any moment --
  // so a memo keyed on it would never hit, and mapping a catalog this size costs
  // less than the memo that pretended to avoid it.
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

  return (
    <View>
      <Text className="mb-2 text-ink font-spaceMedium text-label">Loop</Text>

      <SelectRow
        value={loop?.title}
        detail={
          loop
            ? `${loop.artist}   ·   ${loop.timeSignature}`
            : "Pick one from the catalog"
        }
        accessibilityLabel="Choose a loop"
        onPress={() => setPicking("loop")}
      />

      {loop && (
        <>
          {/* The loop's own tempo, said plainly rather than left in the picker.
              Every warp is measured from it -- a loop recorded at 80 and played
              at 140 is a different thing to hear than one recorded at 132 --
              so it belongs next to the tempo control, not two taps away. */}
          <Text className="mt-2 text-micro text-ink-muted font-satoshiRegular">
            Recorded at {loop.bpm} BPM.
          </Text>

          <TempoStepper
            bpm={tempo}
            onChange={onChangeBpm}
            nativeBpm={loop.bpm}
            isLive={isLive}
          />
        </>
      )}

      <Text className="mt-6 mb-2 text-ink font-spaceMedium text-label">Pad</Text>

      <SelectRow
        value={pack?.title}
        detail={
          pack
            ? `${pack.artist}   ·   ${pack.genre}`
            : "A drone under whatever else is playing"
        }
        accessibilityLabel="Choose a pad"
        onPress={() => setPicking("pad")}
      />

      {/* The key sits behind the same grid the stem screen uses rather than a
          second row of twelve chips here. It is one question -- what key is
          this cue in -- and it should be asked one way. */}
      {padPack && (
        <TouchableOpacity
          onPress={onEditKey}
          accessibilityLabel="Change the key"
          activeOpacity={0.8}
          className="flex-row items-center justify-between px-4 py-3 mt-3 border rounded-lg"
          style={{ borderColor: COLORS.border }}
        >
          <Text className="text-micro text-ink-muted font-spaceBold tracking-widest">
            KEY
          </Text>
          <Text className="text-white font-satoshiBold text-body">
            {padKey
              ? `${padKey} ${padMode === "minor" ? "min" : "maj"}`
              : "Not set"}
          </Text>
        </TouchableOpacity>
      )}

      {!loopKey && !padPack && (
        <Text className="mt-6 text-center text-label text-ink-muted font-satoshiRegular">
          This cue has nothing in it yet. Pick a loop, a pad, or both — it will
          fire from here and from its row in the setlist.
        </Text>
      )}

      <CuePicker
        visible={picking === "loop"}
        title="Loop"
        options={loopOptions}
        selectedKey={loopKey}
        noneLabel="No loop"
        onSelect={onChangeLoop}
        onClose={() => setPicking(null)}
      />

      <CuePicker
        visible={picking === "pad"}
        title="Pad"
        options={padOptions}
        selectedKey={padPack}
        noneLabel="No pad"
        onSelect={onChangePadPack}
        onClose={() => setPicking(null)}
      />
    </View>
  );
}

/**
 * What is currently chosen, and the way to change it.
 *
 * The catalog behind it can be any length, so what stands on the screen is one
 * row of fixed height rather than a block that grows with the number of things
 * you could have picked. Same shape as the KEY row below it, because they are
 * the same kind of control: a decision, its current answer, and a way in.
 */
function SelectRow({
  value,
  detail,
  accessibilityLabel,
  onPress,
}: {
  /** Undefined reads as "None" -- an empty row would look like a bug. */
  value?: string;
  detail?: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.8}
      className="flex-row items-center px-4 py-3 border rounded-lg"
      style={{ borderColor: COLORS.border }}
    >
      <View className="flex-1">
        <Text
          className="text-body font-satoshiBold"
          numberOfLines={1}
          style={{ color: value ? COLORS.white : COLORS.textMuted }}
        >
          {value ?? "None"}
        </Text>
        {detail && (
          <Text
            className="mt-0.5 text-micro text-ink-muted font-satoshiRegular"
            numberOfLines={1}
          >
            {detail}
          </Text>
        )}
      </View>

      <ChevronDown size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

type TempoStepperProps = {
  bpm?: number;
  onChange: (bpm: number) => void;
  /** The loop's own tempo, offered as a reset. A song has no such thing. */
  nativeBpm?: number;
  /** True while the cue is sounding, so the row can say the change has landed. */
  isLive?: boolean;
  /** Why the number matters, for a cue that hasn't been given one yet. */
  hint?: string;
};

/**
 * The tempo of a cue, whatever kind of cue it is.
 *
 * Steppers rather than a field, because this gets used against a band playing:
 * you nudge until it sits, and typing means a keyboard over the thing you are
 * listening to. Fives as well as ones, since 80 to 140 one tap at a time is not
 * a control.
 */
export function TempoStepper({
  bpm,
  onChange,
  nativeBpm,
  isLive,
  hint,
}: TempoStepperProps) {
  // An unset tempo steps from a plausible one rather than from zero, so the
  // first tap lands somewhere musical instead of eight taps below it.
  const from = bpm ?? nativeBpm ?? 120;

  return (
    <>
      <Text className="mt-5 mb-2 text-ink font-spaceMedium text-label">
        Tempo
      </Text>

      <View className="flex-row items-center">
        <Step label="−5" onPress={() => onChange(from - 5)} />
        <Step label="−" onPress={() => onChange(from - 1)} />

        <View className="items-center flex-1">
          <Text
            className="text-heading text-white font-spaceBold"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {bpm ?? "--"}
          </Text>
          <Text className="text-micro text-ink-muted font-spaceBold tracking-widest">
            BPM
          </Text>
        </View>

        <Step label="+" onPress={() => onChange(from + 1)} />
        <Step label="+5" onPress={() => onChange(from + 5)} />
      </View>

      <View className="flex-row items-center mt-3">
        {nativeBpm !== undefined && bpm !== nativeBpm && (
          <TouchableOpacity
            onPress={() => onChange(nativeBpm)}
            accessibilityLabel="Back to the loop's own tempo"
            hitSlop={10}
          >
            <Text className="text-micro text-brand font-spaceBold tracking-widest">
              RESET TO {nativeBpm}
            </Text>
          </TouchableOpacity>
        )}
        {isLive && (
          <Text className="ml-auto text-micro text-ink-muted font-satoshiRegular">
            Changes land as you make them.
          </Text>
        )}
      </View>

      {bpm === undefined && hint && (
        <Text className="mt-2 text-micro text-ink-muted font-satoshiRegular">
          {hint}
        </Text>
      )}
    </>
  );
}

/** One nudge of the tempo. Square, so the four of them read as a set. */
function Step({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={`Tempo ${label}`}
      activeOpacity={0.8}
      className="items-center justify-center border rounded-lg"
      style={{ width: 52, height: 52, borderColor: COLORS.border }}
    >
      <Text className="text-body text-white font-spaceBold">{label}</Text>
    </TouchableOpacity>
  );
}

/** Keeps a nudged tempo inside what the engine will warp to. */
export const clampBpm = (bpm: number) =>
  Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)));

type CueSummaryProps = {
  loopKey?: string;
  bpm?: number;
  padPack?: string;
  padKey?: string;
  padMode: "major" | "minor";
  /** Whether the loop is sounding, and whether the pad is. */
  loopIsLive: boolean;
  padIsLive: boolean;
};

/**
 * The same elements on stage: what this cue will put in the room when you
 * press PLAY, at a size you can check without stopping what you are doing.
 *
 * Lit while sounding, the way a track tile is. It answers the question you
 * actually ask mid-cue -- is the pad still going, is that the loop I can hear
 * -- which two lines of grey text at the top of the screen cannot.
 */
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
    <View>
      <Text className="mb-2 text-ink font-spaceMedium text-label">Elements</Text>

      <Element
        label="LOOP"
        title={loop?.title ?? "None"}
        detail={loop ? `${bpm ?? loop.bpm} BPM   ·   ${loop.timeSignature}` : undefined}
        isLive={loopIsLive && !!loop}
      />
      <Element
        label="PAD"
        title={pack?.title ?? "None"}
        detail={
          pack && padKey
            ? `${padKey} ${padMode === "minor" ? "minor" : "major"}`
            : pack
              ? "No key set"
              : undefined
        }
        isLive={padIsLive && !!pack}
      />
    </View>
  );
}

function Element({
  label,
  title,
  detail,
  isLive,
}: {
  label: string;
  title: string;
  detail?: string;
  isLive: boolean;
}) {
  return (
    <View
      className="px-4 py-3 mb-2 border-2 rounded-lg"
      style={{
        backgroundColor: isLive ? COLORS.surface : "transparent",
        borderColor: isLive ? COLORS.brand : COLORS.border,
      }}
    >
      <View className="flex-row items-center">
        <Text
          className="text-micro font-spaceBold tracking-widest"
          style={{ color: isLive ? COLORS.brand : COLORS.textMuted }}
        >
          {label}
        </Text>
        {isLive && (
          <View
            className="ml-2 rounded-full"
            style={{ width: 6, height: 6, backgroundColor: COLORS.brand }}
          />
        )}
      </View>

      <Text
        className="mt-1 text-title text-white font-satoshiBold"
        numberOfLines={1}
      >
        {title}
      </Text>
      {detail && (
        <Text className="mt-0.5 text-micro text-ink-muted font-satoshiRegular">
          {detail}
        </Text>
      )}
    </View>
  );
}
