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
  /**
   * The musical key, as written by whoever made it: "A minor", "F#". Called
   * musicalKey in the manifest because `key` is already the loop's identity.
   */
  musicalKey?: string;
  /**
   * The file type, lower-case, without the dot: "wav". Stated in the manifest
   * because a paid loop has no file path to read an extension from, and a
   * product page that can't say what you'd be buying isn't one.
   */
  format?: string;
  /** Hz, from ffprobe at publish time. */
  sampleRate?: number;
  /** Bits per sample, from ffprobe. Absent for compressed formats. */
  bitDepth?: number;
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
   * Cover art: an object path in the bucket or an absolute URL, square, JPEG or
   * PNG. Public even for a paid pack -- the cover is the shop window. Absent,
   * or failing to load, the store draws a cover from the pack's id instead.
   */
  cover?: string;
  /** A storefront genre: "Afrobeats", "Gospel". Free text, unlike a loop's category. */
  genre?: string;
  /** Short descriptors shown as tags on the product page: "Live drums", "Dry". */
  tags?: string[];
  /** What a buyer may do with the audio, in one line: "Royalty-free". */
  license?: string;
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
  /** Put in the store's banner ahead of everything else. */
  featured?: boolean;
  /**
   * When it was published, as an ISO date. Orders the banner's "new" picks
   * when nothing is featured. Absent is fine -- it just doesn't count as new.
   */
  addedAt?: string;
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

/* -------------------------------------------------------------------------- */
/* Product details                                                             */
/* -------------------------------------------------------------------------- */

// What the product page lists under "What's included". Every one of these is
// derived from fields the manifest may or may not carry, and each returns
// nothing rather than a guess when it can't say -- a spec sheet with a wrong
// sample rate on it is worse than one without the line.

/** The cover's full URL, or undefined when the pack has none. */
export const coverUrlFor = (pack: RemotePack) =>
  pack.cover ? objectUrl(pack.cover) : undefined;

/** "WAV", from the manifest's format or else the file's extension. */
export const fileFormatOf = (loop: RemoteLoop) => {
  const fromPath = loop.file?.split("/").pop()?.split(".");
  const ext = loop.format ?? (fromPath && fromPath.length > 1 ? fromPath.pop() : undefined);
  return ext ? ext.toUpperCase() : undefined;
};

/** The one value every loop agrees on, or undefined if any differ or none say. */
const shared = <T>(values: (T | undefined)[]) => {
  const present = values.filter((value): value is T => value !== undefined);
  if (present.length !== values.length || present.length === 0) return undefined;
  return present.every((value) => value === present[0]) ? present[0] : undefined;
};

const formatRate = (hz: number) => `${Number((hz / 1000).toFixed(1))} kHz`;

/**
 * "WAV · 24-bit · 48 kHz" -- each part only when the whole pack shares it, so a
 * pack mixing 44.1 and 48 kHz files says "WAV" and nothing it can't stand by.
 */
export const formatSpecOf = (pack: RemotePack) => {
  const format = shared(pack.loops.map(fileFormatOf));
  const depth = shared(pack.loops.map((loop) => loop.bitDepth));
  const rate = shared(pack.loops.map((loop) => loop.sampleRate));
  return [format, depth && `${depth}-bit`, rate && formatRate(rate)]
    .filter(Boolean)
    .join(" · ");
};

/** "104 BPM" or "92–128 BPM". */
export const tempoRangeOf = (pack: RemotePack) => {
  const tempos = pack.loops.map((loop) => Math.round(loop.bpm));
  const low = Math.min(...tempos);
  const high = Math.max(...tempos);
  return low === high ? `${low} BPM` : `${low}–${high} BPM`;
};

/** Distinct meters across the pack, in manifest order: "4 / 4, 6 / 8". */
export const metersOf = (pack: RemotePack) =>
  [...new Set(pack.loops.map((loop) => loop.timeSignature))].join(", ");

/** Distinct musical keys, or an empty string when no loop states one. */
export const keysOf = (pack: RemotePack) =>
  [...new Set(pack.loops.map((loop) => loop.musicalKey).filter(Boolean))].join(", ");

/**
 * Whole bars in the loop region, or undefined when the region isn't a whole
 * number of them -- the catalogue script flags that case at publish time, and
 * "7.98 bars" on a product row would only advertise it.
 */
export const barsOf = (loop: RemoteLoop) => {
  const beatsPerBar = parseInt(loop.timeSignature.split("/")[0], 10) || 4;
  const bars = ((loop.trimEnd - loop.trimStart) * loop.bpm) / 60 / beatsPerBar;
  const rounded = Math.round(bars);
  return rounded > 0 && Math.abs(bars - rounded) < 0.05 ? rounded : undefined;
};

/** "Sep 2026" from an ISO date; empty when there isn't one. */
export const formatReleased = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(date);
  } catch {
    return String(date.getUTCFullYear());
  }
};

/**
 * The storefront genre: the pack's own if it states one, otherwise the loop
 * category most of its loops share, so a catalogue that never set a genre
 * still has something to filter by.
 */
export const genreOf = (pack: RemotePack) => {
  if (pack.genre) return pack.genre;
  const counts = new Map<string, number>();
  for (const loop of pack.loops) counts.set(loop.category, (counts.get(loop.category) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

const isCategory = (value: unknown): value is LoopCategory =>
  typeof value === "string" &&
  (LOOP_CATEGORIES as readonly string[]).includes(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** A trimmed string, or undefined for anything else including "". */
const nonEmpty = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

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
      musicalKey: nonEmpty(record.musicalKey),
      format: nonEmpty(record.format)?.replace(/^\./, "").toLowerCase(),
      sampleRate:
        isFiniteNumber(record.sampleRate) && record.sampleRate > 0 ? record.sampleRate : undefined,
      bitDepth:
        isFiniteNumber(record.bitDepth) && record.bitDepth > 0 ? record.bitDepth : undefined,
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
      cover: nonEmpty(record.cover),
      genre: nonEmpty(record.genre),
      tags: Array.isArray(record.tags)
        ? record.tags.flatMap((tag) => nonEmpty(tag) ?? [])
        : undefined,
      license: nonEmpty(record.license),
      price,
      currency: typeof record.currency === "string" ? record.currency : undefined,
      loops,
      single,
      featured: record.featured === true ? true : undefined,
      addedAt:
        typeof record.addedAt === "string" && !Number.isNaN(Date.parse(record.addedAt))
          ? record.addedAt
          : undefined,
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
            featured: loop.featured,
            addedAt: loop.addedAt,
            cover: loop.cover,
            genre: loop.genre,
            tags: loop.tags,
            license: loop.license,
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
