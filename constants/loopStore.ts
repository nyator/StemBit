import { LOOP_CATEGORIES, type LoopCategory } from "./loops";

// The loop store: artist packs and singles that live in a Cloudflare R2 bucket
// instead of in the app bundle.
//
// The shipped catalogue (constants/loops.ts) is always there and always works
// offline -- it is part of the download. This is the other half: audio fetched
// on demand, so the app's install size doesn't grow every time an artist adds a
// pack. A loop only becomes real to the rest of the app once it has been
// downloaded, at which point UserLoopsContext owns it like any import.
//
// Everything the app knows about the bucket comes from ONE file: catalog.json
// at its root. There is no bucket listing here and there shouldn't be -- S3
// ListObjects over a public endpoint would expose every key including the paid
// ones, and it can't carry a loop's tempo or trim points anyway. The manifest is
// generated when loops are uploaded; see docs/loop-store.md for its shape.

// A public r2.dev URL or (better) a custom domain in front of the bucket, with
// no trailing slash: "https://loops.stembit.app". Public is the right call for
// the manifest even when packs are paid -- a store you can't browse until you've
// bought something doesn't sell anything. Paid AUDIO is a different matter; see
// isPackUnlocked below.
const BASE_URL = (process.env.EXPO_PUBLIC_LOOP_STORE_URL ?? "").replace(
  /\/+$/,
  ""
);

/** False until EXPO_PUBLIC_LOOP_STORE_URL is set; the store screen says so. */
export const isStoreConfigured = () => BASE_URL.length > 0;

/**
 * Where the manifest is.
 *
 * `bust` appends a cache-buster, used only when the user pulls to refresh --
 * the automatic load goes through the plain URL so Cloudflare's cache does its
 * job, and a pull-to-refresh that returned the same cached copy would be a
 * gesture that visibly does nothing.
 */
export const catalogUrl = (bust = false) =>
  bust ? `${BASE_URL}/catalog.json?t=${Date.now()}` : `${BASE_URL}/catalog.json`;

/** An object path from the manifest, resolved against the bucket. */
export const objectUrl = (path: string) =>
  /^https?:\/\//i.test(path) ? path : `${BASE_URL}/${path.replace(/^\/+/, "")}`;

export type RemoteLoop = {
  /** Unique across the whole bucket. Becomes part of the local loop's key. */
  key: string;
  title: string;
  category: LoopCategory;
  bpm: number;
  timeSignature: string;
  /**
   * The loop region, seconds into the file. Required, unlike a shipped loop's:
   * the engine can find a region itself, but it does that by trimming silence
   * and snapping to beats, and a pack sold as loops should already know where
   * its own bars are rather than having each device guess.
   */
  trimStart: number;
  trimEnd: number;
  /**
   * Object path in the bucket, or an absolute URL.
   *
   * Absent is legal for a loop in a paid pack, and only there -- see the note on
   * isPackUnlocked. A free loop without one is dropped, because it is a row that
   * could never download.
   */
  file?: string;
  /** Download size, for the row's caption. */
  bytes?: number;
  /** Copied down from the pack while parsing, so a loop always knows its own. */
  artist: string;
  packId: string;
};

export type RemotePack = {
  id: string;
  title: string;
  artist: string;
  description?: string;
  /**
   * Absent or 0 is free. Anything else is paid, and paid means locked: see
   * isPackUnlocked.
   */
  price?: number;
  /** ISO 4217, for display only. Defaults to USD. */
  currency?: string;
  loops: RemoteLoop[];
  /**
   * A one-loop pack that came from the manifest's root `loops` array rather
   * than from `packs`. The store lists these on their own instead of making
   * somebody open a "pack" to find a single track in it.
   */
  single: boolean;
};

export const isPackFree = (pack: RemotePack) => !pack.price;

/**
 * Whether this device may download a pack's audio.
 *
 * Free packs, yes. Paid packs, no -- and deliberately not "no for now, with a
 * flag somewhere that flips it". Nothing in the app can be the authority on
 * whether a purchase happened: a client-side entitlement is one patched binary
 * away from being bypassed, and if the audio sits at a public bucket URL, the
 * manifest has already given it away regardless of what this function returns.
 *
 * So a paid pack is browsable and not downloadable until two things exist that
 * don't yet: a purchase (Apple requires IAP for digital goods, so that is
 * StoreKit / Play Billing, not a card form), and an endpoint that verifies the
 * receipt server-side and hands back a short-lived signed URL for the object.
 * Until then paid audio should not be in the public bucket at all, and paid
 * entries in the manifest should carry no `file` at all.
 *
 * When that lands, this is the function that changes -- it becomes a lookup
 * against entitlements fetched for the signed-in user, and the download path
 * asks for a signed URL instead of building a public one.
 */
export const isPackUnlocked = (pack: RemotePack) => isPackFree(pack);

/** "Free", "$4.99". Display only -- the store never charges anything itself. */
export const formatPrice = (pack: RemotePack) => {
  if (isPackFree(pack)) return "Free";
  const currency = pack.currency ?? "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(pack.price!);
  } catch {
    // An unrecognised currency code shouldn't blank the price out.
    return `${pack.price} ${currency}`;
  }
};

