// react-native-audio-api, loaded only when something actually needs it.
//
// The library installs its native module the moment it's imported, and throws
// if the app binary doesn't contain it -- a dev client built before the
// dependency was added, say. Imported at the top of a file that the root
// layout reaches, that one throw took down every route in the app, for a
// feature that's off by default. So nothing imports it directly: the native
// engines ask for it here, at the point they're built, and the rest of the app
// asks whether it's there before choosing them.
import { usePreferences } from "../context/PreferencesContext";

type AudioApi = typeof import("react-native-audio-api");

// undefined = not tried yet; null = tried, and this binary doesn't have it.
let audioApi: AudioApi | null | undefined;

const load = (): AudioApi | null => {
  if (audioApi !== undefined) return audioApi;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audioApi = require("react-native-audio-api") as AudioApi;
  } catch (error) {
    console.warn(
      "Native audio isn't available in this build — using the WebView engines.",
      error
    );
    audioApi = null;
  }
  return audioApi;
};

/** Whether this app binary can run the native engines at all. */
export const isNativeAudioAvailable = () => load() !== null;

/**
 * The library itself. Only for code that runs once native audio has been
 * chosen -- callers check isNativeAudioAvailable (or useNativeAudio) first.
 */
export const getAudioApi = (): AudioApi => {
  const api = load();
  if (!api) throw new Error("react-native-audio-api is not in this build");
  return api;
};

/**
 * Run the engines on native audio: the user turned it on, and this build can.
 * With the setting on but the module missing, the WebView engines carry on as
 * if it were off rather than failing.
 */
export function useNativeAudio() {
  const { prefs } = usePreferences();
  return prefs.nativeAudio && isNativeAudioAvailable();
}
