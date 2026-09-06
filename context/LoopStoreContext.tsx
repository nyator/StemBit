import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
// The legacy entrypoint, not the package root -- same reason as everywhere else
// in the app: SDK 54 moved the path-and-string API behind /legacy, and
// createDownloadResumable is part of it.
import * as FileSystem from "expo-file-system/legacy";

import {
  catalogUrl,
  fileNameFor,
  isPackUnlocked,
  isStoreConfigured,
  localKeyFor,
  objectUrl,
  parseCatalog,
  type RemoteLoop,
  type RemotePack,
} from "../constants/loopStore";
import { useUserLoops } from "./UserLoopsContext";

// The store's half of the loop library: what is in the bucket, what has been
// downloaded, and what is downloading right now.
//
// It owns none of the audio. A download lands in the cache directory and is
// handed straight to UserLoopsContext.addRemoteLoop, which moves it into
// documentDirectory/loops/ and writes the index entry -- the same directory,
// index and pruning-on-launch that every imported loop goes through. That is
// deliberate: a downloaded loop is a loop, and the moment it needs its own
// storage path is the moment half the app has to learn about a second kind.

// The manifest, kept on disk between launches.
//
// Not a nicety: the app opens straight into a usable store on a bad connection
// or none at all, showing what was there last time -- and since every loop it
// lists may already be downloaded and playable offline, a spinner over a list
// the device could render immediately would be a network requirement invented
// for no reason. The network copy replaces it when it arrives.
const CACHE_FILE = `${FileSystem.documentDirectory}loopCatalog.json`;

// Downloads land here first. The cache directory is right for it: if the OS
// clears it mid-download the worst case is a failed download, whereas a
// half-written file under documentDirectory/loops/ would be a permanent
// resident that only the index's existence check would ever notice.
const DOWNLOAD_DIR = `${FileSystem.cacheDirectory}loop-downloads/`;

type StoreStatus = "loading" | "ready" | "error";

type LoopStoreContextValue = {
  /** Packs from the manifest; singles appear here as one-loop packs. */
  packs: RemotePack[];
  status: StoreStatus;
  /** Set when the last fetch failed. The cached packs may still be listed. */
  error?: string;
  /** False until EXPO_PUBLIC_LOOP_STORE_URL is set. */
  configured: boolean;
  /** Re-fetch the manifest, bypassing the CDN cache. */
  refresh: () => Promise<void>;
  findPack: (id: string | undefined) => RemotePack | undefined;
  /** Whether this manifest loop is already in the library. */
  isDownloaded: (loop: RemoteLoop) => boolean;
  /** 0..1 while downloading, undefined otherwise. */
  progressFor: (loop: RemoteLoop) => number | undefined;
  downloadLoop: (loop: RemoteLoop) => Promise<void>;
  /** Downloads a pack's loops one at a time; resolves with what happened. */
  downloadPack: (
    pack: RemotePack
  ) => Promise<{ downloaded: number; failed: number }>;
};

const LoopStoreContext = createContext<LoopStoreContextValue | null>(null);

