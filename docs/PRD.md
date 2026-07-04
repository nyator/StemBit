# StemBit Product Requirements Document

## 1. Product Summary

StemBit is a mobile practice and performance toolkit for musicians, worship teams, band leaders, producers, and live performers. The app combines four core tools in one fast, stage-ready interface:

- **Bits**: a loop player for backing loops, stems, and rhythmic practice tracks.
- **WPad**: a worship/sustain pad instrument that plays continuous musical pads in selected keys.
- **Session**: a setlist/session manager for preparing songs, tempos, loops, and pad keys before rehearsal or performance.
- **Metronome**: a configurable click tool with BPM, tap tempo, time signatures, and clear beat feedback.

The current codebase points toward a musician-first app that should be quick to open, reliable under performance conditions, and simple enough to operate one-handed during rehearsal or live sets.

## 2. Problem Statement

Musicians often juggle separate apps or devices for metronomes, pad drones, backing loops, and setlists. This creates friction during practice and risk during live performance: switching apps, matching tempos manually, finding the right key, or loading the correct backing track takes attention away from playing.

StemBit should solve this by giving musicians a single place to load a song/session, start the right loop, choose the right pad key, and keep time with an accurate click.

## 3. Target Users

### Primary Users

**Live musicians and worship players**
- Need ambient pads, loops, and click tools during services, rehearsals, or live sets.
- Care deeply about quick access, low-latency response, and no accidental interruptions.

**Band leaders and music directors**
- Need to organize setlists with song title, BPM, key, time signature, and backing assets.
- Want repeatable sessions so the band can rehearse and perform consistently.

**Solo performers and practice-focused musicians**
- Need a metronome, loop player, and pad bed for personal practice.
- Want simple tempo adjustment and tap tempo without deep menus.

### Secondary Users

**Producers and content creators**
- May use loops and pads for sketching musical ideas.
- Need lightweight playback and key/tempo reference tools.

## 4. Product Goals

1. Give musicians a single mobile toolkit for loops, pads, metronome, and session preparation.
2. Make each tool usable in under three taps from app launch after login/onboarding.
3. Support live-performance reliability: audio should continue in silent mode and background mode where platform policy allows.
4. Let users prepare reusable sessions/setlists with BPM, key, time signature, loops, and notes.
5. Build a foundation for account-backed cloud storage of user sessions and imported audio.

## 5. Non-Goals For MVP

- Full digital audio workstation editing.
- Multitrack stem mixing with per-stem effects.
- Social sharing, public marketplace, or collaborative setlists.
- Advanced notation/chord chart rendering.
- Real-time multiplayer rehearsal sync.
- Desktop/web production workflow.

## 6. Current Product Evidence From Codebase

The repository already includes:

- Expo Router navigation with auth, tabs, loop selection, and settings routes.
- Bottom tabs for **Bits**, **WPad**, **Session**, and **Metronome**.
- `expo-audio` integration for metronome sounds, loop playback, and pad playback.
- A WPad implementation with pitch shifting, haptics, crossfade looping, major/minor mode, and key selection.
- A metronome implementation with BPM controls, tap tempo, time signature selection, looping click assets, and beat visuals.
- A Bits loop player with loop selection, preview, BPM loading, tap tempo, and play/pause.
- A placeholder Session screen for future setlist management.
- Settings, profile, onboarding, login, register, reset password, and help routes.
- Appwrite configuration for auth, database, audio collection, and file storage, though auth state and session persistence are not yet fully wired.

## 7. MVP Scope

### 7.1 Onboarding And Entry

Users should see a brief onboarding explaining the app's musician workflow:

- Practice with click, loops, and pads.
- Build performance-ready sessions.
- Keep tempos, keys, and audio organized.

MVP requirements:

- User can skip onboarding.
- User can reach the main tabs quickly.
- Login can be optional for local-only usage during MVP, or required only if cloud sync/import is enabled.
- Auth screens should not block local practice tools if backend auth is unavailable.

Acceptance criteria:

- A new user can reach the main tool tabs in under 30 seconds.
- Returning users should land directly in the last-used main tab or default to Bits.

### 7.2 Bits: Loop Player

Bits is the loop/backing track area. Users should be able to choose a loop, load its BPM, and play it reliably.

Functional requirements:

- Display available loops with title, artist, BPM, and time signature.
- Allow users to preview a loop from the loop list.
- Confirm loading a selected loop into the player.
- Set the main player BPM from the selected loop metadata.
- Start, pause, and restart loop playback.
- Support tap tempo and manual BPM adjustment.
- Maintain playback in silent mode where supported.
- Stop loop audio when leaving the screen or selecting a different loop.

MVP loop metadata:

- `key`
- `title`
- `artist`
- `bpm`
- `timeSignature`
- `source`

Future requirements:

- Import audio from device files.
- Store imported loops in Appwrite storage.
- Let users tag loops by genre, key, usage, or setlist.
- Support half-time and double-time controls.
- Support count-in before loop start.
- Support loop trimming and start offset.

Acceptance criteria:

