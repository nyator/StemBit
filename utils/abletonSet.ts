import { gunzipSync, strFromU8 } from "fflate";

import type { CueSection } from "../context/SessionsContext";

// Reading an Ableton Live Set (.als) for the parts of it a song on stage needs:
// where its sections are, what tempo it runs at, and where each audio file sits
// on the arrangement.
//
// An .als is gzipped XML. It carries no audio -- only references to files on
// the producer's machine -- so it arrives alongside the stems rather than
// instead of them, and the stems are matched to its clips by file name.
//
// What it is good for, in order of how much it matters:
//
//   1. Locators. The markers a producer drops on the arrangement -- "Intro",
//      "Verse", "Chorus" -- are exactly the sections a section pad launches,
//      and placing them by hand on a phone is the slowest part of setting a
//      song up. Exported stems never carry them; the set always does.
//   2. Tempo, including automation, which is what turns a locator's position
//      in beats into the seconds the engine seeks to.
//   3. Clip placement. A stem that starts at bar 9 in the arrangement starts
//      at bar 9 in the app too, instead of at the top with everything else.
//
// The limits are worth stating so nothing gets built on them by mistake. A
// warped clip is placed by where its first sample lands, but the app does not
// time-stretch, so a clip warped away from its own recorded tempo will drift
// from that point on. A file used by several clips is placed once, by the
// earliest. Both are rare in the multitrack songs this is for, which are
// recorded to the grid and laid out from bar 1.
//
// Parsing is defensive for the same reason the WAV marker reader is: the bytes
// come from whatever file the user picked. Anything malformed yields an empty
// set, never a throw into an import.

export type AbletonLocator = {
  name: string;
  /** Seconds from the start of the arrangement. */
  seconds: number;
};

export type AbletonClip = {
  /** The audio file the clip plays, as the set names it: "Drums.wav". */
  fileName: string;
  /**
   * Where the file's first sample falls on the song's timeline, in seconds.
   *
   * Not where the clip starts: a clip trimmed to begin 2s into its file and
   * placed at 10s puts the file's start at 8s, and that is the number that
   * lines the file up with everything else. Negative when the trimmed-off part
   * would sit before the song began.
   */
  startSeconds: number;
};

export type AbletonSet = {
  /** Tempo at the start of the arrangement. */
  bpm: number;
  /** Earliest first. */
  locators: AbletonLocator[];
  /** One per audio file, by its earliest placement. */
  clips: AbletonClip[];
};

const EMPTY_SET: AbletonSet = { bpm: 0, locators: [], clips: [] };

/* -------------------------------------------------------------------------- */
/* Tempo                                                                       */
/* -------------------------------------------------------------------------- */

type TempoPoint = { beat: number; bpm: number };

/** The tempo in force at `beat`: straight between breakpoints, held past them. */
export function tempoAt(beat: number, tempo: TempoPoint[]): number {
  if (tempo.length === 0) return 0;
  if (beat <= tempo[0].beat) return tempo[0].bpm;
  for (let i = 0; i < tempo.length - 1; i++) {
    const a = tempo[i];
    const b = tempo[i + 1];
    if (beat > b.beat) continue;
    if (b.beat === a.beat) return b.bpm;
    return a.bpm + ((b.bpm - a.bpm) * (beat - a.beat)) / (b.beat - a.beat);
  }
  return tempo[tempo.length - 1].bpm;
}

/**
 * Seconds from beat 0 to `beat`, under a tempo that may change.
 *
 * Live draws tempo automation as straight lines between breakpoints, so
 * between two of them the tempo is linear in beats and the time taken is the
 * integral of 60 / bpm -- a logarithm, not the average of the two ends. Two
 * breakpoints at the same beat are a jump, which falls out of the same sum as
 * a segment of zero length.
 *
 * Before the first breakpoint and after the last, the tempo holds.
 */
