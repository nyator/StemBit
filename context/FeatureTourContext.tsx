import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Plumbing for the first-run feature tour (components/ui/featureTour.tsx).
//
// The tour spotlights real controls, so it needs to know where they actually
// are on screen. Hard-coding the geometry would work today -- the floating tab
// bar is a fixed 228pt pill -- and break silently the first time the design
// moves, with the hole landing next to the thing it's meant to point at. So the
// controls report their own position instead: each one measures itself on
// layout and registers the frame here, and the overlay reads it back.
//
// Kept separate from PreferencesContext because these are transient screen
// coordinates, not settings: they change on rotation and must never be
// persisted.

/** A control's position in window coordinates, as measureInWindow reports it. */
export type TourFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FeatureTourContextValue = {
  frames: Record<string, TourFrame>;
  registerTarget: (id: string, frame: TourFrame) => void;
};

const FeatureTourContext = createContext<FeatureTourContextValue | null>(null);

export function FeatureTourProvider({ children }: { children: ReactNode }) {
  const [frames, setFrames] = useState<Record<string, TourFrame>>({});

  // Layout runs on every tab switch (the bar re-renders to swap icon variants)
  // but the pill never moves, so the same numbers would arrive again and again.
  // Bailing out when nothing changed keeps that from re-rendering the overlay
  // mid-tour, which would restart the step's fade.
  const registerTarget = useCallback((id: string, frame: TourFrame) => {
    setFrames((prev) => {
      const existing = prev[id];
      if (
        existing &&
        existing.x === frame.x &&
        existing.y === frame.y &&
        existing.width === frame.width &&
        existing.height === frame.height
      ) {
        return prev;
      }
      return { ...prev, [id]: frame };
    });
  }, []);

  const value = useMemo(
    () => ({ frames, registerTarget }),
    [frames, registerTarget]
  );

  return (
    <FeatureTourContext.Provider value={value}>
      {children}
    </FeatureTourContext.Provider>
  );
}

/**
 * Returns null outside the provider rather than throwing. The tab bar registers
 * its targets unconditionally, and it also renders in tests and in any future
 * screen mounted outside the provider -- none of which should crash over a
 * cosmetic overlay.
 */
export function useFeatureTour(): FeatureTourContextValue | null {
  return useContext(FeatureTourContext);
}
