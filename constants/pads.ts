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
   * it's meant to sit under -- this caps the bed at 40% of full scale and
   * gives the whole throw back as usable range.
   *
   * Engine-side, like padBusScale: the strip still reads out its fader
   * position, because that's what the fader is doing. Trim is the desk's
   * business.
   */
  trim: 0.4,
};

// What every channel gets multiplied by so the voices can't sum past full
// scale. Exported (rather than living in the engine) so the mixer's readout is
// computed the same way the audio is -- otherwise the two drift and the
// percentages start lying about what you're hearing.
//
// Muted channels contribute nothing, which is what makes muting one give the
// others more room rather than just leaving a hole in the mix.
//
// Takes anything with a level so it doesn't need the PadLayer type, which
// lives in PreferencesContext and would point this module at the context layer.
export const padBusScale = (channels: { level: number; muted?: boolean }[]) =>
  1 /
  Math.max(
    1,
    channels.reduce(
      (sum, channel) => sum + (channel.muted ? 0 : channel.level),
      0
    )
  );

// Unique artist names, sorted, derived from the catalog.
export const getPadArtists = () =>
  [...new Set(PAD_PACKS.map((pack) => pack.artist))].sort((a, b) =>
    a.localeCompare(b)
  );
