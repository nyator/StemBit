#!/usr/bin/env bash
# Regenerates the metronome click kits in assets/audio/clicks from the raw DAW
# recordings. Each kit ships two voices: `beat` (the DAW's normal Metronome.wav)
# and `accent` (its MetronomeUp.wav). Output is mono 44.1kHz/16-bit WAV.
#
# WAV, not m4a: the metronome engine decodes each click with Web Audio's
# decodeAudioData (constants/metronomeEngine.ts). AAC prepends ~1-2k samples of
# priming silence, which would offset each click's onset inconsistently and smear
# timing. WAV/PCM has zero priming delay and decodes identically everywhere.
#
# Every click is peak-normalized to PEAK_DBFS so the kits sit at a consistent
# loudness with each other and with the "Basic" synthetic clicks (which peak
# near 0). Peak (not LUFS/RMS) because these clicks are far shorter than the
# 400ms EBU R128 gating window — integrated LUFS reads -inf for most of them —
# and peak normalization preserves the transient attack that IS the click,
# instead of pumping up decay tails and noise floors the way RMS matching would.
# Per-voice accent emphasis is applied at playback by the engine's gain stages,
# not baked into the sample levels.
#
# Usage:  bash scripts/generate_clicks.sh /path/to/"Metronome Sounds Collections"
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="${1:?usage: generate_clicks.sh <sounds-collection-dir>}"
OUT="assets/audio/clicks"
PEAK_DBFS="-1.0"          # target true peak; ~matches Basic with a little headroom
mkdir -p "$OUT"

# Trim leading silence so each transient fires exactly on the beat, then downmix
# to mono. Kept intentionally gentle (-60dB) so soft attacks survive.
AF="silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.001,aformat=channel_layouts=mono"

# Peak-normalize a WAV in place to PEAK_DBFS (measure max_volume, then apply the
# complementary gain — a lossless amplitude scale, no limiting/coloration).
normalize() {
  local file="$1"
  local peak
  peak=$(ffmpeg -i "$file" -af volumedetect -f null - 2>&1 \
    | grep -oE 'max_volume: [-0-9.]+' | grep -oE '[-0-9.]+$')
  [ -z "$peak" ] && return 0
  local gain
  gain=$(awk -v p="$peak" -v t="$PEAK_DBFS" 'BEGIN{printf "%.2f", t - p}')
  local tmp="${file%.wav}.norm.wav"
  ffmpeg -y -loglevel error -i "$file" -af "volume=${gain}dB" \
    -ac 1 -ar 44100 -sample_fmt s16 "$tmp"
  mv -f "$tmp" "$file"
}

# kit id : source subdirectory
MAP="ableton|Ableton (DEFAULT)
cubase|Cubase
fl|FL Studio
logic|Logic
maschine|Maschine
mpc|MPC
protools|Pro Tools/Default
marimba|Pro Tools/Marimba
reason|Reason
sonar|Sonar"

render() { # in-file  out-file  use_trim
  local af=""
  [ "$3" = "trim" ] && af="-af $AF"
  ffmpeg -y -loglevel error -i "$1" $af -ac 1 -ar 44100 -sample_fmt s16 "$2"
}

echo "$MAP" | while IFS='|' read -r kit sub; do
  # MPC clicks are ultra-short (~1-6ms) impulses; silence-trimming eats them, so
  # they're converted without the trim.
  trim="trim"; [ "$kit" = "mpc" ] && trim="notrim"
  render "$SRC/$sub/Metronome.wav"   "$OUT/${kit}_beat.wav"   "$trim"
  render "$SRC/$sub/MetronomeUp.wav" "$OUT/${kit}_accent.wav" "$trim"
  normalize "$OUT/${kit}_beat.wav"
  normalize "$OUT/${kit}_accent.wav"
  echo "${kit}: beat + accent (peak ${PEAK_DBFS} dBFS)"
done
echo "Done -> $OUT"
