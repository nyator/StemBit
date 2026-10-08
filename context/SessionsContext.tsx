import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
// The legacy entrypoint, not the package root. SDK 54 ships
// expo-file-system 19, where the root export is the new File/Directory API
// and the path-and-string API this file uses moved behind /legacy. Importing
// from the root leaves EncodingType undefined and makes every read throw.
import * as FileSystem from "expo-file-system/legacy";

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

/**
 * One imported stem in a cue: a single audio file that plays as part of a
 * multi-track song, locked to the others.
 *
 * Holds a URI, never audio. These files are tens of megabytes and this whole
 * structure is serialised to preferences.json on every change -- putting audio
 * in here would make saving a setlist rewrite hundreds of megabytes. The file
 * is copied into app storage on import and read back when the cue is loaded.
 */
export type CueTrack = {
  id: string;
  /** Shown in the mixer -- "Drums", "Bass", whatever the file was called. */
  name: string;
  /** Location in app storage, not the pick location, which doesn't persist. */
  uri: string;
  level: number;
  muted: boolean;
  /**
   * Placement in the stereo field, -1 (hard left) to 1 (hard right).
   *
   * Optional because cues written before the mixer existed don't carry one, and
   * an absent pan means centre -- which is where every one of them was.
   */
  pan?: number;
};

/**
 * A named span of a stem song -- verse, chorus, bridge.
 *
 * Times, not bars. The engine launches by seeking every track to the same
 * second, and storing bars would mean the stored song silently moved if its
 * tempo were ever corrected. Bars are derived for display where they're wanted.
 *
 * A section owns both of its edges. `endSeconds` is what a launched section
 * loops back from, so holding on a chorus repeats the chorus rather than
 * running on into whatever follows.
 *
 * The end used to be derived -- every section ran to wherever the next one
 * began -- which is only right when the sections happen to be contiguous. Mark
 * the four bars you want to loop and the derived end put it at the next marker
 * instead, and the last section of a song had no end at all, so holding on the
 * outro looped it through whatever trailing silence the file carried. Both
 * edges are placed and dragged on purpose now.
 *
 * Unset still means "to the end of the file", because cues written before this
 * carry it that way and because it is the honest answer for a section imported
 * from WAV cue markers, which are points rather than regions.
 */
/**
 * `repeats` value meaning "keep going round until I hit something else".
 *
 * Zero rather than Infinity because a section is persisted as JSON, and
 * Infinity does not survive the round trip -- JSON.stringify writes it as null,
 * which would come back as "no value" and quietly turn a held chorus into a
 * section that plays once. Zero plays zero times under no sane reading, so it
 * is free to mean something else.
 */
export const SECTION_LOOP_FOREVER = 0;

export type CueSection = {
  id: string;
  /** "Verse 1", "Chorus", "Outro". */
  name: string;
  startSeconds: number;
  endSeconds?: number;
  /**
   * How many times the section plays when its pad is hit, then the song
   * carries on into whatever follows.
   *
   * Undefined is once -- hit the pad, hear the chorus, and the song keeps
   * going. That is a deliberate change from what section pads used to do, which
   * was to loop every section forever with no way to say otherwise: the engine
   * read a missing flag as "loop" (`section.loop !== false`), so the only way
   * out of a chorus was to hit another pad or stop.
   *
   * SECTION_LOOP_FOREVER keeps that old behaviour for the sections that want
   * it, which is what the pad's own badge sets it to.
   */
  repeats?: number;
};

export type SessionItem = {
  id: string;
  /** What it's called on the night -- a song name, "Altar call", "Walk-in". */
  title: string;
  /** Loop to load, from the catalog or the user's imports. */
  loopKey?: string;
  /** Tempo for this cue. Falls back to the loop's own when unset. */
  bpm?: number;
  /**
   * Pad pack to arm, and the root to sound it at.
   *
   * Set on a stem cue as well as a loop/pad one, and it means the same thing in
   * both: the key the song is in. For a stem cue that is a detail of the song
   * itself -- worth recording even before anyone decides to play a pad under it
   * -- and it is what the pad is tuned to when they do. A song does not change
   * key because you imported it, so this is editable afterwards from the
   * performance screen as well as from the cue editor.
   */
  padPack?: string;
  padKey?: string;
  padMode?: "major" | "minor";
  /**
   * Imported stems, when this cue is a multi-track song rather than a loop or a
   * pad. Optional because a cue is one kind or the other: the two are different
   * enough on stage that mixing them in one cue would only be confusing.
   *
   * Sections within a song come later and hang off here too -- a section is a
   * span of these same tracks, so the tracks are the thing that has to exist
   * first.
   */
  tracks?: CueTrack[];
  /**
   * Named spans within the stems, in the order they occur. Empty or absent
   * means the song is played from the top as one piece.
   */
  sections?: CueSection[];
};

/**
 * What a cue is called before anyone names it.
 *
 * A cue is created empty and named in STUDIO, so it exists for a moment with
 * nothing in it -- and a blank row in a running order is unreadable. Also what
 * a stem import checks against before taking the first file's name.
 */
export const UNTITLED_CUE = "Untitled cue";

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
  /** Returns the cue it created, so the caller can open it. */
  addItem: (sessionId: string, item: Omit<SessionItem, "id">) => SessionItem;
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

  const addItem = (sessionId: string, item: Omit<SessionItem, "id">) => {
    // Minted here rather than inside the update, so the caller gets it back.
    // Adding a cue now means opening it -- there is no form to fill in first --
    // and the screen it opens is addressed by id.
    const created: SessionItem = { ...item, id: newId() };
    replaceSession(sessionId, (session) => ({
      ...session,
      items: [...session.items, created],
    }));
    return created;
  };

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
