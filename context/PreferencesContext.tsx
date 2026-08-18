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
//   metronomeVolume -> master gain for the metronome, scales accent+beat, 0–2
//   padVolume     -> master gain for the pad instrument, 0–1
//   loopVolume    -> master gain for the loop's backing track, 0–1
//   loopClick     -> play a metronome click alongside a loop (off by default)
//   loopClickPan  -> stereo placement of that loop click
//   padLayers     -> the pad packs stacked into the instrument, each with its
//                    own mix level. One key press sounds all of them.
//   natureNoise   -> the ambience bed layered over every pad. A mixer channel
//                    of its own, muted until the user brings it in.
/**
 * How far the metronome's master gain can be pushed, where 1 is the click as
 * its sample was recorded.
 *
 * Past full scale on purpose. Every other level in the app is a balance -- how
 * loud this sits against that -- and tops out where the signal does. A click
 * isn't in the mix; it is competing with a drummer, and the sample at unity is
 * not always louder than one. The engines clamp to this same ceiling, so a
 * hand-edited preferences file can't ask for a gain that would tear.
 */
export const METRONOME_MAX_VOLUME = 2;

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
  /**
   * A click over a stem song, toggled from the performance screen.
   *
   * Separate from loopClick because they are different decisions: a loop is a
   * bare backing track that often wants a count, while a multitrack song
   * usually has a drummer in it already. Everything else about the two clicks
   * -- pan, which samples, how loud -- is shared, so setting it once sets it
   * for both.
   */
  stemClick: boolean;
  loopClickPan: "left" | "center" | "right";
  padLayers: PadLayer[];
  natureNoise: MixSettings;
  seenOnboarding: boolean;
  seenFeatureTour: boolean;
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
  // Per-engine master levels (Settings -> Audio Output / Volume).
  //
  // The metronome's runs to 2 where the others stop at 1, and 1 is its default:
  // the click has to cut through a band rather than sit in a mix, and on a loud
  // stage the accent sample at full scale still isn't always enough. 100% is
  // the click as recorded; above that is deliberate overdrive, which is why it
  // is the number the slider starts at rather than the top of the throw.
  //
  // The pad and loop defaults are the slider positions the Figma draws
  // (119/140, 70/140).
  metronomeVolume: 1,
  padVolume: 0.7,
  loopVolume: 0.8,
  // The loop click is opt-in: loops play with no click until the user turns it
  // on (Settings -> Audio Output / Volume). Center = no stereo panning.
  loopClick: false,
  // Off for the same reason the loop's is: a song is not a rehearsal aid until
  // someone says so, and a click nobody asked for is heard by the room.
  stemClick: false,
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
  // Distinct from seenOnboarding, which gates the pre-login carousel. This one
  // covers the tour over the tab bar, which can only run once the user is
  // actually in the app -- so the two are reached at different moments and a
  // user who skipped one should still get the other.
  seenFeatureTour: false,
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
