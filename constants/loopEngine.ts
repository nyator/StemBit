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
// BPM warping is TIME-STRETCHED, not varispeed: changing the tempo must not
// change the pitch. Web Audio has no built-in time-stretch (playbackRate is
// tape-style varispeed), so the engine includes a WSOLA stretcher
// (waveform-similarity overlap-add — the same family of algorithm SoundTouch
// and DAW "warp" modes use). On a rate change the loop region is re-rendered
// offline into a stretched buffer (fast: a few ms of CPU per second of
// audio) and playback crossfades to it at the matching musical position.
// The source node itself always plays at rate 1.
//
// TEMPO DETECTION, for loops the user imports, is realtime-bpm-analyzer, injected
// as source into the page below. It has to run here rather than in React Native
// because it needs Web Audio -- it renders a biquad lowpass through an
// OfflineAudioContext -- and only this page has that. See
// constants/vendor/bpmAnalyzerSource.ts for how it gets here.
import { SILENT_MODE_KEEP_ALIVE_SOURCE } from "./silentModeKeepAlive";
import { BPM_ANALYZER_SOURCE } from "./vendor/bpmAnalyzerSource";
import { TEMPO_DETECT_SOURCE } from "./tempoDetect";

export const buildLoopEngineHtml = () => `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script>
      // realtime-bpm-analyzer's CommonJS bundle, verbatim. It has no external
      // requires, so a module/exports pair is all it needs to load anywhere.
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

        // Active loop (what play/stop act on): decoded buffer + loop points.
        var active = null; // { key, buffer, loopStart, loopEnd }
        var currentRate = 1;
        // Cached stretched render of the active loop region for currentRate.
        var stretched = null; // { rate, buffer }
        // Currently sounding source. startedAt/startedOffset let us compute
        // the musical phase so a rate change resumes in the same spot.
        var playing = null; // { source, gain, loopStart, loopEnd, startedAt, startedOffset }
        var selectToken = 0;
        var rateTimer = null;
        // Playhead reporting, off unless asked for. The import screen wants it to
        // draw where playback has reached on the waveform; the Loop tab has
        // nothing to draw it on, and this posts several messages a second.
        var positionTimer = null;
        var positionUpdates = false;

        // Master output gain for the loop's BACKING TRACK (Settings -> Loop
        // Volume). Created lazily and kept between plays. The click does NOT
        // route through this — it follows the metronome volume instead.
        var loopVolume = 1.0;
        var loopMaster = null;

        // --- Loop click state ---------------------------------------------
        // An optional metronome click layered over the loop (see the "Loop
        // click" section below). clickBuffers holds decoded click samples
        // keyed by sound id; the rest is live config pushed from the app plus
        // the lookahead scheduler's cursor.
        var clickBuffers = {};
        var clickEnabled = false;
        // Subdivision, as a multiplier on how often the click sounds: 0.5 is
        // half time, 1 every beat, 2 eighths.
        //
        // It moves the CLICK only. The playback rate, the beat grid, the dots
        // and the accent are all untouched, because the loop's tempo is what
        // the BPM dial is for and a second control that also changed it would
        // just be the dial again. See the note on beatScheduler.
        var clickFeel = 1;
        var clickPan = 0; // -1 left .. 0 center .. +1 right
        var clickAccentId = null;
        var clickBeatId = null;
        var clickAccentVol = 1.0;
        var clickBeatVol = 0.8;
        var clickSources = [];
        // The beat grid, shared by the click and the dots. It runs whenever the
        // loop plays, whether or not the click is switched on.
        //
        // gridBeatIndex is BAR-relative -- 0 .. beatsPerBar-1 -- because it is
        // the one number both the click and the screen are given. The metronome
        // engine keeps its beat the same way and for the same reason.
        var beatTimer = null;
        var gridNextTime = 0;
        var gridBeatIndex = 0;
        // One pending "a beat is landing now" timeout per scheduled beat, so
        // they can be cancelled when the loop stops.
        var beatTimers = [];

        // Catalog caches. Loops are preloaded (and decoded) up front so
        // selecting one is just a pointer swap — no decode wait at play
        // time. decodedByKey: key -> { buffer, loopStart, loopEnd }.
        var encodedByKey = {};
        var decodedByKey = {};
        // key -> [{ onDone, onError }] for decodes currently in flight, so
        // a select landing mid-decode waits for the result instead of
        // failing with "no data".
        var pendingDecodes = {};

        // Samples quieter than this (on any channel) count as silence when
        // trimming encoder padding. ~ -46 dBFS.
        var SILENCE_THRESHOLD = 0.005;
        // Shortest region that counts as a loop. An explicit trim shorter than
        // this is treated as a mistake rather than looped -- below a couple of
        // stretch frames there is nothing musical left to warp.
        var MIN_LOOP_SECONDS = 0.05;
        // Waveform resolution for "analyze", and how many samples each of its
        // buckets inspects (a bucket is ~1px wide; it does not need all of a
        // long file's frames to draw right).
        var PEAK_BUCKETS = 480;
        var PEAK_SAMPLES_PER_BUCKET = 256;
        // The ANALYSIS_* constants that used to sit here moved with the detector
        // into constants/tempoDetect.ts, which is embedded below.
        // Only snap to the beat grid if the trimmed length is within this
        // fraction of a whole number of beats; otherwise trust the trim.
        var BEAT_SNAP_TOLERANCE = 0.1;
        // Rates closer to 1x than this play the original, unstretched audio.
        var UNITY_RATE_EPSILON = 0.001;
        // Crossfade used when swapping sources on a rate change.
        var SWAP_FADE_SECONDS = 0.03;
        // Smallest lead that still schedules reliably on the audio clock. Web
        // Audio silently drops times already in the past, so a start needs some
        // headroom -- but only a couple of milliseconds of it. Matches the
        // metronome engine, so both transports answer with the same immediacy.
        var MIN_SCHEDULE_LEAD = 0.002;
        // Rate changes are debounced this long so dragging the BPM control
        // doesn't re-render on every step.
        var RATE_DEBOUNCE_MS = 120;
        // Loop click scheduler cadence (same lookahead approach the metronome
        // engine uses): wake every ~25ms, schedule clicks up to 100ms ahead.
        var CLICK_LOOKAHEAD_MS = 25;
        var CLICK_SCHEDULE_AHEAD = 0.1;
        // How often the playhead is reported while it's wanted. ~16 a second:
        // smooth enough to read as movement, and far cheaper than a message per
        // frame across the bridge.
        var POSITION_INTERVAL_MS = 60;
        // |pan| at or above this counts as "hard left/right" and gets routed
        // to that channel outright rather than through the panner. See
        // connectClickOutput.
        var HARD_PAN_THRESHOLD = 0.999;
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
            // Ask for stereo explicitly rather than trusting the default:
            // some WebView builds hand back a destination narrower than the
            // hardware supports, and anything landing on a mono destination
            // gets down-mixed -- which would fold the panned click (below)
            // back into both ears.
            try {
              if (audioContext.destination.maxChannelCount >= 2) {
                audioContext.destination.channelCount = 2;
                audioContext.destination.channelCountMode = "explicit";
              }
            } catch (e) {
              // Read-only in this implementation; the default stands.
            }
          }
          if (audioContext.state === "suspended") {
            audioContext.resume();
          }
          return audioContext;
        }

        // Lazily-created master gain the backing loop routes through, so its
        // level can be set independently of the click.
        function getLoopMaster() {
          var ctx = ensureContext();
          if (!loopMaster) {
            loopMaster = ctx.createGain();
            loopMaster.gain.value = loopVolume;
            loopMaster.connect(ctx.destination);
          }
          return loopMaster;
        }

        function setLoopVolume(v) {
          if (typeof v !== "number") return;
          loopVolume = Math.max(0, Math.min(1, v));
          if (loopMaster) {
            // Short ramp so a mid-playback change doesn't click.
            loopMaster.gain.setTargetAtTime(
              loopVolume,
              audioContext.currentTime,
              0.02
            );
          }
        }

        function isAudible(channels, frameIndex) {
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
          while (firstFrame < totalFrames && !isAudible(channels, firstFrame)) {
            firstFrame++;
          }

          var lastFrame = totalFrames - 1;
          while (lastFrame > firstFrame && !isAudible(channels, lastFrame)) {
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

        // --- Transient-aware time-stretch ---------------------------------
        // Stretch channels (Float32Arrays) by 1/rate without changing pitch.
        //
        // Plain WSOLA doubles or drops drum hits (flams) and its hard
        // crossfades can thump. So, like a DAW's "Beats" warp mode:
        //   1. detect transients (high-frequency energy rising above the
        //      local floor — pads and chords don't trigger it),
        //   2. copy each attack VERBATIM at its exact grid position (a
        //      transient is never stretched, duplicated, or dropped),
        //   3. time-stretch only the sustained audio between attacks, using
        //      correlation-aligned frames overlap-added with triangular
        //      50%-overlap windows (weights always sum to exactly 1, so the
        //      envelope mathematically cannot bump or click),
        //   4. anchor each region's final frame to its end, so segment
        //      joins are sample-continuous and the loop's wrap point lands
        //      exactly on the original (musically continuous) seam.
        function stretchLoop(channels, sr, rate) {
          var inLen = channels[0].length;
          var outLen = Math.max(1, Math.round(inLen / rate));
          var nCh = channels.length;
          var c;
          var i;

          var outs = [];
          for (c = 0; c < nCh; c++) outs.push(new Float32Array(outLen));

          // Mono mix for analysis only (offsets are applied to all channels
          // identically, keeping the stereo image intact).
          var mono = channels[0];
          if (nCh > 1) {
            mono = new Float32Array(inLen);
            for (i = 0; i < inLen; i++) {
              var sum = 0;
              for (c = 0; c < nCh; c++) sum += channels[c][i];
              mono[i] = sum / nCh;
            }
          }

          function detectOnsets() {
            var hop = Math.round(sr * 0.005);
            var nHops = Math.floor(inLen / hop);
            if (nHops < 4) return [0];

            // Two envelopes: full-band, and first-difference (crude
            // highpass) which emphasizes transients over sustained pads.
            var envF = new Float64Array(nHops);
            var envH = new Float64Array(nHops);
            for (var hI = 0; hI < nHops; hI++) {
              var s = hI * hop;
              var ef = 0;
              var eh = 0;
              for (var k = s; k < s + hop; k++) {
                var v = mono[k];
                var d = k > 0 ? mono[k] - mono[k - 1] : 0;
                ef += v * v;
                eh += d * d;
              }
              envF[hI] = Math.sqrt(ef / hop);
              envH[hI] = Math.sqrt(eh / hop);
            }
            var peakF = 0;
            var peakH = 0;
            for (var j = 0; j < nHops; j++) {
              if (envF[j] > peakF) peakF = envF[j];
              if (envH[j] > peakH) peakH = envH[j];
            }
            if (peakF === 0) return [0];

            var onsets = [0];
            var refractoryHops = 10; // 50ms between onsets
            var FLOOR_HOPS = 10; // 50ms local floor
            var lastHop = -refractoryHops;
            for (var h = FLOOR_HOPS; h < nHops; h++) {
              var floorF = 0;
              var floorH = 0;
              for (var f2 = h - FLOOR_HOPS; f2 < h - 1; f2++) {
                floorF += envF[f2];
                floorH += envH[f2];
              }
              floorF /= FLOOR_HOPS - 1;
              floorH /= FLOOR_HOPS - 1;
              var hitF = envF[h] > floorF * 1.8 + 0.02 * peakF;
              var hitH = envH[h] > floorH * 1.8 + 0.02 * peakH;
              if ((hitF || hitH) && h - lastHop >= refractoryHops) {
                var sample = Math.max(0, (h - 1) * hop);
                if (sample > Math.round(sr * 0.01)) onsets.push(sample);
                lastHop = h;
              }
            }
            return onsets.slice(0, 64);
          }

          // Stretch input [inStart, inEnd) into output [outStart,
          // outStart + outSegLen) using correlation-aligned triangular OLA.
          function stretchSegment(inStart, inEnd, outStart, outSegLen) {
            var inSegLen = inEnd - inStart;
            if (inSegLen <= 0 || outSegLen <= 0) return;

            var frame = 2 * Math.round(sr * 0.02); // 40ms, kept even
            var hop = frame / 2; // 50% overlap: triangles sum to 1
            var seek = Math.round(sr * 0.01);
            var corrWin = Math.round(sr * 0.01);
            var localRate = inSegLen / outSegLen;

            if (inSegLen <= frame + seek || outSegLen <= frame) {
              // Segment too short to stretch: nearest-sample resample (short
              // enough that the pitch deviation is inaudible).
              for (var cc = 0; cc < nCh; cc++) {
                for (var ii = 0; ii < outSegLen; ii++) {
                  var srcIdx = Math.min(inSegLen - 1, Math.round(ii * localRate));
                  outs[cc][outStart + ii] = channels[cc][inStart + srcIdx];
                }
              }
              return;
            }

            var maxIn = inSegLen - frame;

            function similarity(refStart, candStart) {
              var sab = 0;
              var saa = 0;
              var sbb = 0;
              for (var k = 0; k < corrWin; k += 2) {
                var a = mono[inStart + refStart + k];
                var b = mono[inStart + candStart + k];
                sab += a * b;
                saa += a * a;
                sbb += b * b;
              }
              if (saa === 0 || sbb === 0) return 0;
              return sab / Math.sqrt(saa * sbb);
            }

            var prevChosen = 0;
            var outPos = 0;
            var first = true;
            while (outPos < outSegLen) {
              var isFinal = outPos + frame >= outSegLen;
              var writeLen = Math.min(frame, outSegLen - outPos);
              var best;
              if (first) {
                best = 0;
              } else if (isFinal) {
                // End exactly at the segment end: the join to the next
                // (verbatim) attack — or the loop's wrap — is continuous.
                best = Math.max(0, inSegLen - writeLen);
              } else {
                var ideal = Math.round(outPos * localRate);
                if (ideal > maxIn) ideal = maxIn;
                var refStart = Math.min(prevChosen + hop, maxIn);
                best = ideal;
                var bestScore = -2;
                var lo = Math.max(0, ideal - seek);
                var hi = Math.min(maxIn, ideal + seek);
                for (var cand = lo; cand <= hi; cand += 2) {
                  var score = similarity(refStart, cand);
                  if (score > bestScore) {
                    bestScore = score;
                    best = cand;
                  }
                }
              }

              for (var c3 = 0; c3 < nCh; c3++) {
                var inCh = channels[c3];
                var outCh = outs[c3];
                for (var i3 = 0; i3 < writeLen; i3++) {
                  var w;
                  if (i3 < hop) {
                    w = first ? 1 : i3 / hop; // rising half
                  } else {
                    w = isFinal ? 1 : (frame - i3) / hop; // falling half
                  }
                  outCh[outStart + outPos + i3] += inCh[inStart + best + i3] * w;
                }
              }

              prevChosen = best;
              first = false;
              if (isFinal) break;
              outPos += hop;
            }
          }

          var onsets = detectOnsets();
          var attack = Math.round(sr * 0.03); // verbatim attack length

          for (var g = 0; g < onsets.length; g++) {
            var inStart = onsets[g];
            var inEnd = g + 1 < onsets.length ? onsets[g + 1] : inLen;
            var outStart = Math.round(inStart / rate);
            var outEnd = g + 1 < onsets.length ? Math.round(inEnd / rate) : outLen;
            var outSegLen = outEnd - outStart;
            if (outSegLen <= 0) continue;

            var copyLen = Math.min(attack, inEnd - inStart, outSegLen);
            for (c = 0; c < nCh; c++) {
              for (i = 0; i < copyLen; i++) {
                outs[c][outStart + i] = channels[c][inStart + i];
              }
            }

            if (outSegLen > copyLen) {
              stretchSegment(
                inStart + copyLen,
                inEnd,
                outStart + copyLen,
                outSegLen - copyLen
              );
            }
          }

          return outs;
        }
        // --- end time-stretch ---------------------------------------------

        // Render one loop region stretched to a rate. The rendered buffer holds
        // ONLY the region, so it loops over its full length.
        //
        // Takes the region explicitly rather than reading the active loop,
        // because the
        // quantised swap has to render the INCOMING loop while the outgoing one
        // is still playing and still the active one. This blocks the JS thread
        // for tens of milliseconds, which is exactly why it happens when a cue
        // is armed rather than on the downbeat it lands on.
        function renderStretch(src, loopStart, loopEnd, rate) {
          var sr = src.sampleRate;
          var startFrame = Math.round(loopStart * sr);
          var endFrame = Math.min(Math.round(loopEnd * sr), src.length);

          var channels = [];
          for (var c = 0; c < src.numberOfChannels; c++) {
            channels.push(src.getChannelData(c).subarray(startFrame, endFrame));
          }

          var outs = stretchLoop(channels, sr, rate);
          var ctx = ensureContext();
          var out = ctx.createBuffer(outs.length, outs[0].length, sr);
          for (var c2 = 0; c2 < outs.length; c2++) {
            out.getChannelData(c2).set(outs[c2]);
          }
          return out;
        }

        // The active loop's render at a rate, cached so a repeated rate change
        // doesn't re-render what it already has.
        function getStretchedBuffer(rate) {
          if (!active) return null;
          if (stretched && Math.abs(stretched.rate - rate) < 0.0005) {
            return stretched.buffer;
          }
          var out = renderStretch(
            active.buffer,
            active.loopStart,
            active.loopEnd,
            rate
          );
          stretched = { rate: rate, buffer: out };
          return out;
        }

        function decodeKey(key, nativeBpm, onDone, onError) {
          if (decodedByKey[key]) {
            onDone(decodedByKey[key]);
            return;
          }

          // A decode for this key is already running (e.g. the startup
          // preload): wait for its result instead of failing.
          if (pendingDecodes[key]) {
            pendingDecodes[key].push({ onDone: onDone, onError: onError });
            return;
          }

          var bytes = encodedByKey[key];
          if (!bytes) {
            onError("missing-data", "no data for loop: " + key);
            return;
          }
          // decodeAudioData detaches the buffer, so drop the encoded copy —
          // the decoded result is cached instead.
          delete encodedByKey[key];
          pendingDecodes[key] = [{ onDone: onDone, onError: onError }];

          function flush(entry, errorCode, errorMessage) {
            var waiters = pendingDecodes[key] || [];
            delete pendingDecodes[key];
            for (var i = 0; i < waiters.length; i++) {
              if (entry) {
                waiters[i].onDone(entry);
              } else {
                waiters[i].onError(errorCode, errorMessage);
              }
            }
          }

          var ctx = ensureContext();
          ctx.decodeAudioData(
            bytes,
            function (decoded) {
              var points = computeLoopPoints(decoded, nativeBpm);
              decodedByKey[key] = {
                buffer: decoded,
                loopStart: points.start,
                loopEnd: points.end,
                nativeBpm: nativeBpm,
              };
              flush(decodedByKey[key]);
            },
            function () {
              flush(null, "decode-failed", "decode failed for loop: " + key);
            }
          );
        }

        // Store (and eagerly decode) a loop so a later select is instant.
        function preload(key, base64, nativeBpm) {
          if (decodedByKey[key] || pendingDecodes[key]) {
            post({ type: "preloaded", key: key });
            return;
          }
          encodedByKey[key] = base64ToArrayBuffer(base64);
          decodeKey(
            key,
            nativeBpm,
            function () {
              post({ type: "preloaded", key: key });
            },
            function (code, message) {
              post({ type: "error", code: code, key: key, message: message });
            }
          );
        }

        // Which region of the buffer to loop: the trim the app sent, or the one
        // found at decode time. An explicit trim is a user edit (imported loops
        // are trimmed by hand, since an arbitrary file has no reason to start
        // on the beat) so it wins -- but only if it really describes a region
        // inside this buffer. A nonsense trim falls back to the automatic
        // points rather than leaving the engine looping a sliver of silence.
        function resolveRegion(entry, trimStart, trimEnd) {
          var limit = entry.buffer.duration;
          if (typeof trimStart === "number" && typeof trimEnd === "number") {
            var start = Math.max(0, Math.min(limit, trimStart));
            var end = Math.max(0, Math.min(limit, trimEnd));
            if (end - start >= MIN_LOOP_SECONDS) {
              return { start: start, end: end };
            }
          }
          return { start: entry.loopStart, end: entry.loopEnd };
        }

        ${TEMPO_DETECT_SOURCE}

        // Re-read the tempo of one region of an already-decoded file. The import
        // screen calls this on the trim the user has settled on.
        function detect(key, start, end) {
          var entry = decodedByKey[key];
          if (!entry) {
            post({ type: "detected", key: key, tempo: null });
            return;
          }
          detectTempo(entry.buffer, start, end, function (tempo) {
            post({ type: "detected", key: key, tempo: tempo });
          });
        }

        function applyActive(key, entry, nativeBpm, beatsPerBar, trimStart, trimEnd) {
          var region = resolveRegion(entry, trimStart, trimEnd);
          // The tempo the app declared on THIS select, not the one cached with
          // the decode. The two differ whenever a loop was decoded by an
          // "analyze" (no declared tempo yet -- the import screen is still
          // finding out what it is) and selected later at the tempo the user
          // settled on.
          var bpm = nativeBpm > 0 ? nativeBpm : entry.nativeBpm;
          // How many whole beats the loop region spans, at its native tempo.
          // The region is a whole number of beats -- either snapped there by
          // computeLoopPoints or trimmed there on the import screen -- so this
          // is an integer; it's the click's beat count per loop pass.
          var loopBeats = 0;
          if (bpm > 0) {
            loopBeats = Math.round(((region.end - region.start) * bpm) / 60);
          }
          // Beats per bar from the loop's time signature. The click accents
          // every bar downbeat (beatIndex % beatsPerBar === 0), so a long
          // multi-bar loop still accents each bar, not just its first beat.
          var bpb = beatsPerBar > 0 ? beatsPerBar : (loopBeats || 1);
          active = {
            key: key,
            buffer: entry.buffer,
            loopStart: region.start,
            loopEnd: region.end,
            nativeBpm: bpm,
            loopBeats: loopBeats,
            beatsPerBar: bpb,
          };
          stretched = null; // renders belong to the previous loop
          post({
            type: "loaded",
            key: key,
            duration: entry.buffer.duration,
            loopStart: region.start,
            loopEnd: region.end,
          });
        }

        // Make a loop the active one. Instant when preloaded; falls back to
        // decoding inline (from provided base64) when it isn't. trimStart /
        // trimEnd are optional and override the automatic loop points -- the
        // import screen re-selects through here on every trim edit, which is
        // cheap because the decode is already cached.
        function select(key, nativeBpm, base64, beatsPerBar, trimStart, trimEnd) {
          selectToken += 1;
          var token = selectToken;
          stop();
          active = null;
          stretched = null;

          var cached = decodedByKey[key];
          if (cached) {
            applyActive(key, cached, nativeBpm, beatsPerBar, trimStart, trimEnd);
            return;
          }

          if (base64 && !encodedByKey[key] && !pendingDecodes[key]) {
            encodedByKey[key] = base64ToArrayBuffer(base64);
          }

          decodeKey(
            key,
            nativeBpm,
            function (entry) {
              if (token !== selectToken) return; // superseded
              applyActive(key, entry, nativeBpm, beatsPerBar, trimStart, trimEnd);
            },
            function (code, message) {
              if (token !== selectToken) return;
              post({ type: "error", code: code, key: key, message: message });
            }
          );
        }

        // --- Analysis (the import screen) ---------------------------------
        // Down-sample the whole buffer to one peak value per bucket, 0..1, for
        // the waveform the user trims against. A bucket is about a pixel wide,
        // so it inspects a sample of its frames rather than all of them -- a
        // five-minute file holds 13 million and the picture is the same.
        // Optionally over a frame range only, which is what the import screen's
        // zoom asks for: the same number of buckets across one second instead of
        // the whole file turns 60ms per bucket into 2ms, which is the difference
        // between seeing that there's a drum hit and seeing where it starts.
        function analyzePeaks(buffer, buckets, fromFrame, toFrame) {
          var first = fromFrame == null ? 0 : Math.max(0, Math.floor(fromFrame));
          var last =
            toFrame == null
              ? buffer.length
              : Math.min(buffer.length, Math.ceil(toFrame));
          var frames = last - first;
          if (frames <= 0) return [];

          var count = Math.max(1, Math.min(buckets || PEAK_BUCKETS, frames));
          var per = frames / count;
          var stride = Math.max(1, Math.floor(per / PEAK_SAMPLES_PER_BUCKET));

          var channels = [];
          for (var c = 0; c < buffer.numberOfChannels; c++) {
            channels.push(buffer.getChannelData(c));
          }

          var peaks = [];
          for (var b = 0; b < count; b++) {
            var from = first + Math.floor(b * per);
            var to = Math.min(last, first + Math.floor((b + 1) * per));
            var peak = 0;
            for (var ch = 0; ch < channels.length; ch++) {
              var data = channels[ch];
              for (var i = from; i < to; i += stride) {
                var v = data[i] < 0 ? -data[i] : data[i];
                if (v > peak) peak = v;
              }
            }
            // Three decimals: the waveform is drawn a few dozen pixels tall,
            // and this keeps the message that crosses the bridge small.
            peaks.push(Math.round(peak * 1000) / 1000);
          }
          return peaks;
        }

        // Peaks for one window of an already-decoded file, for the zoomed trim
        // view. Cheap: the buffer is already in hand, so this is a scan, no
        // decode and nothing crossing the bridge but the numbers.
        function sendRegionPeaks(key, start, end, buckets) {
          var entry = decodedByKey[key];
          var sampleRate = entry ? entry.buffer.sampleRate : 0;
          post({
            type: "regionPeaks",
            key: key,
            start: start,
            end: end,
            peaks: entry
              ? analyzePeaks(
                  entry.buffer,
                  buckets,
                  start * sampleRate,
                  end * sampleRate
                )
              : [],
          });
        }

        // Decode a file the user picked and report what the import screen needs
        // to draw it: its length, a waveform, and the audible region to offer
        // as an opening trim. Decoding under the same key the loop will be
        // selected with means the preview that follows costs nothing.
        function analyze(key, base64, buckets) {
          if (
            base64 &&
            !decodedByKey[key] &&
            !encodedByKey[key] &&
            !pendingDecodes[key]
          ) {
            encodedByKey[key] = base64ToArrayBuffer(base64);
          }

          // nativeBpm 0: there is no declared tempo yet -- finding it is what
          // the screen is for -- so the decode's own points are the raw audible
          // region with no beat snap, which is what we want to suggest.
          decodeKey(
            key,
            0,
            function (entry) {
              // The waveform and the region are ready now; the tempo takes a
              // moment longer (the detector renders a filter pass through an
              // OfflineAudioContext). Both go in one message so the screen lays
              // itself out once, with everything agreeing.
              //
              // Over the audible region rather than the whole file: silence at
              // either end carries no beat and only dilutes the reading.
              detectTempo(
                entry.buffer,
                entry.loopStart,
                entry.loopEnd,
                function (tempo) {
                  post({
                    type: "analyzed",
                    key: key,
                    duration: entry.buffer.duration,
                    audibleStart: entry.loopStart,
                    audibleEnd: entry.loopEnd,
                    peaks: analyzePeaks(entry.buffer, buckets),
                    tempo: tempo,
                  });
                }
              );
            },
            function (code, message) {
              post({ type: "error", code: code, key: key, message: message });
            }
          );
        }

        // Start a source at the given phase (0..1) through the loop, at the
        // exact audio-clock time atTime (or ~now if omitted). Always plays
        // at rate 1: tempo lives in the stretched buffer. IMPORTANT: any
        // stretch render must happen BEFORE computing atTime/phase — the
        // render blocks the JS thread, and scheduling after it with a stale
        // phase makes the loop audibly jump.
        function startSource(phase, fadeSeconds, atTime) {
          if (!active) return null;
          return startSourceFrom(
            {
              buffer: active.buffer,
              loopStart: active.loopStart,
              loopEnd: active.loopEnd,
              // Rendered on demand and cached; in the swap path it is already
              // in hand, which is what keeps the swap off the JS thread.
              stretch:
                Math.abs(currentRate - 1) > UNITY_RATE_EPSILON
                  ? getStretchedBuffer(currentRate)
                  : null,
            },
            phase,
            fadeSeconds,
            atTime
          );
        }

        // Start a source from an explicit loop rather than from the active one.
        //
        // target is { buffer, loopStart, loopEnd, stretch } -- stretch being a
        // pre-rendered warp of the region, or null to play the region as it is.
        // Splitting this out is what lets a queued cue be started at an exact
        // time without having been made active first: the swap needs the new
        // audio scheduled BEFORE the old one is told to stop, and both have to
        // land on the same sample.
        function startSourceFrom(target, phase, fadeSeconds, atTime) {
          var ctx = ensureContext();

          var buf;
          var ls;
          var le;
          if (target.stretch) {
            buf = target.stretch;
            ls = 0;
            le = buf.duration;
          } else {
            buf = target.buffer;
            ls = target.loopStart;
            le = target.loopEnd;
          }
          if (!buf) return null;

          var loopLength = le - ls;
          var offset = ls + phase * loopLength;

          var gain = ctx.createGain();
          var source = ctx.createBufferSource();
          source.buffer = buf;
          source.loop = true;
          source.loopStart = ls;
          source.loopEnd = le;
          source.connect(gain);
          gain.connect(getLoopMaster());

          // A caller with its own schedule (the loop swap) passes atTime. The
          // fallback is the user pressing play, so it wants the smallest lead
          // Web Audio will reliably accept -- 30ms of cushion here was audible
          // as the transport lagging the finger.
          var startAt = atTime || ctx.currentTime + MIN_SCHEDULE_LEAD;
          if (fadeSeconds > 0) {
            gain.gain.setValueAtTime(0, startAt);
            gain.gain.linearRampToValueAtTime(1, startAt + fadeSeconds);
          } else {
            gain.gain.setValueAtTime(1, startAt);
          }
          source.start(startAt, offset);

          playing = {
            source: source,
            gain: gain,
            loopStart: ls,
            loopEnd: le,
            startedAt: startAt,
            startedOffset: offset,
          };
          return playing;
        }

        // Phase (0..1) the given playback will be at, at time atTime.
        function phaseAt(p, atTime) {
          var loopLength = p.loopEnd - p.loopStart;
          if (loopLength <= 0) return 0;
          var elapsed = Math.max(0, atTime - p.startedAt);
          var pos = (p.startedOffset - p.loopStart + elapsed) % loopLength;
          return pos / loopLength;
        }

        // Where the playhead is, as a fraction through the loop region. Sent on a
        // timer rather than computed by the app: the position comes off the audio
        // hardware clock, which is the only clock that knows what is actually
        // being heard.
        //
        // Deliberately NOT where the beat comes from. This is a 60ms sampler --
        // it says where the loop is when it happens to look, which is up to a
        // frame late and by a different amount each time. Beats are announced by
        // the grid that schedules them (see emitBeat), at the moment they sound.
        function startPositionUpdates() {
          stopPositionUpdates();
          if (!positionUpdates) return;
          positionTimer = setInterval(function () {
            if (!playing || !audioContext) return;
            post({
              type: "position",
              phase: phaseAt(playing, audioContext.currentTime),
            });
          }, POSITION_INTERVAL_MS);
        }

        function stopPositionUpdates(silent) {
          if (positionTimer) {
            clearInterval(positionTimer);
            positionTimer = null;
          }
          // One last message with nothing in it, so the playhead is taken off the
          // waveform rather than left frozen wherever it stopped.
          if (!silent && positionUpdates) post({ type: "position", phase: null });
        }

        function stopSource(p, fadeSeconds, atTime) {
          var ctx = audioContext;
          if (!ctx) return;
          var from = atTime || ctx.currentTime;
          try {
            if (fadeSeconds > 0) {
              p.gain.gain.setValueAtTime(1, from);
              p.gain.gain.linearRampToValueAtTime(0, from + fadeSeconds);
              p.source.stop(from + fadeSeconds + 0.01);
            } else {
              p.source.stop();
            }
          } catch (e) {
            // already stopped
          }
        }

        // --- The beat grid (and the click layered on it) ------------------
        // One cursor walks the loop's beats: it schedules the click when the
        // click is on, and announces every beat to the app either way. Both
        // come off this engine's AudioContext, so they are on the exact same
        // hardware clock as the loop and cannot drift from it. Rather than
        // free-running, the grid is derived from the loop's own phase
        // on every tick, so it re-locks continuously and cannot walk away.
        // The accent falls on each bar's downbeat (every beatsPerBar beats),
        // so a long multi-bar loop accents every bar, not just its first beat.
        //
        // The announcement exists because the screen's dots used to keep their
        // own time. Every version of that drifts -- a JS interval at the tempo
        // obviously, but so does sampling the playhead every 60ms, because it
        // reports where the loop is when it happens to look rather than when a
        // beat lands. The only number that can't drift from the click is the
        // one the click is scheduled from.

        // Real seconds between the loop's own beats at the current warp
        // (= 60 / userBpm). The music's beat, unaffected by the subdivision --
        // bar lines are measured in these.
        function musicalBeatSeconds() {
          if (!active || !active.nativeBpm) return 0;
          return 60 / (active.nativeBpm * currentRate);
        }

        // Real seconds between grid ticks: the click's interval, and the rate
        // the dots move at.
        //
        // The grid ticks at the subdivision, and barBeats() ticks of it make an
        // accent cycle -- exactly what the metronome does, where double time
        // doubles the click rate and still accents every fourth click. So 2x on
        // a 4/4 loop gives a b b b a b b b, not one accent stranded in eight.
        function beatSeconds() {
          var musical = musicalBeatSeconds();
          return musical > 0 ? musical / clickFeel : 0;
        }

        // Put the grid on the loop's next beat boundary as of atTime, with the
        // bar counted from the loop's own start. Called on play and on every
        // rate change, so the click and the dots line up with the music rather
        // than with whenever the grid happened to be started.
        function seedBeatGrid(atTime) {
          if (!playing || !active || active.loopBeats < 1) return;
          var beatSec = beatSeconds();
          if (beatSec <= 0) return;
          // In GRID ticks, not musical beats: at 2x there are two of them per
          // beat, and the grid has to be seeded in the units it advances in or
          // the first tick lands in the wrong place.
          var beatFloat = phaseAt(playing, atTime) * active.loopBeats * clickFeel;
          var nextBeat = Math.ceil(beatFloat - 1e-6);
          var bpb = barBeats();
          gridBeatIndex = ((nextBeat % bpb) + bpb) % bpb;
          gridNextTime = atTime + (nextBeat - beatFloat) * beatSec;
        }

        // Tell the app a beat is landing, at the moment it lands.
        //
        // A timeout per beat, measured from the audio clock at the instant the
        // beat was scheduled -- exactly what the metronome engine does for its
        // own beat indicator. The timeout can fire late, as JS timers always
        // can, but the next one is measured from the audio clock again, so
        // lateness is a few milliseconds of visual latency and never builds up.
        //
        // beatIndex arrives bar-relative and is passed through untouched. No
        // arithmetic here, because this is the number the click was scheduled
        // with, and doing anything to it is how the two came apart.
        function emitBeat(beatIndex, time) {
          if (!audioContext) return;
          var timer = setTimeout(
            function () {
              var idx = beatTimers.indexOf(timer);
              if (idx !== -1) beatTimers.splice(idx, 1);
              post({ type: "beat", beat: beatIndex, accent: beatIndex === 0 });
            },
            Math.max(0, (time - audioContext.currentTime) * 1000)
          );
          beatTimers.push(timer);
        }

        // Route a click's gain node to the destination at the current pan.
        //
        // The three positions the app exposes are hard left / center / hard
        // right, and at the hard positions "panned" should mean *silent* on
        // the other side. Rather than trust a StereoPannerNode's equal-power
        // curve to reach exactly zero at the endpoints, feed one input of a
        // ChannelMergerNode and leave the other unconnected: an unconnected
        // merger input is digital silence, not a very small number.
        //
        // Level-matched to the panner it replaces: the spec's curve at
        // |pan| = 1 is gain 1.0 into the live channel and 0.0 into the other,
        // which is exactly what the merger does, so switching between
        // positions doesn't change how loud the click is. (Merger inputs are
        // mono; every click sample in assets/audio/clicks is mono, so nothing
        // is down-mixed on the way through.)
        //
        // Intermediate pan values still go through the panner -- nothing
        // sends them today, but a continuous pan control would keep working.
        //
        // Note for anyone chasing a "pan bleeds" report: this is as isolated
        // as the graph can be, and it ends at the destination. Spatial-audio
        // modes on headphones (CMF/Nothing, AirPods, Galaxy Buds) re-render
        // hard-panned sources binaurally, which puts them back in both ears
        // downstream of everything here. Rule that out first.
        function connectClickOutput(node, ctx) {
          if (Math.abs(clickPan) >= HARD_PAN_THRESHOLD && ctx.createChannelMerger) {
            var merger = ctx.createChannelMerger(2);
            node.connect(merger, 0, clickPan < 0 ? 0 : 1);
            merger.connect(ctx.destination);
            return;
          }
          // Degrade gracefully to a centred click if an older WebView lacks
          // StereoPannerNode.
          if (ctx.createStereoPanner) {
            var panner = ctx.createStereoPanner();
            panner.pan.value = clickPan;
            node.connect(panner);
            panner.connect(ctx.destination);
            return;
          }
          node.connect(ctx.destination);
        }

        function scheduleClick(beatIndex, time) {
          var ctx = audioContext;
          // beatIndex is already bar-relative, so the downbeat is beat 0 -- the
          // accent on a multi-bar loop lands once per bar rather than once per
          // loop. Read straight, with no arithmetic of its own: the screen is
          // handed this same number, and any sum done here and not there is a
          // way for the accent and the lit dot to disagree.
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

        // How many beats are in a bar -- the number the dots are counting, and
        // the number the accent falls on the first of.
        function barBeats() {
          if (!active) return 4;
          if (active.beatsPerBar > 0) return active.beatsPerBar;
          return active.loopBeats > 0 ? active.loopBeats : 4;
        }

        function advanceGrid(beatSec) {
          gridNextTime += beatSec;
          gridBeatIndex = (gridBeatIndex + 1) % barBeats();
        }

        // Runs whenever the loop does, not only when the click is audible: the
        // dots move with or without a click, and they have to move on the same
        // grid either way. Whether a beat is also heard is one line of it.
        //
        // Modelled on the metronome's scheduler (constants/metronomeEngine.ts),
        // deliberately, and the two properties that matter are the ones this
        // kept getting wrong:
        //
        //   1. ONE number describes the beat, and both the sound and the screen
        //      are handed it. gridBeatIndex is already bar-relative, so the
        //      click's accent and the lit dot cannot disagree about which beat
        //      this is -- that is what made the accent land on a different
        //      circle, and it is now unrepresentable rather than merely fixed.
        //
        //   2. The counter only ever advances, once per beat scheduled. An
        //      earlier version re-derived it from the loop's phase on every
        //      tick to stop the cursor accumulating error, and bought a worse
        //      bug: the same beat re-derived a fraction of a millisecond later
        //      slipped past the "already scheduled" guard and went out twice,
        //      with a freshly computed index attached.
        function beatScheduler() {
          if (!playing || !active) return;
          var beatSec = beatSeconds();
          if (beatSec <= 0) return;
          while (gridNextTime < audioContext.currentTime + CLICK_SCHEDULE_AHEAD) {
            emitBeat(gridBeatIndex, gridNextTime);
            if (clickEnabled) scheduleClick(gridBeatIndex, gridNextTime);
            advanceGrid(beatSec);
          }

          // A queued cue whose boundary is now close enough to schedule. Done
          // here rather than on a timer of its own because this is already the
          // thing that wakes up in time to hand the audio clock what happens
          // next -- and runQueuedSwap restarts the grid, so it must be the last
          // word in this pass.
          if (
            pendingSwap &&
            pendingSwap.at < audioContext.currentTime + CLICK_SCHEDULE_AHEAD
          ) {
            runQueuedSwap();
            return;
          }

          beatTimer = setTimeout(beatScheduler, CLICK_LOOKAHEAD_MS);
        }

        // Silence pending clicks without touching the grid -- for turning the
        // click off mid-loop, where the beats must carry on being announced.
        function stopClickSources() {
          for (var i = 0; i < clickSources.length; i++) {
            try {
              clickSources[i].stop();
            } catch (e) {
              // already stopped, or scheduled in the future (cancels it)
            }
          }
          clickSources = [];
        }

        function stopBeatGrid() {
          if (beatTimer) {
            clearTimeout(beatTimer);
            beatTimer = null;
          }
          // Beats already queued for a moment that is no longer coming: without
          // this, stopping leaves a dot lighting up on a silent loop.
          for (var t = 0; t < beatTimers.length; t++) clearTimeout(beatTimers[t]);
          beatTimers = [];
          stopClickSources();
        }

        // (Re)start the grid from the loop's position at atTime. Cancels
        // anything pending first so a rate change can't double it up.
        function startBeatGrid(atTime) {
          stopBeatGrid();
          if (!playing || !active) return;
          seedBeatGrid(atTime == null ? audioContext.currentTime : atTime);
          beatScheduler();
        }

        // Swap sources at the same musical position with a short crossfade.
        // Order matters: render the stretched buffer FIRST (it blocks the JS
        // thread for tens of ms), and only then pick the swap time and
        // compute the phase — otherwise the new source starts at a position
        // that's already in the past and the loop audibly stumbles.
        function applyRateChange() {
          if (!playing || !active) return;
          var ctx = ensureContext();

          if (Math.abs(currentRate - 1) > UNITY_RATE_EPSILON) {
            if (!getStretchedBuffer(currentRate)) return;
          }

          var old = playing;
          var swapTime = ctx.currentTime + 0.03;
          var phase = phaseAt(old, swapTime);
          var next = startSource(phase, SWAP_FADE_SECONDS, swapTime);
          if (!next) return;
          stopSource(old, SWAP_FADE_SECONDS, swapTime);
          // Re-lock the grid to the loop at its new warp, so the click and the
          // dots both follow the tempo change instead of carrying on at the old
          // spacing.
          startBeatGrid(swapTime);
        }

        // --- Quantised cue swap -------------------------------------------
        // Firing a cue over a running loop should land on the next downbeat, and
        // land on it exactly. The app can say WHEN cheaply enough -- it gets a
        // message per beat -- but it cannot start audio on time: everything
        // between the message and the call is JS, and JS is the one clock this
        // engine exists to avoid. So the whole swap is handed over as an intent
        // and executed here, against the audio clock.
        //
        // Two halves, deliberately far apart in time:
        //
        //   queueLoopSwap  runs when the cue is pressed. It decodes if it must
        //                  and renders the warp, which blocks for tens of ms --
        //                  fine, there is most of a bar to do it in.
        //   runQueuedSwap  runs on the boundary. It only schedules: the new
        //                  source starts at exactly T and the old one is faded
        //                  out at exactly T, both already prepared.
        var pendingSwap = null;

        /** The audio-clock time of the next bar line, or null if there isn't one.
         *
         * Worked out from the loop's own position rather than from the click
         * grid, because the two stopped being the same thing when the
         * subdivision arrived: at 2x the grid accents twice a bar, and reading
         * the next accent off it would swap cues half a bar early. A bar line
         * is a fact about the music, so it is measured in the music's beats.
         */
        function nextDownbeatTime() {
          if (!playing || !active || active.loopBeats < 1) return null;
          var spb = musicalBeatSeconds();
          if (spb <= 0) return null;
          var bpb = barBeats();

          var now = audioContext.currentTime;
          // Where the loop stands, in its own beats.
          var beatFloat = phaseAt(playing, now) * active.loopBeats;
          // The next whole bar at or after that.
          var nextBar = Math.ceil(beatFloat / bpb - 1e-6) * bpb;
          var at = now + (nextBar - beatFloat) * spb;

          // Never a boundary that has already gone by while this was being
          // worked out; take the following bar instead.
          var floor = now + MIN_SCHEDULE_LEAD;
          while (at < floor) at += bpb * spb;
          return at;
        }

        function queueLoopSwap(key, nativeBpm, beatsPerBar, trimStart, trimEnd, rate) {
          var entry = decodedByKey[key];
          // Nothing decoded and nothing playing to wait for: not a swap at all.
          // The app falls back to selecting and playing outright.
          if (!entry || !playing || !active) {
            post({ type: "swapFailed", key: key });
            return;
          }

          var at = nextDownbeatTime();
          if (at == null) {
            post({ type: "swapFailed", key: key });
            return;
          }

          var region = resolveRegion(entry, trimStart, trimEnd);
          var bpm = nativeBpm > 0 ? nativeBpm : entry.nativeBpm;
          var loopBeats =
            bpm > 0 ? Math.round(((region.end - region.start) * bpm) / 60) : 0;
          var useStretch = Math.abs(rate - 1) > UNITY_RATE_EPSILON;

          pendingSwap = {
            at: at,
            key: key,
            buffer: entry.buffer,
            loopStart: region.start,
            loopEnd: region.end,
            nativeBpm: bpm,
            loopBeats: loopBeats,
            beatsPerBar: beatsPerBar > 0 ? beatsPerBar : loopBeats || 1,
            rate: rate,
            // Rendered NOW, while there is a bar to spare. Left until the
            // boundary it would block straight through it.
            stretch: useStretch
              ? renderStretch(entry.buffer, region.start, region.end, rate)
              : null,
          };

          post({ type: "swapQueued", key: key, at: at });
        }

        function cancelQueuedSwap() {
          pendingSwap = null;
        }

        // Perform the swap. Called from the beat scheduler once the boundary is
        // inside the lookahead, so both sources are scheduled ahead of time
        // rather than started when JS happens to wake up.
        function runQueuedSwap() {
          var swap = pendingSwap;
          pendingSwap = null;

          var old = playing;
          var next = startSourceFrom(
            {
              buffer: swap.buffer,
              loopStart: swap.loopStart,
              loopEnd: swap.loopEnd,
              stretch: swap.stretch,
            },
            0,
            SWAP_FADE_SECONDS,
            swap.at
          );
          if (!next) {
            post({ type: "swapFailed", key: swap.key });
            return;
          }
          if (old) stopSource(old, SWAP_FADE_SECONDS, swap.at);

          // Only now does the incoming loop become the active one -- everything
          // that reads the active loop (the click's spacing, the bar length)
          // was describing the outgoing loop right up to the boundary, which is
          // what kept the click in time through the bar leading into it.
          active = {
            key: swap.key,
            buffer: swap.buffer,
            loopStart: swap.loopStart,
            loopEnd: swap.loopEnd,
            nativeBpm: swap.nativeBpm,
            loopBeats: swap.loopBeats,
            beatsPerBar: swap.beatsPerBar,
          };
          stretched = swap.stretch
            ? { rate: swap.rate, buffer: swap.stretch }
            : null;
          currentRate = swap.rate;

          // The new loop's downbeat is exactly swap.at, so the grid re-locks
          // there and beat 0 lands on it.
          startBeatGrid(swap.at);
          post({ type: "swapped", key: swap.key, at: swap.at });
        }

        function play(rate) {
          if (!active) {
            // Coded so the app can tell this apart from a decode failure and
            // put the transport back rather than leaving it showing "playing".
            post({ type: "error", code: "no-loop", message: "no loop loaded" });
            return;
          }
          if (rate) currentRate = rate;
          // Starting outright supersedes anything queued for a boundary.
          cancelQueuedSwap();
          startKeepAlive(); // see silentModeKeepAlive.ts
          if (playing) stopSource(playing, 0);
          playing = null;
          startSource(0, 0);
          // The loop's downbeat is playing.startedAt (phase 0); start the grid
          // there so beat 0 lands exactly on it.
          startBeatGrid(playing ? playing.startedAt : null);
          startPositionUpdates();
        }

        function stop() {
          if (rateTimer) {
            clearTimeout(rateTimer);
            rateTimer = null;
          }
          stopKeepAlive();
          stopBeatGrid();
          stopPositionUpdates();
          // A cue queued for a boundary that is no longer coming. Without this
          // it would swap into a stopped transport and start playing again.
          cancelQueuedSwap();
          // The dots go dark with the sound rather than sticking on whichever
          // beat the loop happened to stop on.
          post({ type: "beat", beat: null, accent: false });
          if (playing) {
            stopSource(playing, 0.008); // tiny fade: no click on stop
            playing = null;
          }
        }

        // The subdivision. Changes the grid's spacing, so the grid has to be
        // re-laid from the loop's current position -- beats already queued are
        // on the old spacing, and leaving them would put the first tick of the
        // new feel wherever the last one of the old feel happened to land.
        //
        // Nothing about the audio moves: the rate, the buffer and the phase are
        // all untouched, so this is only ever a re-timing of the click and the
        // dots. That is the whole point of the control.
        function setClickFeel(multiplier) {
          if (typeof multiplier !== "number" || !(multiplier > 0)) return;
          if (multiplier === clickFeel) return;
          clickFeel = multiplier;
          if (playing) startBeatGrid(null);
        }

        function setRate(rate) {
          currentRate = rate;
          if (!active) return;
          if (rateTimer) clearTimeout(rateTimer);
          rateTimer = setTimeout(function () {
            rateTimer = null;
            if (playing) {
              applyRateChange();
            } else if (Math.abs(currentRate - 1) > UNITY_RATE_EPSILON) {
              // Warm the render so the next play is instant.
              getStretchedBuffer(currentRate);
            }
          }, RATE_DEBOUNCE_MS);
        }

        // Decode and cache a click sample (the loop click follows whichever
        // Metronome sounds are selected, sent over by id).
        function loadClick(id, base64) {
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

        // Live click config from the app: enabled flag, pan, which sound ids
        // the accent/beat voices use, and their volumes. Toggling enabled
        // mid-playback starts/stops the click on the fly.
        function setClick(cfg) {
          if (typeof cfg.pan === "number") {
            clickPan = Math.max(-1, Math.min(1, cfg.pan));
          }
          if (typeof cfg.accentId === "string") clickAccentId = cfg.accentId;
          if (typeof cfg.beatId === "string") clickBeatId = cfg.beatId;
          // Up to 2, not 1. These arrive already multiplied by the metronome's
          // master (see postClickConfig), which is allowed past full scale so
          // the click can be heard over a band -- clamping to 1 here would quietly
          // put the ceiling back. Keep in step with METRONOME_MAX_VOLUME in
          // context/PreferencesContext.tsx.
          if (typeof cfg.accentVolume === "number") {
            clickAccentVol = Math.max(0, Math.min(2, cfg.accentVolume));
          }
          if (typeof cfg.beatVolume === "number") {
            clickBeatVol = Math.max(0, Math.min(2, cfg.beatVolume));
          }
          var wasEnabled = clickEnabled;
          if (typeof cfg.enabled === "boolean") clickEnabled = cfg.enabled;
          if (playing) {
            if (clickEnabled && !wasEnabled) {
              // Re-seed rather than wait: the grid is already running, but the
              // beats it has queued ahead have no click attached to them, so
              // without this the click joins a lookahead late.
              startBeatGrid(null);
            } else if (!clickEnabled && wasEnabled) {
              // Only the sound. The grid keeps running, because the dots do.
              stopClickSources();
            }
          }
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
            case "preload":
              preload(data.key, data.base64, data.nativeBpm);
              break;
            case "select":
              select(
                data.key,
                data.nativeBpm,
                data.base64,
                data.beatsPerBar,
                data.trimStart,
                data.trimEnd
              );
              break;
            case "analyze":
              analyze(data.key, data.base64, data.buckets);
              break;
            case "detect":
              detect(data.key, data.start, data.end);
              break;
            case "regionPeaks":
              sendRegionPeaks(data.key, data.start, data.end, data.buckets);
              break;
            case "positionUpdates":
              positionUpdates = data.enabled === true;
              if (positionUpdates && playing) startPositionUpdates();
              else stopPositionUpdates(true);
              break;
            case "play":
              play(data.rate);
              break;
            case "queueSwap":
              queueLoopSwap(
                data.key,
                data.nativeBpm,
                data.beatsPerBar,
                data.trimStart,
                data.trimEnd,
                data.rate
              );
              break;
            case "cancelSwap":
              cancelQueuedSwap();
              break;
            case "stop":
              stop();
              break;
            case "setClickFeel":
              setClickFeel(data.multiplier);
              break;
            case "setRate":
              setRate(data.rate);
              break;
            case "setLoopVolume":
              setLoopVolume(data.volume);
              break;
            case "loadClick":
              loadClick(data.id, data.base64);
              break;
            case "setClick":
              setClick(data);
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

        post({ type: "ready" });
      })();
    </script>
  </body>
</html>`;
