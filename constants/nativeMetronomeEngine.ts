// The metronome engine on native audio, as an alternative to the WebView one
// in metronomeEngine.ts. Behind a preference (Settings -> Native metronome)
// while it's being proven: the WebView engine stays the default.
//
// Same timing model, same messages. What made the WebView engine accurate was
// never the WebView -- it was Web Audio's lookahead scheduler: a coarse timer
// wakes up every ~25ms and places each upcoming click on the hardware audio
// clock with source.start(time). react-native-audio-api is that same Web Audio
// API implemented natively, so the scheduler below is the page's scheduler
// moved across nearly line for line. Clicks are still placed on the audio
// clock, never fired from a JS timer, so JS-thread jitter can delay when a
// click is SCHEDULED but not when it SOUNDS.
//
// What changes is where the audio lives. The WebView's AudioContext belongs
// to WebKit, which suspends it whenever the app leaves the foreground and
// mutes it with the ringer switch. This one belongs to the app's own audio
// session -- the one Pad already plays through -- so it keeps going in the
// background and ignores the switch.
//
// The one real difference from the page: the timer here runs on the React
// Native JS thread, which a heavy render can hold up for longer than a WebView
// timer ever was. A click whose time has already passed when the scheduler
// gets to it would be late, so the horizon is wider (see SCHEDULE_AHEAD) --
// a tempo change takes up to that long to be heard, which nobody notices at
// 150ms.
//
// The host talks to it exactly as it talks to the page: post() takes the same
// messages, and onMessage gets the same "ready" / "beat" / "pong" / "error"
// replies.
import type {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioContext,
} from "react-native-audio-api";

// Loaded lazily -- see utils/nativeAudio.ts for why nothing imports it directly.
import { getAudioApi } from "../utils/nativeAudio";
import { setNativeAudioSession } from "../utils/nativeEngineHost";

type EngineReply =
  | { type: "ready" }
  | { type: "pong" }
  | { type: "beat"; beat: number }
  | { type: "error"; message: string };

type EngineMessage = { type: string; [key: string]: unknown };

/** How far ahead clicks are placed on the audio clock, while on screen. */
const SCHEDULE_AHEAD = 0.15;
/**
 * ...and while the app is in the background, where iOS can stretch the JS
 * thread's timers out. Nobody changes the tempo from the lock screen, so the
 * slower response costs nothing.
 */
