// Keeps Web Audio audible when the iOS ring/silent switch is on.
//
// WebKit picks an audio session category per page from what that page is
// playing. A bare AudioContext lands on an ambient-type session, which the
// silent switch mutes; a playing HTMLMediaElement pushes the page onto a
// playback session, which it doesn't. So a WebView engine built on Web Audio
// alone goes silent on a muted phone even though the app's own session is
// configured for playback -- that setting governs the app's session, and
// WKWebView plays media in a separate process with its own.
//
// The fix is to give WebKit an element to see: a looping, silent WAV. The
// AudioContext then rides along on the playback session the element earned.
// WebKit doesn't inspect the samples, so silence works -- but the element must
// be UNMUTED with volume > 0, because a muted element doesn't count as
// playback and won't move the category.
//
// Held only while something is sounding, not for the life of the page, so an
// idle engine isn't holding a playback session (and ducking other apps) for
// nothing.
//
// Android needs none of this -- silent mode never touched the music stream --
// but it's harmless there, and one code path is easier to reason about than a
// platform test inside a WebView that doesn't know which platform it's on.
//
// Injected into the engine pages as source (see loopEngine.ts /
// metronomeEngine.ts), so it must stay free of backticks and ${} to survive
// the template literals it's interpolated into.
export const SILENT_MODE_KEEP_ALIVE_SOURCE = `
        var keepAliveEl = null;

        // A second of 8kHz mono silence as a data URI. Small (~21KB of
        // base64) and generated rather than shipped, so there's no asset to
        // keep in sync. The rate is low because it is, after all, silence --
        // the OS resamples it and nobody hears the difference.
        function buildSilentWav() {
          var rate = 8000;
          var frames = rate;
          var bytes = new ArrayBuffer(44 + frames * 2);
          var view = new DataView(bytes);
          function ascii(offset, text) {
            for (var i = 0; i < text.length; i++) {
              view.setUint8(offset + i, text.charCodeAt(i));
            }
          }
          ascii(0, "RIFF");
          view.setUint32(4, 36 + frames * 2, true);
          ascii(8, "WAVEfmt ");
          view.setUint32(16, 16, true); // PCM header length
          view.setUint16(20, 1, true); // format: PCM
          view.setUint16(22, 1, true); // channels: mono
          view.setUint32(24, rate, true);
          view.setUint32(28, rate * 2, true); // byte rate
          view.setUint16(32, 2, true); // block align
          view.setUint16(34, 16, true); // bits per sample
          ascii(36, "data");
          view.setUint32(40, frames * 2, true);
          // The sample data is left as it was allocated: zeroes, i.e. silence.
          var raw = new Uint8Array(bytes);
          var binary = "";
          for (var b = 0; b < raw.length; b++) {
            binary += String.fromCharCode(raw[b]);
          }
          return "data:audio/wav;base64," + btoa(binary);
        }

        function startKeepAlive() {
          if (!keepAliveEl) {
            keepAliveEl = document.createElement("audio");
            keepAliveEl.src = buildSilentWav();
            keepAliveEl.loop = true;
            keepAliveEl.volume = 1; // must be audible to WebKit; see above
            keepAliveEl.setAttribute("playsinline", "");
            document.body.appendChild(keepAliveEl);
          }
          // Called on every start, not just the first: the OS can pause the
          // element while the app is away, and playback always comes back
          // through here.
          var started = keepAliveEl.play();
          if (started && started.catch) {
            started.catch(function () {
              // Autoplay refused. The engine still plays, just at the mercy
              // of the silent switch -- not worth failing playback over.
            });
          }
        }

        function stopKeepAlive() {
          if (keepAliveEl) keepAliveEl.pause();
        }
`;
