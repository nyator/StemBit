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
import { SILENT_MODE_KEEP_ALIVE_SOURCE } from "./silentModeKeepAlive";

export type MetronomeAssets = {
  /**
   * The two click samples, base64-encoded and keyed by voice:
   * `{ accent: "...", beat: "..." }` (see METRONOME_SOUNDS in
   * MetronomeContext). Both are decoded when the page loads; each voice always
   * plays its own sample, so there is nothing to select at runtime.
   */
  sounds: Record<"accent" | "beat", string>;
};

export const buildMetronomeHtml = ({ sounds }: MetronomeAssets) => `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script>
      (function () {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        var audioContext = null;
        // Decoded AudioBuffers keyed by voice ("accent" / "beat").
        var buffers = {};

        var isPlaying = false;
        // Base tempo in BPM, without the playback-feel multiplier applied.
        var tempo = 120;
        // Playback-feel (subdivision) multiplier that's currently sounding:
        // 0.5 = half time, 1 = normal, 2 = double time. The effective click
        // rate is tempo * speedMultiplier.
        var speedMultiplier = 1;
        // A feel multiplier the user picked mid-playback, queued to take effect
        // on the next downbeat so the pulse doesn't lurch mid-bar. null = none
        // pending. See scheduler().
        var pendingMultiplier = null;
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
        // Master gain for the whole metronome (Settings -> Metronome Volume).
        // Multiplied with each voice's gain, so the accent/beat sliders keep
        // setting the relative mix and this sets the overall level.
        var masterVolume = 1.0;
        var currentBeatNumber = 0;
        var nextNoteTime = 0.0;
        // Minimum lead when scheduling on the audio clock. Web Audio rejects
        // times in the past; ~2ms is enough headroom while still feeling
        // attached to the finger. The old 50ms start delay read as sluggish.
        var MIN_SCHEDULE_LEAD = 0.002;
        var lookaheadMs = 25.0;
        var scheduleAheadTime = 0.1;
        var timerId = null;
        var scheduledSources = [];
        var scheduledBeatTimeouts = [];

        var sounds = ${JSON.stringify(sounds)};
${SILENT_MODE_KEEP_ALIVE_SOURCE}
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

        // The buffer a voice should play, falling back to the other voice's
        // sample if this one somehow failed to decode -- a click in the wrong
        // colour beats a bar with a hole in it.
        function bufferForVoice(isAccent) {
          var id = isAccent ? "accent" : "beat";
          return buffers[id] || buffers[Object.keys(buffers)[0]] || null;
        }

        function scheduleNote(beatNumber, time) {
          var ctx = audioContext;
          var isPrimaryAccent = beatNumber === 0;
          var isSecondaryAccent =
            !isPrimaryAccent && accents.indexOf(beatNumber) !== -1;
          var isAccentVoice = isPrimaryAccent || isSecondaryAccent;
          // The accent voice plays the accent sample; every other beat plays
          // the beat sample.
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
            gainNode.gain.value = gain * masterVolume;
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
          var secondsPerBeat = 60.0 / (tempo * speedMultiplier);
          nextNoteTime += secondsPerBeat;
          currentBeatNumber = (currentBeatNumber + 1) % beatsPerMeasure;
        }

        function scheduler() {
          if (!isPlaying) return;
          while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
            // Apply a queued feel change right as the downbeat is scheduled, so
            // the new rate governs the bar that's about to start (never mid-bar).
            if (currentBeatNumber === 0 && pendingMultiplier !== null) {
              speedMultiplier = pendingMultiplier;
              pendingMultiplier = null;
            }
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

        function setVolumes(nextAccentVolume, nextBeatVolume, nextMasterVolume) {
          if (typeof nextAccentVolume === "number") {
            accentVolume = Math.max(0, Math.min(1, nextAccentVolume));
          }
          if (typeof nextBeatVolume === "number") {
            beatVolume = Math.max(0, Math.min(1, nextBeatVolume));
          }
          if (typeof nextMasterVolume === "number") {
            // Up to 2, not 1: the metronome's master is allowed past full scale
            // so the click can be heard over a band. Keep this in step with
            // METRONOME_MAX_VOLUME in context/PreferencesContext.tsx -- clamped
            // here as well so a hand-edited preferences file can't ask for a
            // gain that would tear.
            masterVolume = Math.max(0, Math.min(2, nextMasterVolume));
          }
        }

        function start(nextTempo, nextMultiplier, nextBeats, nextAccents, nextAccentVolume, nextBeatVolume, nextMasterVolume) {
          if (isPlaying) return;
          if (nextTempo) tempo = nextTempo;
          if (typeof nextMultiplier === "number") speedMultiplier = nextMultiplier;
          pendingMultiplier = null;
          if (nextBeats) beatsPerMeasure = nextBeats;
          if (nextAccents) setAccents(nextAccents);
          setVolumes(nextAccentVolume, nextBeatVolume, nextMasterVolume);
          var ctx = ensureContext();
          startKeepAlive(); // see silentModeKeepAlive.ts
          currentBeatNumber = 0;
          // Claim the transport before the resume below, so a stop() arriving
          // while the context is still waking is seen by beginPlayback and
          // cancels the start instead of being overrun by it.
          isPlaying = true;
          // A running context is the common case -- every press after the
          // first -- and starts on the very next audio block. A suspended one
          // has a frozen currentTime, so reading it now would put the first
          // click in the past, and Web Audio drops those silently. Resume
          // first, then take the clock.
          if (ctx.state === "running") {
            beginPlayback(ctx);
            return;
          }
          var resuming = ctx.resume();
          if (resuming && typeof resuming.then === "function") {
            resuming.then(
              function () {
                beginPlayback(ctx);
              },
              function () {
                beginPlayback(ctx);
              }
            );
          } else {
            beginPlayback(ctx);
          }
        }

        // Starts the scheduler against the live audio clock. MIN_SCHEDULE_LEAD
        // rather than a fixed cushion: the first click lands about 2ms out
        // instead of 50, which is the difference between the transport feeling
        // attached to your finger and feeling like it thought about it.
        function beginPlayback(ctx) {
          if (!isPlaying) return; // stopped while the context was resuming
          nextNoteTime = ctx.currentTime + MIN_SCHEDULE_LEAD;
          scheduler();
        }

        function stop() {
          isPlaying = false;
          stopKeepAlive();
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

        // Change the playback-feel multiplier. Mid-playback the change is
        // queued for the next downbeat (see scheduler); when stopped it applies
        // at once so the next start uses it.
        function setFeel(nextMultiplier) {
          if (typeof nextMultiplier !== "number") return;
          if (isPlaying) {
            pendingMultiplier = nextMultiplier;
          } else {
            speedMultiplier = nextMultiplier;
            pendingMultiplier = null;
          }
        }

        function setBeats(nextBeats, nextAccents) {
          beatsPerMeasure = nextBeats;
          setAccents(nextAccents);
          currentBeatNumber = 0;
        }

        // Bring the audio back when the app does.
        //
        // Android suspends a WebView AudioContext when the activity pauses,
        // and pulling the notification shade down is a pause. Suspending stops
        // the context clock, so everything scheduled against it stops with it
        // -- the audio simply cuts out.
        //
        // Nothing used to bring it back. Every resume in this file lives inside
        // ensureContext, which runs when a COMMAND arrives -- a load, a launch,
        // a tempo change. Coming back to the app is not a command, so the audio
        // stayed dead until the next thing the user pressed. A glance at a
        // notification killed the song.
        //
        // Suspension pauses rather than tears down: the sources are still
        // there and the clock picks up where it stopped, so this continues the
        // song rather than restarting it.
        function resumeAudio() {
          if (!audioContext) return;
          if (audioContext.state !== "suspended") return;
          var resumed = audioContext.resume();
          if (resumed && resumed.catch) {
            resumed.catch(function () {
              // Refused: the page is back but the OS has not handed the audio
              // session over yet. ensureContext tries again on the next
              // command, and the app re-sends this on the next foreground.
            });
          }
        }

        // Both, because neither is reliable alone. The page event is the fast
        // path and needs no bridge; the explicit command covers the case where
        // an offscreen WebView is never considered hidden in the first place,
        // and so never fires one.
        document.addEventListener("visibilitychange", function () {
          if (!document.hidden) resumeAudio();
        });

        function handleMessage(event) {
          var data;
          try {
            data = JSON.parse(event.data);
          } catch (e) {
            return;
          }
          switch (data.type) {
            case "start":
              start(data.bpm, data.multiplier, data.beats, data.accents, data.accentVolume, data.beatVolume, data.masterVolume);
              break;
            case "stop":
              stop();
              break;
            case "setFeel":
              setFeel(data.multiplier);
              break;
            case "setVolumes":
              setVolumes(data.accentVolume, data.beatVolume, data.masterVolume);
              break;
            case "setTempo":
              setTempo(data.bpm);
              break;
            case "setBeats":
              setBeats(data.beats, data.accents);
              break;
            // Liveness check. The app pings after returning to the foreground:
            // if this page's process was reclaimed while backgrounded there is
            // nobody left to answer, and the app rebuilds the engine.
            case "resume":
              resumeAudio();
              break;
            case "ping":
              post({ type: "pong" });
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
