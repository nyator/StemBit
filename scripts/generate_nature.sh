#!/usr/bin/env bash
# Regenerates the nature ambience bed in assets/audio/nature from a raw field
# recording. This is the channel that layers over the pads (NATURE_CHANNEL in
# constants/pads.ts), not a pad voice of its own.
#
# The source is a full-length recording (an hour, in the case of the forest
# take); only the first LENGTH_SECONDS is shipped. A minute of ambience is long
# enough that the repetition isn't obvious and small enough to bundle -- the
# whole hour would add ~85MB to the app for material the ear can't distinguish
# from the first minute anyway.
#
# m4a/AAC, matching the pad clips: unlike the metronome clicks, nothing here
# depends on sample-accurate onset, so AAC's priming silence is harmless and
# the size saving over WAV is worth having in the bundle.
#
# No trimming or loop-point work is done on the tail. An arbitrary slice of a
# field recording will never butt-splice cleanly, so the engine crossfades the
# clip against a fresh copy of itself instead (startSelfCrossfadeLoop in
# context/PadPlaybackContext.tsx) and the seam is never heard. That also means
# this file does NOT need to be a perfect loop -- don't spend effort making it
# one.
#
# Usage: scripts/generate_nature.sh <source-audio-file>

set -euo pipefail

SOURCE="${1:?usage: generate_nature.sh <source-audio-file>}"
OUT_DIR="assets/audio/nature"
OUT="$OUT_DIR/forest_awakening.m4a"

LENGTH_SECONDS=60
SAMPLE_RATE=44100
BITRATE=160k

mkdir -p "$OUT_DIR"

ffmpeg -y -loglevel error \
  -i "$SOURCE" \
  -t "$LENGTH_SECONDS" \
  -vn \
  -map_metadata -1 \
  -ac 2 \
  -ar "$SAMPLE_RATE" \
  -c:a aac -b:a "$BITRATE" \
  "$OUT"

echo "wrote $OUT"
ffprobe -v error \
  -show_entries format=duration,bit_rate \
  -show_entries stream=codec_name,channels,sample_rate \
  -of default=noprint_wrappers=1 "$OUT"
