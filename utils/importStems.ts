import * as DocumentPicker from "expo-document-picker";
// The legacy entrypoint, not the package root. SDK 54 ships
// expo-file-system 19, where the root export is the new File/Directory API
// and the path-and-string API this file uses moved behind /legacy. Importing
// from the root leaves EncodingType undefined and makes every read throw.
import * as FileSystem from "expo-file-system/legacy";

import type { CueSection, CueTrack } from "../context/SessionsContext";
import { parseAbletonSet, placementFor, type AbletonSet } from "./abletonSet";
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

/**
 * Rebuilds a stem's path against the CURRENT documentDirectory, discarding
 * whatever absolute prefix got baked in when it was imported.
 *
 * iOS reassigns the app's container a new absolute path on every reinstall --
 * a fresh Expo Go build, a TestFlight update, sometimes an OS update. A uri
 * stored as the fully-resolved path from import time points at a container
 * that may no longer exist by the time it's read; the part after "stems/" is
 * the only part of it that's actually stable, since the id in the filename
 * never changes. Safe to call on an already-current path too -- it just
 * rebuilds the same string.
 */
export function resolveStemUri(uri: string): string {
  const filename = uri.split("/stems/").pop();
  return filename ? `${STEMS_DIRECTORY}${filename}` : uri;
}

async function ensureStemsDirectory() {
  const info = await FileSystem.getInfoAsync(STEMS_DIRECTORY);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(STEMS_DIRECTORY, {
      intermediates: true,
    });
  }
}

// What the picker lets through once it has to accept an Ableton set as well.
// The set has no MIME type either platform recognises, so the picker is opened
// to everything and the choice is narrowed here instead -- a PDF picked by
// mistake is skipped rather than handed to the decoder as a stem.
const AUDIO_EXTENSIONS = /\.(wav|wave|aif|aiff|aifc|mp3|m4a|aac|caf|flac|ogg|opus)$/i;
const ABLETON_SET_EXTENSION = /\.als$/i;

export type StemImport = {
  tracks: CueTrack[];
  /**
   * The Ableton set picked alongside the stems, when there was one and it
   * could be read. Present with an empty `locators` is still worth having --
   * the tempo and placements are in it.
   */
  set?: AbletonSet;
  /**
   * The set's name without ".als", whenever one was picked -- including when
   * it couldn't be read, which is how the caller tells "no set" from "a set
   * that didn't parse".
   */
  setName?: string;
  /** Files that were neither audio nor a set, by name, for telling the user. */
  skipped: string[];
};

async function readAbletonSet(uri: string): Promise<AbletonSet | undefined> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const set = parseAbletonSet(new Uint8Array(base64ToArrayBuffer(base64)));
    // A tempo is the one thing every real set has; without one, the file
    // wasn't a set this reader understands.
    return set.bpm > 0 ? set : undefined;
  } catch (error) {
    console.error("Failed to read Ableton set", error);
    return undefined;
  }
}

/**
 * Prompts for audio files -- and optionally an Ableton set -- and copies the
 * audio into app storage.
 *
 * When a set comes with the stems, each stem the set uses is placed where its
 * clip sits in the arrangement. The set's locators and tempo are handed back
 * for the caller to decide what to do with, since that depends on what the cue
 * already has.
 *
 * Returns no tracks and no set when the user cancels -- a cancel is a
 * decision, not an error, and shouldn't reach the caller as one.
 */
export async function importStems(): Promise<StemImport> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    multiple: true,
    // The picker's own copy: without it the returned URI can be a content://
    // handle that isn't readable once the picker closes.
    copyToCacheDirectory: true,
  });

  if (result.canceled || result.assets.length === 0) {
    return { tracks: [], skipped: [] };
  }

  // Read before copying any audio, so the stems can be placed as they land.
  // More than one set picked is a mistake with no right answer; the first wins.
  const setAsset = result.assets.find((asset) =>
    ABLETON_SET_EXTENSION.test(asset.name)
  );
  const set = setAsset ? await readAbletonSet(setAsset.uri) : undefined;

  const audio = result.assets.filter((asset) => AUDIO_EXTENSIONS.test(asset.name));
  const skipped = result.assets
    .filter(
      (asset) =>
        !AUDIO_EXTENSIONS.test(asset.name) && asset !== setAsset
    )
    .map((asset) => asset.name);

  if (audio.length > 0) await ensureStemsDirectory();

  const tracks: CueTrack[] = [];

  for (const asset of audio) {
    // Unique per file rather than per name: two songs can both have "Bass.wav",
    // and a collision would have one song playing the other's stem.
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const target = `${STEMS_DIRECTORY}${id}${extensionOf(asset.name)}`;

    try {
      await FileSystem.copyAsync({ from: asset.uri, to: target });
      const startSeconds = set ? placementFor(set, asset.name) : undefined;
      tracks.push({
        id,
        name: displayName(asset.name),
        uri: target,
        level: 1,
        muted: false,
        // Only when it moves the stem: a stem at 0 is what absent means, and
        // leaving it off keeps cues from sets and cues from loose files alike.
        ...(startSeconds && Math.abs(startSeconds) > 0.0005
          ? { startSeconds }
          : {}),
      });
    } catch (error) {
      // One unreadable file shouldn't lose the rest of the song.
      console.error("Failed to copy stem", asset.name, error);
    }
  }

  // Alphabetical, so the mixer's running order matches the file names the user
  // chose -- which is usually already the order they think of the parts in.
  tracks.sort((a, b) => a.name.localeCompare(b.name));
  return {
    tracks,
    set,
    setName: setAsset ? displayName(setAsset.name) : undefined,
    skipped,
  };
}

/**
 * Stems already in a cue, placed by a set picked on its own afterwards.
 *
 * Matched on the stem's name, which is its file name until someone renames
 * it. Returns the same array when nothing moved, so the caller can tell
 * whether the engine needs to reload.
 */
export function placeTracks(tracks: CueTrack[], set: AbletonSet): CueTrack[] {
  let moved = false;
  const placed = tracks.map((track) => {
    const startSeconds = placementFor(set, track.name);
    if (startSeconds === undefined) return track;
    const next = Math.abs(startSeconds) > 0.0005 ? startSeconds : undefined;
    if (next === track.startSeconds) return track;
    moved = true;
    return { ...track, startSeconds: next };
  });
  return moved ? placed : tracks;
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
      const base64 = await FileSystem.readAsStringAsync(
        resolveStemUri(track.uri),
        { encoding: FileSystem.EncodingType.Base64 }
      );
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
      FileSystem.deleteAsync(resolveStemUri(track.uri), {
        idempotent: true,
      }).catch(() => {
        // Already gone, which is the outcome we wanted anyway.
      })
    )
  );
}