export function LoopStoreProvider({ children }: { children: ReactNode }) {
  const [packs, setPacks] = useState<RemotePack[]>([]);
  const [status, setStatus] = useState<StoreStatus>("loading");
  const [error, setError] = useState<string | undefined>();
  const [progress, setProgress] = useState<Record<string, number>>({});

  const { addRemoteLoop, downloadedRemoteKeys } = useUserLoops();

  const configured = isStoreConfigured();

  // Manifest keys currently downloading. A ref rather than state because it is
  // read inside the download loop to decide whether to start -- state read there
  // would be whatever the closure captured, which is how one loop ends up
  // downloading twice from a double tap.
  const inFlight = useRef(new Set<string>());
  // The last progress value published per loop, so the resumable's callback --
  // which fires on every chunk -- doesn't re-render the list at that rate.
  const lastPublished = useRef<Record<string, number>>({});

  const publishProgress = (key: string, value: number) => {
    const previous = lastPublished.current[key];
    if (previous !== undefined && value < 1 && value - previous < 0.02) return;
    lastPublished.current[key] = value;
    setProgress((current) => ({ ...current, [key]: value }));
  };

  const clearProgress = (key: string) => {
    delete lastPublished.current[key];
    setProgress((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const load = async (bust: boolean) => {
    if (!configured) {
      setStatus("ready");
      return;
    }

    try {
      const response = await fetch(catalogUrl(bust));
      if (!response.ok) {
        throw new Error(`Catalog returned ${response.status}`);
      }
      // Read as text and parse here, so a truncated or non-JSON body (an R2
      // error page, most likely) fails as a parse error we can report rather
      // than as an exception from inside fetch's own json().
      const text = await response.text();
      const parsed = parseCatalog(JSON.parse(text));

      setPacks(parsed);
      setStatus("ready");
      setError(undefined);

      // Cached after parsing succeeded, never before: caching a body that
      // couldn't be read would mean the next launch starts from something
      // already known to be broken.
      FileSystem.writeAsStringAsync(CACHE_FILE, text).catch((cacheError) => {
        console.error("Failed to cache loop catalog", cacheError);
      });
    } catch (fetchError) {
      console.error("Failed to load loop catalog", fetchError);
      setError(
        fetchError instanceof Error ? fetchError.message : "Couldn't reach the store"
      );
      // Only an error state if there is nothing to show. With a cached copy on
      // screen this is a failed refresh, and blanking a working list to say so
      // would cost the user more than the message is worth.
      setStatus((current) => (current === "ready" ? "ready" : "error"));
    }
  };

  useEffect(() => {
    let isMounted = true;

    const start = async () => {
      // Disk first, network second. Both write the same state; the network one
      // wins because it finishes later.
      try {
        const info = await FileSystem.getInfoAsync(CACHE_FILE);
        if (info.exists) {
          const cached = parseCatalog(
            JSON.parse(await FileSystem.readAsStringAsync(CACHE_FILE))
          );
          if (isMounted && cached.length > 0) {
            setPacks(cached);
            setStatus("ready");
          }
        }
      } catch (cacheError) {
        console.error("Failed to read cached loop catalog", cacheError);
      }

      if (isMounted) await load(false);
    };

    start();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findPack = (id: string | undefined) =>
    id ? packs.find((pack) => pack.id === id) : undefined;

  const isDownloaded = (loop: RemoteLoop) =>
    downloadedRemoteKeys.includes(loop.key);

  const progressFor = (loop: RemoteLoop) => progress[loop.key];

  const downloadLoop = async (loop: RemoteLoop) => {
    if (inFlight.current.has(loop.key)) return;
    if (downloadedRemoteKeys.includes(loop.key)) return;

    const pack = findPack(loop.packId);
    // Both halves matter. The pack lock is the rule; the missing file is what
    // that rule looks like in a correctly built manifest, where paid audio has
    // no public path to name.
    if (pack && !isPackUnlocked(pack)) {
      throw new Error(`${pack.title} hasn't been unlocked.`);
    }
    if (!loop.file) {
      throw new Error(`${loop.title} isn't available to download yet.`);
    }

    inFlight.current.add(loop.key);
    publishProgress(loop.key, 0);

    const fileName = fileNameFor(loop);
    const target = `${DOWNLOAD_DIR}${localKeyFor(loop.key)}-${fileName}`;

    try {
      await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });

      const resumable = FileSystem.createDownloadResumable(
        objectUrl(loop.file),
        target,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          // A server that doesn't send Content-Length reports -1 here. Nothing
          // useful can be shown as a fraction of that, so the bar stays where
          // it is and the row keeps reading as busy.
          if (!(totalBytesExpectedToWrite > 0)) return;
          publishProgress(
            loop.key,
            Math.min(0.99, totalBytesWritten / totalBytesExpectedToWrite)
          );
        }
      );

      const result = await resumable.downloadAsync();
      if (!result) throw new Error("Download didn't complete");
      // R2 answers a missing key with a 404 whose body is XML, and
      // downloadAsync writes that body to disk as happily as it would audio --
      // so a bad path in the manifest would otherwise arrive as a "loop" that
      // fails much later, at decode time, with nothing pointing back to here.
      if (result.status >= 400) {
        throw new Error(`Download failed (${result.status})`);
      }

      await addRemoteLoop({
        key: localKeyFor(loop.key),
        remoteKey: loop.key,
        packId: loop.packId,
        artist: loop.artist,
        title: loop.title,
        category: loop.category,
        bpm: loop.bpm,
        timeSignature: loop.timeSignature,
        trimStart: loop.trimStart,
        trimEnd: loop.trimEnd,
        sourceUri: result.uri,
        fileName,
      });
    } catch (downloadError) {
      // Whatever landed is partial or is an error page. Either way it is not a
      // loop, and leaving it in the cache would have a retry resume onto it.
      FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
      throw downloadError;
    } finally {
      inFlight.current.delete(loop.key);
      clearProgress(loop.key);
    }
  };

  // One at a time rather than all at once. A pack is a dozen files over a phone
  // connection; firing them in parallel makes every row's progress bar crawl
  // together and, on a flaky connection, tends to fail all of them instead of
  // some. Sequential also means a part-finished pack is a real thing -- the
  // loops that made it are downloaded and playable, and running this again
  // picks up the rest.
  const downloadPack = async (pack: RemotePack) => {
    let downloaded = 0;
    let failed = 0;

    for (const loop of pack.loops) {
      if (downloadedRemoteKeys.includes(loop.key)) continue;
      try {
        await downloadLoop(loop);
        downloaded += 1;
      } catch (packError) {
        console.error("Failed to download loop", loop.key, packError);
        failed += 1;
      }
    }

    return { downloaded, failed };
  };

  const value = useMemo(
    () => ({
      packs,
      status,
      error,
      configured,
      refresh: () => load(true),
      findPack,
      isDownloaded,
      progressFor,
      downloadLoop,
      downloadPack,
    }),
    // Rebuilt whenever anything a caller reads through it changes. The
    // downloaded list belongs here too: every function above closes over it to
    // decide whether a loop still needs fetching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [packs, status, error, configured, progress, downloadedRemoteKeys]
  );

  return (
    <LoopStoreContext.Provider value={value}>{children}</LoopStoreContext.Provider>
  );
}

export function useLoopStore() {
  const context = useContext(LoopStoreContext);
  if (!context) {
    throw new Error("useLoopStore must be used within a LoopStoreProvider");
  }
  return context;
}
