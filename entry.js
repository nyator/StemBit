// The app's entry point: expo-router's, with one thing installed first.
//
// A release build that throws while it starts has no way to say what went
// wrong. The error is fatal, expo-updates' error recovery then aborts the app
// on purpose, and the iOS crash report names expo-updates -- the JavaScript
// message isn't in it at all. The root ErrorBoundary (app/_layout.tsx) catches
// errors while screens render, but not ones thrown while the modules are still
// being loaded, which is before there is anything to render.
//
// So in release builds, a fatal JS error is shown as a native alert instead of
// being handed on. The alert needs no React tree, so it works even when the
// failure is at import time. The app is left stuck rather than killed -- which
// is the point: a tester can screenshot the message.
//
// require(), not import: imports are hoisted above everything else in the
// file, so the router would load -- and any import-time error would fire --
// before the handler below existed.
const { Alert } = require("react-native");

if (!__DEV__ && global.ErrorUtils) {
  const passOn = global.ErrorUtils.getGlobalHandler();
  let shown = false;

  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (!isFatal) {
      passOn(error, isFatal);
      return;
    }
    if (shown) return; // one alert, not a stack of them
    shown = true;

    const message = `${error?.name ?? "Error"}: ${error?.message ?? String(error)}`;
    const stack = String(error?.stack ?? "").split("\n").slice(0, 8).join("\n");

    // Also to the log: under `expo start --no-dev` this lands in the Metro
    // terminal, which is readable even when the alert is stuck behind the
    // splash screen.
    console.error(`[StemBits startup error] ${message}\n${stack}`);

    // The splash is still up -- it's only hidden once the first screen is
    // ready, which a fatal error means never happens -- and it covers the
    // alert. Take it down first, or the app just sits on the logo.
    try {
      const SplashScreen = require("expo-splash-screen");
      (SplashScreen.hide ?? SplashScreen.hideAsync)?.();
    } catch (e) {
      // No splash module to hide; the alert may still get through.
    }

    // A moment's delay: at launch the native window may not be ready to
    // present an alert yet.
    setTimeout(() => {
      Alert.alert("StemBits startup error", `${message}\n\n${stack}`);
    }, 800);
  });
}

require("expo-router/entry");
