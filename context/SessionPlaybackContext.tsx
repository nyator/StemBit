import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import { buildSessionEngineHtml } from "../constants/sessionEngine";
import { loadAudioBase64 } from "../utils/loadAssetBase64";
import type { CueTrack } from "./SessionsContext";

// The session's own playback, in a hidden WebView of its own.
//
// Separate from the Loop and Pad tabs' engines because a stem cue is
// multi-track and its tracks have to be sample-locked to each other, which only
// happens when they share one AudioContext. See constants/sessionEngine.ts.
//
// It is also deliberately absent from FloatingEngineControls, so running a set
// never surfaces on another tab.

/** How a launch is lined up against the transport grid, in beats. */
export type Quantum = 0 | 1 | 2 | 4 | 8;

type SessionPlaybackContextValue = {
  /** Cue whose stems are currently decoded, or null. */
  loadedCueId: string | null;
  /** True once every track of the loaded cue has decoded. */
  isReady: boolean;
  isPlaying: boolean;
  /**
   * Decode a cue's stems, dropping whatever the last one left behind. Safe to
   * call for the cue already loaded -- it returns without touching the engine,
   * so re-cueing the live song doesn't stall it.
   */
  loadCue: (cueId: string, tracks: CueTrack[]) => Promise<void>;
  /** Start the loaded cue. `quantum` 0 starts now; 4 waits for the next bar. */
  play: (tracks: CueTrack[], bpm: number, quantum?: Quantum) => void;
  stop: () => void;
  /** Mute or set the level of one track without disturbing the others. */
  setTrack: (trackId: string, level: number, muted: boolean) => void;
};

const SessionPlaybackContext =
  createContext<SessionPlaybackContextValue | null>(null);

export function SessionPlaybackProvider({ children }: { children: ReactNode }) {
  const webViewRef = useRef<WebView>(null);
  const [engineHtml] = useState(buildSessionEngineHtml);
  const [engineGeneration, setEngineGeneration] = useState(0);

  const [loadedCueId, setLoadedCueId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Messages posted before the page attaches its listeners are dropped, so
  // everything queues until the engine's "ready" handshake.
  const engineReadyRef = useRef(false);
  const messageQueueRef = useRef<Record<string, unknown>[]>([]);
  // Track ids still decoding, so "all loaded" is a fact rather than a guess.
  const pendingRef = useRef<Set<string>>(new Set());

  const postToEngine = (message: Record<string, unknown>) => {
    if (!engineReadyRef.current) {
      messageQueueRef.current.push(message);
      return;
    }
    webViewRef.current?.postMessage(JSON.stringify(message));
  };

  const loadCue = async (cueId: string, tracks: CueTrack[]) => {
    if (cueId === loadedCueId) return;

    setIsReady(false);
    setLoadedCueId(cueId);
    // Free the previous song before decoding the next. A set's worth of stems
    // held at once would exhaust the WebView long before the night ended.
    postToEngine({ type: "clearTracks" });

    pendingRef.current = new Set(tracks.map((track) => track.id));
    if (tracks.length === 0) {
      setIsReady(true);
      return;
    }

    // Sequential rather than Promise.all: each file is read into a base64
    // string, and a song's stems read at once would hold several copies of the
    // whole song in JS memory at the same moment.
    for (const track of tracks) {
      try {
        const base64 = await loadAudioBase64(track.uri);
        postToEngine({ type: "loadTrack", id: track.id, base64 });
      } catch (error) {
        console.error("Failed to read stem", track.name, error);
        pendingRef.current.delete(track.id);
      }
    }
  };

  const play = (tracks: CueTrack[], bpm: number, quantum: Quantum = 0) => {
    postToEngine({ type: "setTempo", bpm });
    postToEngine({
      type: "arm",
      sectionId: loadedCueId,
      tracks: tracks.map((track) => track.id),
      quantum,
    });
    setIsPlaying(true);
  };

  const stop = () => {
    postToEngine({ type: "stopTransport" });
    setIsPlaying(false);
  };

  const setTrack = (trackId: string, level: number, muted: boolean) => {
    postToEngine({ type: "setTrack", id: trackId, level, muted });
  };

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "ready") {
        engineReadyRef.current = true;
        const queued = messageQueueRef.current;
        messageQueueRef.current = [];
        queued.forEach((message) =>
          webViewRef.current?.postMessage(JSON.stringify(message))
        );
      } else if (data.type === "loaded") {
        pendingRef.current.delete(data.id);
        if (pendingRef.current.size === 0) setIsReady(true);
      } else if (data.type === "transport") {
        // The engine is the authority on whether anything is running -- it
        // stops the transport itself in cases the app never hears about.
        setIsPlaying(data.running === true);
      } else if (data.type === "error") {
        console.error("Session engine error:", data.code, data.id ?? "");
        // A stem that won't decode must not leave the cue waiting forever on a
        // track that is never coming.
        if (data.id) {
          pendingRef.current.delete(data.id);
          if (pendingRef.current.size === 0) setIsReady(true);
        }
      }
    } catch {
      // Ignore malformed messages.
    }
  };

  const restartEngine = () => {
    engineReadyRef.current = false;
    messageQueueRef.current = [];
    pendingRef.current = new Set();
    setLoadedCueId(null);
    setIsReady(false);
    setIsPlaying(false);
    setEngineGeneration((generation) => generation + 1);
  };

  return (
    <SessionPlaybackContext.Provider
      value={{ loadedCueId, isReady, isPlaying, loadCue, play, stop, setTrack }}
    >
      {children}
      <WebView
        key={engineGeneration}
        ref={webViewRef}
        source={{ html: engineHtml }}
        onMessage={handleWebViewMessage}
        onRenderProcessGone={() => {
          console.warn("Session engine renderer was killed — restarting it");
          restartEngine();
        }}
        onContentProcessDidTerminate={() => {
          console.warn("Session engine content process ended — restarting it");
          restartEngine();
        }}
        originWhitelist={["*"]}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        containerStyle={{ flex: 0, width: 0, height: 0 }}
      />
    </SessionPlaybackContext.Provider>
  );
}

export function useSessionPlayback(): SessionPlaybackContextValue {
  const context = useContext(SessionPlaybackContext);
  if (!context) {
    throw new Error(
      "useSessionPlayback must be used within a SessionPlaybackProvider"
    );
  }
  return context;
}
