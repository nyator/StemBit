import audio from "./audio";

/**
 * What a pack is, which decides how it answers a key press.
 *
 *   pad      -- a tonal drone, one clip per root; the key picks the clip.
 *   ambience -- a recording with no pitch to speak of: birds, a forest, a
 *               room at prayer. One clip, played whatever the key, and left
 *               running across a key change rather than restarted -- a forest
 *               doesn't start again because the song modulated.
 *
 * Both are loaded, mixed and muted the same way, which is the point: ambience
 * used to be one fixed "Nature" strip with its own rules, and now any number
 * of them can be stacked with the pads and with each other.
 */
export type PadKind = "pad" | "ambience";

export const PAD_KIND_LABEL: Record<PadKind, string> = {
  pad: "Pads",
  ambience: "Ambience",
};

export type PadPack = {
  key: string;
  title: string;
  artist: string;
  genre: string;
  kind: PadKind;
  /**
   * One clip per chromatic root, keyed "C", "C#", ... The engine picks the
   * right root rather than pitch-shifting at runtime.
   *
   * Most packs still point at the SAME generated set
   * (assets/audio/pads/generated, one master rendered to 12 roots), so
   * layering two of those sounds like one pad. Chimes is the first with its
   * own recording; scripts/build_pad_keys.py renders a new one from a source
   * in any key.
   */
  sources: Record<string, number>;
  /**
   * Fixed input trim, applied before the fader; 1 when absent.
   *
   * For field recordings mastered far hotter than the pads: the forest take at
   * full scale drowned the instrument it's meant to sit under. 0.2 caps it at
   * a fifth and gives the whole fader throw back as usable range -- ambience
   * that can be picked out as a track is ambience turned up too far.
   *
   * Engine-side, like padBusScale: the strip reads out its fader position,
   * because that's what the fader is doing. Trim is the desk's business.
   */
  trim?: number;
};

/** The one clip an ambience pack plays, whatever the key. */
const ambience = (source: number) => ({ C: source });

/**
 * How many packs the mixer holds at once.
 *
 * Four: the three pads it used to hold plus the strip the fixed Nature
 * channel took, so the mixer keeps its width now that ambience shares the
 * same slots.
 */
export const MAX_PAD_LAYERS = 4;

// The catalog shown on the "Select Pad" screen (Figma node 108:651).
//
// Adding an ambience: render it with scripts/generate_nature.sh, add it to
// constants/audio.js, and give it an entry below with kind "ambience".
export const PAD_PACKS: PadPack[] = [
  { key: "drone-pad", title: "Drone Pad", artist: "DJ Koda", genre: "Lo-Fi", kind: "pad", sources: audio.pads },
  { key: "ocean-waves", title: "Ocean Waves", artist: "Aqua Beats", genre: "Chillhop", kind: "pad", sources: audio.pads },
  { key: "sunset-vibes", title: "Sunset Vibes", artist: "Mellow Tune", genre: "Ambient", kind: "pad", sources: audio.pads },
  { key: "city-lights", title: "City Lights", artist: "Urban Echo", genre: "Jazz", kind: "pad", sources: audio.pads },
  { key: "forest-whispers", title: "Forest Whispers", artist: "Nature Sounds", genre: "Relaxing", kind: "pad", sources: audio.pads },
  // Its own recording, unlike the five above: a D# major chime swell, made
  // into twelve keys by scripts/build_pad_keys.py, which checks each clip
  // reads as the key it's filed under.
  { key: "chimes", title: "Chimes", artist: "StemBits", genre: "Ambient", kind: "pad", sources: audio.chimes },
  // One bowed bass note -- a C and its fifth, no third -- so it sits under a
  // major or a minor key alike. Rendered the same way as Chimes.
  { key: "sad-bass-string", title: "Sad Bass String", artist: "StemBits", genre: "Strings", kind: "pad", sources: audio.sadBass },
  // The old Nature channel's recording. Its key is "nature" so a mix saved
  // with that channel unmuted carries over as this pack -- see
  // PreferencesContext's migration.
  {
    key: "nature",
    title: "Forest at Dawn",
    artist: "Field Recording",
    genre: "Forest",
    kind: "ambience",
    sources: ambience(audio.nature_forest as number),
    trim: 0.2,
  },
  {
    key: "dawn-chorus",
    title: "Dawn Chorus",
    artist: "Zapsplat",
    genre: "Birds",
    kind: "ambience",
    sources: ambience(audio.nature_dawn_chorus as number),
    // A touch more than the forest's 0.2: levelling stopped 2dB short of the
    // target to keep its loudest calls from clipping.
    trim: 0.25,
  },
];

