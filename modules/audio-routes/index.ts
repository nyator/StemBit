import {
  requireOptionalNativeModule,
  type EventSubscription,
} from "expo-modules-core";

// Live audio output routing.
//
// Nothing in Expo or React Native's JS surface reports audio OUTPUT devices --
// expo-audio enumerates inputs (for recording) and exposes a single
// `shouldRouteThroughEarpiece` flag, and that's the whole of it. So the output
// list in Settings was hard-coded to the three rows the Figma drew. This module
// is the missing piece: it asks the platform what's actually connected and
// tells us when that changes.
//
// A note on selection, because the platforms are stricter than the UI suggests:
//
//   iOS   -- Apple does not let an app route audio to a specific Bluetooth or
//            AirPlay device. `overrideOutputAudioPort` can force the built-in
//            speaker or fall back to the system's choice, and even that only
//            works when the audio session category is `playAndRecord`. Anything
//            else goes through the system route picker, which the user drives.
//
//   Android -- Enumeration is real and complete via AudioManager. Pinning media
//            playback to a chosen device is not: expo-audio owns the ExoPlayer
//            instance internally, so there's no audio track to call
//            `setPreferredDevice` on. The system output switcher is the honest
//            control.
//
// Rather than paper over that with radio buttons that quietly do nothing, each
// output reports its own `isSelectable`, and `showOutputPicker()` opens the
// platform's own switcher. The UI leans on the picker and uses the list to
// show what's connected and which device is live.

/** Normalized device categories, so the UI can pick an icon per output. */
export type AudioOutputKind =
  | "speaker"
  | "receiver"
  | "wiredHeadset"
  | "bluetoothA2dp"
  | "bluetoothSco"
  | "usb"
  | "hdmi"
  | "airplay"
  | "carAudio"
  | "dock"
  | "unknown";

export type AudioOutput = {
  /** Stable within a connection; not stable across reconnects. */
  id: string;
  /** Display name. Accessory names come from the device itself. */
  name: string;
  kind: AudioOutputKind;
  /** Whether audio is currently playing through this device. */
  isActive: boolean;
  /**
   * Whether `selectOutput` can genuinely switch to this device on this
   * platform. False means the system picker is the only way -- see the note
   * above. Never render a control that implies otherwise when this is false.
   */
  isSelectable: boolean;
};

export type RouteChangeEvent = { outputs: AudioOutput[] };

type NativeAudioRoutes = {
  getOutputs(): AudioOutput[];
  selectOutput(id: string): Promise<boolean>;
  showOutputPicker(): boolean;
  addListener(
    event: "onRouteChange",
    listener: (event: RouteChangeEvent) => void
  ): EventSubscription;
};

// Optional, not required: a dev client built before this module existed (or
// Expo Go) simply won't have it. Everything below degrades to an empty list
// instead of throwing on import, which would take the whole app down.
const native = requireOptionalNativeModule<NativeAudioRoutes>("AudioRoutes");

/**
 * False when the app is running a binary built before this module was added.
 * The Settings screen uses this to explain the empty list rather than showing
 * a bare "no devices found", which would look like a bug.
 */
export const isAudioRoutesAvailable = native != null;

/** Currently connected output devices. Empty when the native module is absent. */
export function getOutputs(): AudioOutput[] {
  try {
    return native?.getOutputs() ?? [];
  } catch {
    return [];
  }
}

/**
 * Best-effort switch to a device. Returns false when the platform refuses,
 * which is the common case -- check `isSelectable` before offering this.
 */
export async function selectOutput(id: string): Promise<boolean> {
  try {
    return (await native?.selectOutput(id)) ?? false;
  } catch {
    return false;
  }
}

/**
 * Opens the OS output switcher (iOS route picker / Android media output panel).
 * Returns false if no picker could be opened.
 */
export function showOutputPicker(): boolean {
  try {
    return native?.showOutputPicker() ?? false;
  } catch {
    return false;
  }
}

/** Fires whenever a device connects, disconnects, or the active route changes. */
export function addRouteChangeListener(
  listener: (event: RouteChangeEvent) => void
): EventSubscription | null {
  if (!native) return null;
  return native.addListener("onRouteChange", listener);
}
