import { useCallback, useRef } from "react";


const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 28;

type TapPoint = { x: number; y: number };

export function useDoubleTap() {
  const lastRef = useRef<{ time: number; point?: TapPoint } | null>(null);

  return useCallback((point?: TapPoint) => {
    const now = Date.now();
    const previous = lastRef.current;
    const inTime = previous != null && now - previous.time < DOUBLE_TAP_MS;
    const inPlace =
      point == null ||
      previous?.point == null ||
      (Math.abs(point.x - previous.point.x) < DOUBLE_TAP_SLOP &&
        Math.abs(point.y - previous.point.y) < DOUBLE_TAP_SLOP);

    if (inTime && inPlace) {
      // Cleared, so a third tap starts a fresh pair instead of resetting again.
      lastRef.current = null;
      return true;
    }

    lastRef.current = { time: now, point };
    return false;
  }, []);
}
