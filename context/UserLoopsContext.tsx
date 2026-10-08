import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
// The legacy entrypoint, not the package root. SDK 54 ships
// expo-file-system 19, where the root export is the new File/Directory API
// and the path-and-string API this file uses moved behind /legacy. Importing
// from the root leaves EncodingType undefined and makes every read throw.
import * as FileSystem from "expo-file-system/legacy";

import { resolveAudioUri } from "../utils/loadAssetBase64";

import {
  LOOP_CATEGORIES,
  USER_LOOP_ARTIST,
  setCatalogOverrides,
  setUserLoopRegistry,
  type Loop,
  type LoopCategory,
  type LoopOverride,
} from "../constants/loops";

// Loops the user imported from their own device (app/(loops)/import.tsx): the
// audio copied into app storage, plus the tempo and trim they set for it, which
// is what lets the engine warp it like any shipped loop.
//
// Two separate things are persisted, deliberately:
//   - the audio file, under documentDirectory/loops/
//   - an index of records, as JSON
// The index stores the file's NAME, never its full path. documentDirectory sits
// inside a container whose absolute path changes between installs on iOS, so a
// saved absolute URI is a link that quietly breaks on update; the path is
// rebuilt at read time instead.

const LOOPS_DIR = `${FileSystem.documentDirectory}loops/`;
const INDEX_FILE = `${FileSystem.documentDirectory}userLoops.json`;
// Corrections to shipped loops, kept in their own file rather than folded into
// the index above: they're about audio the app ships, not audio the user added,
// and mixing them would mean migrating a format that's already on devices.
const OVERRIDES_FILE = `${FileSystem.documentDirectory}loopOverrides.json`;

/** Everything an import needs; the rest is derived or generated. */
export type NewUserLoop = {
  title: string;
  category: LoopCategory;
  bpm: number;
  timeSignature: string;
  /** The loop region, seconds into the file. */
  trimStart: number;
  trimEnd: number;
  /** Where the picked file is now — the picker's copy in the cache. */
  sourceUri: string;
  /** The picked file's name, for its extension. */
  fileName: string;
  mimeType?: string;
};

/** Everything a download from the loop store needs. */
export type NewRemoteLoop = {
  /** The loop's key in the store's manifest, for spotting a re-download. */
  remoteKey: string;
  /** The pack it came from. */
  packId: string;
  /** The pack's artist, kept as the credit on the local copy. */
  artist: string;
  title: string;
  category: LoopCategory;
  bpm: number;
  timeSignature: string;
  trimStart: number;
  trimEnd: number;
  /** Where the finished download is now -- a file in the cache directory. */
  sourceUri: string;
  fileName: string;
  /** The local key to file it under, so a re-download is recognisable. */
  key: string;
};

type StoredUserLoop = {
  key: string;
  title: string;
  category: LoopCategory;
  bpm: number;
  timeSignature: string;
  /** File name inside LOOPS_DIR. */
  file: string;
  trimStart: number;
  trimEnd: number;
  /** The tempo to open it at, when that is not the recorded one. */
  playbackBpm?: number;
  createdAt: number;
  /**
   * Who to credit. Absent on everything imported from the user's own device,
   * which is every record written before the store existed -- hence optional
   * rather than a migration: an index already on a device stays readable, and
   * its entries keep falling back to USER_LOOP_ARTIST the way they always did.
   */
  artist?: string;
  /** The store pack this was downloaded from, when it was. */
  packId?: string;
  /** Its key in the store manifest, so the store can mark it downloaded. */
  remoteKey?: string;
};

/**
 * What an import's screen can change afterwards: everything except the audio
 * itself. Swapping the file would be a different loop wearing this one's key --
 * the engine has its decode cached under that key, and the Loop tab may have it
 * loaded -- so that's an add, not an edit.
 */
export type UserLoopEdits = {
  title: string;
  category: LoopCategory;
  bpm: number;
  timeSignature: string;
  trimStart: number;
  trimEnd: number;
  /** Undefined means "open it at the tempo it was recorded at". */
  playbackBpm?: number;
};

