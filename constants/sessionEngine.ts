// Session playback engine, running inside a hidden WebView (same pattern as
// constants/metronomeEngine.ts and constants/loopEngine.ts).
//
// This is the engine a setlist plays through, and it exists as a third engine
// rather than reusing the loop one for a reason that isn't about tidiness:
//
//   Sections are multi-track. Four stems of the same song have to start on the
//   same sample and stay locked, and the only way to get that is to schedule
//   every one of them against a single AudioContext clock. Two WebViews are two
//   AudioContexts and can never be sample-locked to each other, so the moment a
//   section is more than one file it has to live in one engine of its own.
//
// The other half of the job is WHEN a section starts. On stage you hit a pad
// somewhere in the middle of a bar and expect the change to land on the next
// downbeat, not under your finger -- so a trigger doesn't start audio, it arms
// a launch. A transport counts bars and beats off the audio clock whether or
// not anything is sounding, and armed launches are scheduled to the next
// boundary on that grid.
//
// Scheduling uses the same lookahead approach as the metronome: a timer wakes
// every ~25ms and schedules anything falling due inside the next 100ms against
// ctx.currentTime. JS timers are far too jittery to start audio on directly;
// they only ever decide what to hand the audio clock.

export const buildSessionEngineHtml = () => `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script id="engine">
      (function () {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        var audioContext = null;
        var master = null;

        // Decoded stems, by track id. Loading is separate from arranging: the
        // same track can appear in several sections, and decoding it per
        // section would waste both time and memory.
        var buffers = {};

        // Per-track output gain, kept between launches so a level set during
        // one section survives into the next.
        var trackGains = {};
        var trackLevels = {};

        // Sounding sources, by track id: { source, gain }.
        var playing = {};

        // --- Transport ------------------------------------------------------
        // The musical grid. startedAt is the audio-clock time beat 0 fell on, so
        // any later beat is arithmetic rather than a running count that could
        // drift.
        var tempo = 120;
        var beatsPerBar = 4;
        var transportRunning = false;
        var startedAt = 0;

        // A launch waiting for its boundary:
        // { sectionId, tracks, atBeat, scheduled }
        var armed = null;
        var currentSectionId = null;

        var schedulerTimer = null;
        var positionTimer = null;

        // Same lookahead constants the metronome uses, and for the same reason.
        var LOOKAHEAD_MS = 25;
        var SCHEDULE_AHEAD = 0.1;
        // Web Audio drops times already in the past, so a launch needs a little
        // headroom. Matches the other engines.
        var MIN_SCHEDULE_LEAD = 0.002;
        var POSITION_INTERVAL_MS = 60;

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
            master = audioContext.createGain();
            master.gain.value = 1;
            master.connect(audioContext.destination);
          }
          if (audioContext.state === "suspended") audioContext.resume();
          return audioContext;
        }

        function gainForTrack(id) {
          var ctx = ensureContext();
          if (!trackGains[id]) {
            var g = ctx.createGain();
            g.gain.value = trackLevels[id] === undefined ? 1 : trackLevels[id];
            g.connect(master);
            trackGains[id] = g;
          }
          return trackGains[id];
        }

        // --- Grid maths -----------------------------------------------------

        function secondsPerBeat() {
          return 60.0 / tempo;
        }

        /** Beats elapsed since the transport started, as a float. */
        function beatsElapsed(atTime) {
          if (!transportRunning) return 0;
          return (atTime - startedAt) / secondsPerBeat();
        }

        /** Audio-clock time a given beat number falls on. */
        function timeOfBeat(beat) {
          return startedAt + beat * secondsPerBeat();
        }

        // The next grid line at or after fromBeat, on a grid of "quantum"
        // beats. A quantum of 4 with beatsPerBar 4 is "next bar"; 1 is the next
        // beat; 2 in 4/4 is the next 1 or 3, which is the one a drummer
        // actually counts you back in on.
        //
        // No backticks in here, or anywhere else on this page: the whole engine
        // is inside a template literal and one would end it mid-file.
        function nextBoundary(fromBeat, quantum) {
          if (quantum <= 0) return fromBeat;
          var next = Math.ceil(fromBeat / quantum) * quantum;
          // Landing exactly on the line we're already past is no use; take the
          // following one so there is always time to schedule into.
          if (next - fromBeat < 0.001) next += quantum;
          return next;
        }

        // --- Playback -------------------------------------------------------

        function stopTrack(id, atTime) {
          var live = playing[id];
          if (!live) return;
          try {
            live.source.stop(atTime);
          } catch (e) {
            // Already stopped or never started.
          }
          delete playing[id];
        }

        function stopAll(atTime) {
          for (var id in playing) {
            if (Object.prototype.hasOwnProperty.call(playing, id)) {
              stopTrack(id, atTime);
            }
          }
        }

        // Starts every track of a section on ONE time value. This is the whole
        // point of the engine: one shared start means the stems are locked to
        // each other by construction, not by being started close together.
        function launch(section, atTime) {
          stopAll(atTime);

          for (var i = 0; i < section.tracks.length; i++) {
            var id = section.tracks[i];
            var buffer = buffers[id];
            if (!buffer) continue;

            var ctx = audioContext;
            var source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(gainForTrack(id));
            source.start(atTime);
            playing[id] = { source: source, gain: gainForTrack(id) };
          }

          currentSectionId = section.sectionId;
          post({ type: "launched", sectionId: section.sectionId });
        }

        function scheduler() {
          if (!transportRunning) return;
          var ctx = audioContext;

          if (armed && !armed.scheduled) {
            var at = timeOfBeat(armed.atBeat);
            if (at < ctx.currentTime + SCHEDULE_AHEAD) {
              // Never hand Web Audio a time it has already passed; if the
              // boundary slipped by while the JS thread was busy, take the
              // earliest time it will still honour.
              launch(armed, Math.max(at, ctx.currentTime + MIN_SCHEDULE_LEAD));
              armed = null;
            }
          }

          schedulerTimer = setTimeout(scheduler, LOOKAHEAD_MS);
        }

        function startPositionUpdates() {
          stopPositionUpdates();
          positionTimer = setInterval(function () {
            if (!transportRunning || !audioContext) return;
            var beats = beatsElapsed(audioContext.currentTime);
            var bar = Math.floor(beats / beatsPerBar);
            var beatInBar = beats - bar * beatsPerBar;
            post({
              type: "position",
              bar: bar,
              beat: Math.floor(beatInBar),
              // Fraction through the current beat, for anything that has to
              // move smoothly rather than tick.
              phase: beatInBar - Math.floor(beatInBar),
              armedForBeat: armed ? armed.atBeat : null,
            });
          }, POSITION_INTERVAL_MS);
        }

        function stopPositionUpdates() {
          if (positionTimer) {
            clearInterval(positionTimer);
            positionTimer = null;
          }
        }

        // --- Commands -------------------------------------------------------

        function startTransport() {
          var ctx = ensureContext();
          if (transportRunning) return;
          transportRunning = true;
          startedAt = ctx.currentTime + MIN_SCHEDULE_LEAD;
          scheduler();
          startPositionUpdates();
          post({ type: "transport", running: true });
        }

        function stopTransport() {
          transportRunning = false;
          if (schedulerTimer) {
            clearTimeout(schedulerTimer);
            schedulerTimer = null;
          }
          stopPositionUpdates();
          if (audioContext) stopAll(audioContext.currentTime);
          armed = null;
          currentSectionId = null;
          post({ type: "transport", running: false });
        }

        // Arm a section to launch on the next grid line. Replacing an armed
        // launch that hasn't fired is deliberate: on stage, hitting a second
        // pad before the first lands means you changed your mind, and the last
        // thing pressed is what should play.
        function armSection(sectionId, tracks, quantum) {
          var ctx = ensureContext();
          if (!transportRunning) startTransport();

          var fromBeat = beatsElapsed(ctx.currentTime);
          armed = {
            sectionId: sectionId,
            tracks: tracks || [],
            atBeat: nextBoundary(fromBeat, quantum || beatsPerBar),
            scheduled: false,
          };
          post({ type: "armed", sectionId: sectionId, atBeat: armed.atBeat });
        }

        // The emergency control: drop or bring back one track without touching
        // the rest of the section. Level is kept even while muted so unmuting
        // returns it to where it was.
        function setTrack(id, level, muted) {
          if (typeof level === "number") trackLevels[id] = level;
          var g = gainForTrack(id);
          var target = muted ? 0 : (trackLevels[id] === undefined ? 1 : trackLevels[id]);
          var ctx = ensureContext();
          // Ramped, not set: a hard gain change on sounding audio clicks.
          g.gain.cancelScheduledValues(ctx.currentTime);
          g.gain.setTargetAtTime(target, ctx.currentTime, 0.01);
        }

        // Free decoded audio. Decisive for stems in a way it never was for
        // loops: a loop is a couple of bars and the catalogue is preloaded
        // whole, but a song's worth of stems is tens of megabytes decoded, and
        // a setlist may hold twenty songs. Holding every one would run the
        // WebView out of memory long before the set ended, so a cue's stems are
        // loaded when it's cued and dropped when another one takes over.
        //
        // Anything still sounding is stopped first: releasing a buffer out from
        // under a live source is undefined behaviour, not a silence.
        function clearTracks(keepIds) {
          var keep = {};
          if (keepIds) {
            for (var k = 0; k < keepIds.length; k++) keep[keepIds[k]] = true;
          }

          var ctx = audioContext;
          for (var id in buffers) {
            if (!Object.prototype.hasOwnProperty.call(buffers, id)) continue;
            if (keep[id]) continue;

            if (playing[id] && ctx) stopTrack(id, ctx.currentTime);
            if (trackGains[id]) {
              try {
                trackGains[id].disconnect();
              } catch (e) {
                // Already disconnected.
              }
              delete trackGains[id];
            }
            delete buffers[id];
            delete trackLevels[id];
          }

          post({ type: "cleared" });
        }

        function loadTrack(id, base64) {
          var ctx = ensureContext();
          ctx.decodeAudioData(
            base64ToArrayBuffer(base64),
            function (buf) {
              buffers[id] = buf;
              post({ type: "loaded", id: id });
            },
            function () {
              post({ type: "error", code: "decode", id: id });
            }
          );
        }

        function handleMessage(event) {
          var data;
          try {
            data = JSON.parse(event.data);
          } catch (e) {
            return;
          }

          switch (data.type) {
            case "loadTrack":
              loadTrack(data.id, data.base64);
              break;
            case "clearTracks":
              clearTracks(data.keep);
              break;
            case "setTempo":
              // Changing tempo mid-transport would move every future grid line
              // out from under an armed launch, so the grid is re-anchored to
              // now: the beat we are on keeps its time, and the new tempo
              // applies from here.
              if (transportRunning && audioContext) {
                var beatNow = beatsElapsed(audioContext.currentTime);
                tempo = data.bpm || tempo;
                if (data.beatsPerBar) beatsPerBar = data.beatsPerBar;
                startedAt = audioContext.currentTime - beatNow * secondsPerBeat();
              } else {
                tempo = data.bpm || tempo;
                if (data.beatsPerBar) beatsPerBar = data.beatsPerBar;
              }
              break;
            case "startTransport":
              startTransport();
              break;
            case "stopTransport":
              stopTransport();
              break;
            case "arm":
              armSection(data.sectionId, data.tracks, data.quantum);
              break;
            case "setTrack":
              setTrack(data.id, data.level, data.muted);
              break;
            case "ping":
              post({ type: "pong" });
              break;
          }
        }

        document.addEventListener("message", handleMessage);
        window.addEventListener("message", handleMessage);

        ensureContext();
        post({ type: "ready" });
      })();
    </script>
  </body>
</html>`;
