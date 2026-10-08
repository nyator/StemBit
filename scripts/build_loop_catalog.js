#!/usr/bin/env node
/**
 * Builds catalog.json for the loop store from a folder of prepared packs.
 *
 * The split is the same one scripts/import_loops.js draws, for the same reason:
 * a human states what only a human knows -- the tempo, the meter, the category,
 * what the pack costs -- and the script measures what is measurable. Nothing
 * here guesses a tempo. A loop's length, though, has to be exact to the sample
 * or it walks away from the click a little further on every pass, so that is
 * read off the file with ffprobe rather than typed.
 *
 * Layout it expects:
 *
 *   loops-to-upload/
 *     kwame-afro-vol1/
 *       pack.json
 *       deep-groove.wav
 *       ...
 *
 * and a pack.json shaped like:
 *
 *   {
 *     "id": "kwame-afro-vol1",
 *     "title": "Afro Vol. 1",
 *     "artist": "Kwame Mensah",
 *     "description": "Twelve bars cut from the Sunday sets.",
 *     "price": 0,
 *     "single": false,
 *     "loops": [
 *       { "file": "deep-groove.wav", "title": "Deep Groove",
 *         "category": "Afro", "bpm": 104, "timeSignature": "4 / 4" }
 *     ]
 *   }
 *
 * Usage:  node scripts/build_loop_catalog.js ./loops-to-upload [> catalog.json]
 *
 * Writes catalog.json into the source folder, ready to upload alongside the
 * audio. See docs/loop-store.md for what to put where in the bucket.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const LOOP_CATEGORIES = ["Worship", "Praise", "Funk", "Afro", "Drill", "Highlife"];

const root = process.argv[2];
if (!root) {
  console.error("Usage: node scripts/build_loop_catalog.js <folder>");
  process.exit(1);
}
if (!fs.existsSync(root)) {
  console.error(`No such folder: ${root}`);
  process.exit(1);
}

/** Exact duration, in seconds, from the frame count rather than the header. */
function durationOf(file) {
  const out = execFileSync(
    "ffprobe",
    [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=duration_ts,sample_rate",
      "-of", "default=noprint_wrappers=1",
      file,
    ],
    { encoding: "utf8" }
  );
  const rate = Number(out.match(/sample_rate=(\d+)/)[1]);
  const frames = Number(out.match(/duration_ts=(\d+)/)[1]);
  return frames / rate;
}

const problems = [];
const packs = [];
const singles = [];

const folders = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const folder of folders) {
  const dir = path.join(root, folder);
  const descriptor = path.join(dir, "pack.json");

  if (!fs.existsSync(descriptor)) {
    problems.push(`${folder}: no pack.json, skipped`);
    continue;
  }

  const meta = JSON.parse(fs.readFileSync(descriptor, "utf8"));
  const id = meta.id || folder;
  const paid = Number(meta.price) > 0;

  const loops = [];

  for (const entry of meta.loops || []) {
    const source = path.join(dir, entry.file);
    if (!fs.existsSync(source)) {
      problems.push(`${id}: ${entry.file} is listed but not in the folder`);
      continue;
    }
    if (!LOOP_CATEGORIES.includes(entry.category)) {
      // Not fatal -- the app falls back to the first category -- but it means
      // the loop files under a chip nobody expects, so it is worth saying.
      problems.push(
        `${id}/${entry.file}: category "${entry.category}" isn't one of ${LOOP_CATEGORIES.join(", ")}`
      );
    }

    const duration = durationOf(source);
    const bytes = fs.statSync(source).size;

    // The whole-bars check import_loops.js runs on the shipped catalogue,
    // applied to pack audio for the same reason: a loop that isn't a whole
    // number of beats at its stated tempo drifts against the click, and nothing
    // about it looks wrong until you hear it.
    const beatsPerBar = parseInt(String(entry.timeSignature || "4 / 4").split("/")[0].trim(), 10) || 4;
    const beats = (duration * entry.bpm) / 60;
    const rounded = Math.round(beats);
    if (Math.abs(beats - rounded) > 0.01 || rounded % beatsPerBar !== 0) {
      problems.push(
        `${id}/${entry.file}: ${beats.toFixed(3)} beats at ${entry.bpm} bpm -- not a whole number of ${beatsPerBar}-beat bars`
      );
    }

    loops.push({
      key: `${id}/${path.basename(entry.file, path.extname(entry.file))}`,
      title: entry.title,
      category: entry.category,
      bpm: entry.bpm,
      timeSignature: entry.timeSignature || "4 / 4",
      trimStart: 0,
      trimEnd: Number(duration.toFixed(6)),
      // Paid audio gets NO path in the manifest, on purpose.
      //
      // The manifest is public -- it has to be, or nobody can browse the store
      // before buying -- so a path in it is a path anyone can fetch. Until a
      // purchase can be verified server-side and answered with a signed URL,
      // the only way for paid audio to stay paid is for it to be absent from
      // the public bucket and absent from here. The app is built for this: a
      // paid loop with no file lists and locks rather than disappearing.
      ...(paid ? {} : { file: `packs/${id}/${entry.file}` }),
      bytes,
    });
  }

  if (loops.length === 0) {
    problems.push(`${id}: no usable loops, skipped`);
    continue;
  }

  const built = {
    id,
    title: meta.title,
    artist: meta.artist,
    ...(meta.description ? { description: meta.description } : {}),
    ...(paid ? { price: meta.price, currency: meta.currency || "USD" } : {}),
    loops,
  };

  // A "single" pack's loops go in the manifest's root array, where the app
  // lists them one per row instead of behind a pack that holds one thing.
  if (meta.single) {
    for (const entry of loops) {
      singles.push({ ...entry, artist: meta.artist, ...(paid ? { price: meta.price } : {}) });
    }
  } else {
    packs.push(built);
  }
}

const catalog = {
  version: 1,
  generatedAt: new Date().toISOString(),
  ...(packs.length ? { packs } : {}),
  ...(singles.length ? { loops: singles } : {}),
};

const target = path.join(root, "catalog.json");
fs.writeFileSync(target, `${JSON.stringify(catalog, null, 2)}\n`);

const loopCount =
  packs.reduce((total, pack) => total + pack.loops.length, 0) + singles.length;
console.log(
  `Wrote ${target}: ${packs.length} pack(s), ${singles.length} single(s), ${loopCount} loop(s).`
);

if (problems.length > 0) {
  console.log("\nWorth a look before uploading:");
  for (const problem of problems) console.log(`  - ${problem}`);
}

const paidPacks = packs.filter((pack) => pack.price);
if (paidPacks.length > 0) {
  console.log(
    `\n${paidPacks.length} paid pack(s) were written without file paths, and their audio must NOT be uploaded to the public bucket. ` +
      "They will list in the store and stay locked until in-app purchasing and a signed-URL endpoint exist."
  );
}
