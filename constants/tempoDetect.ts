// Reading a tempo off an AudioBuffer, as engine source.
//
// A string rather than a module because it runs inside a WebView, alongside the
// audio it measures -- the same arrangement as SILENT_MODE_KEEP_ALIVE_SOURCE
// and BPM_ANALYZER_SOURCE. Two engines need it: the loop engine, where an
// imported loop's tempo is read off the trim, and the session engine, where a
// freshly imported song's tempo is read off a stem.
//
// Shared rather than copied because the session engine's alternative was to
// have a whole second loop engine mounted to do the reading -- which meant the
// same audio decoded twice, held in two AudioContexts, at the one moment the
// app is already decoding a whole multitrack song. The engine that owns the
// buffer should be the engine that measures it.
//
// EXPECTS from its host engine:
//   ensureContext()      -> an AudioContext (for createBuffer)
//   window.bpmAnalyzer   -> BPM_ANALYZER_SOURCE, loaded before this
// and nothing else. Everything it needs beyond those is defined here.

export const TEMPO_DETECT_SOURCE = `
        // --- Tempo detection (realtime-bpm-analyzer) ----------------------

        // How much audio a repeated region is built up to, and the ceiling on it.
        var ANALYSIS_MIN_SECONDS = 20;
        var ANALYSIS_MAX_SECONDS = 40;
        // Only regions shorter than this are worth repeating. Longer ones already
        // hold the peaks the detector wants, and repeating them measurably makes
        // things worse: a four-bar mix reads correctly as itself and a whole
        // octave out when tiled, because every join adds an interval that isn't
        // in the music.
        var ANALYSIS_TILE_UNDER_SECONDS = 6;
        // The detector lowpasses at 200Hz before looking for peaks, so it is deaf
        // to anything whose pulse isn't carried by a kick or a bass note: a click
        // track, a hi-hat loop, a shaker, a rimshot groove. When the first pass
        // comes back with nothing, or next to nothing, the same audio is read
        // again with the filter opened up this far.
        var ANALYSIS_FALLBACK_HZ = 3000;
        // A first pass under this is worth a second opinion.
        var ANALYSIS_RETRY_CONFIDENCE = 0.15;

        // The library's analyzeFullBuffer takes a whole AudioBuffer, so a region
        // becomes a buffer of its own first. That isn't only plumbing: analysing
        // the trim rather than the file is a cleaner read, with no count-in, tail
        // or applause to drag the answer around.
        //
        // Optionally REPEATED to fill it, which is how a short loop gets read at
        // all: the detector wants 15 peaks before it will answer, and below that
        // returns nothing rather than a weak guess. Two bars at 120 BPM is four
        // seconds and eight kick hits. Repeating is fair rather than a trick,
        // since repeating is what a loop does -- the audio analysed is the audio
        // the file will actually make.
        //
        // It is not free, though, which is why detectTempo asks for it rather
        // than assuming it. Where the region isn't a whole number of beats -- a
        // reverb tail past the last hit, say -- every join adds an interval that
        // doesn't exist in the music, and enough joins can outvote the real
        // tempo. See detectTempo for how that's kept honest.
        function sliceRegion(buffer, startSeconds, endSeconds, repeat) {
          var ctx = ensureContext();
          var sampleRate = buffer.sampleRate;
          var from = Math.max(0, Math.floor(startSeconds * sampleRate));
          var to = Math.min(buffer.length, Math.ceil(endSeconds * sampleRate));
          var length = to - from;
          if (length < sampleRate) return null; // under a second: nothing to read

          var copies = repeat ? analysisCopies(length / sampleRate) : 1;
          var total = Math.min(
            length * copies,
            Math.ceil(ANALYSIS_MAX_SECONDS * sampleRate)
          );
          var region = ctx.createBuffer(buffer.numberOfChannels, total, sampleRate);

          for (var c = 0; c < buffer.numberOfChannels; c++) {
            var source = buffer.getChannelData(c).subarray(from, to);
            var target = region.getChannelData(c);
            for (var at = 0; at < total; at += length) {
              // The last copy is trimmed to whatever room is left, which is fine:
              // a partial pass still holds whole beats.
              target.set(
                at + length <= total ? source : source.subarray(0, total - at),
                at
              );
            }
          }
          return region;
        }

        // How many times a region of this length is repeated before analysis.
        function analysisCopies(seconds) {
          if (!(seconds > 0)) return 1;
          return Math.max(1, Math.ceil(ANALYSIS_MIN_SECONDS / seconds));
        }

        // Turn the library's candidate list into the one answer the app wants.
        //
        // Candidates come back sorted by "count" -- how many peak-to-peak
        // intervals agree with that tempo -- and the library leaves its own
        // confidence field at 0 in the offline path, so confidence here is the
        // winner's share of all the candidates' counts. A loop with a clear pulse
        // puts half the intervals or more on one tempo; on material with no pulse
        // the top few come out level, which is exactly what a low share means.
        function describeTempo(candidates) {
          if (!candidates || !candidates.length) return null;

          var total = 0;
          for (var i = 0; i < candidates.length; i++) {
            total += candidates[i].count || 0;
          }
          var top = candidates[0];
          if (!top || !top.tempo) return null;

          return {
            bpm: top.tempo,
            confidence: total > 0 ? (top.count || 0) / total : 0,
            // The other readings, best first. The library folds every tempo into
            // 90-180 BPM, so the reading a listener wanted is often one of these
            // rather than the winner -- the screen offers them as one-tap chips,
            // which beats making someone tap the tempo out.
            alternatives: candidates.slice(1, 4).map(function (candidate) {
              return candidate.tempo;
            }),
          };
        }

        // One pass of the detector over a prepared buffer, at a given filter.
        function analyzePass(region, options, onDone) {
          try {
            window.bpmAnalyzer
              .analyzeFullBuffer(region, options)
              .then(function (candidates) {
                onDone(describeTempo(candidates));
              })
              .catch(function () {
                // A file it can't read isn't worth surfacing as an error: the
                // screen falls back to working the tempo out from the loop's
                // length, and says that's what it did.
                onDone(null);
              });
          } catch (e) {
            onDone(null);
          }
        }

        // Read the tempo of a region. Asynchronous: the library renders its
        // lowpass through an OfflineAudioContext, which is a promise.
        // Up to three readings of the same region, each covering a way the one
        // before it goes deaf, stopping as soon as one is convincing and otherwise
        // keeping whichever put most of its evidence on a single tempo:
        //
        //   1. The region as it stands -- unless it's short, in which case the
        //      repeated reading goes first. On a region too short to hold the
        //      peaks the detector wants, this pass is the UNRELIABLE one: it
        //      answers off a handful of intervals and can look confident doing it,
        //      so leading with it means a two-bar loop settles for 117 when the
        //      repeated reading would have said 120.
        //   2. The region repeated. A one-bar loop returns NOTHING at all from the
        //      pass above and reads exactly right from this one. Only for short
        //      regions: a four-bar mix reads correctly as itself and an octave out
        //      when tiled, because a region that isn't a whole number of beats
        //      puts an interval at every join that isn't in the music.
        //   3. The filter opened up. The detector lowpasses at 200Hz before
        //      looking for peaks, so a click track -- nothing down there at all --
        //      or a loop driven by hats comes back empty from both passes above.
        //      Not the better default: on a full mix the low band is exactly what
        //      makes the beat legible.
        function detectTempo(buffer, startSeconds, endSeconds, onDone) {
          if (!window.bpmAnalyzer) {
            onDone(null);
            return;
          }

          var plain = sliceRegion(buffer, startSeconds, endSeconds, false);
          if (!plain) {
            onDone(null);
            return;
          }

          var seconds = plain.length / plain.sampleRate;
          var repeated =
            seconds < ANALYSIS_TILE_UNDER_SECONDS
              ? sliceRegion(buffer, startSeconds, endSeconds, true)
              : null;

          var attempts = repeated
            ? [
                { region: repeated, options: undefined },
                { region: plain, options: undefined },
                {
                  region: repeated,
                  options: { frequencyValue: ANALYSIS_FALLBACK_HZ },
                },
              ]
            : [
                { region: plain, options: undefined },
                {
                  region: plain,
                  options: { frequencyValue: ANALYSIS_FALLBACK_HZ },
                },
              ];

          var best = null;
          var index = 0;

          function next() {
            while (index < attempts.length && !attempts[index]) index += 1;
            if (index >= attempts.length) {
              onDone(best);
              return;
            }

            var attempt = attempts[index];
            index += 1;
            analyzePass(attempt.region, attempt.options, function (result) {
              if (result && (!best || result.confidence > best.confidence)) {
                best = result;
              }
              // Convincing enough to stop asking.
              if (best && best.confidence >= ANALYSIS_RETRY_CONFIDENCE) {
                onDone(best);
                return;
              }
              next();
            });
          }

          next();
        }
`;
