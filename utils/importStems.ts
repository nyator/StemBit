import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

import type { CueSection, CueTrack } from "../context/SessionsContext";
import { base64ToArrayBuffer, readWavMarkers } from "./wavMarkers";

// Bringing a song's stems into the app.
//
// Multi-select rather than a folder pick, which sounds like the obvious
// interface and isn't available: expo-document-picker picks files, and while
// Android could enumerate a directory through the Storage Access Framework, iOS
// has no equivalent Expo exposes. One flow that works on both beats two that
// diverge -- in practice the user opens the folder and selects everything in it,
// which is the same gesture with one extra tap.
//
// Files are COPIED, not referenced. The picker hands back a cache URI that the
// OS is free to delete whenever it likes, and a setlist that silently loses its
// audio between soundcheck and the gig is the worst failure this feature could
// have.

const STEMS_DIRECTORY = `${FileSystem.documentDirectory}stems/`;

/** Strips the extension, so "01 Drums.wav" shows in the mixer as "01 Drums". */
function displayName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

/** Keeps a file's extension, since the decoder infers format from it. */
function extensionOf(fileName: string): string {
  const match = fileName.match(/\.[^.]+$/);
  return match ? match[0] : "";
}

async function ensureStemsDirectory() {
  const info = await FileSystem.getInfoAsync(STEMS_DIRECTORY);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(STEMS_DIRECTORY, {
      intermediates: true,
    });
  }
}

/**
 * Prompts for audio files and copies them into app storage.
 *
 * Returns an empty array when the user cancels -- a cancel is a decision, not
 * an error, and shouldn't reach the caller as one.
 */
export async function importStems(): Promise<CueTrack[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "audio/*",
    multiple: true,
    // The picker's own copy: without it the returned URI can be a content://
    // handle that isn't readable once the picker closes.
    copyToCacheDirectory: true,
  });

  if (result.canceled || result.assets.length === 0) return [];

  await ensureStemsDirectory();

  const tracks: CueTrack[] = [];

  for (const asset of result.assets) {
    // Unique per file rather than per name: two songs can both have "Bass.wav",
    // and a collision would have one song playing the other's stem.
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const target = `${STEMS_DIRECTORY}${id}${extensionOf(asset.name)}`;

    try {
      await FileSystem.copyAsync({ from: asset.uri, to: target });
      tracks.push({
        id,
        name: displayName(asset.name),
        uri: target,
        level: 1,
        muted: false,
      });
    } catch (error) {
      // One unreadable file shouldn't lose the rest of the song.
      console.error("Failed to copy stem", asset.name, error);
    }
  }

  // Alphabetical, so the mixer's running order matches the file names the user
  // chose -- which is usually already the order they think of the parts in.
  return tracks.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Sections a stem carries in its own metadata, if any.
 *
 * Reads the first file that has markers and stops -- stems of one song are
 * exported together and carry the same ones, so the rest would be duplicates.
 *
 * An empty result is the normal case, not a failure: plenty of DAWs write no
 * cue chunks when exporting stems, and nothing but WAV carries them at all.
 * Marking sections by hand stays the reliable path; this only saves the work
 * when the file happens to have done it already.
 */
export async function readStemSections(
  tracks: CueTrack[]
): Promise<CueSection[]> {
  for (const track of tracks) {
    if (!/\.wav$/i.test(track.uri)) continue;

    try {
      const base64 = await FileSystem.readAsStringAsync(track.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const markers = readWavMarkers(base64ToArrayBuffer(base64));
      if (markers.length === 0) continue;

      return markers.map((marker, index) => ({
        id: `${Date.now()}-${index}`,
        name: marker.name ?? `Section ${index + 1}`,
        startSeconds: marker.seconds,
        // Each section runs to the next one. The last runs to the end of the
        // file, which is what an absent end means to the engine.
        endSeconds: markers[index + 1]?.seconds,
      }));
    } catch (error) {
      // A file that can't be read for markers can still be played, so this is
      // never fatal to the import.
      console.error("Failed to read markers", track.name, error);
    }
  }

  return [];
}

/** Deletes a cue's copied stems. Called when the cue itself goes. */
export async function removeStems(tracks: CueTrack[]): Promise<void> {
  await Promise.all(
    tracks.map((track) =>
      FileSystem.deleteAsync(track.uri, { idempotent: true }).catch(() => {
        // Already gone, which is the outcome we wanted anyway.
      })
    )
  );
}
