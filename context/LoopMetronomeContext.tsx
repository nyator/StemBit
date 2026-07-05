import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import audio from "../constants/audio";
import { buildMetronomeHtml } from "../constants/metronomeEngine";
import { loadAssetBase64 } from "../utils/loadAssetBase64";

export const LOOP_MIN_BPM = 20;
export const LOOP_MAX_BPM = 240;
const BEATS_PER_BAR = 4;

type LoopMetronomeContextValue = {
  bpm: number;
  setBpm: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  engineReady: boolean;
  startClick: () => void;
  stopClick: () => void;
};

const LoopMetronomeContext = createContext<LoopMetronomeContextValue | null>(
  null
);

// Same hidden-WebView Web Audio "lookahead scheduler" pattern used by the
// Metronome tab (see context/MetronomeContext.tsx and
// constants/metronomeEngine.ts), applied to the Bits/Loop screen's click
// track. Mounted above the tab navigator (app/(tabs)/_layout.tsx) rather than
// inside the loop screen itself, so it isn't throttled when the tab is
// hidden and keeps ticking steadily across tab switches.
export function LoopMetronomeProvider({ children }: { children: ReactNode }) {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);

  const webViewRef = useRef<WebView>(null);
  const [engineHtml, setEngineHtml] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  const postToEngine = (message: Record<string, unknown>) => {
    webViewRef.current?.postMessage(JSON.stringify(message));
  };

  // Load the click samples once and build the WebView engine page
  useEffect(() => {
    let isMounted = true;

    const loadEngine = async () => {
      try {
        const [brightBase64, lowBase64] = await Promise.all([
          loadAssetBase64(audio.metronome_bright),
          loadAssetBase64(audio.metronome_low),
        ]);

        if (!isMounted) return;
        setEngineHtml(buildMetronomeHtml({ brightBase64, lowBase64 }));
      } catch (error) {
        console.error("Failed to load loop metronome engine", error);
      }
    };

    loadEngine();

    return () => {
      isMounted = false;
    };
  }, []);

  const stopClick = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    postToEngine({ type: "stop" });
  };

  // The metronome only makes sense in the foreground: pause it if the app
  // is backgrounded or the screen locks, since the WebView's audio clock
  // suspends there anyway.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && isPlayingRef.current) {
        stopClick();
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") {
        setEngineReady(true);
      } else if (data.type === "error") {
        console.error("Loop metronome engine error:", data.message);
      }
      // "beat" messages are ignored here: the Bits screen doesn't render a
      // beat indicator, so there's no need to re-render on every click.
    } catch (error) {
      // Ignore malformed messages
    }
  };

  const startClick = () => {
    if (isPlaying) return;

    if (!engineReady) {
      console.warn("Loop metronome engine not loaded yet");
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);
    postToEngine({ type: "start", bpm, beats: BEATS_PER_BAR });
  };

  // Handle BPM changes while playing
  useEffect(() => {
    if (isPlaying) {
      postToEngine({ type: "setTempo", bpm });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm]);

  useEffect(() => {
    return () => {
      stopClick();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LoopMetronomeContext.Provider
      value={{
        bpm,
        setBpm,
        isPlaying,
        engineReady,
        startClick,
        stopClick,
      }}
    >
      {children}
      {engineHtml && (
        <WebView
          ref={webViewRef}
          source={{ html: engineHtml }}
          onMessage={handleWebViewMessage}
          originWhitelist={["*"]}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          containerStyle={{ flex: 0, width: 0, height: 0 }}
          style={{ flex: 0, width: 0, height: 0, opacity: 0 }}
          pointerEvents="none"
        />
      )}
    </LoopMetronomeContext.Provider>
  );
}

export function useLoopMetronome() {
  const context = useContext(LoopMetronomeContext);
  if (!context) {
    throw new Error(
      "useLoopMetronome must be used within a LoopMetronomeProvider"
    );
  }
  return context;
}