type UserLoopsContextValue = {
  /** The user's imports as catalog entries, newest first. */
  userLoops: Loop[];
  /** False until the index has been read off disk. */
  isLoaded: boolean;
  addUserLoop: (input: NewUserLoop) => Promise<Loop>;
  /**
   * File a finished store download in the library.
   *
   * Separate from addUserLoop because the two disagree about identity. An
   * import is anonymous -- a fresh random key, credited to the user, and
   * importing the same file twice legitimately gives two loops. A download is
   * the pack author's named work arriving under a key derived from the
   * manifest, and downloading it twice has to give one loop, not two.
   */
  addRemoteLoop: (input: NewRemoteLoop) => Promise<Loop>;
  /** Manifest keys already downloaded, so the store can mark its rows. */
  downloadedRemoteKeys: string[];
  /**
   * Take a copy of any loop and file it under the user's own.
   *
   * The point is that the copy is fully theirs: renameable, re-tempoable,
   * re-categorisable -- none of which a shipped loop allows, because its name
   * and meter are catalog facts and the only thing an override can move is the
   * tempo and the trim.
   *
   * A copy rather than a mutation, so the original stays where it was. Wanting
   * this one at 96 called "Sunday Opener" is not the same as wanting the
   * catalog's 107 to stop existing.
   */
  duplicateLoop: (loop: Loop) => Promise<Loop>;
  /** Re-save an existing import's tempo, trim and details, keeping its key. */
  updateUserLoop: (key: string, edits: UserLoopEdits) => void;
  removeUserLoop: (key: string) => Promise<void>;
  /**
   * Correct what the app believes about a SHIPPED loop -- its tempo, trim or time
   * signature. The audio is bundled and can't change; this is the app's reading
   * of it, which is what every warp is measured from.
   */
  setLoopOverride: (key: string, override: LoopOverride) => void;
  /** Put a shipped loop back to the values it ships with. */
  clearLoopOverride: (key: string) => void;
  /** Keys of shipped loops currently corrected, so the browser can mark them. */
  overriddenKeys: string[];
};

const UserLoopsContext = createContext<UserLoopsContextValue | null>(null);

// Pickers hand back a name with an extension almost every time; the MIME map is
// for the ones that don't. The extension is cosmetic to the loop engine (it
// decodes by content) but the row preview plays through the native player,
// which does better when the file is named like what it is.
const MIME_EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "m4a",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
};

const extensionFor = (fileName: string, mimeType?: string) => {
  const fromName = fileName.includes(".")
    ? fileName.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
  if (fromName && fromName.length <= 5) return fromName;
  return (mimeType && MIME_EXTENSIONS[mimeType.toLowerCase()]) || "audio";
};

const isCategory = (value: unknown): value is LoopCategory =>
  typeof value === "string" &&
  (LOOP_CATEGORIES as readonly string[]).includes(value);

// The index is a file on a user's device: a partial write, a restore from an
// older build, or a hand-edited copy all reach us as the wrong shape. Anything
// unusable is dropped, one entry at a time — a single bad record shouldn't cost
// the user the rest of their imports.
const normalize = (value: unknown): StoredUserLoop[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Partial<StoredUserLoop>;
    if (
      typeof record.key !== "string" ||
      typeof record.file !== "string" ||
      typeof record.title !== "string" ||
      typeof record.bpm !== "number" ||
      !Number.isFinite(record.bpm) ||
      typeof record.trimStart !== "number" ||
      typeof record.trimEnd !== "number" ||
      !Number.isFinite(record.trimStart) ||
      !Number.isFinite(record.trimEnd) ||
      record.trimEnd <= record.trimStart
    ) {
      return [];
    }

    return [
      {
        key: record.key,
        title: record.title,
        // A category retired from LOOP_CATEGORIES would leave the loop
        // unreachable behind every filter chip, so it falls back to the first.
        category: isCategory(record.category)
          ? record.category
          : LOOP_CATEGORIES[0],
        bpm: record.bpm,
        timeSignature:
          typeof record.timeSignature === "string"
            ? record.timeSignature
            : "4 / 4",
        file: record.file,
        trimStart: record.trimStart,
        trimEnd: record.trimEnd,
        // Dropped rather than defaulted when it isn't a usable number: absent
        // means "open at the recorded tempo", which is also the right answer
        // for a value that has been corrupted.
        playbackBpm:
          typeof record.playbackBpm === "number" &&
          Number.isFinite(record.playbackBpm) &&
          record.playbackBpm > 0
            ? record.playbackBpm
            : undefined,
        createdAt:
          typeof record.createdAt === "number" ? record.createdAt : Date.now(),
        // The three store fields travel together or not at all: a record with a
        // pack id but no artist would credit a download to "Yours", which is
        // the one thing filing it under a pack was for.
        artist: typeof record.artist === "string" ? record.artist : undefined,
        packId: typeof record.packId === "string" ? record.packId : undefined,
        remoteKey:
          typeof record.remoteKey === "string" ? record.remoteKey : undefined,
      },
    ];
  });
};

const toLoop = (record: StoredUserLoop): Loop => ({
  key: record.key,
  title: record.title,
  // A download keeps its artist; an import has none to keep, and is filed under
  // "Yours" so the browser's Artist axis gets that chip for free.
  artist: record.artist ?? USER_LOOP_ARTIST,
  category: record.category,
  bpm: record.bpm,
  timeSignature: record.timeSignature,
  source: LOOPS_DIR + record.file,
  trimStart: record.trimStart,
  trimEnd: record.trimEnd,
  playbackBpm: record.playbackBpm,
  userAdded: true,
  packId: record.packId,
});

