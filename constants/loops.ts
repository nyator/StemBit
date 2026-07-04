import audio from "./audio";

export type Loop = {
  key: string;
  title: string;
  artist: string;
  bpm: number;
  timeSignature: string;
  source: number;
};

export const LOOPS: Loop[] = [
  {
    key: "sample_bpm80",
    title: "HENRY LOOP",
    artist: "Henry",
    bpm: 80,
    timeSignature: "4 / 4",
    source: audio.sampleLoop,
  },
];

export const findLoopByKey = (key: string | undefined) =>
  LOOPS.find((loop) => loop.key === key);
