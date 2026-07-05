// Metronome timing engine that runs inside a hidden WebView.
//
// JS `setTimeout`/`setInterval` scheduling on the RN JS thread is not sample
// accurate: any bridge/GC/render hiccup shifts every subsequent beat. Web
// Audio's `AudioContext.currentTime` is a hardware clock, so instead of
// timing each click with a timer we use the standard "lookahead scheduler"
// pattern (see Chris Wilson, "A Tale of Two Clocks"): a coarse JS timer wakes
// up every ~25ms and schedules any upcoming clicks that fall within the next
// 100ms directly on the audio clock. Playback timing is therefore immune to
// JS thread jitter; only the RN-side visual beat indicator (posted back via
// a delayed setTimeout) can lag slightly, which is imperceptible.
export type MetronomeAssets = {
  brightBase64: string;
  lowBase64: string;
};

export const buildMetronomeHtml = ({
  brightBase64,
  lowBase64,
}: MetronomeAssets) => `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script>
      (function () {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        var audioContext = null;
        var brightBuffer = null;
        var lowBuffer = null;

        var isPlaying = false;
        var tempo = 120;
        var beatsPerMeasure = 4;
        var currentBeatNumber = 0;
        var nextNoteTime = 0.0;
        var lookaheadMs = 25.0;
        var scheduleAheadTime = 0.1;
        var timerId = null;
        var scheduledSources = [];
        var scheduledBeatTimeouts = [];

        var brightBase64 = ${JSON.stringify(brightBase64)};
        var lowBase64 = ${JSON.stringify(lowBase64)};

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

        function decodeBuffers() {
          var ctx = ensureContext();
          var pending = 2;
          function done() {
            pending -= 1;
            if (pending === 0) {
              post({ type: "ready" });
            }
          }
          ctx.decodeAudioData(
            base64ToArrayBuffer(brightBase64),
            function (buf) {
              brightBuffer = buf;
              done();
            },
            function () {
              post({ type: "error", message: "decode bright failed" });
              done();
            }
          );
          ctx.decodeAudioData(
            base64ToArrayBuffer(lowBase64),
            function (buf) {
              lowBuffer = buf;
              done();
            },
            function () {
              post({ type: "error", message: "decode low failed" });
              done();
            }
          );
        }

        function scheduleNote(beatNumber, time) {
          var ctx = audioContext;
          var buffer = beatNumber === 0 ? brightBuffer : lowBuffer;
          if (buffer) {
            var source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start(time);
            scheduledSources.push(source);
            source.onended = function () {
              var idx = scheduledSources.indexOf(source);
              if (idx !== -1) scheduledSources.splice(idx, 1);
            };
          }
          var delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
          var beatTimeout = setTimeout(function () {
            var idx = scheduledBeatTimeouts.indexOf(beatTimeout);
            if (idx !== -1) scheduledBeatTimeouts.splice(idx, 1);
            post({ type: "beat", beat: beatNumber });
          }, delayMs);
          scheduledBeatTimeouts.push(beatTimeout);
        }

        function advanceNote() {
          var secondsPerBeat = 60.0 / tempo;
          nextNoteTime += secondsPerBeat;
          currentBeatNumber = (currentBeatNumber + 1) % beatsPerMeasure;
        }

        function scheduler() {
          if (!isPlaying) return;
          while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
            scheduleNote(currentBeatNumber, nextNoteTime);
            advanceNote();
          }
          timerId = setTimeout(scheduler, lookaheadMs);
        }

        function start(nextTempo, nextBeats) {
          if (isPlaying) return;
          if (nextTempo) tempo = nextTempo;
          if (nextBeats) beatsPerMeasure = nextBeats;
          var ctx = ensureContext();
          currentBeatNumber = 0;
          nextNoteTime = ctx.currentTime + 0.05;
          isPlaying = true;
          scheduler();
        }

        function stop() {
          isPlaying = false;
          if (timerId) {
            clearTimeout(timerId);
            timerId = null;
          }
          scheduledSources.forEach(function (source) {
            try {
              source.stop();
            } catch (e) {
              // already stopped/ended
            }
          });
          scheduledSources = [];
          scheduledBeatTimeouts.forEach(function (t) {
            clearTimeout(t);
          });
          scheduledBeatTimeouts = [];
        }

        function setTempo(nextTempo) {
          tempo = nextTempo;
        }

        function setBeats(nextBeats) {
          beatsPerMeasure = nextBeats;
          currentBeatNumber = 0;
        }

        function handleMessage(event) {
          var data;
          try {
            data = JSON.parse(event.data);
          } catch (e) {
            return;
          }
          switch (data.type) {
            case "start":
              start(data.bpm, data.beats);
              break;
            case "stop":
              stop();
              break;
            case "setTempo":
              setTempo(data.bpm);
              break;
            case "setBeats":
              setBeats(data.beats);
              break;
            default:
              break;
          }
        }

        document.addEventListener("message", handleMessage);
        window.addEventListener("message", handleMessage);

        decodeBuffers();
      })();
    </script>
  </body>
</html>`;
