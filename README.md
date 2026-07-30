# StemBit

StemBit is a React Native mobile application designed for musicians and performers. It provides an integrated suite of tools including a metronome, loop player, pad interface, and session manager, all accessible through a modern, tab-based interface. The app aims to streamline practice, performance, and session management for users.

---

## Table of Contents

- [Features](#features)
  - [Metronome](#metronome)
  - [Loop](#loop)
  - [Pad](#pad)
  - [Session](#session)
  - [Profile & Auth](#profile--auth)
- [Audio Architecture](#audio-architecture)
- [Adding Loops to the Catalog](#adding-loops-to-the-catalog)
- [Importing a Loop (in-app)](#importing-a-loop-in-app)
- [Technical Stack](#technical-stack)
- [Installation & Setup](#installation--setup)
- [Contribution Guidelines](#contribution-guidelines)

---

## Features

### Metronome (`app/(tabs)/metro.tsx`)
- Sample-accurate click scheduling on the Web Audio hardware clock (immune to JS thread jitter).
- Time signatures with musical accent groupings: compound and odd meters click in their natural groups (6/8 = 3+3, 7/8 = 2+2+3, 5/4 = 3+2, ...). Downbeat gets the full bright click, group starts a softer bright click.
- Playback feels: Half Time (½×), Normal (1×), Double Time (2×) without changing the displayed BPM.
- Tap tempo with median-based outlier rejection (one sloppy tap doesn't skew the tempo), hold-to-repeat +/- steppers, and direct BPM entry.
- Beat indicator dots reflect the meter's accent groups, even while stopped.

### Loop (`app/(tabs)/loop.tsx`)
- Browse the loop catalog by **category** (Worship, Praise, Funk, ...) or by **artist**, with filter chips and preview playback.
- Gapless, sample-accurate looping — encoder padding in MP3/AAC files is trimmed automatically and loop length is snapped to the musical grid.
- Tempo warping is **pitch-preserving** (WSOLA time-stretch): change the speed, the key stays put. 1× plays the untouched original audio.
- Whole catalog is preloaded and decoded at app start, so loading and playing a loop is instant.
- **Import your own loop** (+ in the browser header): pick an audio file, trim it on a waveform, set its tempo, and hear it warp before saving. It then behaves like any catalog loop — see [Importing a Loop](#importing-a-loop-in-app).

### Pad (`app/(tabs)/pad.tsx`)
- Sustained pads in all 12 major and 7 minor keys (minor plays the relative major clip).
- Pre-pitched clips per chromatic root (rendered offline via `scripts/generate_pads.sh`) — no unreliable runtime pitch shifting.
- Dual-layer player with self-crossfading loop so pads never audibly restart; smooth crossfade on key changes.

### Session (`app/(tabs)/session.tsx`)
- Manage session setlists (in progress).

### Profile & Auth (`app/(settings)`, `app/(auths)`)
- Authentication via Appwrite: register, login, forgot/reset password.
- Login currently has a `DEV_SKIP_AUTH` flag enabled in `app/(auths)/login.tsx` — set it to `false` to require real credentials.

---

## Audio Architecture

Three independent audio engines, each mounted once above the tab navigator so they keep running across tab switches, with a floating pill control to see/stop them from anywhere:

- **Metronome engine** (`constants/metronomeEngine.ts`): hidden WebView running a Web Audio "lookahead scheduler" (Chris Wilson's two-clocks pattern). Accent patterns are passed per time signature.
- **Loop engine** (`constants/loopEngine.ts`): hidden WebView. Decodes loops into buffers, trims encoder silence, snaps loop points to whole beats at the loop's native BPM, and loops via `AudioBufferSourceNode` (sample-accurate). BPM changes re-render the loop region through an inline WSOLA time-stretcher and crossfade at the matching musical phase — pitch never changes.
- **Pad player**: expo-audio dual-layer crossfade (pads don't need sample-accurate looping; long crossfades are the point).

`context/PlaybackLockContext.tsx` keeps the metronome and loop engines mutually exclusive so two clock sources never fight.

Shared BPM UI logic (draft-based text entry, hold-to-repeat steppers, outlier-rejecting tap tempo) lives in `hooks/useBpmControl.ts`.

---

## Adding Loops to the Catalog

1. Drop the audio file into `assets/audio/loops/` (MP3 is fine — padding is trimmed automatically).
2. Import it in `constants/audio.js` and add it to the exported object.
3. Add one entry to `LOOPS` in `constants/loops.ts` with `key`, `title`, `artist`, `category`, `bpm`, `timeSignature`, and `source`.

Categories are defined in `LOOP_CATEGORIES` (same file). Artists are derived automatically from the catalog. The browser UI, filter chips, counts, and preload all pick up new entries with no further changes.

---

## Importing a Loop (in-app)

`app/(loops)/import.tsx` lets a user add a loop from their own device. Warping a
loop needs two things a bare audio file doesn't carry, and no analysis can
reliably guess: **where the loop actually starts and ends**, and **how many beats
that is**. So the screen asks, with the audio playing:

1. **Pick a file** (`expo-document-picker`, ≤ 20 MB). It's decoded by a
   throwaway instance of the loop engine, which reports the file's length, a
   waveform, its audible region, and a **detected tempo**.
2. **Nothing, usually.** When a tempo is found, it and the loop region are set
   automatically: the region starts where the audio does and runs a whole number of
   bars at that tempo. That's the loop already warp-ready.
3. **Trim** it if the automatic region isn't what you meant
   (`components/ui/waveformTrimmer.tsx`) — drag handles, plus 10 ms nudges.
   **Hold a handle to zoom**: the same view expands to ~1 s around that edge at
   full resolution, and lifting your finger returns it to the whole file. Zoomed
   out a pixel is tens of milliseconds, so an edge can only land *near* a beat;
   held, it's a couple of milliseconds — finer than the nudges — and the drag that
   opened the zoom carries on at that scale. Drag toward either side and the view
   scrolls, so the trim isn't limited to what happened to be on screen when the
   zoom opened. The engine measures a buffer several seconds wide
   (`regionPeaks`) and the trimmer slides its window over that, so scrolling is an
   array slice rather than a round trip per frame; a new buffer is only asked for
   when the view nears the end of the measured audio, and the old peaks stay on
   screen until it lands. DETECT re-reads the tempo from the trimmed region, which
   is a cleaner read than the whole file.
4. **Or set the tempo by hand** — tap tempo, direct entry, or "fit tempo to N
   bars", which derives the BPM from the trim's length and snaps the trim onto
   that BPM's grid.
5. **Preview** it warped to another tempo, with the metronome click locked to the
   loop's own grid — if the click slides, the tempo or trim is wrong.

### Tempo detection

[realtime-bpm-analyzer](https://github.com/dlepaux/realtime-bpm-analyzer), running
inside the loop engine's WebView. Its `analyzeFullBuffer` lowpasses the audio at
200 Hz, walks a descending amplitude threshold for peaks, counts the intervals
between them, and reports the tempos those intervals agree on.

It lives in the WebView because it needs Web Audio — it renders that lowpass
through an `OfflineAudioContext` — and React Native has none. The WebView is handed
an HTML string rather than a module graph, so the library has to arrive as source
text: `scripts/vendor-bpm-analyzer.js` copies its bundle into
`constants/vendor/bpmAnalyzerSource.ts` as a string (`npm run vendor:bpm` after
upgrading the package), and the engine injects that ahead of its own script. A test
asserts the copy still matches what's installed, so it can't go stale.

What's ours around it (`detectTempo` / `describeTempo` in the engine):

- **Region slicing**, so the trim can be analysed instead of the whole file — no
  count-in, tail or applause dragging the answer around. That's what DETECT does.
- **One answer out of the candidate list.** The library returns its top five sorted
  by interval count, and leaves its own confidence field at 0 in the offline path,
  so confidence here is the winner's share of all their counts: a clear pulse puts
  half the intervals or more on one tempo, while material with no pulse spreads
  them evenly. The screen applies the tempo at ≥ 0.2, calls it strong at ≥ 0.4, and
  otherwise estimates from the loop's length — always saying which it used.

**Known limits.** The library folds every tempo into **90–180 BPM**, so a loop a
listener would call 70 comes back as 140. That's why `÷ 2` / `× 2` sit next to the
BPM readout, and why the runner-up tempos are offered as one-tap chips — the
reading you wanted is usually among them. It also reports no downbeat, so an
imported loop's region starts at the audible start rather than at a detected first
beat. And a beating pad scores about the same as a melodic loop with no drums, so
material with no pulse can still get a tempo applied; it arrives labelled "faint
beat, worth checking against the click", and a gate high enough to exclude it would
refuse real music.

`utils/tests/loopTempo.test.js` runs the real library over synthesised *mixes*
(kick with a low body, snare, hats, sustained bass, pad, reverb, limiting) using a
plain-JS `OfflineAudioContext` shim, so the whole path is covered outside the
WebView. The material matters: the hand-written detector this replaced passed every
test built on impulse trains in silence and still answered half tempo on real
audio, because a mix is nothing like an impulse train.


Saving copies the audio into `documentDirectory/loops/` and records the entry in
`documentDirectory/userLoops.json` (`context/UserLoopsContext.tsx`). Imported
loops are merged into the catalog by `getAllLoops()`, filed under the artist
`Yours`, and carry `trimStart`/`trimEnd` so the engine loops the user's region
instead of finding its own. Everything downstream — preload, warping, the loop
click, the BPM dial — treats them as ordinary catalog entries.

Long-press an imported row in the browser to **edit** or delete it. Editing opens
the same screen with `?key=`, loads the saved tempo and trim instead of detecting
(DETECT re-reads on demand), and saves in place under the same key — so a loop
that's currently loaded is just re-selected with its new trim, no re-decode. The
audio file itself is fixed: swapping it under an existing key would be a
different loop wearing that key, so that's an add.

> Adds a native module, so an existing dev client needs rebuilding
> (`npx expo run:android` / `run:ios`) before the file picker works.

---

## Technical Stack

- **Framework:** React Native + Expo (expo-router navigation)
- **UI Styling:** Tailwind CSS (NativeWind)
- **Audio:** Web Audio (via react-native-webview) for metronome & loops; expo-audio for pads & previews
- **Icons:** @expo/vector-icons
- **Backend:** Appwrite (authentication and data)
- **Language:** TypeScript

---

## Installation & Setup

1. **Clone the repository:**
   ```sh
   git clone https://github.com/yourusername/stembit.git
   cd stembit
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Configure environment:**
   ```sh
   cp .env.example .env
   # fill in EXPO_PUBLIC_APPWRITE_DEV_KEY (Appwrite console -> Project -> Settings -> Dev keys)
   ```
   Never commit `.env`. The dev key is only needed for development builds.

4. **Start the dev server:**
   ```sh
   npm start
   ```

5. **Run on your device:**
   ```sh
   npm run ios
   # or
   npm run android
   ```

6. **Run tests / type check:**
   ```sh
   npm test
   npx tsc --noEmit
   ```

---

## Contribution Guidelines

1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Write clear, concise commits and include tests if applicable.
4. Submit a pull request with a detailed description.

**Code Style:**
- Use TypeScript for all files.
- Follow the existing folder structure.
- Use Tailwind CSS classes for styling.
- Keep components modular and reusable.
- Note: the engine files build HTML template literals — never use backticks inside their inline scripts/comments.

---

## File Structure Overview

- `app/` - Main application screens and navigation
  - `(tabs)/` - Main tab screens: `loop.tsx`, `pad.tsx`, `session.tsx`, `metro.tsx`
  - `(auths)/` - Authentication screens: `login.tsx`, `register.tsx`, etc.
  - `(loops)/` - Loop browser (`sounds.tsx`: categories/artists + filter chips) and loop import (`import.tsx`: pick, trim, set tempo, warp)
  - `(settings)/` - Settings, user profile, and help screens
- `components/` - Reusable UI components (header, buttons, toast, loop list)
- `constants/` - Static config and the audio engines (`metronomeEngine.ts`, `loopEngine.ts`, `loops.ts`, `audio.js`, `icons.js`)
- `context/` - Providers: `MetronomeContext`, `LoopPlaybackContext`, `PlaybackLockContext`, `UserLoopsContext`
- `hooks/` - Shared hooks (`useBpmControl.ts`)
- `lib/` - Backend integration (`appwrite.ts`)
- `utils/` - Helpers (`loadAssetBase64.ts`) and tests
- `assets/` - Images, icons, fonts, audio

---

## Contact

For questions or support, open an issue or contact me.