export function UserLoopsProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<StoredUserLoop[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  // Mirrors records for the async mutations, which would otherwise build their
  // next list from whatever state they closed over when they were called.
  const recordsRef = useRef<StoredUserLoop[]>([]);
  const [overrides, setOverrides] = useState<Record<string, LoopOverride>>({});
  const overridesRef = useRef<Record<string, LoopOverride>>({});

  // Every write goes through here, so the module-level registry the engine
  // reads (constants/loops.ts) is updated in the same breath as the state the
  // UI reads. Doing that here rather than in an effect matters: effects run
  // child-first, so a child re-rendering with a new list would look the loop up
  // in a registry that hadn't caught up yet.
  const commit = (next: StoredUserLoop[], persist = true) => {
    // Held newest-first from here on, so the registry, the browser list and the
    // saved index can't disagree about the order.
    const sorted = [...next].sort((a, b) => b.createdAt - a.createdAt);
    recordsRef.current = sorted;
    setRecords(sorted);
    setUserLoopRegistry(sorted.map(toLoop));

    if (!persist) return;
    FileSystem.writeAsStringAsync(INDEX_FILE, JSON.stringify(sorted)).catch(
      (error) => {
        console.error("Failed to save imported loops", error);
      }
    );
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const info = await FileSystem.getInfoAsync(INDEX_FILE);
        if (info.exists) {
          const parsed = JSON.parse(
            await FileSystem.readAsStringAsync(INDEX_FILE)
          );
          const stored = normalize(parsed);
          // Confirm the audio is actually there. An index entry whose file went
          // missing — a restore from backup, an import interrupted mid-copy —
          // would otherwise sit in the browser as a row that can't play.
          const present = await Promise.all(
            stored.map(async (record) => {
              const file = await FileSystem.getInfoAsync(LOOPS_DIR + record.file);
              return file.exists ? record : null;
            })
          );
          const alive = present.filter(
            (record): record is StoredUserLoop => record !== null
          );
          if (!isMounted) return;
          // Only rewrite the index if pruning actually removed something.
          commit(alive, alive.length !== stored.length);
        }
      } catch (error) {
        console.error("Failed to load imported loops", error);
      }

      try {
        const info = await FileSystem.getInfoAsync(OVERRIDES_FILE);
        if (info.exists) {
          const parsed = JSON.parse(
            await FileSystem.readAsStringAsync(OVERRIDES_FILE)
          );
          if (isMounted && parsed && typeof parsed === "object") {
            // Registry first, state second: a correction has to be in place
            // before anything looks a loop up, and the engine's lookups don't go
            // through React at all.
            overridesRef.current = parsed;
            setCatalogOverrides(parsed);
            setOverrides(parsed);
          }
        }
      } catch (error) {
        console.error("Failed to load loop corrections", error);
      }

      if (isMounted) setIsLoaded(true);
    };

    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Copy the picked file into app storage before recording it. The picker's own
  // copy lives in the cache directory, which the OS is free to empty whenever
  // it likes — keeping only that would give the user a loop that works until
  // the day it doesn't.
  const addUserLoop = async (input: NewUserLoop): Promise<Loop> => {
    const key = `user-${Date.now().toString(36)}-${Math.floor(
      Math.random() * 1296
    ).toString(36)}`;
    const file = `${key}.${extensionFor(input.fileName, input.mimeType)}`;

    await FileSystem.makeDirectoryAsync(LOOPS_DIR, { intermediates: true });
    await FileSystem.copyAsync({ from: input.sourceUri, to: LOOPS_DIR + file });

    const record: StoredUserLoop = {
      key,
      title: input.title,
      category: input.category,
      bpm: input.bpm,
      timeSignature: input.timeSignature,
      file,
      trimStart: input.trimStart,
      trimEnd: input.trimEnd,
      createdAt: Date.now(),
    };

    commit([record, ...recordsRef.current]);
    return toLoop(record);
  };

  const addRemoteLoop = async (input: NewRemoteLoop): Promise<Loop> => {
    // Already here: hand back what's on disk rather than writing a second copy.
    // The store checks this before it downloads anything, so reaching it means
    // two downloads of the same loop overlapped -- and the loser should be a
    // no-op, not a duplicate row.
    const existing = recordsRef.current.find((entry) => entry.key === input.key);
    if (existing) return toLoop(existing);

    const file = `${input.key}.${extensionFor(input.fileName)}`;

    await FileSystem.makeDirectoryAsync(LOOPS_DIR, { intermediates: true });
    // Moved, not copied: the source is this app's own download in the cache
    // directory and nothing else refers to it, so copying would leave a second
    // full-size file behind for the OS to clear up whenever it got round to it.
    await FileSystem.moveAsync({ from: input.sourceUri, to: LOOPS_DIR + file });

    const record: StoredUserLoop = {
      key: input.key,
      title: input.title,
      category: input.category,
      bpm: input.bpm,
      timeSignature: input.timeSignature,
      file,
      trimStart: input.trimStart,
      trimEnd: input.trimEnd,
      createdAt: Date.now(),
      artist: input.artist,
      packId: input.packId,
      remoteKey: input.remoteKey,
    };

    commit([record, ...recordsRef.current]);
    return toLoop(record);
  };

  const duplicateLoop = async (loop: Loop): Promise<Loop> => {
    // Every loop in the app carries a region -- the bundled ones state theirs
    // in constants/loops.ts, imports get one from the trimmer. Without a valid
    // pair there is nothing to write: normalize() drops a record whose trimEnd
    // isn't past its trimStart, so a copy made without one would vanish on the
    // next launch rather than fail here where it can be seen.
    const trimStart = loop.trimStart ?? 0;
    const trimEnd = loop.trimEnd ?? 0;
    if (!(trimEnd > trimStart)) {
      throw new Error(`${loop.title} has no loop region to copy`);
    }

    // Resolved rather than assumed to be a file: a bundled loop is a module id
    // and lives inside the app package until the asset system unpacks it.
    const { uri, fileName } = await resolveAudioUri(loop.source);

    return addUserLoop({
      // The name is kept as it stands. The editor opens straight after this so
      // it can be changed, and inventing "Afro Piano (copy)" for somebody who
      // is about to rename it anyway is noise -- the browser already tells the
      // two apart by artist.
      title: loop.title,
      category: loop.category,
      bpm: loop.bpm,
      timeSignature: loop.timeSignature,
      trimStart,
      trimEnd,
      sourceUri: uri,
      fileName,
    });
  };

  // Keeps the key, the file and the created date; replaces what the user can
  // actually edit. Same key matters: the loop may be loaded in the Loop tab and
  // decoded in the engine under it, so an edit re-selects rather than reloads.
  const updateUserLoop = (key: string, edits: UserLoopEdits) => {
    if (!recordsRef.current.some((entry) => entry.key === key)) return;
    commit(
      recordsRef.current.map((entry) =>
        entry.key === key ? { ...entry, ...edits } : entry
      )
    );
  };

  // Same discipline as the imports: the module-level registry the engine reads is
  // updated in the same breath as the state the UI reads, not in an effect.
  const commitOverrides = (next: Record<string, LoopOverride>) => {
    overridesRef.current = next;
    setOverrides(next);
    setCatalogOverrides(next);
    FileSystem.writeAsStringAsync(OVERRIDES_FILE, JSON.stringify(next)).catch(
      (error) => {
        console.error("Failed to save loop corrections", error);
      }
    );
  };

  const setLoopOverride = (key: string, override: LoopOverride) => {
    commitOverrides({ ...overridesRef.current, [key]: override });
  };

  const clearLoopOverride = (key: string) => {
    if (!overridesRef.current[key]) return;
    const next = { ...overridesRef.current };
    delete next[key];
    commitOverrides(next);
  };

  const removeUserLoop = async (key: string) => {
    const record = recordsRef.current.find((entry) => entry.key === key);
    if (!record) return;

    commit(recordsRef.current.filter((entry) => entry.key !== key));
    // Best effort. The row is gone from the catalog either way, and a file left
    // behind costs a few hundred KB — far less than an import that appears to
    // have failed because the delete threw.
    FileSystem.deleteAsync(LOOPS_DIR + record.file, {
      idempotent: true,
    }).catch((error) => {
      console.error("Failed to delete loop audio", error);
    });
  };

  // Already newest-first (see commit). Memoised for a stable identity while
  // nothing changes: this list is an effect dependency in LoopPlaybackContext.
  const userLoops = useMemo(() => records.map(toLoop), [records]);

  const downloadedRemoteKeys = useMemo(
    () =>
      records.flatMap((record) => (record.remoteKey ? [record.remoteKey] : [])),
    [records]
  );

  return (
    <UserLoopsContext.Provider
      value={{
        userLoops,
        isLoaded,
        addUserLoop,
        addRemoteLoop,
        downloadedRemoteKeys,
        duplicateLoop,
        updateUserLoop,
        removeUserLoop,
        setLoopOverride,
        clearLoopOverride,
        overriddenKeys: Object.keys(overrides),
      }}
    >
      {children}
    </UserLoopsContext.Provider>
  );
}

export function useUserLoops() {
  const context = useContext(UserLoopsContext);
  if (!context) {
    throw new Error("useUserLoops must be used within a UserLoopsProvider");
  }
  return context;
}
