import audio from "./audio";

export type PadPack = {
  key: string;
  title: string;
  artist: string;
  genre: string;
  /**
   * One clip per chromatic root, keyed "C", "C#", ... The engine picks the
   * right root rather than pitch-shifting at runtime.
   *
   * Every pack currently points at the SAME generated set
   * (assets/audio/pads/generated, one master rendered to 12 roots), so layering
   * two packs today sounds like one pad, not two textures. Giving a pack its
   * own voice means producing a second master and pointing this at it -- the
   * rest of the stack already treats packs as independent instruments.
   */
  sources: Record<string, number>;
};

// How many packs can sound together. Each layer costs two native AudioPlayers,
// since every voice needs its own pair to crossfade its loop seamlessly -- so
// this is 6 players held open while a drone sounds.
export const MAX_PAD_LAYERS = 3;

// The catalog shown on the "Select Pad" screen (Figma node 108:651).
export const PAD_PACKS: PadPack[] = [
  { key: "drone-pad", title: "Drone Pad", artist: "DJ Koda", genre: "Lo-Fi", sources: audio.pads },
  { key: "ocean-waves", title: "Ocean Waves", artist: "Aqua Beats", genre: "Chillhop", sources: audio.pads },
  { key: "sunset-vibes", title: "Sunset Vibes", artist: "Mellow Tune", genre: "Ambient", sources: audio.pads },
  { key: "city-lights", title: "City Lights", artist: "Urban Echo", genre: "Jazz", sources: audio.pads },
  { key: "forest-whispers", title: "Forest Whispers", artist: "Nature Sounds", genre: "Relaxing", sources: audio.pads },
];

export const findPadPackByKey = (key: string | undefined) =>
  PAD_PACKS.find((pack) => pack.key === key);

// The ambience bed that plays under whatever pads are loaded. It holds a mixer
// channel of its own rather than one of the MAX_PAD_LAYERS slots -- it adds to
// the stack rather than being part of it.
//
// Unlike the pads it has no key: it's one recording that plays back at pitch
// whatever the pads are doing, and it runs on its own rather than waiting for
// a key press.
export const NATURE_CHANNEL = {
  key: "nature",
  title: "Nature Noises",
  subtitle: "Forest and birds at dawn",
  source: audio.nature_forest as number,
  /**
   * Fixed input trim, applied before the fader. The recording is mastered far
   * hotter than the pads, so a fader at the top was drowning the instrument
   * it's meant to sit under -- this caps the bed at 20% of full scale and
   * gives the whole throw back as usable range.
   *
   * 20% rather than the 40% it started at: even trimmed by more than half, the
   * bed is meant to be something you notice only when it stops. Ambience that
   * can be picked out as a track is ambience turned up too far.
   *
   * Engine-side, like padBusScale: the strip still reads out its fader
   * position, because that's what the fader is doing. Trim is the desk's
   * business.
   */
  trim: 0.2,
};

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
