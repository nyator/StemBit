// Runs a WebView engine page's script on native audio instead of in a WebView.
//
// The loop, session and loop-preview engines are pages: a script that builds a
// Web Audio graph, takes commands as postMessage strings and answers the same
// way. react-native-audio-api is the Web Audio API implemented natively, so the
// script itself needs nothing changed to run here -- only the handful of
// browser things around it: window, document, atob, the message channel, and
// the two context classes. This file is those, and nothing else, so the page
// stays the one source of truth for what every engine does whichever way it
// is run.
//
// Why bother: a WebView's audio belongs to WebKit, which suspends it whenever
// the app leaves the foreground and mutes it with the ringer switch. The
// native context belongs to the app's own audio session, so it keeps playing
// in the background and ignores the switch -- see nativeMetronomeEngine.ts,
// where the same move was measured sample-accurate on a real phone.
//
// What the page sees that differs from a browser:
//   - decodeAudioData takes success/error callbacks as well as returning a
//     promise, and sources take `onended` -- the library's names differ.
//   - The silent keep-alive <audio> element (silentModeKeepAlive.ts) is a
//     stub. It exists to fix WebKit's audio session, which isn't in play here;
//     the app's session is set in setNativeAudioSession below.
//   - document.hidden follows AppState, and visibilitychange fires with it.
//   - window.__nativeHost is true, for the few constants worth tuning
//     differently on the React Native JS thread.
import { AppState, type AppStateStatus } from "react-native";
import type { AudioContext as NativeAudioContext } from "react-native-audio-api";

// Loaded lazily -- see utils/nativeAudio.ts for why nothing imports it directly.
import { getAudioApi } from "./nativeAudio";

type Listener = (event: { data: string }) => void;

export type NativeEngineHost = {
  /** Same as WebView.postMessage: a string the page's "message" handler gets. */
  postMessage: (data: string) => void;
  dispose: () => void;
};

/** The <script> bodies of an engine page, in order. */
const scriptsOf = (html: string) =>
  Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g), (m) => m[1]).join(
    "\n;\n"
  );

// Callback-style decodeAudioData (what the pages use) on top of the promise.
const withDecodeCallbacks = <T extends { decodeAudioData: (...args: any[]) => Promise<any> }>(
  ctx: T
) => {
  const decode = ctx.decodeAudioData.bind(ctx);
  (ctx as any).decodeAudioData = (
    input: ArrayBuffer,
    onSuccess?: (buffer: unknown) => void,
    onError?: (error: unknown) => void
  ) => {
    const pending = decode(input);
    if (onSuccess || onError) pending.then(onSuccess, onError);
    return pending;
  };
  return ctx;
};

// Sources answer to `onended` as in a browser.
const withOnEnded = <T extends { createBufferSource: () => any }>(ctx: T) => {
  const create = ctx.createBufferSource.bind(ctx);
  (ctx as any).createBufferSource = () => {
    const source = create();
    let handler: ((event: unknown) => void) | null = null;
    Object.defineProperty(source, "onended", {
      configurable: true,
      get: () => handler,
      set: (fn: ((event: unknown) => void) | null) => {
        handler = fn;
        source.onEnded = fn ? () => fn({ target: source }) : null;
      },
    });
    return source;
  };
  return ctx;
};

// The keep-alive element, inert. See the header.
const fakeMediaElement = () => ({
  src: "",
  loop: false,
  volume: 1,
  setAttribute() {},
  play: () => Promise.resolve(),
  pause() {},
});

/**
 * Configure the app's audio session for the native engines: playback, so the
 * ringer switch doesn't mute them, and shared with other apps or not.
 */
export const setNativeAudioSession = (mixWithOthers: boolean) => {
  getAudioApi().AudioManager.setAudioSessionOptions({
    iosCategory: "playback",
    iosMode: "default",
    iosOptions: mixWithOthers ? ["mixWithOthers"] : [],
  });
};

