#!/usr/bin/env node
/**
 * Brings the edited loop pack into assets/audio/loops.
 *
 * The loops arrive already cut — tempo, meter and downbeat all decided by ear,
 * which is the part no measurement gets right on syncopated material. This
 * script does only the things that ARE measurable:
 *
 *   1. Checks each file holds a whole number of beats at the tempo on its name.
 *      A loop that does not walks away from the click a little further on every
 *      pass, and nothing about it looks wrong until you hear it.
 *
 *   2. Forces the length to be exact. Most files land 1-8ms short of a whole
 *      beat, which is inaudible once and 400ms of drift over a three-minute
 *      song. Short files are padded with silence at the tail; long ones are
 *      trimmed. Both are inaudible on a decaying bar end.
 *
 *   3. Re-encodes 24-bit to 16-bit. The sources are 48kHz/24-bit; 16 is CD+
 *      quality, halves the bundle, and Web Audio decodes to float either way.
 *
 * Every entry ends up with an explicit trimStart/trimEnd in constants/loops.ts.
 * That skips the engine's silence-trim and beat-snap entirely — which is what
 * it wants, because four of these end on a decay that the trim would eat and
 * the snap would then decline to restore (see BEAT_SNAP_TOLERANCE, 0.1 beats).
 *
 * Usage:  node scripts/import_loops.js "/path/to/LOOPS EDITED"
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "assets", "audio", "loops");

// source file, key, title, category, bpm, beats-per-bar, time signature.
//
// Titles carry the character; the browser row already prints the tempo, so it
// is not repeated in the name. Where the pack had two files that would read the
// same in a list ("AFRO" and "AFRO2", three at 155, three at 80), the duplicates
// are numbered rather than invented.
const CATALOG = [
  // --- Afro ---------------------------------------------------------------
  ["AFRO - 96BPM - 4_4.wav",              "afro",             "Afro",             "Afro",     96,  4, "4 / 4"],
  ["AFRO -97BPM - 4_4.wav",               "afro_97",          "Afro 97",          "Afro",     97,  4, "4 / 4"],
  ["AFRO2 -97BPM - 4_4.wav",              "afro_97_ii",       "Afro 97 II",       "Afro",     97,  4, "4 / 4"],
  ["AFRO BACK HOME - 128BPM - 4_4.wav",   "back_home",        "Back Home",        "Afro",     128, 4, "4 / 4"],
  ["AFRO DANCEHALL -131BPM - 4_4.wav",    "afro_dancehall",   "Afro Dancehall",   "Afro",     131, 4, "4 / 4"],
  ["AFRO LOCAL - 136BPM - 4_4.wav",       "afro_local",       "Afro Local",       "Afro",     136, 4, "4 / 4"],
  ["AFRO OI - 107BPM - 4_4.wav",          "afro_oi",          "Afro OI",          "Afro",     107, 4, "4 / 4"],
  ["AFRO P -122BPM - 4_4.wav",            "afro_p",           "Afro P",           "Afro",     122, 4, "4 / 4"],
  ["AFRO PIANO  - 124BPM - 4_4.wav",      "afro_piano",       "Afro Piano",       "Afro",     124, 4, "4 / 4"],

  // --- Praise -------------------------------------------------------------
  ["AFRO PRAISE - 135BPM - 4_4.wav",      "afro_praise",      "Afro Praise",      "Praise",   135, 4, "4 / 4"],

  // --- Drill --------------------------------------------------------------
  ["DRILL - 132BPM -4_4.wav",             "drill",            "Drill",            "Drill",    132, 4, "4 / 4"],

  // --- Highlife -----------------------------------------------------------
  ["PST NATH (highlife  )- 87BPM -4_4.wav", "pst_nath",       "Pst Nath",         "Highlife", 87,  4, "4 / 4"],

  // --- Worship ------------------------------------------------------------
  ["WORSHIP - 80BPM - 4_4.wav",           "worship_80",       "Worship 80",       "Worship",  80,  4, "4 / 4"],
  ["WORSHIP - 80BPM - 4_4_1.wav",         "worship_80_ii",    "Worship 80 II",    "Worship",  80,  4, "4 / 4"],
  ["WORSHIP - 80BPM - 4_4_2.wav",         "worship_80_iii",   "Worship 80 III",   "Worship",  80,  4, "4 / 4"],
  ["WORSHIP MM - 80BPM -4_4.wav",         "worship_mm",       "Worship MM",       "Worship",  80,  4, "4 / 4"],
  // Named 6/8 and 80 BPM, and the app cannot honour both: a bar here measures
  // 2.25s, and "6 / 8" at 80 would be a 4.5s bar -- which would make this file
  // one and a half bars long and put the click's accent somewhere new on every
  // pass. 3/4 at 80 gives the bar it actually has AND keeps the tempo written
  // on the tin. (160 in "6 / 8" is the same bar and the same loop; it only
  // changes the number on screen and how the click subdivides.)
  ["WORSHIP - 80BPM - 6_8.wav",           "worship_68",       "Worship 6/8",      "Worship",  80,  3, "3 / 4"],
  ["WORSHIP - 82BPM - 4_4.wav",           "worship_82",       "Worship 82",       "Worship",  82,  4, "4 / 4"],
  ["WORSHIP MOVER - 82BPM - 4_4.wav",     "worship_mover",    "Worship Mover",    "Worship",  82,  4, "4 / 4"],
  ["WORSHI - 91BPM -4_4.wav",             "worship_91",       "Worship 91",       "Worship",  91,  4, "4 / 4"],
  ["WORSHIP UNDERDOG - 94BPM -4_4.wav",   "worship_underdog", "Worship Underdog", "Worship",  94,  4, "4 / 4"],
  ["WORSHIP WAR DRUM -  94BPM - 4_4.wav", "worship_war_drum", "Worship War Drum", "Worship",  94,  4, "4 / 4"],
  ["WORSHIP WAR - 98 -4_4.wav",           "worship_war",      "Worship War",      "Worship",  98,  4, "4 / 4"],
  ["WORSHIP - 135BPM - 4_4.wav",          "worship_135",      "Worship 135",      "Worship",  135, 4, "4 / 4"],
  ["WORSHIP - 155BPM -3_4.wav",           "worship_155",      "Worship 155",      "Worship",  155, 3, "3 / 4"],
  ["WORSHIP 2 - 155BPM -3_4.wav",         "worship_155_ii",   "Worship 155 II",   "Worship",  155, 3, "3 / 4"],
  ["WORSHIP 3 - 155BPM -3_4.wav",         "worship_155_iii",  "Worship 155 III",  "Worship",  155, 3, "3 / 4"],
];

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error('usage: node scripts/import_loops.js "/path/to/LOOPS EDITED"');
  process.exit(1);
}

const probe = (file) => {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "a:0",
    "-show_entries", "stream=duration_ts,sample_rate",
    "-of", "default=nw=1", file,
  ]).toString();
  const rate = Number(out.match(/sample_rate=(\d+)/)[1]);
  const frames = Number(out.match(/duration_ts=(\d+)/)[1]);
  return { rate, frames, duration: frames / rate };
};

const results = [];
let adjusted = 0;

for (const [file, key, title, category, bpm, beatsPerBar, signature] of CATALOG) {
  const inPath = path.join(src, file);
  if (!fs.existsSync(inPath)) {
    console.error(`MISSING: ${file}`);
    process.exitCode = 1;
    continue;
  }

  const before = probe(inPath);
  const beats = (before.duration * bpm) / 60;
  const wholeBeats = Math.round(beats);
  const bars = wholeBeats / beatsPerBar;

  if (Math.abs(beats - wholeBeats) > 0.05) {
    console.error(
      `OFF GRID: ${file} is ${beats.toFixed(3)} beats at ${bpm} BPM — not a whole number`
    );
    process.exitCode = 1;
    continue;
  }
  if (!Number.isInteger(bars)) {
    console.error(
      `NOT WHOLE BARS: ${file} is ${wholeBeats} beats, which is ${bars} bars of ${beatsPerBar}`
    );
    process.exitCode = 1;
    continue;
  }

  // The exact length this loop should be, to the sample.
  const targetSeconds = (wholeBeats * 60) / bpm;
  const targetFrames = Math.round(targetSeconds * before.rate);
  const deltaMs = (targetSeconds - before.duration) * 1000;
  if (Math.abs(deltaMs) > 0.5) adjusted++;

  const outPath = path.join(OUT, `${key}.wav`);

  // apad then a hard -t: pads a short file with silence and trims a long one,
  // so the result is exactly targetFrames either way. atrim/asetpts keeps the
  // timestamps clean so the length is what it says.
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", inPath,
    "-af", `apad,atrim=end_sample=${targetFrames},asetpts=N/SR/TB`,
    "-ac", "2",
    "-ar", String(before.rate),
    "-sample_fmt", "s16",
    outPath,
  ]);

  const after = probe(outPath);
  const finalBeats = (after.duration * bpm) / 60;

  results.push({
    key, title, category, bpm, signature,
    duration: after.duration,
    frames: after.frames,
    beats: finalBeats,
    bars,
    bytes: fs.statSync(outPath).size,
    exact: after.frames === targetFrames,
  });

  console.log(
    `${key.padEnd(18)} ${String(bpm).padStart(5)} BPM  ${signature.padEnd(6)} ` +
      `${String(bars).padStart(2)} bar  ${after.duration.toFixed(6)}s  ` +
      `= ${finalBeats.toFixed(4)} beats  ` +
      (Math.abs(deltaMs) > 0.5 ? `(${deltaMs > 0 ? "padded" : "trimmed"} ${Math.abs(deltaMs).toFixed(1)}ms)` : "")
  );
}

const notExact = results.filter((r) => !r.exact);
const totalMB = results.reduce((sum, r) => sum + r.bytes, 0) / 1048576;

console.log(`\n${results.length} loops, ${totalMB.toFixed(1)} MB total`);
console.log(`${adjusted} nudged to an exact beat length`);
console.log(
  notExact.length
    ? `${notExact.length} did NOT come out at the exact sample count`
    : "every file is exactly a whole number of beats"
);

fs.writeFileSync(
  path.join(__dirname, "..", "assets", "audio", "loops", "_catalog.json"),
  JSON.stringify(results, null, 2)
);
