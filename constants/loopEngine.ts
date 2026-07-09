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
export const buildLoopEngineHtml = () => `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script>
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
        // Only snap to the beat grid if the trimmed length is within this
        // fraction of a whole number of beats; otherwise trust the trim.
        var BEAT_SNAP_TOLERANCE = 0.1;
        // Rates closer to 1x than this play the original, unstretched audio.
        var UNITY_RATE_EPSILON = 0.001;
        // Crossfade used when swapping sources on a rate change.
        var SWAP_FADE_SECONDS = 0.03;
        // Rate changes are debounced this long so dragging the BPM control
        // doesn't re-render on every step.
        var RATE_DEBOUNCE_MS = 120;

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

        // Render (or fetch the cached render of) the active loop region
        // stretched to the given rate. The stretched buffer contains ONLY
        // the loop region, so it loops over its full length.
        function getStretchedBuffer(rate) {
          if (!active) return null;
          if (stretched && Math.abs(stretched.rate - rate) < 0.0005) {
            return stretched.buffer;
          }

          var src = active.buffer;
          var sr = src.sampleRate;
          var startFrame = Math.round(active.loopStart * sr);
          var endFrame = Math.min(Math.round(active.loopEnd * sr), src.length);

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

        function applyActive(key, entry) {
          active = {
            key: key,
            buffer: entry.buffer,
            loopStart: entry.loopStart,
            loopEnd: entry.loopEnd,
          };
          stretched = null; // renders belong to the previous loop
          post({
            type: "loaded",
            key: key,
            duration: entry.buffer.duration,
            loopStart: entry.loopStart,
            loopEnd: entry.loopEnd,
          });
        }

        // Make a loop the active one. Instant when preloaded; falls back to
        // decoding inline (from provided base64) when it isn't.
        function select(key, nativeBpm, base64) {
          selectToken += 1;
          var token = selectToken;
          stop();
          active = null;
          stretched = null;

          var cached = decodedByKey[key];
          if (cached) {
            applyActive(key, cached);
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
              applyActive(key, entry);
            },
            function (code, message) {
              if (token !== selectToken) return;
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
          var ctx = ensureContext();
          var useStretch = Math.abs(currentRate - 1) > UNITY_RATE_EPSILON;

          var buf;
          var ls;
          var le;
          if (useStretch) {
            buf = getStretchedBuffer(currentRate); // cached in the swap path
            if (!buf) return null;
            ls = 0;
            le = buf.duration;
          } else {
            buf = active.buffer;
            ls = active.loopStart;
            le = active.loopEnd;
          }

          var loopLength = le - ls;
          var offset = ls + phase * loopLength;

          var gain = ctx.createGain();
          var source = ctx.createBufferSource();
          source.buffer = buf;
          source.loop = true;
          source.loopStart = ls;
          source.loopEnd = le;
          source.connect(gain);
          gain.connect(ctx.destination);

          var startAt = atTime || ctx.currentTime + 0.03;
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
        }

        function play(rate) {
          if (!active) {
            post({ type: "error", message: "no loop loaded" });
            return;
          }
          if (rate) currentRate = rate;
          if (playing) stopSource(playing, 0);
          playing = null;
          startSource(0, 0);
        }

        function stop() {
          if (rateTimer) {
            clearTimeout(rateTimer);
            rateTimer = null;
          }
          if (playing) {
            stopSource(playing, 0.008); // tiny fade: no click on stop
            playing = null;
          }
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
              select(data.key, data.nativeBpm, data.base64);
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