export function beatsToSeconds(beat: number, tempo: TempoPoint[]): number {
  if (tempo.length === 0 || beat <= 0) return 0;

  let seconds = 0;
  const span = (from: number, to: number, bpmFrom: number, bpmTo: number) => {
    if (to <= from) return;
    if (Math.abs(bpmTo - bpmFrom) < 1e-9) {
      seconds += ((to - from) * 60) / bpmFrom;
    } else {
      seconds +=
        ((to - from) * 60 * Math.log(bpmTo / bpmFrom)) / (bpmTo - bpmFrom);
    }
  };

  const bpmAt = (index: number, at: number) => {
    const a = tempo[index];
    const b = tempo[index + 1];
    if (!b || b.beat === a.beat) return a.bpm;
    return a.bpm + ((b.bpm - a.bpm) * (at - a.beat)) / (b.beat - a.beat);
  };

  // Held at the first value up to the first breakpoint.
  const first = tempo[0];
  if (first.beat > 0) {
    span(0, Math.min(beat, first.beat), first.bpm, first.bpm);
  }

  for (let i = 0; i < tempo.length; i++) {
    const from = Math.max(0, tempo[i].beat);
    const next = tempo[i + 1];
    // Held at the last value past the last breakpoint.
    const to = Math.min(beat, next ? next.beat : Infinity);
    if (to <= from) continue;
    span(from, to, bpmAt(i, from), next ? bpmAt(i, to) : tempo[i].bpm);
  }

  return seconds;
}

/* -------------------------------------------------------------------------- */
/* Warping                                                                     */
/* -------------------------------------------------------------------------- */

type WarpMarker = { beat: number; seconds: number };

/**
 * Seconds into the audio file at a point in clip time.
 *
 * An unwarped clip's own time is already seconds. A warped clip's is beats,
 * mapped onto the file by its warp markers, straight between neighbours and
 * extended past the ends along the nearest pair.
 */
function fileSecondsAt(
  clipTime: number,
  warped: boolean,
  markers: WarpMarker[],
  fallbackBpm: number
): number {
  if (!warped) return clipTime;
  if (markers.length === 0) return (clipTime * 60) / fallbackBpm;
  if (markers.length === 1) {
    const only = markers[0];
    return only.seconds + ((clipTime - only.beat) * 60) / fallbackBpm;
  }

  let i = 0;
  while (i < markers.length - 2 && clipTime > markers[i + 1].beat) i++;
  const a = markers[i];
  const b = markers[i + 1];
  if (b.beat === a.beat) return a.seconds;
  return a.seconds + ((b.seconds - a.seconds) * (clipTime - a.beat)) / (b.beat - a.beat);
}

/* -------------------------------------------------------------------------- */
/* XML                                                                         */
/* -------------------------------------------------------------------------- */

// A full XML parser would be a dependency for the sake of reading a few dozen
// attributes out of a file that is otherwise all device state. Live writes
// every value it stores as a Value="..." attribute on an element of its own,
// so a tag scanner that keeps track of where it is in the tree is all this
// needs.

const TAG = /<(\/?)([A-Za-z_][\w.-]*)((?:\s+[\w.:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
const ATTRIBUTE = /([\w.:-]+)\s*=\s*"([^"]*)"/g;

function decodeEntities(text: string): string {
  if (text.indexOf("&") === -1) return text;
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, code) => {
    switch (code.toLowerCase()) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
    }
    const point =
      code[1] === "x" || code[1] === "X"
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
    return Number.isFinite(point) ? String.fromCodePoint(point) : "";
  });
}

function attributesOf(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  ATTRIBUTE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTRIBUTE.exec(source))) {
    attributes[match[1]] = decodeEntities(match[2]);
  }
  return attributes;
}

/** True when `stack` ends with `tail`, outermost first. */
function endsWith(stack: string[], tail: string[]): boolean {
  if (stack.length < tail.length) return false;
  const offset = stack.length - tail.length;
  for (let i = 0; i < tail.length; i++) {
    if (stack[offset + i] !== tail[i]) return false;
  }
  return true;
}

