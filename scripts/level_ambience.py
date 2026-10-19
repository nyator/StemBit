"""Cut and level an ambience recording, for scripts/generate_nature.sh.

Reads a 16-bit WAV, keeps LENGTH seconds from START, and scales it so its
median loudness (per-second RMS on the left channel) lands on TARGET_DB --
the level the forest recording is mastered at. Every ambience then sits at the
same loudness before the mixer, so they all share one trim in
constants/pads.ts (0.2) instead of each needing its own number worked out by
ear.

Median rather than peak or mean: field recordings are mostly bed with the
odd loud call, and the bed is what has to match. A loud call is allowed
through; the gain is only held back if it would push a peak past PEAK_DB.

Usage: python3 level_ambience.py <in.wav> <out.wav> <start-seconds> <length-seconds>
"""

import array
import math
import sys
import wave

TARGET_DB = -23.0  # forest_awakening.m4a's median
PEAK_DB = -1.0


def per_second_db(samples, rate):
    out = []
    for start in range(0, len(samples) - rate, rate):
        chunk = samples[start : start + rate : 4]
        rms = math.sqrt(sum(x * x for x in chunk) / len(chunk)) / 32768
        out.append(20 * math.log10(max(rms, 1e-9)))
    return out


def main():
    src, dst, start_s, length_s = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])

    with wave.open(src) as w:
        if w.getsampwidth() != 2:
            sys.exit("expected 16-bit PCM")
        rate, channels = w.getframerate(), w.getnchannels()
        w.setpos(min(w.getnframes(), int(start_s * rate)))
        frames = w.readframes(int(length_s * rate))

    samples = array.array("h")
    samples.frombytes(frames)
    left = samples[0::channels]

    levels = sorted(per_second_db(left, rate))
    if not levels:
        sys.exit("too short to level")
    median = levels[len(levels) // 2]
    peak = max(abs(x) for x in samples) / 32768

    gain_db = TARGET_DB - median
    headroom_db = PEAK_DB - 20 * math.log10(max(peak, 1e-9))
    if gain_db > headroom_db:
        print(f"gain held at {headroom_db:+.1f} dB (wanted {gain_db:+.1f}) to keep peaks under {PEAK_DB} dBFS")
        gain_db = headroom_db
    gain = 10 ** (gain_db / 20)

    out = array.array("h", (max(-32768, min(32767, round(x * gain))) for x in samples))

    with wave.open(dst, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(out.tobytes())

    print(f"median {median:.1f} dB -> {median + gain_db:.1f} dB ({gain_db:+.1f} dB), {len(left) / rate:.0f}s kept")


if __name__ == "__main__":
    main()
