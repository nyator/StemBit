import { useEffect, useRef, useState } from "react";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";

import { resolveAudioUri } from "../utils/loadAssetBase64";

// Auditioning a row in a browser -- a loop, a pad -- without loading it.
//
// The loop and pad browsers each had their own copy of this, and both had the
// same two faults:
//
//   - The player was handed the bundled asset itself. In a development build
//     that is a URL on the Metro server, so every preview streamed the file
//     over Wi-Fi before a note sounded -- seconds, for a pad.
//   - The button said "playing" the instant it was tapped and only took it
//     back when the sound finished. A preview that never started never
//     finished, so the button stuck on pause for good.
//
// So the file is put on disk first (a no-op once it's there, and in a release
// build it already is), the button says "loading" until sound is actually
// coming out, and a preview that hasn't started within a few seconds gives up
// instead of pretending.

/** Long enough for a slow first download; short enough not to look broken. */
const START_TIMEOUT_MS = 8000;

export type PreviewState = {
  /** The row being auditioned, or null. */
  activeKey: string | null;
  /** True between the tap and the first sound. */
  isLoading: boolean;
  /** Start this row, or stop it if it's the one already going. */
  toggle: (key: string, source: number | string) => void;
  stop: () => void;
};

export function usePreview(): PreviewState {
  const [active, setActive] = useState<{ key: string; loading: boolean } | null>(
    null
  );
  const playerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Which tap is current. A tap on a second row while the first is still
  // resolving its file must not end with the first one playing.
  const tokenRef = useRef(0);
  const activeKeyRef = useRef<string | null>(null);

  const release = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    const player = playerRef.current;
    playerRef.current = null;
    if (player) {
      // Paused before it's released: remove() alone doesn't reliably silence a
      // player that's sounding, and the old preview bleeds into the next.
      player.pause();
      player.remove();
    }
  };

  const stop = () => {
    tokenRef.current += 1;
    release();
    activeKeyRef.current = null;
    setActive(null);
  };

  const toggle = (key: string, source: number | string) => {
    if (activeKeyRef.current === key) {
      stop();
      return;
    }

    stop();
    const token = tokenRef.current;
    activeKeyRef.current = key;
    setActive({ key, loading: true });

    resolveAudioUri(source)
      .then(({ uri }) => {
        if (tokenRef.current !== token) return;

        const player = createAudioPlayer(uri);
        playerRef.current = player;
        subscriptionRef.current = player.addListener(
          "playbackStatusUpdate",
          (status) => {
            if (tokenRef.current !== token) return;
            if (status.didJustFinish) {
              stop();
              return;
            }
            if (status.playing) {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
              setActive((current) =>
                current?.key === key && current.loading
                  ? { key, loading: false }
                  : current
              );
            }
          }
        );
        player.play();

        timeoutRef.current = setTimeout(() => {
          if (tokenRef.current !== token || player.playing) return;
          console.warn("Preview didn't start; giving up", key);
          stop();
        }, START_TIMEOUT_MS);
      })
      .catch((error) => {
        if (tokenRef.current !== token) return;
        console.error("Preview failed to load", key, error);
        stop();
      });
  };

  // Nothing keeps sounding after the browser closes.
  useEffect(() => () => {
    tokenRef.current += 1;
    release();
  }, []);

  return {
    activeKey: active?.key ?? null,
    isLoading: active?.loading ?? false,
    toggle,
    stop,
  };
}