function numberOf(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** "C:/Music/Song/Samples/Drums.wav" -> "Drums.wav", either slash. */
function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

type RawClip = {
  time?: number;
  loopStart?: number;
  startRelative?: number;
  warped?: boolean;
  markers: WarpMarker[];
  fileName?: string;
  path?: string;
};

type RawEnvelope = { pointee?: string; events: TempoPoint[] };

// The tracks that own the song tempo. Live 12 renamed the master track.
const MASTER_TRACKS = new Set(["MasterTrack", "MainTrack"]);

/**
 * A set's locators, tempo and clip placements, from its XML.
 *
 * Exported apart from the gunzip so it can be tested against XML written out
 * in the test, without a compressed fixture standing between the test and the
 * structure it is checking.
 */
export function parseAbletonSetXml(xml: string): AbletonSet {
  try {
    const stack: string[] = [];

    const locators: { name?: string; beat?: number; songStart?: boolean }[] = [];
    let locatorDepth = -1;

    let manualBpm: number | undefined;
    let tempoTarget: string | undefined;
    const envelopes: RawEnvelope[] = [];
    let envelopeDepth = -1;

    const clips: RawClip[] = [];
    let clipDepth = -1;

    // Index of the master track in the stack, or -1 when outside it.
    let masterDepth = -1;

    const open = (name: string, attributes: Record<string, string>) => {
      const value = attributes.Value;

      if (MASTER_TRACKS.has(name) && endsWith(stack, ["LiveSet"])) {
        masterDepth = stack.length;
      }

      // ---- locators
      if (name === "Locator" && endsWith(stack, ["Locators", "Locators"])) {
        locators.push({});
        locatorDepth = stack.length;
        return;
      }
      if (locatorDepth !== -1 && stack.length === locatorDepth + 1) {
        const locator = locators[locators.length - 1];
        if (name === "Time") locator.beat = numberOf(value);
        else if (name === "Name") locator.name = value;
        else if (name === "IsSongStart") locator.songStart = value === "true";
        return;
      }

      // ---- tempo
      if (masterDepth !== -1) {
        if (endsWith(stack, ["Mixer", "Tempo"])) {
          if (name === "Manual") manualBpm = numberOf(value);
          else if (name === "AutomationTarget") tempoTarget = attributes.Id;
          return;
        }
        if (name === "AutomationEnvelope" && endsWith(stack, ["AutomationEnvelopes", "Envelopes"])) {
          envelopes.push({ events: [] });
          envelopeDepth = stack.length;
          return;
        }
        if (envelopeDepth !== -1) {
          const envelope = envelopes[envelopes.length - 1];
          if (name === "PointeeId" && endsWith(stack, ["EnvelopeTarget"])) {
            envelope.pointee = value;
          } else if (name === "FloatEvent" && endsWith(stack, ["Automation", "Events"])) {
            const beat = numberOf(attributes.Time);
            const bpm = numberOf(value);
            if (beat !== undefined && bpm !== undefined && bpm > 0) {
              envelope.events.push({ beat, bpm });
            }
          }
          return;
        }
      }

      // ---- arrangement clips
      //
      // Only the main sequencer's: the same AudioClip element also turns up in
      // session-view clip slots, in frozen copies and in take lanes, none of
      // which are what the arrangement plays.
      if (
        name === "AudioClip" &&
        endsWith(stack, ["MainSequencer", "Sample", "ArrangerAutomation", "Events"])
      ) {
        clips.push({ time: numberOf(attributes.Time), markers: [] });
        clipDepth = stack.length;
        return;
      }
      if (clipDepth !== -1) {
        const clip = clips[clips.length - 1];
        const path = stack.slice(clipDepth + 1).concat(name).join("/");
        switch (path) {
          case "CurrentStart":
            if (clip.time === undefined) clip.time = numberOf(value);
            break;
          case "Loop/LoopStart":
            clip.loopStart = numberOf(value);
            break;
          case "Loop/StartRelative":
            clip.startRelative = numberOf(value);
            break;
          case "IsWarped":
            clip.warped = value === "true";
            break;
          case "WarpMarkers/WarpMarker": {
            const beat = numberOf(attributes.BeatTime);
            const seconds = numberOf(attributes.SecTime);
            if (beat !== undefined && seconds !== undefined) {
              clip.markers.push({ beat, seconds });
            }
            break;
          }
          // Live 10 names the file outright; 11 and later give paths.
          case "SampleRef/FileRef/Name":
            if (value) clip.fileName = value;
            break;
          case "SampleRef/FileRef/Path":
          case "SampleRef/FileRef/RelativePath":
            if (value && !clip.path) clip.path = value;
            break;
        }
      }
    };

    const close = () => {
      stack.pop();
      if (stack.length <= locatorDepth) locatorDepth = -1;
      if (stack.length <= envelopeDepth) envelopeDepth = -1;
      if (stack.length <= clipDepth) clipDepth = -1;
      if (stack.length <= masterDepth) masterDepth = -1;
    };

    TAG.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TAG.exec(xml))) {
      const [, closing, name, rawAttributes, selfClosing] = match;
      if (closing) {
        // Tolerates a mismatched close by unwinding to the element it names,
        // rather than drifting one level out of step for the rest of the file.
        const at = stack.lastIndexOf(name);
        if (at === -1) continue;
        while (stack.length > at) close();
        continue;
      }
      open(name, attributesOf(rawAttributes));
      stack.push(name);
      if (selfClosing) close();
    }

    // ---- tempo map
    let tempo: TempoPoint[] = [];
    const tempoEnvelope = envelopes.find(
      (envelope) => tempoTarget !== undefined && envelope.pointee === tempoTarget
    );
    if (tempoEnvelope && tempoEnvelope.events.length > 0) {
      // Live stores the value in force before any breakpoint as an event far
      // before zero, so sorting puts it first and it governs beat 0 onwards.
      tempo = [...tempoEnvelope.events].sort((a, b) => a.beat - b.beat);
    } else if (manualBpm && manualBpm > 0) {
      tempo = [{ beat: 0, bpm: manualBpm }];
    }
    if (tempo.length === 0) return EMPTY_SET;

    const bpmAtZero = tempoAt(0, tempo);

    // ---- sections
    const placed = locators
      .filter(
        (locator): locator is { name?: string; beat: number; songStart?: boolean } =>
          locator.beat !== undefined && locator.beat >= 0 && !locator.songStart
      )
      .map((locator) => ({
        name: (locator.name ?? "").trim(),
        seconds: beatsToSeconds(locator.beat, tempo),
      }))
      .sort((a, b) => a.seconds - b.seconds);

    // ---- clip placement, earliest per file
    const byFile = new Map<string, AbletonClip & { at: number }>();
    for (const clip of clips) {
      const fileName = clip.fileName ?? (clip.path ? baseName(clip.path) : undefined);
      if (!fileName || clip.time === undefined) continue;

      const songSeconds = beatsToSeconds(clip.time, tempo);
      const clipStart = (clip.loopStart ?? 0) + (clip.startRelative ?? 0);
      const intoFile = fileSecondsAt(
        clipStart,
        clip.warped ?? false,
        [...clip.markers].sort((a, b) => a.beat - b.beat),
        bpmAtZero
      );

      const key = fileName.toLowerCase();
      const existing = byFile.get(key);
      if (existing && existing.at <= songSeconds) continue;
      byFile.set(key, {
        fileName,
        startSeconds: songSeconds - intoFile,
        at: songSeconds,
      });
    }

    return {
      bpm: Math.round(bpmAtZero * 100) / 100,
      locators: placed,
      clips: [...byFile.values()]
        .sort((a, b) => a.at - b.at)
        .map(({ fileName, startSeconds }) => ({ fileName, startSeconds })),
    };
  } catch {
    return EMPTY_SET;
  }
}

