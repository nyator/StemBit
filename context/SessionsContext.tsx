import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as FileSystem from "expo-file-system";

// What you set up before a gig so you don't go hunting for a loop on stage.
//
// Two levels:
//   session -- one night's running order: a gig, a service, a rehearsal
//   item    -- one cue in it: a loop, a pad, or both, at the tempo and key
//
// An item stores KEYS, never audio: the loop's catalog key and the pad's pack
// and root. So a setlist survives its loops being re-trimmed or re-tempoed --
// it points at the loop, not at a copy of what the loop was that day.

const SESSIONS_FILE = `${FileSystem.documentDirectory}sessions.json`;

export type SessionItem = {
  id: string;
  /** What it's called on the night -- a song name, "Altar call", "Walk-in". */
  title: string;
  /** Loop to load, from the catalog or the user's imports. */
  loopKey?: string;
  /** Tempo for this cue. Falls back to the loop's own when unset. */
  bpm?: number;
  /** Pad pack to arm, and the root to sound it at. */
  padPack?: string;
  padKey?: string;
  padMode?: "major" | "minor";
};

export type Session = {
  id: string;
  title: string;
  items: SessionItem[];
  createdAt: number;
};

type SessionsContextValue = {
  sessions: Session[];
  isLoaded: boolean;
  addSession: (title: string) => Session;
  renameSession: (id: string, title: string) => void;
  removeSession: (id: string) => void;
  addItem: (sessionId: string, item: Omit<SessionItem, "id">) => void;
  updateItem: (
    sessionId: string,
    itemId: string,
    changes: Partial<Omit<SessionItem, "id">>
  ) => void;
  removeItem: (sessionId: string, itemId: string) => void;
  /** Put the running order in exactly this sequence, after a drag. */
  reorderItems: (sessionId: string, orderedIds: string[]) => void;
  findSession: (id: string | undefined) => Session | undefined;
};

const SessionsContext = createContext<SessionsContextValue | null>(null);

const newId = () =>
  `${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;

// A file on a user's device: a partial write or a hand-edited copy reaches us as
// the wrong shape. Anything unusable is dropped one level at a time, so a bad
// item costs its setlist rather than the whole gig.
const normalize = (value: unknown): Session[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const session = entry as Partial<Session>;
    if (typeof session.id !== "string" || typeof session.title !== "string") {
      return [];
    }

    const readItems = (value: unknown): SessionItem[] =>
      Array.isArray(value)
        ? value.flatMap((raw) => {
            const item = raw as Partial<SessionItem>;
            if (typeof item?.id !== "string" || typeof item?.title !== "string") {
              return [];
            }
            return [item as SessionItem];
          })
        : [];

    // Sessions written when a session held several setlists keep their cues:
    // they run together into one order rather than being dropped.
    const nested = Array.isArray((session as { setlists?: unknown }).setlists)
      ? ((session as { setlists: { items?: unknown }[] }).setlists ?? []).flatMap(
          (setlist) => readItems(setlist?.items)
        )
      : [];

    return [
      {
        id: session.id,
        title: session.title,
        items: [...readItems(session.items), ...nested],
        createdAt:
          typeof session.createdAt === "number" ? session.createdAt : Date.now(),
      },
    ];
  });
};

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  // Mirrors state for the updaters, which build their next list from what's on
  // disk rather than from whatever a render closed over.
  const sessionsRef = useRef<Session[]>([]);

  const commit = (next: Session[]) => {
    sessionsRef.current = next;
    setSessions(next);
    FileSystem.writeAsStringAsync(SESSIONS_FILE, JSON.stringify(next)).catch(
      (error) => {
        console.error("Failed to save sessions", error);
      }
    );
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const info = await FileSystem.getInfoAsync(SESSIONS_FILE);
        if (info.exists) {
          const parsed = JSON.parse(
            await FileSystem.readAsStringAsync(SESSIONS_FILE)
          );
          if (isMounted) {
            const loaded = normalize(parsed);
            sessionsRef.current = loaded;
            setSessions(loaded);
          }
        }
      } catch (error) {
        console.error("Failed to load sessions", error);
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // Every edit is "replace the session it belongs to", so the whole tree is
  // written back the same way and there's one place a save can go wrong.
  const replaceSession = (id: string, change: (session: Session) => Session) => {
    commit(
      sessionsRef.current.map((session) =>
        session.id === id ? change(session) : session
      )
    );
  };

  const addSession = (title: string) => {
    const session: Session = {
      id: newId(),
      title: title.trim() || "New session",
      items: [],
      createdAt: Date.now(),
    };
    commit([session, ...sessionsRef.current]);
    return session;
  };

  const renameSession = (id: string, title: string) =>
    replaceSession(id, (session) => ({
      ...session,
      title: title.trim() || session.title,
    }));

  const removeSession = (id: string) =>
    commit(sessionsRef.current.filter((session) => session.id !== id));

  const addItem = (sessionId: string, item: Omit<SessionItem, "id">) =>
    replaceSession(sessionId, (session) => ({
      ...session,
      items: [...session.items, { ...item, id: newId() }],
    }));

  const updateItem = (
    sessionId: string,
    itemId: string,
    changes: Partial<Omit<SessionItem, "id">>
  ) =>
    replaceSession(sessionId, (session) => ({
      ...session,
      items: session.items.map((item) =>
        item.id === itemId ? { ...item, ...changes } : item
      ),
    }));

  const removeItem = (sessionId: string, itemId: string) =>
    replaceSession(sessionId, (session) => ({
      ...session,
      items: session.items.filter((item) => item.id !== itemId),
    }));

  const reorderItems = (sessionId: string, orderedIds: string[]) =>
    replaceSession(sessionId, (session) => {
      // Rebuilt from the ids the list handed back, then anything it didn't
      // mention appended -- a cue added on another screen mid-drag ends up at the
      // bottom rather than being dropped on the floor.
      const byId = new Map(session.items.map((item) => [item.id, item]));
      const ordered = orderedIds.flatMap((id) => {
        const item = byId.get(id);
        if (!item) return [];
        byId.delete(id);
        return [item];
      });
      return { ...session, items: [...ordered, ...byId.values()] };
    });

  const findSession = (id: string | undefined) =>
    sessions.find((session) => session.id === id);

  return (
    <SessionsContext.Provider
      value={{
        sessions,
        isLoaded,
        addSession,
        renameSession,
        removeSession,
        addItem,
        updateItem,
        removeItem,
        reorderItems,
        findSession,
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
