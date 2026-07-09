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
//   haptics      -> pad presses and tap-tempo feedback
//   meterAccents -> metronome accent grouping in compound/odd meters
export type Preferences = {
  haptics: boolean;
  meterAccents: boolean;
  seenOnboarding: boolean;
};

const DEFAULTS: Preferences = {
  haptics: true,
  meterAccents: true,
  seenOnboarding: false,
};

type PreferencesContextValue = {
  prefs: Preferences;
  isLoaded: boolean;
  setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const PREFS_FILE = `${FileSystem.documentDirectory}preferences.json`;

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
            setPrefs({ ...DEFAULTS, ...parsed });
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
