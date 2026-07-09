import { useCallback, useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";

import { usePreferences } from "../context/PreferencesContext";

type UseBpmControlOptions = {
  bpm: number;
  setBpm: React.Dispatch<React.SetStateAction<number>>;
  minBpm: number;
  maxBpm: number;
};

const HOLD_REPEAT_MS = 70;
const TAP_RESET_MS = 2000;
const MAX_TAP_SAMPLES = 8;
// Intervals further than this fraction from the median are ignored, so one
// hesitant or flammed tap doesn't drag the calculated tempo around.
const TAP_OUTLIER_TOLERANCE = 0.25;

// Shared BPM controls used by both the Metronome and Loop screens:
// - draft-based direct text entry (clamped on commit, not per keystroke)
// - +/- steppers with hold-to-repeat
// - tap tempo with median-based outlier rejection
export function useBpmControl({
  bpm,
  setBpm,
  minBpm,
  maxBpm,
}: UseBpmControlOptions) {
  const { prefs } = usePreferences();
  const clampBpm = useCallback(
    (value: number) => Math.max(minBpm, Math.min(maxBpm, value)),
    [minBpm, maxBpm]
  );

  // --- Direct text entry -------------------------------------------------
  // Clamping every keystroke makes multi-digit entry impossible: typing "8"
  // en route to "80" would snap to the minimum ("20"), and the trailing "0"
  // then reads as 200. So while the field is being edited we hold the raw
  // draft string and only parse + clamp when editing ends.
  const [bpmDraft, setBpmDraft] = useState<string | null>(null);
  const bpmText = bpmDraft ?? String(bpm);

  const handleBpmTextChange = (text: string) => {
    setBpmDraft(text.replace(/[^0-9]/g, ""));
  };

  const commitBpmText = () => {
    setBpmDraft((draft) => {
      if (draft !== null) {
        const parsed = parseInt(draft, 10);
        if (!Number.isNaN(parsed)) {
          setBpm(clampBpm(parsed));
        }
      }
      return null; // fall back to showing the (clamped) bpm value
    });
  };

  // --- Steppers with hold-to-repeat --------------------------------------
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stepBy = useCallback(
    (delta: number) => setBpm((prev) => clampBpm(prev + delta)),
    [setBpm, clampBpm]
  );

  const endHold = useCallback(() => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, []);

  const startHold = useCallback(
    (delta: number) => {
      if (holdIntervalRef.current) return;
      holdIntervalRef.current = setInterval(() => stepBy(delta), HOLD_REPEAT_MS);
    },
    [stepBy]
  );

  const increase = () => stepBy(1);
  const decrease = () => stepBy(-1);
  const startHoldIncrease = () => startHold(1);
  const startHoldDecrease = () => startHold(-1);

  // --- Tap tempo ----------------------------------------------------------
  const tapTimesRef = useRef<number[]>([]);

  const handleTapTempo = () => {
    if (prefs.haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    const now = Date.now();
    const taps = tapTimesRef.current;

    // A long pause means a fresh attempt: start over instead of averaging
    // the gap into the tempo.
    if (taps.length > 0 && now - taps[taps.length - 1] > TAP_RESET_MS) {
      taps.length = 0;
    }

    taps.push(now);
    if (taps.length > MAX_TAP_SAMPLES) {
      taps.shift();
    }

    if (taps.length < 2) return;

    const intervals: number[] = [];
    for (let i = 1; i < taps.length; i++) {
      intervals.push(taps[i] - taps[i - 1]);
    }

    // Average only the intervals close to the median so a single sloppy tap
    // doesn't skew the result.
    const sorted = [...intervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const steady = intervals.filter(
      (interval) => Math.abs(interval - median) / median <= TAP_OUTLIER_TOLERANCE
    );
    const usable = steady.length > 0 ? steady : intervals;
    const avgInterval = usable.reduce((a, b) => a + b, 0) / usable.length;

    setBpm(clampBpm(Math.round(60000 / avgInterval)));
  };

  // Clean up a still-running hold interval on unmount.
  useEffect(() => endHold, [endHold]);

  return {
    bpmText,
    handleBpmTextChange,
    commitBpmText,
    increase,
    decrease,
    startHoldIncrease,
    startHoldDecrease,
    endHold,
    handleTapTempo,
  };
}
