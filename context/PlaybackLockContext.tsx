import { createContext, useContext, useState, type ReactNode } from "react";

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

  const requestStart = (engine: EngineId) => {
    if (activeEngine && activeEngine !== engine) {
      return false;
    }
    setActiveEngine(engine);
    return true;
  };

  const release = (engine: EngineId) => {
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