- Selecting a loop updates the player title and BPM.
- Preview playback cannot overlap with another preview.
- Main loop playback does not overlap with stale previous loop instances.
- Play/pause state always matches audible state.

### 7.3 WPad: Musical Pad Instrument

WPad is a playable pad bed for worship, practice, and live transitions.

Functional requirements:

- Show major and minor mode tabs.
- In major mode, show 12 chromatic keys.
- In minor mode, show minor key options.
- Pressing a key starts a continuous pad.
- Pressing the active key stops the pad.
- Pressing a different key switches cleanly to the new key.
- Use crossfade looping to avoid hard audio gaps.
- Provide tactile feedback on key press.
- Visually identify the active pad.

Current implementation direction:

- A shared source pad sample is pitch-shifted by semitone using playback rate.
- Two audio layers crossfade to create seamless sustain.
- Major and minor UI modes exist, though minor audio theory mapping needs clearer product definition.

Product decisions needed:

- Decide whether minor mode should use true minor pad samples, pitch-shifted major pads, or relative-minor naming.
- Decide whether pad key labels should prefer sharps only, flats only, or user-selectable notation.
- Decide whether changing keys should stop immediately or crossfade between keys.

Acceptance criteria:

- Active pad loops for at least 5 minutes without obvious gaps.
- Switching keys does not produce overlapping uncontrolled audio.
- Leaving the WPad tab stops or gracefully fades the active pad.
- UI remains responsive while pad audio is playing.

### 7.4 Metronome

The metronome is a dedicated click tool with clear stage-readable controls.

Functional requirements:

- BPM range: 20 to 320.
- Increment and decrement BPM by tap.
- Fast BPM changes via press-and-hold.
- Direct BPM numeric input.
- Tap tempo with smoothing across recent taps.
- Time signature selection.
- Supported signatures for MVP: 2/4, 3/4, 4/4, 5/4, 6/8, 7/8, 9/8, 12/8.
- Visual beat indicators matching the selected time signature.
- Distinguish the downbeat visually and audibly.
- Start and stop control should be large and reachable.

Technical requirement:

- The metronome must prioritize timing reliability. If JavaScript timers prove inconsistent, move scheduling to native/sample-accurate audio, generated click loops, or a dedicated audio timing engine.

Acceptance criteria:

- Changing BPM while playing updates playback without requiring stop/start.
- Changing time signature while playing resets cleanly to beat 1.
- Visual beat indicator does not drift noticeably from audible click during normal use.
- No duplicate click layers remain after stop/start cycles.

### 7.5 Session Manager

Session is the planned setlist area. It should connect the other tools into a preparation workflow.

Functional requirements:

- Create a session/setlist.
- Add songs/items to a session.
- For each song, store:
  - Song title
  - Artist/source
  - BPM
  - Time signature
  - Song key
  - Pad key
  - Loop/audio asset
  - Notes
  - Order in setlist
- Reorder songs.
- Open a song into performance mode.
- From a session item, load the associated loop into Bits, pad key into WPad, and BPM/time signature into Metronome.

MVP session workflow:

1. User taps plus on Session tab.
2. User creates a setlist name.
3. User adds songs with title, BPM, key, and optional loop.
4. User taps a song to load its performance setup.
5. User can move to next/previous song.

Acceptance criteria:

- A user can create and return to a saved local session.
- Session item order persists after app restart.
- Loading a song applies BPM and loop metadata correctly.
- Missing loop assets are handled with a clear empty state.

## 8. Settings, Profile, And Account

### Settings

MVP settings should include:

- Sound effects on/off.
- Background audio on/off where supported.
- Default BPM.
- Default time signature.
- Key notation preference: sharps, flats, or both.
- Dark mode can remain fixed if the app is intentionally dark-first.

### Profile

Profile should initially be minimal:

- Name
- Email
- Optional role/instrument
- App usage stats only if they are real and tracked.

The current placeholder profile data should be replaced before release.

### Auth And Cloud

Appwrite appears intended for:

- User accounts.
- User metadata.
- Audio metadata.
- File storage for uploaded loops.
- Potential cloud sync of sessions.

MVP recommendation:

- Make core tools usable without login.
- Require account only for cloud sync, imported audio backup, or multi-device access.

Acceptance criteria:

- Login, registration, logout, and password reset work end to end before cloud features are marketed.
- Auth state persists across app restart.
- Failed auth shows clear error messages.
- Sensitive Appwrite dev keys are not shipped in production builds.

## 9. Navigation And Information Architecture

Primary tabs:

- **Bits**
- **WPad**
- **Session**
- **Metronome**

Secondary routes:

- Loop Sounds
- Settings
- Profile
- Help & Support
- Login/Register/Password flows

Recommended launch behavior:

- First install: onboarding.
- Returning unauthenticated user: main app with optional sign-in prompt, or login if cloud-only decision is made.
- Returning authenticated user: last-used tab.

## 10. UX Principles

