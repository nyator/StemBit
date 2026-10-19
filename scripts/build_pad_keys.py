"""Render a pad's 12 key clips from one recording in a known key.

    python3 scripts/build_pad_keys.py <source.wav> <source-root> <out-dir>
        [--level-like <clip.m4a>] [--seconds 30] [--kbps 96]

e.g.
    python3 scripts/build_pad_keys.py ~/Downloads/chimes-pad_D#_major.wav "D#" \\
        assets/audio/pads/chimes --level-like assets/audio/pads/generated/pad_C.m4a

The successor to generate_pads.sh for sources that aren't a long C master,
and it needs nothing but Python and macOS's afconvert. Four steps:

1. Bed. A short swell (a chime struck and left to ring) is too short to loop:
   the pad engine starts each pass 5s in and crossfades over the last 5.4s
   (context/PadPlaybackContext.tsx). So the source is laid end to end,
   each copy struck as the previous one starts to fade, into ~90s of
   continuous sound -- the way a player would keep re-striking it.

2. Keys. Each root is the bed transposed by its distance FROM THE SOURCE'S
   ROOT, nearest octave (-5..+6 semitones), by varispeed: the samples are
   relabelled with a faster or slower rate and resampled back to 44.1kHz
   (what generate_pads.sh does with asetrate+aresample). The app picks a clip
   per key rather than pitch-shifting at runtime -- AVPlayer's varispeed is
   unreliable on device. Minor keys play their relative major's clip, so a
   major source covers both.

3. Length and size. 30s at 96kbps AAC by default: about 350KB a clip, 4MB
   for all twelve, against 14MB at the 60s/160kbps the first pads shipped
   at. The engine loops the clip, so length past what a pass needs only buys
   a longer stretch before it repeats; 30s still leaves ~20s per pass after
   the 5s start offset and the 5.4s crossfade. A soft sustained pad loses
   nothing audible at 96kbps. The bed is built half as long again as the
   clip, since transposing up 6 semitones shortens it to 71%.

4. Check. Each clip's pitch-class energy is measured and compared with the
   bed's: the shift that lines the two up must be exactly the transposition
   asked for, so a clip filed under the wrong key fails the run rather than
   shipping. Compared against the source itself rather than "the best-fitting
   major scale", because a source with no third -- a bass note and its fifth,
   a drone -- fits three major scales equally well, and the check would fail
   clips that are right.
"""

import array
import math
import os
import subprocess
import sys
import tempfile
import wave

NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FILE_ROOT = {n: n.replace("#", "s") for n in NAMES}  # "C#" -> "Cs", as audio.js names them
RATE = 44100
# Set from --seconds / --kbps in main().
CLIP_SECONDS = 30
BED_SECONDS = 45
BITRATE = 96000
# Under this the engine's loop has no room: 5s start offset + 5.4s crossfade.
MIN_CLIP_SECONDS = 20


def read_wav(path):
    with wave.open(path) as w:
        if w.getsampwidth() != 2:
            sys.exit(f"{path}: expected 16-bit PCM")
        rate, channels = w.getframerate(), w.getnchannels()
        data = array.array("h")
        data.frombytes(w.readframes(w.getnframes()))
    if channels == 1:
        data = array.array("h", (v for v in data for _ in range(2)))
    return rate, data  # interleaved stereo


def write_wav(path, rate, data):
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(data.tobytes())


def frame_rms_db(data, rate, step_s=0.5):
    left = data[0::2]
    step = int(rate * step_s)
    out = []
    for s in range(0, len(left) - step, step):
        seg = left[s : s + step : 2]
        rms = math.sqrt(sum(v * v for v in seg) / len(seg)) / 32768
        out.append(20 * math.log10(max(rms, 1e-9)))
    return out


def build_bed(data, rate, period_s):
    """Copies of the source, one starting every period_s, summed."""
    frames = len(data) // 2
    period = int(period_s * rate)
    total = int(BED_SECONDS * rate) + frames
    acc = [0.0] * (total * 2)
    start = 0
    while start < BED_SECONDS * rate:
        base = start * 2
        for i in range(frames * 2):
            acc[base + i] += data[i]
        start += period
    acc = acc[: int(BED_SECONDS * rate) * 2]
    return acc


def to_int16(acc, gain):
    return array.array("h", (max(-32768, min(32767, round(v * gain))) for v in acc))


def choose_period(data, rate):
    """The re-strike spacing that keeps the bed's level steadiest."""
    best = None
    for tenths in range(50, 81, 5):  # 5.0s .. 8.0s; closer stacks three copies of one note, which phases
        period = tenths / 10
        bed = build_bed(data, rate, period)
        peak = max(abs(v) for v in bed) or 1
        levels = frame_rms_db(to_int16(bed, 32767 / peak * 0.5), rate)[6:-2]  # past the first attack
        spread = max(levels) - min(levels)
        print(f"  re-strike every {period:.1f}s: level varies {spread:.1f} dB")
        if best is None or spread < best[0]:
            best = (spread, period)
    return best[1]


