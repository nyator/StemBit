import audio from "./audio";

export type PadPack = {
  key: string;
  title: string;
  artist: string;
  genre: string;
  // All packs point at the one recorded pad instrument for now -- there's
  // only a single chromatic sample set (see PAD_SOURCES in app/(tabs)/pad.tsx)
  // until distinct packs are actually recorded.
  source: number;
};

// The catalog shown on the "Select Pad" screen (Figma node 108:651). Selecting
// a pack doesn't yet swap the instrument's actual samples -- see the TODO on
// SelectPadView.
export const PAD_PACKS: PadPack[] = [
  { key: "drone-pad", title: "Drone Pad", artist: "DJ Koda", genre: "Lo-Fi", source: audio.pads.C },
  { key: "ocean-waves", title: "Ocean Waves", artist: "Aqua Beats", genre: "Chillhop", source: audio.pads.C },
  { key: "sunset-vibes", title: "Sunset Vibes", artist: "Mellow Tune", genre: "Ambient", source: audio.pads.C },
  { key: "city-lights", title: "City Lights", artist: "Urban Echo", genre: "Jazz", source: audio.pads.C },
  { key: "forest-whispers", title: "Forest Whispers", artist: "Nature Sounds", genre: "Relaxing", source: audio.pads.C },
];

export const findPadPackByKey = (key: string | undefined) =>
  PAD_PACKS.find((pack) => pack.key === key);

// Unique artist names, sorted, derived from the catalog.
export const getPadArtists = () =>
  [...new Set(PAD_PACKS.map((pack) => pack.artist))].sort((a, b) =>
    a.localeCompare(b)
  );
