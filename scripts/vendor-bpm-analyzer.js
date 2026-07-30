#!/usr/bin/env node
/**
 * Copies realtime-bpm-analyzer's browser bundle into constants/vendor/ as a
 * JavaScript string, for injecting into the loop engine's WebView.
 *
 * Why this exists: tempo detection needs Web Audio -- the library renders a
 * biquad lowpass through an OfflineAudioContext -- and React Native has none.
 * The WebView does, so that's where the library has to run. But the WebView is
 * handed an HTML string, not a module graph, so the library has to arrive as
 * source text, and Metro has no way to import a file as text.
 *
 * Hence a generated module holding the bundle as a string literal. The generated
 * file is committed so a build never depends on this script having been run, and
 * utils/tests/loopTempo.test.js asserts the copy still matches the installed
 * package, so it can't quietly go stale.
 *
 * Run after upgrading the package:  npm run vendor:bpm
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const source = path.join(
  root,
  "node_modules",
  "realtime-bpm-analyzer",
  "dist",
  "index.js"
);
const target = path.join(root, "constants", "vendor", "bpmAnalyzerSource.ts");

if (!fs.existsSync(source)) {
  console.error(
    "realtime-bpm-analyzer is not installed. Run: npm install realtime-bpm-analyzer"
  );
  process.exit(1);
}

const bundle = fs.readFileSync(source, "utf8");
const { version } = require(path.join(
  root,
  "node_modules",
  "realtime-bpm-analyzer",
  "package.json"
));

// The bundle is CommonJS with no external requires, so it needs nothing but a
// module/exports pair to run anywhere. JSON.stringify is what makes it safe to
// embed: the bundle contains backticks and ${...} of its own, which would tear a
// template literal apart.
const file = `// GENERATED FILE -- DO NOT EDIT.
// realtime-bpm-analyzer v${version}, dist/index.js, as a string.
// Regenerate with: npm run vendor:bpm  (scripts/vendor-bpm-analyzer.js)
//
// This is the tempo detector, and it lives here as text because it has to run
// inside the loop engine's WebView: it needs Web Audio (an OfflineAudioContext,
// to render its lowpass) and React Native has none. The WebView takes an HTML
// string, so the library has to be injectable as source.

/** realtime-bpm-analyzer's CommonJS bundle, verbatim. */
export const BPM_ANALYZER_SOURCE = ${JSON.stringify(bundle)};

/** The version this copy was taken from, so the test can check it hasn't drifted. */
export const BPM_ANALYZER_VERSION = ${JSON.stringify(version)};
`;

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, file, "utf8");

console.log(
  `Vendored realtime-bpm-analyzer v${version} (${bundle.length} bytes) -> constants/vendor/bpmAnalyzerSource.ts`
);
