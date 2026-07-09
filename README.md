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
  - `(loops)/` - Loop browser (`sounds.tsx`: categories/artists + filter chips)
  - `(settings)/` - Settings, user profile, and help screens
- `components/` - Reusable UI components (header, buttons, toast, loop list)
- `constants/` - Static config and the audio engines (`metronomeEngine.ts`, `loopEngine.ts`, `loops.ts`, `audio.js`, `icons.js`)
- `context/` - Providers: `MetronomeContext`, `LoopPlaybackContext`, `PlaybackLockContext`
- `hooks/` - Shared hooks (`useBpmControl.ts`)
- `lib/` - Backend integration (`appwrite.ts`)
- `utils/` - Helpers (`loadAssetBase64.ts`) and tests
- `assets/` - Images, icons, fonts, audio

---

## Contact

For questions or support, open an issue or contact me.