/**
 * A set from the bytes of an .als file.
 *
 * Gzipped is what Live writes; plain XML is accepted too, since it's what you
 * get from anyone who unpacked one to look inside and saved it back.
 */
export function parseAbletonSet(bytes: Uint8Array): AbletonSet {
  try {
    const gzipped = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    const xml = strFromU8(gzipped ? gunzipSync(bytes) : bytes);
    return parseAbletonSetXml(xml);
  } catch {
    return EMPTY_SET;
  }
}

/* -------------------------------------------------------------------------- */
/* Into the app's shapes                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Locators as sections: each runs to the next, the last to the end of the song.
 *
 * Two locators on the same spot become one section rather than a pad that
 * plays nothing. A locator with no name gets the same "Section n" a WAV marker
 * without a label does.
 */
export function sectionsFromLocators(locators: AbletonLocator[]): CueSection[] {
  const distinct = locators.filter(
    (locator, index) =>
      index === 0 || Math.abs(locator.seconds - locators[index - 1].seconds) > 0.001
  );
  const stamp = Date.now();
  return distinct.map((locator, index) => ({
    id: `${stamp}-${index}`,
    name: locator.name || `Section ${index + 1}`,
    startSeconds: locator.seconds,
    endSeconds: distinct[index + 1]?.seconds,
  }));
}

/** "01 Drums.WAV" -> "01 drums": what a file and a clip are matched on. */
export function matchKey(fileName: string): string {
  return baseName(fileName).replace(/\.[^.]+$/, "").trim().toLowerCase();
}

/**
 * Where the set places a file, matched on its name without the extension.
 *
 * Undefined when the set doesn't use it -- stems rendered with "Export Audio"
 * are new files the set has never heard of, and they start at the top, which
 * is where an export from bar 1 belongs.
 */
export function placementFor(set: AbletonSet, fileName: string): number | undefined {
  const key = matchKey(fileName);
  const clip = set.clips.find((each) => matchKey(each.fileName) === key);
  return clip?.startSeconds;
}
