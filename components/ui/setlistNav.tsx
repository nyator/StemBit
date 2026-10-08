import { Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../../constants/theme";
import { ArrowLeft, ArrowRight } from "../icons";

// One step either way along the running order.
//
// Forwards is the obvious one -- a set is played in order and the next cue is
// the one you reach for. Backwards is the one that actually gets used: the band
// wants that last song again, or you opened the wrong cue, and without it the
// only way back is through the setlist sheet, which is a gesture and a read at
// the moment you have least of both.
//
// Its own component because both readouts carry it, and the performance screen
// shows one or the other depending on what is inside the cue. The way you move
// through a set cannot depend on that.

/** The cue on one side of the current one in the running order. */
export type NeighbourCue = {
  title: string;
  /**
   * Set only when moving there is possible -- which today means "with nothing
   * sounding". The name still shows when it isn't: "what is either side of me"
   * is a question you ask while the cue is still running, and an answer that
   * disappears exactly when you are playing is no answer.
   */
  onPress?: () => void;
};

type SetlistNavProps = {
  /** Unset at the ends of the set, where there is nothing to step to. */
  prev?: NeighbourCue;
  next?: NeighbourCue;
};

export default function SetlistNav({ prev, next }: SetlistNavProps) {
  // A setlist of one has no running order to move through.
  if (!prev && !next) return null;

  return (
    <View className="flex-row mt-3">
      <Neighbour direction="prev" cue={prev} />
      <View style={{ width: 8 }} />
      <Neighbour direction="next" cue={next} />
    </View>
  );
}

/**
 * Kept on screen at the ends of the set rather than collapsed, reading "Start
 * of set" or "End of set". A row that loses a button when you reach the last
 * cue is a row whose remaining button moves, and the whole point of a fixed
 * transport is that a hand finds it by position without looking.
 */
function Neighbour({
  direction,
  cue,
}: {
  direction: "prev" | "next";
  cue?: NeighbourCue;
}) {
  const isPrev = direction === "prev";
  const title = cue?.title ?? (isPrev ? "Start of set" : "End of set");
  const enabled = !!cue?.onPress;
  const arrowColor = enabled ? COLORS.brand : COLORS.textMuted;

  return (
    <TouchableOpacity
      onPress={cue?.onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={
        enabled
          ? `Load ${title}`
          : isPrev
            ? "No earlier cue to load"
            : "No later cue to load"
      }
      // Loading is not playing, and at the ends of a set the button is dimmed
      // rather than gone -- both worth knowing without being able to see it.
      accessibilityHint={enabled ? "Loads it and stops there." : undefined}
      accessibilityState={{ disabled: !enabled }}
      activeOpacity={0.7}
      className="flex-row items-center flex-1 px-3 border-2 rounded-lg"
      style={{
        minHeight: 56,
        backgroundColor: COLORS.surface,
        borderColor: enabled ? COLORS.border : COLORS.borderSegment,
        opacity: enabled ? 1 : 0.4,
      }}
    >
      {isPrev && <ArrowLeft size={20} color={arrowColor} />}

      <View className={isPrev ? "flex-1 ml-2" : "flex-1 mr-2"}>
        <Text
          className="text-micro text-ink-muted font-spaceBold tracking-widest"
          style={{ textAlign: isPrev ? "left" : "right" }}
        >
          {isPrev ? "PREV" : "NEXT"}
        </Text>
        <Text
          className="mt-0.5 text-body font-spaceBold"
          numberOfLines={1}
          style={{
            color: cue ? COLORS.white : COLORS.textMuted,
            textAlign: isPrev ? "left" : "right",
          }}
        >
          {title}
        </Text>
      </View>

      {!isPrev && <ArrowRight size={20} color={arrowColor} />}
    </TouchableOpacity>
  );
}
