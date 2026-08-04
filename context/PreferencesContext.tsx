import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as FileSystem from "expo-file-system";

// App-wide user preferences, persisted on device. Every preference here is
// real — it changes actual behavior somewhere in the app:
//   haptics       -> pad presses and tap-tempo feedback
//   meterAccents  -> metronome accent grouping in compound/odd meters
//   accentVolume  -> gain of the metronome's accent clicks, 0–1
//   beatVolume    -> gain of the metronome's regular clicks, 0–1
//   accentSound   -> id of the click sound the accent voice plays
//   beatSound     -> id of the click sound the regular-beat voice plays
//   metronomeVolume -> master gain for the metronome, scales accent+beat, 0–1
//   padVolume     -> master gain for the pad instrument, 0–1
//   loopVolume    -> master gain for the loop's backing track, 0–1
//   loopClick     -> play a metronome click alongside a loop (off by default)
//   loopClickPan  -> stereo placement of that loop click
//   padLayers     -> the pad packs stacked into the instrument, each with its
//                    own mix level. One key press sounds all of them.
//   natureNoise   -> the ambience bed layered over every pad. A mixer channel
//                    of its own, muted until the user brings it in.
export type Preferences = {
  haptics: boolean;
  meterAccents: boolean;
  accentVolume: number;
  beatVolume: number;
  accentSound: string;
  beatSound: string;
  metronomeVolume: number;
  padVolume: number;
  loopVolume: number;
  loopClick: boolean;
  loopClickPan: "left" | "center" | "right";
  padLayers: PadLayer[];
  natureNoise: MixSettings;
  seenOnboarding: boolean;
};

/** A mixer channel's own settings. Muting keeps the level for when it returns. */
export type MixSettings = {
  level: number;
  muted: boolean;
};

/** One pack stacked into the pad instrument. */
export type PadLayer = MixSettings & {
  /** PadPack.key from constants/pads.ts. */
  pack: string;
};

const DEFAULTS: Preferences = {
  haptics: true,
  meterAccents: true,
  accentVolume: 1,
  beatVolume: 0.8,
  // Ids from METRONOME_SOUNDS (context/MetronomeContext.tsx). Default to the
  // Ableton kit's accent/beat voices.
  accentSound: "ableton_accent",
  beatSound: "ableton_beat",
  // Per-engine master levels (Settings -> Audio Output / Volume). Defaults are
  // the slider positions the Figma draws (98/140, 119/140, 70/140).
  metronomeVolume: 0.99,
  padVolume: 0.7,
  loopVolume: 0.8,
  // The loop click is opt-in: loops play with no click until the user turns it
  // on (Settings -> Audio Output / Volume). Center = no stereo panning.
  loopClick: false,
  loopClickPan: "center",
  // First entry of PAD_PACKS, at full level. Not imported from
  // constants/pads.ts on purpose: preferences are plain persisted values, and
  // pulling the catalog in here would make this module depend on the audio
  // assets it indexes.
  padLayers: [{ pack: "drone-pad", level: 1, muted: false }],
  // Present in the mixer from the start but muted: ambience under every key
  // press is a deliberate choice, not something to discover already running.
  natureNoise: { level: 0.6, muted: true },
  seenOnboarding: false,
};

type PreferencesContextValue = {
  prefs: Preferences;
  isLoaded: boolean;
  setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const PREFS_FILE = `${FileSystem.documentDirectory}preferences.json`;

// padLayers is the only preference that isn't a scalar, so it's the only one
// where a bad persisted value reaches the code as the wrong *shape* rather than
// just an odd number. A build that stored the earlier single-key `padPack`
// string, or a half-written file, would otherwise hand the pad engine
// something it can't iterate. Anything unusable falls back to the default
// stack rather than leaving the instrument silent.
const normalizePadLayers = (value: unknown): PadLayer[] => {
  if (!Array.isArray(value)) return DEFAULTS.padLayers;

  const layers = value
    .filter(
      (entry): entry is PadLayer =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as PadLayer).pack === "string" &&
        typeof (entry as PadLayer).level === "number" &&
        Number.isFinite((entry as PadLayer).level)
    )
    .map((entry) => ({
      pack: entry.pack,
      level: Math.max(0, Math.min(1, entry.level)),
      // Absent in stacks written before channels could be muted.
      muted: entry.muted === true,
    }));

  return layers.length > 0 ? layers : DEFAULTS.padLayers;
};

const normalizeMixSettings = (
  value: unknown,
  fallback: MixSettings
): MixSettings => {
  if (!value || typeof value !== "object") return fallback;
  const settings = value as Partial<MixSettings>;
  if (typeof settings.level !== "number" || !Number.isFinite(settings.level)) {
    return fallback;
  }
  return {
    level: Math.max(0, Math.min(1, settings.level)),
    muted: settings.muted === true,
  };
};

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const info = await FileSystem.getInfoAsync(PREFS_FILE);
        if (info.exists) {
          const parsed = JSON.parse(
            await FileSystem.readAsStringAsync(PREFS_FILE)
          );
          if (isMounted && parsed && typeof parsed === "object") {
            setPrefs({
              ...DEFAULTS,
              ...parsed,
              padLayers: normalizePadLayers(parsed.padLayers),
              natureNoise: normalizeMixSettings(
                parsed.natureNoise,
                DEFAULTS.natureNoise
              ),
            });
          }
        }
      } catch (error) {
        console.error("Failed to load preferences", error);
      } finally {
        if (isMounted) {
          hasLoadedRef.current = true;
          setIsLoaded(true);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    FileSystem.writeAsStringAsync(PREFS_FILE, JSON.stringify(prefs)).catch(
      (error) => {
        console.error("Failed to save preferences", error);
      }
    );
  }, [prefs]);

  const setPref = <K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <PreferencesContext.Provider value={{ prefs, isLoaded, setPref }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}