- **Stage safe**: large controls, high contrast, no tiny critical buttons.
- **Fast**: no deep menus for common live actions.
- **Predictable audio**: play/pause/active states must always match what is heard.
- **Dark-first**: the existing black/dark UI is appropriate for stage environments.
- **Minimal reading during performance**: labels should be short, with clear icons and strong visual state.
- **No surprise interruption**: avoid modal prompts during active playback unless the user explicitly triggered a destructive change.

## 11. Data Model

### User

- `id`
- `email`
- `displayName`
- `instrument`
- `createdAt`
- `updatedAt`

### Loop

- `id`
- `ownerId`
- `title`
- `artist`
- `bpm`
- `timeSignature`
- `key`
- `duration`
- `fileId`
- `localAssetKey`
- `createdAt`
- `updatedAt`

### Session

- `id`
- `ownerId`
- `title`
- `description`
- `date`
- `items`
- `createdAt`
- `updatedAt`

### Session Item

- `id`
- `sessionId`
- `order`
- `songTitle`
- `artist`
- `bpm`
- `timeSignature`
- `songKey`
- `padKey`
- `loopId`
- `notes`

### User Preferences

- `ownerId`
- `defaultBpm`
- `defaultTimeSignature`
- `keyNotation`
- `soundEffectsEnabled`
- `backgroundAudioEnabled`
- `lastOpenedTab`

## 12. Technical Requirements

- Framework: React Native with Expo.
- Routing: Expo Router.
- Styling: NativeWind/Tailwind.
- Audio: `expo-audio` for MVP, with evaluation of native/sample-accurate audio if timing limitations remain.
- Backend: Appwrite for auth, metadata, database, and storage.
- Platform: iOS first, Android supported.
- Orientation: portrait.
- Offline support: core playback and local sessions should work without network.

Critical technical concerns:

- Audio cleanup must be strict on route changes.
- Background playback behavior must be tested on physical iOS and Android devices.
- Metronome timing should be measured on device, not only simulator.
- Imported audio storage should separate local file URI, cloud file ID, and metadata.

## 13. Analytics And Success Metrics

MVP metrics:

- Onboarding completion rate.
- Time from launch to first audio playback.
- Number of metronome starts per user.
- Number of pad key presses per user.
- Number of loops loaded.
- Number of sessions created.
- Crash-free sessions.
- Audio error rate.

Product success indicators:

- 70% of active users use at least two tools in a week.
- Median time to start playback is under 10 seconds after app open.
- Users create at least one saved session within first week if Session is released.
- Crash-free sessions above 99%.

## 14. Release Phases

### Phase 1: Local Music Toolkit MVP

- Reliable tab navigation.
- Functional Bits loop player with built-in loops.
- Functional WPad with major keys.
- Functional Metronome with BPM, tap tempo, and time signatures.
- Basic Session list with local persistence.
- Settings cleaned up to real preferences.
- Optional onboarding.

### Phase 2: Setlist And Song Workflow

- Create/edit/delete sessions.
- Add/reorder songs.
- Load song settings into Bits/WPad/Metronome.
- Store sessions locally.
- Polish performance mode.

### Phase 3: Accounts And Cloud Sync

- Complete Appwrite auth flow.
- Persist user profile.
- Cloud sync sessions.
- Upload and manage custom loops.
- Restore data on new device.

### Phase 4: Pro Performance Features

- Count-ins.
- Crossfade between loops.
- Song sections/cues.
- MIDI or Bluetooth foot controller support.
- Chord chart/lyrics attachments.
- Audio pack management.

## 15. Open Questions

1. Is login required for all users, or only for sync/import features?
2. Should WPad target worship musicians specifically, or all live performers?
3. Should minor pads be true minor audio beds or pitch-shifted versions of one pad?
4. Should loops be called "Bits" everywhere, or should "Loops" remain user-facing in some places?
5. Should Session become the default home screen once a user has created a setlist?
6. Do users need imported local files in MVP, or are bundled loops enough for first release?
7. Is Appwrite the final backend choice for production?
8. Should metronome and loop playback be able to run simultaneously?

## 16. MVP Acceptance Checklist

- User can open the app and reach main tabs.
- User can play, pause, and change BPM in Bits.
- User can choose and preview a loop.
- User can play and stop a pad in WPad.
- User can switch pad keys without audio buildup.
- User can start/stop metronome with selected BPM and time signature.
- User can create at least one session/setlist and persist it.
- Settings reflect real app behavior.
- No placeholder profile stats or lorem ipsum copy remain.
- Auth is either fully working or clearly deferred from the local MVP.
- App runs on a physical iOS device without audio session failures.
- Audio stops or fades predictably when navigating away from screens.

## 17. Recommended Immediate Next Steps

1. Decide whether the MVP is local-first or login-gated.
2. Build local persistence for sessions and user preferences.
3. Replace placeholder onboarding and profile copy.
4. Normalize terminology: choose "StemBit", "StemBits", "Bits", and "WPad" usage.
5. Harden audio cleanup and test on physical devices.
6. Define the WPad minor-key behavior.
7. Add a real Session create/edit flow.
8. Remove production secrets from client-visible config before release.
