# The loop store

Artist packs and singles that live in a Cloudflare R2 bucket instead of in the
app bundle. The shipped catalogue (`constants/loops.ts`) still ships with the
app and still works with no network; this is the other half — audio the app
fetches on demand, so the install doesn't grow every time an artist adds a pack.

A downloaded loop is not a special kind of loop. It lands in
`documentDirectory/loops/` and gets an index entry, exactly like a loop imported
from the user's own device, and from that point every part of the app treats it
as one: it appears in Bits, previews, warps, loads into the engine, and can be
deleted. The one thing it keeps that an import doesn't is its artist.

## Setting it up

1. Turn on public access for the bucket — a custom domain is better than the
   `r2.dev` URL, which Cloudflare rate-limits and doesn't intend for production.
2. Put the domain in `.env`, no trailing slash:

   ```
   EXPO_PUBLIC_LOOP_STORE_URL=https://loops.stembit.app
   ```

   This is a public read endpoint, not a secret. R2 **API tokens must never go
   in an `EXPO_PUBLIC_` variable** — everything with that prefix is compiled
   into the app bundle and is readable by anyone who downloads it.
3. Restart the dev server (`npm start`) — Expo reads `.env` at bundler start.

Without the variable the store screen says so rather than failing; nothing else
in the app changes.

## What goes in the bucket

```
catalog.json                      <- the only file the app looks for by name
packs/<pack-id>/cover.jpg         <- cover art, for every pack, free or paid
packs/<pack-id>/<loop>.wav        <- free audio
```

`catalog.json` must be served as `application/json`. Everything else is
addressed by the paths inside it, so the layout above is a convention rather
than a requirement.

**CORS** doesn't apply to the iOS and Android builds — native `fetch` sends no
`Origin` — but it does to `expo start --web`. If you want the store to work in a
browser, add a CORS rule on the bucket allowing `GET` from your web origin.

## catalog.json

```json
{
  "version": 1,
  "packs": [
    {
      "id": "kwame-afro-vol1",
      "title": "Afro Vol. 1",
      "artist": "Kwame Mensah",
      "description": "Twelve bars cut from the Sunday sets.",
      "cover": "packs/kwame-afro-vol1/cover.jpg",
      "genre": "Afrobeats",
      "tags": ["Live drums", "Percussion"],
      "license": "Royalty-free",
      "addedAt": "2026-10-01",
      "loops": [
        {
          "key": "kwame-afro-vol1/deep-groove",
          "title": "Deep Groove",
          "category": "Afro",
          "bpm": 104,
          "timeSignature": "4 / 4",
          "musicalKey": "A minor",
          "trimStart": 0,
          "trimEnd": 4.615385,
          "file": "packs/kwame-afro-vol1/deep-groove.wav",
          "bytes": 812000,
          "format": "wav",
          "sampleRate": 48000,
          "bitDepth": 24
        }
      ]
    }
  ],
  "loops": []
}
```

- **`key`** is unique across the whole bucket and permanent. It becomes the
  local loop's key (`store-kwame-afro-vol1-deep-groove`), which is how the app
  knows a loop is already downloaded. Changing a key republishes the loop as a
  new one; renaming a `title` doesn't.
- **`category`** must be one of `LOOP_CATEGORIES` in `constants/loops.ts`. An
  unrecognised one falls back to the first rather than dropping the loop.
- **`trimEnd`** is the file's exact duration, and matters more than it looks.
  The engine can find a loop region itself — trim silence, snap to whole beats —
  but that's for a file of unknown provenance. A loop sold as a loop should
  already know where its bars are, and a region a hair short of a whole bar
  drifts against the click a little further on every pass.
- **`bytes`** is optional and drives the sizes on the row and the product page.
- **`cover`** is the pack's artwork: a square JPEG or PNG (1000×1000 or more
  is plenty), as a bucket path or absolute URL. It's public even on a paid pack
  — it's the shop window. Without one, or if it fails to load, the store draws
  a coloured cover from the pack's id. The script picks up `cover.jpg` (or
  `.png` / `.webp`) from the pack folder.
- **`genre`**, **`tags`** and **`license`** are optional storefront details.
  `genre` is free text and drives the filter row; a pack without one is filed
  under its loops' most common `category`. `tags` show on the product page.
  `license` is one line, e.g. `"Royalty-free"`.
- **`musicalKey`**, **`format`**, **`sampleRate`**, **`bitDepth`** are per loop
  and fill in the product page's "What's included" sheet and each file's spec
  line. The script writes all but `musicalKey` from `ffprobe`; set that in
  `pack.json`. A pack-level spec (e.g. "WAV · 24-bit · 48 kHz") only shows the
  parts every loop in the pack shares.
- **`loops`** at the root is for singles: same shape, plus its own `artist`, and
  each one lists on its own row instead of behind a pack holding one thing.
- **`featured`** (`true`) and **`addedAt`** (an ISO date, `"2026-09-20"`) are
  optional, on a pack or a single, and decide what fills the big banner at the
  top of the store: everything featured first, then the newest by `addedAt`,
  up to five. With neither set anywhere, the banner shows the first few entries
  in the manifest, so an old catalogue still gets one.

Anything malformed is dropped entry by entry — a pack with one bad loop lists
its other eleven, and a manifest that won't parse at all leaves the last cached
copy on screen. `utils/tests/loopStore.test.js` covers the cases.

## Publishing

Prepare a folder per pack with a `pack.json` beside the audio (the script's
header documents the shape), then:

```
npm run loops:catalog -- ./loops-to-upload
```

It measures each file's exact duration with `ffprobe`, checks it's a whole
number of bars at its stated tempo, fills in sizes, and writes `catalog.json`
into the folder. Upload the audio and cover art under `packs/<id>/` and the
manifest at the root. It reads sample rate and bit depth while it's there, and
warns about any pack without cover art.

The app caches the manifest to disk, so a publish reaches a device on its next
launch, or immediately on pull-to-refresh.

## Paid packs

**Paid packs list in the store and can't be downloaded.** They are locked in
`isPackUnlocked()` (`constants/loopStore.ts`), and the catalogue script writes
paid loops with no `file` path at all.

This isn't a placeholder to switch off. Two things have to exist first, and
neither is something the app can supply on its own:

1. **A purchase.** Apple and Google both require their own in-app purchasing for
   digital goods, so this is StoreKit / Play Billing, not a card form.
2. **A signing endpoint.** Something server-side has to verify the receipt and
   hand back a short-lived signed URL for the object — a Cloudflare Worker in
   front of a *private* bucket, or `stembits-backend`. Client-side
   entitlements are one patched binary away from being bypassed.

Until then, paid audio must not be uploaded to the public bucket. A public
object URL is downloadable by anyone who knows the path, and the manifest is
where they'd learn it — which is why the script omits it rather than trusting
the lock alone.

When that work lands, `isPackUnlocked()` becomes a lookup against entitlements
fetched for the signed-in user, and `downloadLoop()` asks the endpoint for a
signed URL instead of building a public one. Those two functions are the whole
change on the app side.