export function createNativeEngineHost(
  html: string,
  onMessage: (data: string) => void
): NativeEngineHost {
  let disposed = false;
  const windowListeners: Listener[] = [];

  // Everything the page makes that outlives a call: its live audio contexts
  // and its timers. Tracked so dispose can end them -- a page's scheduler is a
  // setTimeout chain, and left alone it would run for the life of the app.
  const contexts: NativeAudioContext[] = [];
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();

  class HostedAudioContext {
    constructor() {
      const ctx = new (getAudioApi().AudioContext)();
      contexts.push(ctx);
      return withOnEnded(withDecodeCallbacks(ctx));
    }
  }

  class HostedOfflineAudioContext {
    constructor(channels: number, length: number, sampleRate: number) {
      return withOnEnded(
        withDecodeCallbacks(
          new (getAudioApi().OfflineAudioContext)(channels, length, sampleRate)
        )
      );
    }
  }

  const hostSetTimeout = (fn: (...args: any[]) => void, ms?: number, ...args: any[]) => {
    const id = setTimeout(() => {
      timeouts.delete(id);
      if (!disposed) fn(...args);
    }, ms);
    timeouts.add(id);
    return id;
  };
  const hostClearTimeout = (id: ReturnType<typeof setTimeout>) => {
    timeouts.delete(id);
    clearTimeout(id);
  };
  const hostSetInterval = (fn: (...args: any[]) => void, ms?: number, ...args: any[]) => {
    const id = setInterval(() => {
      if (!disposed) fn(...args);
    }, ms);
    intervals.add(id);
    return id;
  };
  const hostClearInterval = (id: ReturnType<typeof setInterval>) => {
    intervals.delete(id);
    clearInterval(id);
  };
  const documentListeners: Record<string, Listener[]> = {};

  const isHidden = (state: AppStateStatus) => state === "background";
  const documentShim = {
    hidden: isHidden(AppState.currentState),
    body: { appendChild() {} },
    createElement: fakeMediaElement,
    addEventListener(type: string, fn: Listener) {
      (documentListeners[type] ??= []).push(fn);
    },
    removeEventListener(type: string, fn: Listener) {
      documentListeners[type] = (documentListeners[type] ?? []).filter((l) => l !== fn);
    },
  };

  const windowShim: Record<string, unknown> = {
    __nativeHost: true,
    AudioContext: HostedAudioContext,
    OfflineAudioContext: HostedOfflineAudioContext,
    ReactNativeWebView: {
      postMessage: (data: string) => {
        if (!disposed) onMessage(data);
      },
    },
    addEventListener(type: string, fn: Listener) {
      if (type === "message") windowListeners.push(fn);
    },
    removeEventListener(type: string, fn: Listener) {
      if (type !== "message") return;
      const index = windowListeners.indexOf(fn);
      if (index !== -1) windowListeners.splice(index, 1);
    },
  };

  const appStateSubscription = AppState.addEventListener("change", (state) => {
    const hidden = isHidden(state);
    if (hidden === documentShim.hidden) return;
    documentShim.hidden = hidden;
    (documentListeners.visibilitychange ?? []).forEach((fn) => fn({ data: "" }));
  });

  // The pages listen for "message" on both window and document, because which
  // one a WebView fires on depends on the platform. Here it's delivered once:
  // to window's listeners if there are any, else document's -- never both, or
  // every command would run twice.
  const deliver = (data: string) => {
    const targets = windowListeners.length
      ? windowListeners
      : (documentListeners.message ?? []);
    targets.slice().forEach((fn) => fn({ data }));
  };

  try {
    // eslint-disable-next-line no-new-func
    const run = new Function(
      "window",
      "document",
      "navigator",
      "AudioContext",
      "OfflineAudioContext",
      "webkitAudioContext",
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      scriptsOf(html)
    );
    run(
      windowShim,
      documentShim,
      {},
      HostedAudioContext,
      HostedOfflineAudioContext,
      undefined,
      hostSetTimeout,
      hostClearTimeout,
      hostSetInterval,
      hostClearInterval
    );
  } catch (error) {
    // Reported the way a page reports its own errors, so the host context's
    // existing handling picks it up.
    onMessage(
      JSON.stringify({
        type: "error",
        message: `native engine failed to start: ${String(error)}`,
      })
    );
  }

  return {
    postMessage: (data: string) => {
      if (!disposed) deliver(data);
    },
    dispose: () => {
      disposed = true;
      appStateSubscription.remove();
      timeouts.forEach(clearTimeout);
      timeouts.clear();
      intervals.forEach(clearInterval);
      intervals.clear();
      // Closing a context silences everything scheduled on it.
      contexts.forEach((ctx) => ctx.close().catch(() => {}));
      contexts.length = 0;
      windowListeners.length = 0;
      Object.keys(documentListeners).forEach((key) => delete documentListeners[key]);
    },
  };
}