/**
 * Whether minor keys are offered at all.
 *
 * Off for now: the app works in major keys while the pads are built out, and
 * minor comes back later. Off hides the Maj/Min switch on the Pad tab and the
 * Major/Minor choice in a cue's key, and the engine won't enter minor. Turning
 * it back on is this line -- nothing minor was deleted.
 */
export const MINOR_KEYS_ENABLED = false;

const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * The key to actually play and show for a saved one.
 *
 * With minor off, a cue saved in a minor key -- before this switch -- becomes
 * its relative major: A minor is C major. That is the same clip it always
 * played (a minor key sounds its relative major's pad), so the room hears
 * exactly what it did; only the label is honest about it now.
 */
export const playableKey = (
  key: string,
  mode: "major" | "minor" = "major"
): { key: string; mode: "major" | "minor" } => {
  if (MINOR_KEYS_ENABLED || mode === "major") return { key, mode };
  const index = ROOTS.indexOf(key);
  return index < 0 ? { key, mode: "major" } : { key: ROOTS[(index + 3) % 12], mode: "major" };
};

export const findPadPackByKey = (key: string | undefined) =>
  PAD_PACKS.find((pack) => pack.key === key);

/** The tonal pads only -- what a session cue can play in a song's key. */
export const TONAL_PAD_PACKS = PAD_PACKS.filter((pack) => pack.kind === "pad");

/** The clip a pack plays for a root. Ambience has one, whatever the root. */
export const padSourceFor = (pack: PadPack, root: string) =>
  pack.kind === "ambience" ? pack.sources.C : pack.sources[root];

/** The trim a pack's fader runs through. */
export const padTrim = (packKey: string) => findPadPackByKey(packKey)?.trim ?? 1;

// What every channel gets multiplied by so the summed voices stay inside full
// scale.
//
// Divided by the root sum of the squared levels, not by their plain sum. That
// is the difference between a bus that holds its loudness as pads are stacked
// and one that ducks every time another is loaded -- which is what the plain
// sum did: two faders at the top each got half the gain, so the instrument lost
// about 3dB the moment a second pack went in, and 6dB by the fourth.
//
// Dividing by the sum is the right answer for signals that are copies of each
// other, whose amplitudes really do add and can add in phase. Pads are not
// that. They are different recordings at different pitches, so what adds is
// their POWER, and power is amplitude squared. Normalising by the root of the
// summed squares keeps the total power at one voice's worth however many are
// loaded, which is "adding a layer shouldn't turn the instrument down" written
// as arithmetic.
//
// The cost is a peak that can pass full scale if two pads happen to line up in
// phase for an instant -- 1.41x for two at the top, in a worst case that
// uncorrelated material does not really produce. padVolume sits underneath this
// (0.7 by default) with room to absorb it.
//
// Never boosts: the max(1, ...) leaves a quiet stack where the faders put it
// rather than pulling it up to full scale.
//
// Muted channels contribute nothing, which is what makes muting one give the
// others more room rather than just leaving a hole in the mix.
//
// Takes anything with a level so it doesn't need the PadLayer type, which
// lives in PreferencesContext and would point this module at the context layer.
export const padBusScale = (channels: { level: number; muted?: boolean }[]) => {
  const power = channels.reduce(
    (sum, channel) => sum + (channel.muted ? 0 : channel.level * channel.level),
    0
  );
  return 1 / Math.max(1, Math.sqrt(power));
};

// Unique artist names, sorted, derived from the catalog.
export const getPadArtists = () =>
  [...new Set(PAD_PACKS.map((pack) => pack.artist))].sort((a, b) =>
    a.localeCompare(b)
  );
