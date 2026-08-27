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

        // What to do to the sources, and when, for a song played as its
        // sections are configured rather than straight through.
        //
        // PLAY used to hand the engine one flat span from the top of the song
        // to the end of the file, so every repeat count on every section did
        // nothing unless that section's own pad was the thing that started it.
        // This walks the arrangement instead.
        //
        // Nothing here stops or restarts a source. The stems are started once
        // and play continuously; a section that repeats is done by pointing the
        // SAME sources' loop window at it and taking the window away again
        // afterwards, which is why the seams are silent -- there is no seek to
        // hear. That also means the whole schedule can be computed up front,
        // from spans and counts alone, instead of watching the playhead and
        // reacting to it on a thread that has a beat to deliver.
        //
        // Each step carries the song position it corresponds to, so live can
        // be re-based as it fires. Without that the reported position is the
        // raw elapsed time, which runs ahead of the song the moment anything
        // has looped -- every readout on the screen would drift further out
        // with each repeat.
        //
        // Pure, and covered by tests: the timing is the whole of the risk here
        // and none of it is visible until it is wrong in front of a room.
        function planArrangement(sections, fromSeconds, atTime) {
          var plan = [];
          var cursorTime = atTime;
          var position = fromSeconds;

          for (var i = 0; i < sections.length; i++) {
            var s = sections[i];
            var start = s.startSeconds;
            var end = s.endSeconds;
            // A section with no length has no window to loop, and one already
            // behind the playhead is not going to be reached.
            if (!(end > start)) continue;
            if (end <= position) continue;

            // The first section can be entered partway through -- PLAY starts
            // at the top of the song, but a pad launch lands mid-section.
            var enterAt = position > start ? position : start;
            var firstSpan = end - enterAt;
            var span = end - start;
            var plays = typeof s.repeats === "number" ? s.repeats : 1;

            if (plays === 0) {
              // A vamp. Loop it and schedule nothing after, because nothing
              // after it is going to play until a pad is hit.
              plan.push({
                when: cursorTime + firstSpan / 2,
                position: enterAt + firstSpan / 2,
                looping: true,
                loopStart: start,
                loopEnd: end,
              });
              return plan;
            }

            if (plays >= 2) {
              // On, halfway through the first pass: after the previous
              // section's window was taken away, and well before this one's
              // end is reached.
              plan.push({
                when: cursorTime + firstSpan / 2,
                position: enterAt + firstSpan / 2,
                looping: true,
                loopStart: start,
                loopEnd: end,
              });
              // Off, halfway through the last pass, so the source runs on past
              // the boundary into whatever follows.
              plan.push({
                when: cursorTime + firstSpan + (plays - 1.5) * span,
                position: start + span / 2,
                looping: false,
                loopStart: start,
                loopEnd: end,
              });
              cursorTime += firstSpan + (plays - 1) * span;
            } else {
              // Played once: the audio already flows through it, so there is
              // nothing to schedule.
              cursorTime += firstSpan;
            }

            position = end;
          }

          return plan;
        }

        // One step of a planned arrangement, handed to a timer.
        //
        // Timed loosely on purpose: every step is aimed at the middle of a pass
        // rather than at its edge, so a JS timer that wakes a few tens of
        // milliseconds either side of its mark still lands inside the window it
        // was meant for. What it must NOT do is use its own wake time as the
        // truth -- live is re-based to the step's scheduled time, so the
        // reported position stays right however late the timer actually ran.
        function scheduleArrangementStep(step, sources, generation) {
          var delay = (step.when - audioContext.currentTime) * 1000;
          setTimeout(
            function () {
              // Another launch has replaced this one; these sources are either
              // already stopped or belong to somebody else's plan.
              if (generation !== launchGeneration) return;

              for (var i = 0; i < sources.length; i++) {
                if (step.looping) {
                  sources[i].loopStart = step.loopStart;
                  sources[i].loopEnd = step.loopEnd;
                }
                sources[i].loop = step.looping;
              }

              if (live) {
                live.at = step.when;
                live.offset = step.position;
                live.loopStart = step.loopStart;
                live.loopEnd = step.loopEnd;
                live.looping = step.looping;
              }
            },
            Math.max(0, delay)
          );
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

          // How many times through, and therefore which of three shapes this
          // launch has.
          //
          //   repeats absent  -- the old two-state behaviour, kept for the
          //                      timeline: loop unless told not to.
          //   repeats === 0   -- round and round until something else is hit.
          //   repeats === 1   -- play it once and carry on through the song.
          //   repeats >= 2    -- N times round, then carry on through the song.
          //
          // The last two are the same thing to Web Audio, which has no notion
          // of a repeat count: source.loop runs forever or not at all. So a
          // count is done by starting the source looping and switching loop off
          // partway through the final pass -- see the timer below.
          // A whole song played as configured, rather than one span. The
          // sources are set up exactly as for a single play-through -- the
          // arrangement is applied by retuning them afterwards, never by
          // starting them differently.
          var arrangement =
            section.arrangement && section.arrangement.length > 0
              ? section.arrangement
              : null;

          var hasCount = arrangement ? true : typeof section.repeats === "number";
          var repeats = arrangement ? 1 : hasCount ? section.repeats : null;
          var loopsForever = hasCount ? repeats === 0 : section.loop !== false;
          // Only ever true where a count was actually asked for; the timeline's
          // launches never take this path.
          var countsDown = hasCount && repeats >= 2;
          var looping = loopsForever || countsDown;

          var boundary = 0;
          var last = null;
          var loopingSources = [];

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
              loopingSources.push(source);
            } else if (hasCount) {
              // Played once and left running. No duration cap, because the
              // point of a count is that the song continues past the section
              // rather than stopping at its edge.
              source.loop = false;
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

          // Let a counted section out of its loop, so the song carries on.
          //
          // Web Audio can't be told "loop four times". What it can be told, at
          // any moment, is to stop looping -- and a source whose loop is
          // switched off mid-pass simply plays on past loopEnd into the rest of
          // the file, which is exactly the handover wanted. So the count is a
          // timer that flips the flag during the final pass.
          //
          // Aimed at the MIDDLE of that pass rather than at its edge. A timer
          // in this WebView is not sample-accurate and doesn't need to be:
          // anywhere inside the last time round does the same thing, so half a
          // pass of slack either way turns a timing problem into a non-problem.
          // Landing it late is the only real failure -- one pass late and the
          // section plays N+1 times -- and half a span of margin is orders of
          // magnitude more than the jitter.
          // Walk the song's sections, retuning the loop window as the playhead
          // crosses each boundary. Every step re-bases live as well as the
          // sources, so the position the screen draws stays the song's own
          // rather than raw elapsed time -- which runs ahead the moment
          // anything has repeated.
          if (arrangement) {
            // Close any section left open. A section's end is optional and the
            // last one usually has none -- it runs to wherever the song stops,
            // and this is the only place that knows where that is, because this
            // is where the decoded buffers live. The app cannot answer it: the
            // performance screen happens to have measured the stems, and no
            // other surface that fires a cue ever has.
            var closed = [];
            for (var a = 0; a < arrangement.length; a++) {
              var wanted = arrangement[a];
              var closeAt = wanted.endSeconds;
              if (!(closeAt > wanted.startSeconds)) closeAt = boundary;
              closed.push({
                startSeconds: wanted.startSeconds,
                endSeconds: closeAt,
                repeats: wanted.repeats,
              });
            }

            var steps = planArrangement(closed, offset, atTime);
            var arrangementSources = [];
            for (var p = 0; p < section.tracks.length; p++) {
              var held = playing[section.tracks[p]];
              if (held) arrangementSources.push(held.source);
            }

            for (var st = 0; st < steps.length; st++) {
              scheduleArrangementStep(
                steps[st],
                arrangementSources,
                generation
              );
            }
          }

          if (countsDown && loopingSources.length > 0) {
            var span = boundary - offset;
            if (span > 0) {
              var releaseAt = atTime + (repeats - 0.5) * span;
              var delayMs = (releaseAt - audioContext.currentTime) * 1000;
              setTimeout(
                function () {
                  // Another launch has been and gone; these sources are either
                  // already stopped or belong to nobody.
                  if (generation !== launchGeneration) return;
                  for (var s = 0; s < loopingSources.length; s++) {
                    loopingSources[s].loop = false;
                  }
                  // The reported position wraps on this flag, so leaving it set
                  // would keep the playhead folding back into the section long
                  // after the audio had moved past it -- every readout on the
                  // screen stuck in a bar the song has left.
                  if (live) live.looping = false;
                },
                Math.max(0, delayMs)
              );
            }
          }

          // Played straight, the transport stops when the audio runs out --
          // otherwise the counter keeps climbing over silence and the screen
          // insists the song is still going. One source carries this; they all
          // end on the same sample.
          //
          // Counted sections get it too: once the timer above releases the
          // loop they run to the end of the file like any straight play, so
          // they need the same tidy-up. A section looping forever never ends
          // and never fires this.
          if (!loopsForever && last) {
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
        function armSection(
          sectionId,
          tracks,
          quantum,
          offset,
          endSeconds,
          loop,
          repeats,
          arrangement
        ) {
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
            // Carried through unchanged, undefined included: launch() tells a
            // count that was asked for from one that was never mentioned, and
            // an arm that defaulted it would turn every timeline seek into a
            // counted section.
            repeats: repeats,
            // The whole song's shape, when PLAY sent one. Carried through an
            // arm the same way a count is: what launches has to be what was
            // asked for a bar ago, not what the screen looks like now.
            arrangement: arrangement,
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
                data.loop,
                data.repeats,
                data.arrangement
              );
              break;
            case "setTrack":
              setTrack(data.id, data.level, data.muted, data.pan);
              break;
            case "resume":
              resumeAudio();
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
