#!/usr/bin/env bash
# Regenerates the 12 chromatic pad clips from the single C major master.
# Each key is a nearest-octave transposition (window [-5, +6] semitones) of
# C_MAJOR_PAD.wav, rendered offline so the app never pitch-shifts at runtime
# (AVPlayer varispeed is unreliable on physical iOS devices).
#
# Usage:  bash scripts/generate_pads.sh [TRIM_SECONDS]
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="assets/audio/pads/C_MAJOR_PAD.wav"
OUT="assets/audio/pads/generated"
TRIM="${1:-30}"          # seconds of the master to use (it loops in-app)
BR="160k"                 # AAC bitrate
BASE=44100

mkdir -p "$OUT"

# root : semitone offset from C (nearest-octave window)
MAP="C:0 Cs:1 D:2 Ds:3 E:4 F:5 Fs:6 G:-5 Gs:-4 A:-3 As:-2 B:-1"

for pair in $MAP; do
  root="${pair%%:*}"; off="${pair##*:}"
  rate=$(awk -v b="$BASE" -v o="$off" 'BEGIN{printf "%d", b * (2 ^ (o/12.0)) + 0.5}')
  ffmpeg -y -loglevel error -i "$SRC" -t "$TRIM" \
    -af "asetrate=${rate},aresample=${BASE}" \
    -c:a aac -b:a "$BR" "$OUT/pad_${root}.m4a"
  echo "pad_${root}.m4a  (offset ${off} st, srcrate ${rate})"
done
echo "Done -> $OUT"
