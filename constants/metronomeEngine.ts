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
  /**
   * Map of sound id -> base64-encoded audio, e.g. `{ bright: "...", low: "..." }`.
   * Every registered click sound (see METRONOME_SOUNDS in MetronomeContext) is
   * decoded up front; the accent and beat voices then each play whichever id
   * their picker selected.
   */
  sounds: Record<string, string>;
};

export const buildMetronomeHtml = ({ sounds }: MetronomeAssets) => `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script>
      (function () {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        var audioContext = null;
        // Decoded AudioBuffers keyed by sound id.
        var buffers = {};

        var isPlaying = false;
        var tempo = 120;
        var beatsPerMeasure = 4;
        // Beat indices (0-based) that mark the start of a rhythmic group.
        // Beat 0 is always the primary accent; any other listed beat gets a
        // softer accent click so compound/odd meters (6/8, 7/8, ...) are felt
        // in their groupings, not as a flat pulse.
        var accents = [0];
        // Per-voice output gain, 0–1. accentVolume scales the accent clicks
        // (primary + softer group accents); beatVolume scales the regular
        // clicks. Driven from the metro screen's Accent/Beats rows.
        var accentVolume = 1.0;
        var beatVolume = 1.0;
        // Which loaded sound each voice plays (set from the per-voice pickers);
        // default to the first/second loaded sound until told otherwise.
        var accentSoundId = null;
        var beatSoundId = null;
        var currentBeatNumber = 0;
        var nextNoteTime = 0.0;
        var lookaheadMs = 25.0;
        var scheduleAheadTime = 0.1;
        var timerId = null;
        var scheduledSources = [];
        var scheduledBeatTimeouts = [];

        var sounds = ${JSON.stringify(sounds)};

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
          var ids = Object.keys(sounds);
          if (accentSoundId === null) accentSoundId = ids[0];
          if (beatSoundId === null) beatSoundId = ids.length > 1 ? ids[1] : ids[0];
          var pending = ids.length;
          if (pending === 0) {
            post({ type: "ready" });
            return;
          }
          function done() {
            pending -= 1;
            if (pending === 0) post({ type: "ready" });
          }
          ids.forEach(function (id) {
            ctx.decodeAudioData(
              base64ToArrayBuffer(sounds[id]),
              function (buf) {
                buffers[id] = buf;
                done();
              },
              function () {
                post({ type: "error", message: "decode " + id + " failed" });
                done();
              }
            );
          });
        }

        // The buffer a voice should play, falling back to any loaded sound if
        // the selected id somehow failed to decode.
        function bufferForVoice(isAccent) {
          var id = isAccent ? accentSoundId : beatSoundId;
          return buffers[id] || buffers[Object.keys(buffers)[0]] || null;
        }

        function scheduleNote(beatNumber, time) {
          var ctx = audioContext;
          var isPrimaryAccent = beatNumber === 0;
          var isSecondaryAccent =
            !isPrimaryAccent && accents.indexOf(beatNumber) !== -1;
          var isAccentVoice = isPrimaryAccent || isSecondaryAccent;
          // The accent voice plays accentSoundId; every other beat plays
          // beatSoundId.
          var buffer = bufferForVoice(isAccentVoice);
          // Group accents keep their 0.6 "lift" relative to the downbeat, then
          // the whole accent voice is scaled by accentVolume; other clicks by
          // beatVolume.
          var gain;
          if (isPrimaryAccent) {
            gain = accentVolume;
          } else if (isSecondaryAccent) {
            gain = 0.6 * accentVolume;
          } else {
            gain = beatVolume;
          }
          if (buffer) {
            var source = ctx.createBufferSource();
            source.buffer = buffer;
            var gainNode = ctx.createGain();
            gainNode.gain.value = gain;
            source.connect(gainNode);
            gainNode.connect(ctx.destination);
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

        function setAccents(nextAccents) {
          if (Object.prototype.toString.call(nextAccents) === "[object Array]" && nextAccents.length > 0) {
            accents = nextAccents;
          } else {
            accents = [0];
          }
        }

        function setVolumes(nextAccentVolume, nextBeatVolume) {
          if (typeof nextAccentVolume === "number") {
            accentVolume = Math.max(0, Math.min(1, nextAccentVolume));
          }
          if (typeof nextBeatVolume === "number") {
            beatVolume = Math.max(0, Math.min(1, nextBeatVolume));
          }
        }

        function setSounds(nextAccentSound, nextBeatSound) {
          if (typeof nextAccentSound === "string" && buffers[nextAccentSound]) {
            accentSoundId = nextAccentSound;
          }
          if (typeof nextBeatSound === "string" && buffers[nextBeatSound]) {
            beatSoundId = nextBeatSound;
          }
        }

        function start(nextTempo, nextBeats, nextAccents, nextAccentVolume, nextBeatVolume, nextAccentSound, nextBeatSound) {
          if (isPlaying) return;
          if (nextTempo) tempo = nextTempo;
          if (nextBeats) beatsPerMeasure = nextBeats;
          if (nextAccents) setAccents(nextAccents);
          setVolumes(nextAccentVolume, nextBeatVolume);
          setSounds(nextAccentSound, nextBeatSound);
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

        function setBeats(nextBeats, nextAccents) {
          beatsPerMeasure = nextBeats;
          setAccents(nextAccents);
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
              start(data.bpm, data.beats, data.accents, data.accentVolume, data.beatVolume, data.accentSound, data.beatSound);
              break;
            case "stop":
              stop();
              break;
            case "setVolumes":
              setVolumes(data.accentVolume, data.beatVolume);
              break;
            case "setSounds":
              setSounds(data.accentSound, data.beatSound);
              break;
            case "setTempo":
              setTempo(data.bpm);
              break;
            case "setBeats":
              setBeats(data.beats, data.accents);
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
