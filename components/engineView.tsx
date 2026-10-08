import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import WebView, {
  type WebViewMessageEvent,
  type WebViewProps,
} from "react-native-webview";

import {
  createNativeEngineHost,
  setNativeAudioSession,
  type NativeEngineHost,
} from "../utils/nativeEngineHost";

// Where an engine page runs: a hidden WebView, or native audio (Settings ->
// Native audio). A drop-in for the <WebView> the engine hosts used to render:
// same `html` in, same ref.postMessage(string), same onMessage event -- so a
// host context doesn't know or care which one it got.
//
// Natively there's no view at all, and no process to lose: the WebView's
// render-process callbacks just never fire, and a host's liveness ping still
// works, because the page answers it either way.

export type EngineViewHandle = { postMessage: (data: string) => void };

type EngineViewProps = Omit<WebViewProps, "source" | "onMessage"> & {
  html: string;
  onMessage: (event: WebViewMessageEvent) => void;
  /** Run the page on native audio instead of in a WebView. */
  native: boolean;
};

const HIDDEN_STYLE = { flex: 0, width: 0, height: 0, opacity: 0 } as const;

const EngineView = forwardRef<EngineViewHandle, EngineViewProps>(function EngineView(
  { html, onMessage, native, ...webViewProps },
  ref
) {
  const webViewRef = useRef<WebView>(null);
  const hostRef = useRef<NativeEngineHost | null>(null);
  // The page outlives renders; it reports through whatever handler is current.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // The page's own "setMixWithOthers" only switches WebKit's session, which
  // isn't in play natively -- the app's session is what decides here, and it
  // always mixes. Declared before the host effect so it runs first.
  useEffect(() => {
    if (native) setNativeAudioSession();
  }, [native]);

  useImperativeHandle(ref, () => ({
    postMessage: (data: string) => {
      if (native) hostRef.current?.postMessage(data);
      else webViewRef.current?.postMessage(data);
    },
  }), [native]);

  useEffect(() => {
    if (!native) return;
    const host = createNativeEngineHost(html, (data) =>
      onMessageRef.current({ nativeEvent: { data } } as WebViewMessageEvent)
    );
    hostRef.current = host;
    return () => {
      host.dispose();
      if (hostRef.current === host) hostRef.current = null;
    };
  }, [native, html]);

  if (native) return null;

  return (
    <WebView
      ref={webViewRef}
      source={{ html }}
      onMessage={onMessage}
      originWhitelist={["*"]}
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
      containerStyle={HIDDEN_STYLE}
      style={HIDDEN_STYLE}
      pointerEvents="none"
      {...webViewProps}
    />
  );
});

export default EngineView;
