import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as FileSystem from "expo-file-system";

// A session is a setlist for a show: a named, ordered list of loops for
// quick access. Loops are referenced by catalog key (constants/loops.ts) so
// a session stays valid across app updates as long as the key exists.
export type Session = {
  id: string;
  name: string;
  loopKeys: string[];
  createdAt: number;
};

type SessionsContextValue = {
  sessions: Session[];
  isLoaded: boolean;
  createSession: (name: string) => string;
  renameSession: (id: string, name: string) => void;
  deleteSession: (id: string) => void;
  addLoopToSession: (id: string, loopKey: string) => void;
  removeLoopFromSession: (id: string, index: number) => void;
  moveLoopInSession: (id: string, from: number, to: number) => void;
};

const SessionsContext = createContext<SessionsContextValue | null>(null);

const SESSIONS_FILE = `${FileSystem.documentDirectory}sessions.json`;

const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasLoadedRef = useRef(false);

  // Load persisted sessions once on mount.
  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const info = await FileSystem.getInfoAsync(SESSIONS_FILE);
        if (info.exists) {
          const raw = await FileSystem.readAsStringAsync(SESSIONS_FILE);
          const parsed = JSON.parse(raw);
          if (isMounted && Array.isArray(parsed)) {
            setSessions(parsed);
          }
        }
      } catch (error) {
        console.error("Failed to load sessions", error);
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

  // Persist on every change after the initial load. Setlists are tiny, so
  // a straight write per mutation is fine.
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    FileSystem.writeAsStringAsync(SESSIONS_FILE, JSON.stringify(sessions)).catch(
      (error) => {
        console.error("Failed to save sessions", error);
      }
    );
  }, [sessions]);

  const createSession = (name: string) => {
    const id = makeId();
    setSessions((prev) => [
      ...prev,
      { id, name: name.trim() || "Untitled Session", loopKeys: [], createdAt: Date.now() },
    ]);
    return id;
  };

  const renameSession = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s))
    );
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const addLoopToSession = (id: string, loopKey: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, loopKeys: [...s.loopKeys, loopKey] } : s
      )
    );
  };

  const removeLoopFromSession = (id: string, index: number) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, loopKeys: s.loopKeys.filter((_, i) => i !== index) }
          : s
      )
    );
  };

  const moveLoopInSession = (id: string, from: number, to: number) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (to < 0 || to >= s.loopKeys.length || from === to) return s;
        const keys = [...s.loopKeys];
        const [moved] = keys.splice(from, 1);
        keys.splice(to, 0, moved);
        return { ...s, loopKeys: keys };
      })
    );
  };

  return (
    <SessionsContext.Provider
      value={{
        sessions,
        isLoaded,
        createSession,
        renameSession,
        deleteSession,
        addLoopToSession,
        removeLoopFromSession,
        moveLoopInSession,
      }}
    >
      {children}
    </SessionsContext.Provider>
  );
}

export function useSessions() {
  const context = useContext(SessionsContext);
  if (!context) {
    throw new Error("useSessions must be used within a SessionsProvider");
  }
  return context;
}
