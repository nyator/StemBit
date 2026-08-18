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
//
// The third job is the mix. Each track keeps a gain, a panner and an analyser
// that outlive any one launch, so a level set during the verse is still set in
// the chorus, and the mixer's meters have something to read. Alongside them the
// engine reports where we are IN THE SONG rather than only how long the
// transport has run -- the two stop agreeing the instant a section seeks into
// the middle of the files, and a timeline can only draw the first one.

// The fourth job is reading a tempo off the stems. A song imported here has no
// declared tempo the way a catalog loop does, and everything on the grid --
// where a launch lands, when a section changes -- is measured in beats from it.
// The detector runs on the buffers this engine has already decoded, rather than
// on a second copy in a second engine: the moment after an import is when a
// whole multitrack song is in memory, and it is the worst possible moment to
// hold another one.
import { BPM_ANALYZER_SOURCE } from "./vendor/bpmAnalyzerSource";
import { TEMPO_DETECT_SOURCE } from "./tempoDetect";

export const buildSessionEngineHtml = () => `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script>
      // realtime-bpm-analyzer's CommonJS bundle, verbatim. It has no external
      // requires, so a module/exports pair is all it needs to load anywhere.
      // Must run before the engine, which looks for window.bpmAnalyzer.
      (function () {
        var module = { exports: {} };
        var exports = module.exports;
        ${BPM_ANALYZER_SOURCE}
        window.bpmAnalyzer = module.exports;
      })();
    </script>
    <script id="engine">
      (function () {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        var audioContext = null;
        var master = null;

        // Decoded stems, by track id. Loading is separate from arranging: the
        // same track can appear in several sections, and decoding it per
        // section would waste both time and memory.
        var buffers = {};

        // Per-track signal chain, kept between launches so a level set during
        // one section survives into the next:
        //
        //   source -> gain -> panner -> master
        //               \
        //                -> analyser        (a tap, for the mixer's meters)
        //
        // The analyser hangs off the gain rather than the panner: a meter should
        // show what the channel is contributing, and reading it after the pan
        // would make a hard-left track look silent on a mono read of channel 0.
        var trackGains = {};
        var trackPanners = {};
        var trackAnalysers = {};
        var trackLevels = {};
        var trackPans = {};
        var trackMutes = {};

        // Sounding sources, by track id: { source, gain }.
        var playing = {};

        // What is currently sounding, in the song's own time:
        // { at, offset, loopStart, loopEnd, looping }.
        //
        // Needed because a section launch seeks every track into the middle of
        // the files, so "how long the transport has been running" and "where we
        // are in the song" stop being the same number the moment anyone hits a
        // section pad. The timeline draws the second one.
        var live = null;

        // Bumped on every launch and on stop, so a source's onended can tell
        // "the song ran out" from "something else took over and stopped me".
        var launchGeneration = 0;

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

        // --- Click ----------------------------------------------------------
        // Decoded click samples by id, and the grid that fires them. Off until
        // the app says otherwise: a song is not a rehearsal aid by default.
        var clickBuffers = {};
        var clickEnabled = false;
        var clickPan = 0; // -1 left .. 0 centre .. +1 right
        var clickAccentId = null;
        var clickBeatId = null;
        var clickAccentVol = 1.0;
        var clickBeatVol = 0.8;
        var clickTimer = null;
        var clickNextTime = 0;
        // Bar-relative, so the accent decision and the beat are one number.
        var clickBeatIndex = 0;
        var clickSources = [];

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

        // The head of a track's chain -- what a source connects to. Building the
        // whole chain here rather than at each launch means a level, a pan and a
        // mute all survive a section change, which is the behaviour you want:
        // the mix is a property of the song, not of the section playing.
        function gainForTrack(id) {
          var ctx = ensureContext();
          if (!trackGains[id]) {
            var g = ctx.createGain();
            g.gain.value = trackLevels[id] === undefined ? 1 : trackLevels[id];

            // StereoPannerNode is missing on some older WebViews. Panning is
            // worth having and worth doing without -- the chain just skips it.
            var tail = g;
            if (ctx.createStereoPanner) {
              var p = ctx.createStereoPanner();
              p.pan.value = trackPans[id] === undefined ? 0 : trackPans[id];
              g.connect(p);
              trackPanners[id] = p;
              tail = p;
            }
            tail.connect(master);

            var a = ctx.createAnalyser();
            // Small window: the meter wants the level over the last few
            // milliseconds, not a spectrum. Smoothing is the analyser's own, so
            // the needle settles without the app having to filter it.
            a.fftSize = 256;
            a.smoothingTimeConstant = 0.5;
            g.connect(a);
            trackAnalysers[id] = a;

            trackGains[id] = g;
          }
          return trackGains[id];
        }

        // Post-fader RMS per sounding track, for the mixer's meters. Only
        // tracks that are actually playing: a meter on a stopped track should
        // read nothing rather than hold its last value.
        var meterWindow = null;
        function meterLevels() {
          var levels = {};
          for (var id in playing) {
            if (!Object.prototype.hasOwnProperty.call(playing, id)) continue;
            var a = trackAnalysers[id];
            if (!a || !a.getFloatTimeDomainData) continue;

            if (!meterWindow || meterWindow.length !== a.fftSize) {
              meterWindow = new Float32Array(a.fftSize);
            }
            a.getFloatTimeDomainData(meterWindow);

            var sum = 0;
            for (var i = 0; i < meterWindow.length; i++) {
              sum += meterWindow[i] * meterWindow[i];
            }
            levels[id] = Math.sqrt(sum / meterWindow.length);
          }
          return levels;
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

        // Where we are IN THE SONG, in seconds, or null when nothing is
        // sounding. Distinct from the transport, which counts from wherever it
        // was started: launch a chorus 90 seconds in and the transport says bar
        // 1 while the audio is at 1:30. The timeline needs the second number,
        // and so does the bar counter above it, or the two disagree on screen.
        function songSeconds(atTime) {
          if (!live) return null;

          var position = live.offset + (atTime - live.at);
          // Scheduled but not yet reached: the launch is a moment in the future,
          // so the playhead sits where it is about to start rather than before it.
          if (position < live.offset) return live.offset;

          if (live.looping) {
            var span = live.loopEnd - live.loopStart;
            if (span > 0 && position >= live.loopEnd) {
              position =
                live.loopStart + ((position - live.loopStart) % span);
            }
          }
          return position;
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
          // Bumped before anything is stopped, so the sources torn down by the
          // stopAll below see a stale generation in their onended and stay
          // quiet about it.
          launchGeneration += 1;
          var generation = launchGeneration;
          stopAll(atTime);

          // Where in the stems this section begins, and how far it runs. A
          // section is a span of the same files rather than a file of its own,
          // so launching one is an offset into every track at once -- which is
          // also why they stay locked to each other across a jump.
          var offset = section.offset || 0;
          var end = section.endSeconds || 0;
          // Looping is the section pads' behaviour -- hold on a chorus and it
          // repeats. The timeline asks for it off, because playing from a point
          // and having the song silently jump backwards is not what a playhead
          // dragged onto bar 40 promises.
          var looping = section.loop !== false;

          var boundary = 0;
          var last = null;

          for (var i = 0; i < section.tracks.length; i++) {
            var id = section.tracks[i];
            var buffer = buffers[id];
            if (!buffer) continue;

            var ctx = audioContext;
            var source = ctx.createBufferSource();
            source.buffer = buffer;
            boundary = end > offset ? end : buffer.duration;

            if (looping) {
              source.loop = true;
              // Looping inside the section, so holding on a chorus repeats the
              // chorus rather than running on into whatever follows it. Without
              // an end the section runs to the end of the file.
              source.loopStart = offset;
              source.loopEnd = boundary;
              source.connect(gainForTrack(id));
              source.start(atTime, offset);
            } else {
              source.loop = false;
              source.connect(gainForTrack(id));
              // Given a duration rather than left to run: a section played
              // straight has to stop where the next one starts, not run on
              // through it to the end of the file.
              source.start(atTime, offset, Math.max(0, boundary - offset));
            }

            playing[id] = { source: source, gain: gainForTrack(id) };
            last = source;
          }

          live = {
            at: atTime,
            offset: offset,
            loopStart: offset,
            loopEnd: boundary,
            looping: looping,
          };

          // Played straight, the transport stops when the audio runs out --
          // otherwise the counter keeps climbing over silence and the screen
          // insists the song is still going. One source carries this; they all
          // end on the same sample.
          if (!looping && last) {
            last.onended = function () {
              if (generation !== launchGeneration) return;
              post({ type: "ended", sectionId: section.sectionId });
              stopTransport();
            };
          }

          currentSectionId = section.sectionId;
          // The click re-locks to the song, not to the transport. A section
          // launch seeks every stem to a new offset, so the beat the music is
          // on changes under the grid -- a click left counting from where the
          // transport started would be right up until the first pad press and
          // wrong after it.
          startClickGrid(atTime);
          post({ type: "launched", sectionId: section.sectionId });
        }

        // --- Click ------------------------------------------------------------
        // A metronome over the stems, on the same AudioContext as the audio it
        // is counting, so it cannot drift from it. Same subsystem the loop
        // engine carries, and the same shape: one bar-relative beat index feeds
        // the accent decision, the grid is seeded from the music's own position
        // rather than free-running, and it is re-seeded whenever that position
        // is moved out from under it.
        function loadClickSound(id, base64) {
          if (!id || clickBuffers[id]) return;
          var ctx = ensureContext();
          ctx.decodeAudioData(
            base64ToArrayBuffer(base64),
            function (buf) {
              clickBuffers[id] = buf;
            },
            function () {
              post({ type: "error", message: "click decode failed: " + id });
            }
          );
        }

        // Hard left / centre / hard right. An unconnected merger input is
        // digital silence, which a panner's curve only approaches -- see the
        // long note on the same function in constants/loopEngine.ts.
        function connectClickOutput(node, ctx) {
          if (Math.abs(clickPan) >= 0.99 && ctx.createChannelMerger) {
            var merger = ctx.createChannelMerger(2);
            node.connect(merger, 0, clickPan < 0 ? 0 : 1);
            merger.connect(ctx.destination);
            return;
          }
          if (ctx.createStereoPanner) {
            var panner = ctx.createStereoPanner();
            panner.pan.value = clickPan;
            node.connect(panner);
            panner.connect(ctx.destination);
            return;
          }
          node.connect(ctx.destination);
        }

        // Straight to the destination, not through master: the performance
        // screen's MUTE pulls master down to drop the band, and the one thing
        // you still want in your ears at that moment is the count.
        function scheduleClick(beatIndex, time) {
          var ctx = audioContext;
          var isAccent = beatIndex === 0;
          var buffer = clickBuffers[isAccent ? clickAccentId : clickBeatId];
          if (!buffer) return;
          var source = ctx.createBufferSource();
          source.buffer = buffer;
          var gain = ctx.createGain();
          gain.gain.value = isAccent ? clickAccentVol : clickBeatVol;
          source.connect(gain);
          connectClickOutput(gain, ctx);
          source.start(time);
          clickSources.push(source);
          source.onended = function () {
            var idx = clickSources.indexOf(source);
            if (idx !== -1) clickSources.splice(idx, 1);
          };
        }

        /** Beats into the SONG at a moment -- what the click counts. */
        function songBeatAt(atTime) {
          var seconds = songSeconds(atTime);
          if (seconds === null) return beatsElapsed(atTime);
          return seconds / secondsPerBeat();
        }

        function seedClickGrid(atTime) {
          var spb = secondsPerBeat();
          if (spb <= 0) return;
          var bpb = beatsPerBar > 0 ? beatsPerBar : 4;
          var beatFloat = songBeatAt(atTime);
          var nextBeat = Math.ceil(beatFloat - 1e-6);
          clickBeatIndex = ((nextBeat % bpb) + bpb) % bpb;
          clickNextTime = atTime + (nextBeat - beatFloat) * spb;
        }

        function clickScheduler() {
          if (!transportRunning || !clickEnabled) return;
          var spb = secondsPerBeat();
          if (spb <= 0) return;
          var bpb = beatsPerBar > 0 ? beatsPerBar : 4;
          while (clickNextTime < audioContext.currentTime + SCHEDULE_AHEAD) {
            scheduleClick(clickBeatIndex, clickNextTime);
            clickBeatIndex = (clickBeatIndex + 1) % bpb;
            clickNextTime += spb;
          }
          clickTimer = setTimeout(clickScheduler, LOOKAHEAD_MS);
        }

        function stopClickSources() {
          for (var i = 0; i < clickSources.length; i++) {
            try {
              clickSources[i].stop();
            } catch (e) {
              // Already stopped, or scheduled in the future (cancels it).
            }
          }
          clickSources = [];
        }

        function stopClickGrid() {
          if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
          }
          stopClickSources();
        }

        function startClickGrid(atTime) {
          stopClickGrid();
          if (!transportRunning || !clickEnabled) return;
          seedClickGrid(
            atTime == null ? audioContext.currentTime : atTime
          );
          clickScheduler();
        }

        ${TEMPO_DETECT_SOURCE}

        // Read the tempo off a stem this engine already holds.
        //
        // The whole track, not a region: a song has no trim, and the detector is
        // happier with more audio than less. One stem is enough -- they are the
        // same performance, and a bass part carries the pulse as well as a full
        // mix does.
        function detectTrackTempo(id) {
          var buffer = buffers[id];
          if (!buffer) {
            post({ type: "tempo", id: id, tempo: null });
            return;
          }
          detectTempo(buffer, 0, buffer.duration, function (tempo) {
            post({ type: "tempo", id: id, tempo: tempo });
          });
        }

        function setClick(cfg) {
          if (typeof cfg.pan === "number") {
            clickPan = Math.max(-1, Math.min(1, cfg.pan));
          }
          if (typeof cfg.accentId === "string") clickAccentId = cfg.accentId;
          if (typeof cfg.beatId === "string") clickBeatId = cfg.beatId;
          // Up to 2: these arrive multiplied by the metronome's master, which is
          // allowed past full scale so a click can be heard over a band. See
          // METRONOME_MAX_VOLUME in context/PreferencesContext.tsx.
          if (typeof cfg.accentVolume === "number") {
            clickAccentVol = Math.max(0, Math.min(2, cfg.accentVolume));
          }
          if (typeof cfg.beatVolume === "number") {
            clickBeatVol = Math.max(0, Math.min(2, cfg.beatVolume));
          }

          var wasEnabled = clickEnabled;
          if (typeof cfg.enabled === "boolean") clickEnabled = cfg.enabled;
          if (!transportRunning) return;
          if (clickEnabled && !wasEnabled) {
            // Joins in from wherever the song currently is, on the next beat.
            startClickGrid(null);
          } else if (!clickEnabled && wasEnabled) {
            stopClickGrid();
          }
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
            var now = audioContext.currentTime;

            // Bars are counted off the song where there is one, so the counter
            // and the timeline's ruler are reading the same clock. With nothing
            // sounding there is no song position, and the transport's own count
            // is the only thing left to show.
            var seconds = songSeconds(now);
            var beats =
              seconds === null ? beatsElapsed(now) : seconds / secondsPerBeat();
            var bar = Math.floor(beats / beatsPerBar);
            var beatInBar = beats - bar * beatsPerBar;

            post({
              type: "position",
              bar: bar,
              beat: Math.floor(beatInBar),
              // Fraction through the current beat, for anything that has to
              // move smoothly rather than tick.
              phase: beatInBar - Math.floor(beatInBar),
              seconds: seconds,
              // Piggybacked rather than sent on a timer of their own: the
              // bridge is the expensive part, and one message a tick carrying
              // both costs the same as one carrying the position alone.
              levels: meterLevels(),
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
          stopClickGrid();
          stopPositionUpdates();
          // Bumped before the sources are stopped so a straight-played section
          // being cut short doesn't come back through onended and stop a
          // transport that is already stopping.
          launchGeneration += 1;
          if (audioContext) stopAll(audioContext.currentTime);
          live = null;
          armed = null;
          currentSectionId = null;
          post({ type: "transport", running: false });
        }

        // Arm a section to launch on the next grid line. Replacing an armed
        // launch that hasn't fired is deliberate: on stage, hitting a second
        // pad before the first lands means you changed your mind, and the last
        // thing pressed is what should play.
        function armSection(sectionId, tracks, quantum, offset, endSeconds, loop) {
          var ctx = ensureContext();
          if (!transportRunning) startTransport();

          var fromBeat = beatsElapsed(ctx.currentTime);
          // A quantum of 0 means now -- used for the first launch of a song,
          // where waiting a bar for silence to end would just be a delay, and
          // for a seek from the timeline, where the point of dragging the
          // playhead is to hear that spot rather than the next downbeat.
          var q = quantum === 0 ? 0 : (quantum || beatsPerBar);
          armed = {
            sectionId: sectionId,
            tracks: tracks || [],
            offset: offset || 0,
            endSeconds: endSeconds || 0,
            loop: loop !== false,
            atBeat: nextBoundary(fromBeat, q),
            scheduled: false,
          };
          post({ type: "armed", sectionId: sectionId, atBeat: armed.atBeat });
        }

        // The emergency control: drop or bring back one track without touching
        // the rest of the section. Level is kept even while muted so unmuting
        // returns it to where it was.
        // Each field is optional and sticky: sending only a pan moves the pan
        // and leaves the level and the mute where they were. Without that, a
        // finger on the pan control would silently unmute a muted stem, which
        // is the sort of thing you find out about from the front of house.
        function setTrack(id, level, muted, pan) {
          if (typeof level === "number") trackLevels[id] = level;
          if (typeof muted === "boolean") trackMutes[id] = muted;

          var g = gainForTrack(id);
          var target = trackMutes[id]
            ? 0
            : (trackLevels[id] === undefined ? 1 : trackLevels[id]);
          var ctx = ensureContext();
          // Ramped, not set: a hard gain change on sounding audio clicks.
          g.gain.cancelScheduledValues(ctx.currentTime);
          g.gain.setTargetAtTime(target, ctx.currentTime, 0.01);

          if (typeof pan === "number") {
            trackPans[id] = pan;
            var p = trackPanners[id];
            if (p) {
              // Ramped for the same reason, and a touch slower: a pan swept by
              // a finger sounds like a move rather than a jump.
              p.pan.cancelScheduledValues(ctx.currentTime);
              p.pan.setTargetAtTime(pan, ctx.currentTime, 0.02);
            }
          }
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
            // The whole chain, not just the gain: a panner and an analyser left
            // connected to the master are a leak that a set's worth of songs
            // would accumulate one stem at a time.
            var chain = [trackGains[id], trackPanners[id], trackAnalysers[id]];
            for (var n = 0; n < chain.length; n++) {
              if (!chain[n]) continue;
              try {
                chain[n].disconnect();
              } catch (e) {
                // Already disconnected.
              }
            }
            delete trackGains[id];
            delete trackPanners[id];
            delete trackAnalysers[id];
            delete buffers[id];
            delete trackLevels[id];
            delete trackPans[id];
            delete trackMutes[id];
          }

          post({ type: "cleared" });
        }

        // A track's shape, for drawing. One value per bucket, each the loudest
        // sample in it, so transients survive being reduced to a few hundred
        // points -- averaging would flatten exactly the drum hits that tell you
        // where you are in a song.
        //
        // Sampled rather than exhaustive: a five-minute stem is thirteen
        // million frames and reading every one would lock the page for seconds.
        // A few hundred per bucket is more than enough to find its peak.
        function peaksFor(id, buckets) {
          var buffer = buffers[id];
          if (!buffer) return null;

          var count = buckets || 400;
          var data = buffer.getChannelData(0);
          var perBucket = Math.max(1, Math.floor(data.length / count));
          var step = Math.max(1, Math.floor(perBucket / 256));
          var peaks = [];

          for (var b = 0; b < count; b++) {
            var start = b * perBucket;
            var end = Math.min(data.length, start + perBucket);
            var max = 0;
            for (var i = start; i < end; i += step) {
              var value = data[i];
              if (value < 0) value = -value;
              if (value > max) max = value;
            }
            peaks.push(max);
          }

          return { peaks: peaks, duration: buffer.duration };
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
            case "getPeaks":
              var shape = peaksFor(data.id, data.buckets);
              if (shape) {
                post({
                  type: "peaks",
                  id: data.id,
                  peaks: shape.peaks,
                  duration: shape.duration,
                });
              }
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
                // The click's spacing comes from the tempo, so its grid has to
                // be rebuilt at the new one rather than carrying on at the old.
                startClickGrid(null);
              } else {
                tempo = data.bpm || tempo;
                if (data.beatsPerBar) beatsPerBar = data.beatsPerBar;
              }
              break;
            case "loadClick":
              loadClickSound(data.id, data.base64);
              break;
            case "detectTempo":
              detectTrackTempo(data.id);
              break;
            case "setClick":
              setClick(data);
              break;
            case "startTransport":
              startTransport();
              break;
            case "stopTransport":
              stopTransport();
              break;
            case "arm":
              armSection(
                data.sectionId,
                data.tracks,
                data.quantum,
                data.offset,
                data.endSeconds,
                data.loop
              );
              break;
            case "setTrack":
              setTrack(data.id, data.level, data.muted, data.pan);
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
