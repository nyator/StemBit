import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { Alert, AppState } from "react-native";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";

import { findLoopByKey } from "../constants/loops";
import { usePlaybackLock } from "./PlaybackLockContext";

export const LOOP_MIN_BPM = 20;
export const LOOP_MAX_BPM = 240;

type LoopPlaybackContextValue = {
  bpm: number;
  setBpm: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  isBlockedByOtherEngine: boolean;
  setSelectedLoopKey: (key: string | undefined) => void;
  startLoop: () => void;
  stopLoop: () => void;
};

const LoopPlaybackContext = createContext<LoopPlaybackContextValue | null>(
  null
);

// Plays the selected backing loop track, "warped" to the current BPM
// (playback rate = bpm / the loop's own recorded tempo, see
// constants/loops.ts). No click/metronome here — just the loop audio.
//
// Mounted above the tab navigator (app/(tabs)/_layout.tsx) like the other
// engines so it can be seen/stopped from the floating control and kept
// mutually exclusive with the Metronome tab via PlaybackLockContext.
export function LoopPlaybackProvider({ children }: { children: ReactNode }) {
  const { activeEngine, requestStart, release } = usePlaybackLock();
  const isBlockedByOtherEngine = activeEngine !== null && activeEngine !== "loop";

  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);

  const loopSoundRef = useRef<AudioPlayer | null>(null);
  // The tempo a loaded loop was originally recorded at. BPM changes are
  // "warped" onto the loop by speeding up/slowing down playback: rate =
  // bpm / nativeBpm, so setting bpm back to nativeBpm plays at original speed.
  const nativeBpmRef = useRef<number | null>(null);
  const [loopReady, setLoopReady] = useState(false);

  // Enable audio playback in silent mode (iOS) for the backing loop track
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionModeAndroid: "duckOthers",
    }).catch((error) => {
      console.error("Failed to set audio mode", error);
    });
  }, []);

  const stopLoop = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    loopSoundRef.current?.pause();
    release("loop");
  };

  // Loop audio only makes sense in the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && isPlayingRef.current) {
        stopLoop();
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the selected loop's audio, resetting the tempo control to its own
  // native BPM so it starts back at 1x speed.
  const setSelectedLoopKey = (key: string | undefined) => {
    setLoopReady(false);
    stopLoop();

    if (loopSoundRef.current) {
      loopSoundRef.current.remove();
      loopSoundRef.current = null;
    }

    if (!key) {
      nativeBpmRef.current = null;
      return;
    }

    const selectedLoop = findLoopByKey(key);
    if (!selectedLoop) {
      nativeBpmRef.current = null;
      return;
    }

    try {
      const sound = createAudioPlayer(selectedLoop.source);
      sound.loop = true;

      loopSoundRef.current = sound;
      nativeBpmRef.current = selectedLoop.bpm;
      setBpm(selectedLoop.bpm);
      setLoopReady(true);
    } catch (error) {
      console.error("Failed to load loop sound", error);
    }
  };

  // Warp the loop's playback rate to match the current BPM relative to the
  // tempo it was recorded at (e.g. sample_bpm80 at bpm=160 plays at 2x).
  useEffect(() => {
    if (loopSoundRef.current && nativeBpmRef.current) {
      loopSoundRef.current.setPlaybackRate(bpm / nativeBpmRef.current);
    }
  }, [bpm, loopReady]);

  const startLoop = async () => {
    if (isPlaying) return;

    if (!loopSoundRef.current) {
      Alert.alert("No loop selected", "Select a loop before pressing play.");
      return;
    }

    if (!requestStart("loop")) {
      console.warn("Stop the Metronome before starting the Loop");
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);

    try {
      await loopSoundRef.current.seekTo(0);
      loopSoundRef.current.play();
    } catch (error) {
      console.error("Error starting loop audio:", error);
    }
  };

  useEffect(() => {
    return () => {
      stopLoop();
      loopSoundRef.current?.remove();
      loopSoundRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LoopPlaybackContext.Provider
      value={{
        bpm,
        setBpm,
        isPlaying,
        isBlockedByOtherEngine,
        setSelectedLoopKey,
        startLoop,
        stopLoop,
      }}
    >
      {children}
    </LoopPlaybackContext.Provider>
  );
}

export function useLoopPlayback() {
  const context = useContext(LoopPlaybackContext);
  if (!context) {
    throw new Error(
      "useLoopPlayback must be used within a LoopPlaybackProvider"
    );
  }
  return context;
}