/** "1.2 MB". Absent size gives an empty string rather than "0 B". */
export const formatBytes = (bytes?: number) => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Total download size of everything in a pack that has a size on it. */
export const packBytes = (pack: RemotePack) =>
  pack.loops.reduce((total, loop) => total + (loop.bytes ?? 0), 0);

const isCategory = (value: unknown): value is LoopCategory =>
  typeof value === "string" &&
  (LOOP_CATEGORIES as readonly string[]).includes(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

// The manifest is a hand-authored file fetched over the network. Every shape
// assumption below is one an editing mistake can break, and the failure that
// matters is the quiet one: a pack whose loops all have a typo'd category
// shouldn't take the rest of the store down with it. So each entry is validated
// on its own and a bad one is dropped, exactly as UserLoopsContext does with the
// on-disk index.
const parseLoop = (
  value: unknown,
  pack: { id: string; artist: string; free: boolean }
): RemoteLoop[] => {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;

  if (typeof record.key !== "string" || !record.key) return [];
  if (typeof record.title !== "string" || !record.title) return [];
  if (!isFiniteNumber(record.bpm) || record.bpm <= 0) return [];

  const trimStart = isFiniteNumber(record.trimStart) ? record.trimStart : 0;
  const trimEnd = isFiniteNumber(record.trimEnd) ? record.trimEnd : 0;
  // Same rule the local index enforces: without a region past its start there
  // is nothing to loop, and a row that can't play is worse than one that isn't
  // listed.
  if (!(trimEnd > trimStart)) return [];

  const file = typeof record.file === "string" && record.file ? record.file : undefined;
  // A free loop with nowhere to download from is a dead row. A paid one is
  // expected to have no file yet -- that is how paid audio stays out of the
  // public bucket -- so it survives and lists as locked.
  if (!file && pack.free) return [];

  return [
    {
      key: record.key,
      title: record.title,
      category: isCategory(record.category) ? record.category : LOOP_CATEGORIES[0],
      bpm: record.bpm,
      timeSignature:
        typeof record.timeSignature === "string" ? record.timeSignature : "4 / 4",
      trimStart,
      trimEnd,
      file,
      bytes: isFiniteNumber(record.bytes) && record.bytes > 0 ? record.bytes : undefined,
      artist: pack.artist,
      packId: pack.id,
    },
  ];
};

const parsePack = (value: unknown, single: boolean): RemotePack[] => {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;

  if (typeof record.id !== "string" || !record.id) return [];
  if (typeof record.title !== "string" || !record.title) return [];

  const artist =
    typeof record.artist === "string" && record.artist ? record.artist : "Unknown";
  const price =
    isFiniteNumber(record.price) && record.price > 0 ? record.price : undefined;

  const loops = Array.isArray(record.loops)
    ? record.loops.flatMap((loop) =>
        parseLoop(loop, { id: record.id as string, artist, free: !price })
      )
    : [];

  // An empty pack is a heading with nothing under it.
  if (loops.length === 0) return [];

  return [
    {
      id: record.id,
      title: record.title,
      artist,
      description:
        typeof record.description === "string" ? record.description : undefined,
      price,
      currency: typeof record.currency === "string" ? record.currency : undefined,
      loops,
      single,
    },
  ];
};

/**
 * The manifest, as packs.
 *
 * Singles -- the manifest's root `loops` array -- come back as one-loop packs
 * rather than as a second kind of thing. Everything downstream (pricing, the
 * lock, the download, the pack a downloaded loop remembers it came from) then
 * has one shape to handle instead of two that differ only in count.
 */
export const parseCatalog = (value: unknown): RemotePack[] => {
  if (!value || typeof value !== "object") return [];
  const root = value as Record<string, unknown>;

  const packs = Array.isArray(root.packs)
    ? root.packs.flatMap((pack) => parsePack(pack, false))
    : [];

  const singles = Array.isArray(root.loops)
    ? root.loops.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const loop = entry as Record<string, unknown>;
        if (typeof loop.key !== "string" || !loop.key) return [];
        // Wrapped in a pack of its own, carrying the single's own artist and
        // price. The id is derived from the loop's key, so it stays stable
        // across refreshes and can be linked to like any other pack.
        return parsePack(
          {
            id: `single:${loop.key}`,
            title: loop.title,
            artist: loop.artist,
            price: loop.price,
            currency: loop.currency,
            loops: [loop],
          },
          true
        );
      })
    : [];

  return [...packs, ...singles];
};

/** A local loop key for a downloaded remote one. Stable, and its own namespace. */
export const localKeyFor = (remoteKey: string) =>
  `store-${remoteKey.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;

/** The filename to save a download as, extension included where the path has one. */
export const fileNameFor = (loop: RemoteLoop) => {
  const fromPath = loop.file?.split("/").pop() ?? "";
  return fromPath.includes(".") ? fromPath : `${loop.key}.wav`;
};
