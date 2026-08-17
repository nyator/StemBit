// Reading section markers out of a WAV file.
//
// DAWs that export markers into audio write them as RIFF chunks: a "cue " chunk
// holding sample offsets, and optionally a "LIST"/"adtl" chunk holding a label
// for each one. Both are documented parts of the format rather than anyone's
// private extension, so a file exported with markers can hand its sections over
// without the user placing a single one.
//
// Worth being clear about the limits, because it would be easy to build on this
// and be disappointed: many DAWs do not write cue chunks when exporting stems,
// and none of them write them into MP3 or AIFF, which this does not read at
// all. So this is a shortcut when it happens to work, never the mechanism --
// placing sections by hand on a waveform has to stay the reliable path.
//
// Parsing is deliberately defensive. These bytes come from an arbitrary file a
// user picked, and a malformed or truncated one must return "no markers" rather
// than throw into a screen mid-import.

export type WavMarker = {
  /** Seconds from the start of the file. */
  seconds: number;
  /** The label the DAW wrote, when there is one. */
  name?: string;
};

const RIFF = 0x52494646; // "RIFF"
const WAVE = 0x57415645; // "WAVE"

function readTag(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

/**
 * Section markers from a WAV file's own metadata, earliest first.
 *
 * Returns an empty array for anything that isn't a WAV, has no cue chunk, or is
 * damaged -- all of which mean the same thing to the caller: this file won't
 * tell us where its sections are, so ask the user.
 */
export function readWavMarkers(bytes: ArrayBuffer): WavMarker[] {
  try {
    const view = new DataView(bytes);
    if (view.byteLength < 12) return [];
    if (view.getUint32(0, false) !== RIFF) return [];
    if (view.getUint32(8, false) !== WAVE) return [];

    let sampleRate = 0;
    // cue point id -> sample offset
    const cues = new Map<number, number>();
    // cue point id -> label
    const labels = new Map<number, string>();

    // Chunks start after "RIFF" + size + "WAVE".
    let offset = 12;

    while (offset + 8 <= view.byteLength) {
      const tag = readTag(view, offset);
      const size = view.getUint32(offset + 4, true);
      const body = offset + 8;

      // A size that runs past the end means the file is truncated. Whatever has
      // been read so far is still usable; the rest isn't there.
      if (body + size > view.byteLength) break;

      if (tag === "fmt " && size >= 16) {
        sampleRate = view.getUint32(body + 4, true);
      } else if (tag === "cue ") {
        const count = view.getUint32(body, true);
        for (let i = 0; i < count; i++) {
          // Each cue point is 24 bytes: id, position, chunk id, chunk start,
          // block start, then the sample offset we actually want.
          const point = body + 4 + i * 24;
          if (point + 24 > body + size) break;
          const id = view.getUint32(point, true);
          const sampleOffset = view.getUint32(point + 20, true);
          cues.set(id, sampleOffset);
        }
      } else if (tag === "LIST" && size >= 4 && readTag(view, body) === "adtl") {
        // Labels live in "labl" sub-chunks inside the associated-data list.
        let sub = body + 4;
        while (sub + 8 <= body + size) {
          const subTag = readTag(view, sub);
          const subSize = view.getUint32(sub + 4, true);
          const subBody = sub + 8;
          if (subBody + subSize > body + size) break;

          if (subTag === "labl" && subSize >= 4) {
            const id = view.getUint32(subBody, true);
            let text = "";
            for (let i = 4; i < subSize; i++) {
              const code = view.getUint8(subBody + i);
              if (code === 0) break; // labels are null-terminated
              text += String.fromCharCode(code);
            }
            if (text) labels.set(id, text);
          }

          // Chunks are word-aligned: an odd size is followed by a pad byte.
          sub = subBody + subSize + (subSize % 2);
        }
      }

      offset = body + size + (size % 2);
    }

    if (!sampleRate || cues.size === 0) return [];

    const markers: WavMarker[] = [];
    cues.forEach((sampleOffset, id) => {
      markers.push({
        seconds: sampleOffset / sampleRate,
        name: labels.get(id),
      });
    });

    // In playing order, which is the order they'll be shown and launched in.
    return markers.sort((a, b) => a.seconds - b.seconds);
  } catch {
    // Anything unexpected in an arbitrary user file means "no markers", not a
    // crash partway through an import.
    return [];
  }
}

/** Decodes base64 audio to bytes, for handing to readWavMarkers. */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = global.atob
    ? global.atob(base64)
    : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
