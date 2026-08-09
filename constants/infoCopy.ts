// Help text behind the Information icons on the instrument screens.
//
// Kept out of the screens themselves for two reasons: the same control appears
// on more than one screen (Subdivision is on both Metronome and Loop, and the
// two do subtly different things), and copy that lives in one file is far
// easier to keep honest when the behaviour it describes changes.
//
// Every entry here describes what the control ACTUALLY does today. If you
// change an engine's behaviour, change the matching entry -- help text that
// has drifted from the code is worse than no help text at all.

export type InfoPoint = {
  /** The option or value being explained, e.g. "1x". */
  term: string;
  detail: string;
};

export type InfoTopic = {
  title: string;
  body: string;
  /** Per-option breakdown, rendered as a definition list under the body. */
  points?: InfoPoint[];
};

// Keys are referenced by <InfoButton topic="..." />, so the union below is what
// keeps a typo from silently rendering an empty sheet.
export const INFO_TOPICS = {
  selectLoop: {
    title: "Select Loop",
    body:
      "Opens your loop library. The loop you pick becomes the backing track on this screen, and it plays time-stretched to the BPM on the dial rather than at the tempo it was recorded at.",
    points: [
      {
        term: "Tempo",
        detail:
          "Picking a loop sets the dial to the loop's own recorded BPM. Nudge it from there and the loop stretches to follow; the reset button returns it to the recorded value.",
      },
      {
        term: "Beat dots",
        detail:
          "The dots above the transport show one bar of the loop's time signature, with the downbeat accented.",
      },
      {
        term: "Import",
        detail:
          "Your own audio can be added from the library screen, alongside the loops that ship with the app.",
      },
    ],
  },

  timeSignature: {
    title: "Time Signature",
    body:
      "Sets how many beats fill a bar and which of them get the accented click. The dial's BPM is unchanged -- this only changes the grouping the clicks fall into.",
    points: [
      {
        term: "Standard",
        detail:
          "Simple meters like 4/4 and 3/4. The downbeat is accented and every other beat is a regular click.",
      },
      {
        term: "Compound",
        detail:
          "Meters that subdivide in threes, like 6/8 and 12/8. Each group gets its own accent, so 6/8 accents beats 1 and 4.",
      },
      {
        term: "Odd",
        detail:
          "Asymmetric meters like 5/4 and 7/8, accented at the natural group boundaries.",
      },
    ],
  },

  // Same control, two engines: on the metronome it re-rates the click, on the
  // loop screen it re-rates the audio itself. Worth two entries rather than one
  // vague one that covers neither properly.
  metroSubdivision: {
    title: "Subdivision",
    body:
      "Multiplies how fast the clicks come without moving the BPM on the dial. Useful for practising against a half-time or double-time feel while the written tempo stays put.",
    points: [
      { term: "0.5x", detail: "Half time -- one click for every two beats." },
      { term: "1x", detail: "Normal -- one click per beat." },
      { term: "2x", detail: "Double time -- two clicks per beat." },
    ],
  },

  loopSubdivision: {
    title: "Subdivision",
    body:
      "Multiplies the loop's playback speed against the BPM on the dial. The dial keeps reading the written tempo; what you hear plays at that tempo times the multiplier.",
    points: [
      { term: "0.5x", detail: "Half time -- the loop plays at half speed." },
      { term: "1x", detail: "Normal -- the loop plays at the dial's tempo." },
      { term: "2x", detail: "Double time -- the loop plays at double speed." },
    ],
  },
} as const satisfies Record<string, InfoTopic>;

export type InfoTopicKey = keyof typeof INFO_TOPICS;
