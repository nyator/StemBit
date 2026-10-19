#!/usr/bin/env bash
# Renders an ambience pack (forest, birds, a room at prayer) into
# assets/audio/nature from a raw field recording. Each is a pack in
# constants/pads.ts with kind "ambience", stacked in the mixer like a pad.
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
# Levelled on the way through (scripts/level_ambience.py): every ambience is
# brought to the forest recording's loudness, so they all share the one trim
# in constants/pads.ts rather than each needing a number found by ear.
#
# Uses ffmpeg when it's installed and macOS's own afconvert when it isn't.
#
# Usage: scripts/generate_nature.sh <source-audio-file> <name> [start-seconds]
#   e.g. scripts/generate_nature.sh ~/Downloads/dawn-chorus.wav birds
#   writes assets/audio/nature/birds.m4a

set -euo pipefail

SOURCE="${1:?usage: generate_nature.sh <source-audio-file> <name> [start-seconds]}"
NAME="${2:?usage: generate_nature.sh <source-audio-file> <name> [start-seconds]}"
START_SECONDS="${3:-0}"
OUT_DIR="assets/audio/nature"
OUT="$OUT_DIR/$NAME.m4a"

LENGTH_SECONDS=60
SAMPLE_RATE=44100
BITRATE=160000

mkdir -p "$OUT_DIR"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Decode to 16-bit stereo WAV, level and cut it, then encode.
if command -v ffmpeg >/dev/null; then
  ffmpeg -y -loglevel error -i "$SOURCE" -vn -ac 2 -ar "$SAMPLE_RATE" \
    -c:a pcm_s16le "$WORK/decoded.wav"
else
  afconvert -f WAVE -d "LEI16@$SAMPLE_RATE" -c 2 "$SOURCE" "$WORK/decoded.wav"
fi

python3 -I "$(dirname "$0")/level_ambience.py" \
  "$WORK/decoded.wav" "$WORK/levelled.wav" "$START_SECONDS" "$LENGTH_SECONDS"

if command -v ffmpeg >/dev/null; then
  ffmpeg -y -loglevel error -i "$WORK/levelled.wav" -map_metadata -1 \
    -c:a aac -b:a "$BITRATE" "$OUT"
else
  afconvert -f m4af -d aac -b "$BITRATE" "$WORK/levelled.wav" "$OUT"
fi

echo "wrote $OUT"
afinfo "$OUT" 2>/dev/null | grep -E "duration|Data format" || true