const SCHEDULE_AHEAD_BACKGROUND = 1.0;
const LOOKAHEAD_MS = 25;
/** Web Audio drops times in the past; ~2ms is enough headroom. */
const MIN_SCHEDULE_LEAD = 0.002;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export class NativeMetronomeEngine {
  private context: AudioContext | null = null;
  private buffers: Partial<Record<"accent" | "beat", AudioBuffer>> = {};
  private disposed = false;

  private isPlaying = false;
  private tempo = 120;
  private speedMultiplier = 1;
  private pendingMultiplier: number | null = null;
  private beatsPerMeasure = 4;
  private accents: number[] = [0];
  private accentVolume = 1;
  private beatVolume = 1;
  private masterVolume = 1;
  private currentBeatNumber = 0;
  private nextNoteTime = 0;
  private scheduleAhead = SCHEDULE_AHEAD;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private scheduledSources: AudioBufferSourceNode[] = [];
  private beatTimeouts: ReturnType<typeof setTimeout>[] = [];

  constructor(
    private readonly sounds: Record<"accent" | "beat", number>,
    private readonly onMessage: (reply: EngineReply) => void
  ) {
    this.load();
  }

  /** Same messages the WebView page takes -- see handleMessage there. */
  post(message: EngineMessage) {
    if (this.disposed) return;
    switch (message.type) {
      case "start":
        this.start(message);
        break;
      case "stop":
        this.stop();
        break;
      case "setFeel":
        this.setFeel(message.multiplier);
        break;
      case "setVolumes":
        this.setVolumes(message.accentVolume, message.beatVolume, message.masterVolume);
        break;
      case "setTempo":
        if (typeof message.bpm === "number") this.tempo = message.bpm;
        break;
      case "setBeats":
        if (typeof message.beats === "number") this.beatsPerMeasure = message.beats;
        this.setAccents(message.accents);
        this.currentBeatNumber = 0;
        break;
      case "resume":
        this.resume();
        break;
      case "setMixWithOthers":
        // Native always mixes -- see setNativeAudioSession. Taken and ignored
        // so the host can keep sending the page's messages unchanged.
        break;
      case "setBackground":
        this.scheduleAhead = message.background
          ? SCHEDULE_AHEAD_BACKGROUND
          : SCHEDULE_AHEAD;
        break;
      case "ping":
        this.onMessage({ type: "pong" });
        break;
      default:
        break;
    }
  }

  dispose() {
    this.stop();
    this.disposed = true;
    this.context?.close().catch(() => {});
    this.context = null;
  }

  private async load() {
    try {
      // Before the context exists, so its first activation already mixes.
      setNativeAudioSession();
      this.context = new (getAudioApi().AudioContext)();
      const [accent, beat] = await Promise.all([
        this.context.decodeAudioData(this.sounds.accent),
        this.context.decodeAudioData(this.sounds.beat),
      ]);
      if (this.disposed) return;
      this.buffers = { accent, beat };
      this.onMessage({ type: "ready" });
    } catch (error) {
      this.onMessage({
        type: "error",
        message: `native metronome failed to load: ${String(error)}`,
      });
    }
  }

  private resume() {
    const ctx = this.context;
    if (!ctx || ctx.state === "running" || ctx.state === "closed") return;
    ctx.resume().catch(() => {});
  }

  private setAccents(next: unknown) {
    this.accents =
      Array.isArray(next) && next.length > 0 ? (next as number[]) : [0];
  }

  private setVolumes(accent: unknown, beat: unknown, master: unknown) {
    if (typeof accent === "number") this.accentVolume = clamp(accent, 0, 1);
    if (typeof beat === "number") this.beatVolume = clamp(beat, 0, 1);
    // Up to 2, as on the page: see METRONOME_MAX_VOLUME.
    if (typeof master === "number") this.masterVolume = clamp(master, 0, 2);
  }

  private setFeel(multiplier: unknown) {
    if (typeof multiplier !== "number") return;
    if (this.isPlaying) {
      this.pendingMultiplier = multiplier;
    } else {
      this.speedMultiplier = multiplier;
      this.pendingMultiplier = null;
    }
  }

  private start(message: EngineMessage) {
    const ctx = this.context;
    if (this.isPlaying || !ctx) return;
    if (typeof message.bpm === "number") this.tempo = message.bpm;
    if (typeof message.multiplier === "number") {
      this.speedMultiplier = message.multiplier;
    }
    this.pendingMultiplier = null;
    if (typeof message.beats === "number") this.beatsPerMeasure = message.beats;
    if (message.accents) this.setAccents(message.accents);
    this.setVolumes(message.accentVolume, message.beatVolume, message.masterVolume);
    this.currentBeatNumber = 0;
    this.isPlaying = true;

    const begin = () => {
      if (!this.isPlaying) return; // stopped while resuming
      this.nextNoteTime = ctx.currentTime + MIN_SCHEDULE_LEAD;
      this.scheduler();
    };
    // A suspended context has a frozen clock; read it after the resume, or
    // the first click lands in the past and is dropped. Whichever comes
    // first, as on the page: a resume another app is holding up can stay
    // pending rather than settle.
    if (ctx.state === "running") {
      begin();
      return;
    }
    let begun = false;
    const beginOnce = () => {
      if (begun) return;
      begun = true;
      begin();
    };
    ctx.resume().then(beginOnce, beginOnce);
    setTimeout(beginOnce, 300);
  }

  private stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.scheduledSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // already ended
      }
    });
    this.scheduledSources = [];
    this.beatTimeouts.forEach(clearTimeout);
    this.beatTimeouts = [];
  }

  private scheduler = () => {
    const ctx = this.context;
    if (!this.isPlaying || !ctx) return;
    while (this.nextNoteTime < ctx.currentTime + this.scheduleAhead) {
      // A queued feel change governs the bar that's about to start, never
      // the middle of one.
      if (this.currentBeatNumber === 0 && this.pendingMultiplier !== null) {
        this.speedMultiplier = this.pendingMultiplier;
        this.pendingMultiplier = null;
      }
      this.scheduleNote(this.currentBeatNumber, this.nextNoteTime);
      this.nextNoteTime += 60 / (this.tempo * this.speedMultiplier);
      this.currentBeatNumber = (this.currentBeatNumber + 1) % this.beatsPerMeasure;
    }
    this.timerId = setTimeout(this.scheduler, LOOKAHEAD_MS);
  };

  private scheduleNote(beatNumber: number, time: number) {
    const ctx = this.context;
    if (!ctx) return;
    const isPrimaryAccent = beatNumber === 0;
    const isSecondaryAccent =
      !isPrimaryAccent && this.accents.includes(beatNumber);
    const isAccentVoice = isPrimaryAccent || isSecondaryAccent;
    // The other voice's sample if one failed to decode: a click in the wrong
    // colour beats a bar with a hole in it.
    const buffer =
      (isAccentVoice ? this.buffers.accent : this.buffers.beat) ??
      this.buffers.accent ??
      this.buffers.beat;
    const gain = isPrimaryAccent
      ? this.accentVolume
      : isSecondaryAccent
        ? 0.6 * this.accentVolume
        : this.beatVolume;

    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = gain * this.masterVolume;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.onEnded = () => {
        const index = this.scheduledSources.indexOf(source);
        if (index !== -1) this.scheduledSources.splice(index, 1);
      };
      // Never in the past -- a scheduler held up past this click's time plays
      // it at once rather than not at all.
      source.start(Math.max(time, ctx.currentTime));
      this.scheduledSources.push(source);
    }

    // The screen's beat light. Only visual, so a timer is fine here.
    const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
    const timeout = setTimeout(() => {
      const index = this.beatTimeouts.indexOf(timeout);
      if (index !== -1) this.beatTimeouts.splice(index, 1);
      this.onMessage({ type: "beat", beat: beatNumber });
    }, delayMs);
    this.beatTimeouts.push(timeout);
  }
}
