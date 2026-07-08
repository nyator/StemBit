// Loop playback engine that runs inside a hidden WebView (same pattern as
// constants/metronomeEngine.ts).
//
// Why not expo-audio's `player.loop = true`? Two reasons, both audible as a
// stumble at the loop point:
//
// 1. AVPlayer/ExoPlayer looping works by seeking back to 0, which is never
//    sample-accurate — there's a small, variable gap on every pass.
// 2. Lossy formats (MP3/AAC) bake silence into the decoded audio: MP3 adds
//    ~10-50ms of encoder priming at the start and padding at the end. The
//    loop file can be perfectly tight in the DAW and still decode with
//    silence at both edges.
//
// Web Audio's AudioBufferSourceNode.loop is rendered sample-accurately by
// the audio hardware clock. On load we additionally:
//   - scan the decoded buffer for the first/last audible sample (trimming
//     the encoder padding), and
//   - snap the loop length to the nearest whole beat at the loop's native
//     BPM (a produced loop is always a whole number of beats), so the loop
//     point lands exactly on the musical grid.
//
// BPM warping maps onto source.playbackRate (rate = bpm / nativeBpm), the
// same varispeed behaviour the expo-audio implementation had.
export const buildLoopEngineHtml = () => `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script>
      (function () {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        var audioContext = null;

        var buffer = null;
        var loopStart = 0;
        var loopEnd = 0;
        var source = null;
        var currentRate = 1;
        var loadToken = 0;

        // Samples quieter than this (on any channel) count as silence when
        // trimming encoder padding. ~ -46 dBFS.
        var SILENCE_THRESHOLD = 0.005;
        // Only snap to the beat grid if the trimmed length is within this
        // fraction of a whole number of beats; otherwise trust the trim.
        var BEAT_SNAP_TOLERANCE = 0.1;

        function post(message) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(message));
          }
        }

        function base64ToArrayBuffer(base64) {
          var binary = atob(base64);
          var len = binary.length;
          var bytes = new Uint8Array(len);
          for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
          return bytes.buffer;
        }

        function ensureContext() {
          if (!audioContext) {
            audioContext = new AudioContextClass();
          }
          if (audioContext.state === "suspended") {
            audioContext.resume();
          }
          return audioContext;
        }

        function isAudible(frame, channels, frameIndex) {
          for (var c = 0; c < channels.length; c++) {
            if (Math.abs(channels[c][frameIndex]) > SILENCE_THRESHOLD) {
              return true;
            }
          }
          return false;
        }

        // Find the audible region of the decoded buffer and compute loop
        // points, snapping the loop length to whole beats at nativeBpm.
        function computeLoopPoints(decoded, nativeBpm) {
          var channels = [];
          for (var c = 0; c < decoded.numberOfChannels; c++) {
            channels.push(decoded.getChannelData(c));
          }
          var totalFrames = decoded.length;

          var firstFrame = 0;
          while (
            firstFrame < totalFrames &&
            !isAudible(null, channels, firstFrame)
          ) {
            firstFrame++;
          }

          var lastFrame = totalFrames - 1;
          while (lastFrame > firstFrame && !isAudible(null, channels, lastFrame)) {
            lastFrame--;
          }

          if (firstFrame >= lastFrame) {
            // Whole file is "silent" (threshold too high for this material):
            // fall back to looping the entire buffer.
            return { start: 0, end: decoded.duration };
          }

          var start = firstFrame / decoded.sampleRate;
          var audibleLength = (lastFrame + 1 - firstFrame) / decoded.sampleRate;

          if (nativeBpm > 0) {
            var secondsPerBeat = 60 / nativeBpm;
            var beats = audibleLength / secondsPerBeat;
            var wholeBeats = Math.round(beats);
            if (
              wholeBeats >= 1 &&
              Math.abs(beats - wholeBeats) <= BEAT_SNAP_TOLERANCE
            ) {
              // Snap: the loop is musically exactly wholeBeats long.
              return { start: start, end: start + wholeBeats * secondsPerBeat };
            }
          }

          return { start: start, end: start + audibleLength };
        }

        function load(base64, nativeBpm) {
          loadToken += 1;
          var token = loadToken;
          stop();
          buffer = null;

          var ctx = ensureContext();
          ctx.decodeAudioData(
            base64ToArrayBuffer(base64),
            function (decoded) {
              if (token !== loadToken) return; // superseded by a newer load
              var points = computeLoopPoints(decoded, nativeBpm);
              buffer = decoded;
              loopStart = points.start;
              loopEnd = points.end;
              post({
                type: "loaded",
                duration: decoded.duration,
                loopStart: loopStart,
                loopEnd: loopEnd,
              });
            },
            function () {
              if (token !== loadToken) return;
              post({ type: "error", message: "decode loop failed" });
            }
          );
        }

        function stop() {
          if (source) {
            try {
              source.stop();
            } catch (e) {
              // already stopped
            }
            source.disconnect();
            source = null;
          }
        }

        function play(rate) {
          if (!buffer) {
            post({ type: "error", message: "no loop loaded" });
            return;
          }
          stop();
          var ctx = ensureContext();
          if (rate) currentRate = rate;

          source = ctx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.loopStart = loopStart;
          source.loopEnd = loopEnd;
          source.playbackRate.value = currentRate;
          source.connect(ctx.destination);
          // Start slightly ahead on the audio clock, from the trimmed loop
          // start so the encoder padding is never heard.
          source.start(ctx.currentTime + 0.03, loopStart);
        }

        function setRate(rate) {
          currentRate = rate;
          if (source) {
            source.playbackRate.value = rate;
          }
        }

        function handleMessage(event) {
          var data;
          try {
            data = JSON.parse(event.data);
          } catch (e) {
            return;
          }
          switch (data.type) {
            case "load":
              load(data.base64, data.nativeBpm);
              break;
            case "play":
              play(data.rate);
              break;
            case "stop":
              stop();
              break;
            case "setRate":
              setRate(data.rate);
              break;
            default:
              break;
          }
        }

        document.addEventListener("message", handleMessage);
        window.addEventListener("message", handleMessage);

        post({ type: "ready" });
      })();
    </script>
  </body>
</html>`;
