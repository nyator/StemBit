// The legacy entrypoint, not the package root -- same reason as everywhere else
// in the app: SDK 54 moved the path-and-string API behind /legacy.
import * as FileSystem from "expo-file-system/legacy";

/**
 * Everything StemBit has written to this device on the user's behalf.
 *
 * Listed in one place because the alternative is each context deleting its own
 * file and a new one quietly not being added here -- which is how a "delete my
 * account" that leaves the setlists behind happens. If you add a new file or
 * directory under documentDirectory, add it here in the same commit.
 */
const USER_DATA_PATHS = [
  "loops/", // imported and downloaded loop audio
  "stems/", // imported song stems
  "userLoops.json", // the imported/downloaded loop index
  "loopOverrides.json", // corrections to shipped loops' tempo and trim
  "loopCatalog.json", // cached copy of the store manifest
  "sessions.json", // setlists and cues
  "preferences.json", // settings, including the launch screen
] as const;

/**
 * Delete the user's local content.
 *
 * Best effort, deliberately: every path is attempted and failures are logged
 * rather than thrown. This runs immediately after the account itself has been
 * deleted, so the thing that legally had to happen already has -- and aborting
 * halfway because one file was locked would leave *more* behind, not less.
 *
 * `idempotent: true` means a path that was never created is not an error, which
 * is the normal case for most of these on a fresh install.
 */
export async function wipeLocalData(): Promise<void> {
  const root = FileSystem.documentDirectory;
  if (!root) return;

  await Promise.all(
    USER_DATA_PATHS.map((path) =>
      FileSystem.deleteAsync(root + path, { idempotent: true }).catch((error) => {
        console.error(`Could not delete ${path}`, error);
      })
    )
  );
}