def chroma(path):
    """Pitch-class energy, C2..B6, of a 16-bit WAV."""
    rate, data = read_wav(path)
    mono = [(data[i] + data[i + 1]) / 65536 for i in range(0, len(data) - 1, 2)]
    dec = 4
    x = [sum(mono[i : i + dec]) / dec for i in range(0, len(mono) - dec, dec)]
    fs = rate / dec
    seg = x[int(6 * fs) : int(18 * fs)]
    n = len(seg)
    seg = [s * (0.5 - 0.5 * math.cos(2 * math.pi * i / (n - 1))) for i, s in enumerate(seg)]
    out = [0.0] * 12
    for midi in range(36, 96):
        f = 440 * 2 ** ((midi - 69) / 12)
        if f > fs * 0.45:
            break
        k = 2 * math.cos(2 * math.pi * f / fs)
        s1 = s2 = 0.0
        for v in seg:
            s1, s2 = v + k * s1 - s2, s1
        out[midi % 12] += s1 * s1 + s2 * s2 - k * s1 * s2
    return out


def shift_between(source, clip):
    """How many semitones up `clip`'s pitch content sits from `source`'s."""
    def norm(v):
        m = math.sqrt(sum(x * x for x in v)) or 1
        return [x / m for x in v]
    a, b = norm(source), norm(clip)
    return max(range(12), key=lambda r: sum(a[i] * b[(i + r) % 12] for i in range(12)))


def median_db(path):
    rate, data = read_wav(path)
    levels = sorted(frame_rms_db(data, rate, 1.0))
    return levels[len(levels) // 2]


def run(*args):
    subprocess.run(args, check=True)


def take_option(args, name, default):
    if name not in args:
        return default
    i = args.index(name)
    value = args[i + 1]
    del args[i : i + 2]
    return value


def main():
    global CLIP_SECONDS, BED_SECONDS, BITRATE
    args = sys.argv[1:]
    CLIP_SECONDS = int(take_option(args, "--seconds", CLIP_SECONDS))
    if CLIP_SECONDS < MIN_CLIP_SECONDS:
        sys.exit(f"--seconds must be at least {MIN_CLIP_SECONDS} for the engine's loop")
    BED_SECONDS = math.ceil(CLIP_SECONDS * 1.5)
    BITRATE = int(take_option(args, "--kbps", BITRATE // 1000)) * 1000
    level_like = None
    if "--level-like" in args:
        i = args.index("--level-like")
        level_like = args[i + 1]
        del args[i : i + 2]
    src, src_root, out_dir = args
    if src_root not in NAMES:
        sys.exit(f"source root must be one of {NAMES}")
    root_index = NAMES.index(src_root)

    rate, data = read_wav(src)
    if rate != RATE:
        sys.exit(f"expected {RATE} Hz, got {rate}")

    print("Bed:")
    period = choose_period(data, rate)
    print(f"  using {period:.1f}s")
    bed = build_bed(data, rate, period)
    peak = max(abs(v) for v in bed) or 1
    gain = 32767 / peak * 10 ** (-1 / 20)  # -1 dBFS before any matching

    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as work:
        bed_wav = os.path.join(work, "bed.wav")
        write_wav(bed_wav, RATE, to_int16(bed, gain))

        if level_like:
            ref = os.path.join(work, "ref.wav")
            run("afconvert", "-f", "WAVE", "-d", f"LEI16@{RATE}", "-c", "2", level_like, ref)
            ref_db, bed_db = median_db(ref), median_db(bed_wav)
            # Only ever down: the bed is already at -1 dBFS peak.
            trim = min(1.0, 10 ** ((ref_db - bed_db) / 20))
            print(f"Level: bed {bed_db:.1f} dB, reference {ref_db:.1f} dB -> x{trim:.2f}")
            write_wav(bed_wav, RATE, to_int16(bed, gain * trim))

        _, bed_data = read_wav(bed_wav)
        source_chroma = chroma(bed_wav)
        print("Keys:")
        failures = []
        for index, root in enumerate(NAMES):
            # Distance from the SOURCE root, folded to the nearest octave.
            offset = (index - root_index) % 12
            if offset > 6:
                offset -= 12
            # Varispeed: claim the samples were recorded at a rate that plays
            # them `offset` semitones higher once resampled back to RATE.
            relabelled = round(RATE * 2 ** (offset / 12))
            tagged = os.path.join(work, f"tag_{index}.wav")
            shifted = os.path.join(work, f"shift_{index}.wav")
            write_wav(tagged, relabelled, bed_data)
            run("afconvert", "-f", "WAVE", "-d", f"LEI16@{RATE}", "-r", "127",
                "--src-complexity", "bats", tagged, shifted)

            _, shifted_data = read_wav(shifted)
            clip = shifted_data[: CLIP_SECONDS * RATE * 2]
            clip_wav = os.path.join(work, f"clip_{index}.wav")
            write_wav(clip_wav, RATE, clip)

            found = NAMES[(root_index + shift_between(source_chroma, chroma(clip_wav))) % 12]
            ok = found == root
            if not ok:
                failures.append(root)

            out = os.path.join(out_dir, f"pad_{FILE_ROOT[root]}.m4a")
            run("afconvert", "-f", "m4af", "-d", "aac", "-b", str(BITRATE), clip_wav, out)
            print(f"  {root:>2}: {offset:+d} semitones -> {os.path.basename(out)}"
                  f"  (reads as {found} {'OK' if ok else 'WRONG'})")

    if failures:
        sys.exit(f"keys that don't read as their own root: {', '.join(failures)}")
    print(f"All 12 keys check out -> {out_dir}")


if __name__ == "__main__":
    main()
