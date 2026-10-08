import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

// The Metronome tab (click track, see MetronomeContext) and the Bits/Loop
// screen (backing loop audio, see LoopPlaybackContext) each play
// independently and persist across tab switches. This keeps them mutually
// exclusive: starting one refuses to start while the other is already
// playing, so you never get two out-of-sync audio sources at once.
export type EngineId = "metro" | "loop";

type PlaybackLockContextValue = {
  activeEngine: EngineId | null;
  requestStart: (engine: EngineId) => boolean;
  release: (engine: EngineId) => void;
};

const PlaybackLockContext = createContext<PlaybackLockContextValue | null>(
  null
);

export function PlaybackLockProvider({ children }: { children: ReactNode }) {
  const [activeEngine, setActiveEngine] = useState<EngineId | null>(null);
  // The authoritative holder, alongside the state that renders it.
  //
  // Handing over is two calls in one breath -- stop what is playing, then start
  // what replaces it -- and the state from the render this closure was made in
  // still names the engine that just let go. Asked whether the lock was free,
  // it said no, and the replacement silently declined to start. So the answer
  // comes from a ref, which is true the instant it is written.
  const activeRef = useRef<EngineId | null>(null);

  const requestStart = (engine: EngineId) => {
    if (activeRef.current && activeRef.current !== engine) {
      return false;
    }
    activeRef.current = engine;
    setActiveEngine(engine);
    return true;
  };

  const release = (engine: EngineId) => {
    if (activeRef.current === engine) activeRef.current = null;
    setActiveEngine((current) => (current === engine ? null : current));
  };

  return (
    <PlaybackLockContext.Provider
      value={{ activeEngine, requestStart, release }}
    >
      {children}
    </PlaybackLockContext.Provider>
  );
}

export function usePlaybackLock() {
  const context = useContext(PlaybackLockContext);
  if (!context) {
    throw new Error(
      "usePlaybackLock must be used within a PlaybackLockProvider"
    );
  }
  return context;
}
