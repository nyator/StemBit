// Live volume while a Settings slider is being dragged.
//
// The levels themselves are preferences, and a preference change re-renders
// every screen and context that reads one and writes the file to disk. Fine
// once, when the drag ends; at frame rate it is the JS-thread load the native
// engines' click schedulers lose to, and the click was heard stuttering under
// it. So during a drag the slider publishes here instead, and each playback
// context hands the level straight to its engine -- a message it already
// takes -- with nothing re-rendered and nothing saved. The release still goes
// through setPref, which persists it and settles every engine on the same
// value the preview was showing.
//
// Throttled: a slider reports every frame, and an engine gains nothing from
// hearing more often than its own ramps can follow.

export type VolumeChannel = "loop" | "pad" | "metronome";

type Listener = (value: number) => void;

const PREVIEW_INTERVAL_MS = 33;

const listeners: Record<VolumeChannel, Set<Listener>> = {
  loop: new Set(),
  pad: new Set(),
  metronome: new Set(),
};
const lastSentAt: Record<VolumeChannel, number> = { loop: 0, pad: 0, metronome: 0 };
const trailing: Partial<Record<VolumeChannel, ReturnType<typeof setTimeout>>> = {};

const emit = (channel: VolumeChannel, value: number) => {
  lastSentAt[channel] = Date.now();
  listeners[channel].forEach((listener) => listener(value));
};

/** Publish a level mid-drag. The last value of a burst is always delivered. */
export function previewVolume(channel: VolumeChannel, value: number) {
  const pending = trailing[channel];
  if (pending) clearTimeout(pending);
  trailing[channel] = undefined;

  const wait = PREVIEW_INTERVAL_MS - (Date.now() - lastSentAt[channel]);
  if (wait <= 0) {
    emit(channel, value);
    return;
  }
  trailing[channel] = setTimeout(() => {
    trailing[channel] = undefined;
    emit(channel, value);
  }, wait);
}

/**
 * End a drag on its final value, at once. Called on release alongside setPref:
 * it drops any tick still waiting, so a stale one can't land after the release
 * and undo it, and sends the final level itself -- a drag that ends where it
 * started leaves the preference unchanged, so nothing else would.
 */
export function settleVolumePreview(channel: VolumeChannel, value: number) {
  const pending = trailing[channel];
  if (pending) clearTimeout(pending);
  trailing[channel] = undefined;
  emit(channel, value);
}

/** Hear a channel's live level. Returns the unsubscribe. */
export function onVolumePreview(channel: VolumeChannel, listener: Listener) {
  listeners[channel].add(listener);
  return () => {
    listeners[channel].delete(listener);
  };
}
