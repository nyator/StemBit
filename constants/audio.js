import beep from "../assets/audio/beep.mp3";
import censor from "../assets/audio/censor.mp3";

//Pad — one clip per chromatic root, pre-pitched offline from the C master via
//scripts/generate_pads.sh (no runtime pitch shifting, which is unreliable on
//physical iOS devices).
import PAD_C from "../assets/audio/pads/generated/pad_C.m4a";
import PAD_Cs from "../assets/audio/pads/generated/pad_Cs.m4a";
import PAD_D from "../assets/audio/pads/generated/pad_D.m4a";
import PAD_Ds from "../assets/audio/pads/generated/pad_Ds.m4a";
import PAD_E from "../assets/audio/pads/generated/pad_E.m4a";
import PAD_F from "../assets/audio/pads/generated/pad_F.m4a";
import PAD_Fs from "../assets/audio/pads/generated/pad_Fs.m4a";
import PAD_G from "../assets/audio/pads/generated/pad_G.m4a";
import PAD_Gs from "../assets/audio/pads/generated/pad_Gs.m4a";
import PAD_A from "../assets/audio/pads/generated/pad_A.m4a";
import PAD_As from "../assets/audio/pads/generated/pad_As.m4a";
import PAD_B from "../assets/audio/pads/generated/pad_B.m4a";

//Nature — the ambience bed that layers over the pads. The first 60s of a
//one-hour field recording, re-encoded to match the pad clips (see
//scripts/generate_nature.sh). It doesn't butt-splice cleanly on its own; the
//pad engine crossfades it against itself instead, so the seam is never heard.
import nature_forest from "../assets/audio/nature/forest_awakening.m4a";

//Metronome — the Ableton click kit, and the only one. A "beat" voice (the
//DAW's normal click) and an "accent" voice (its accented/downbeat click),
//converted offline to mono 44.1kHz/16-bit WAV via ffmpeg (see
//scripts/generate_clicks.sh). WAV, not m4a: AAC priming silence would offset
//each click's onset and smear the metronome's timing — see METRONOME_SOUNDS
//in context/MetronomeContext.tsx.
import ableton_beat from "../assets/audio/clicks/ableton_beat.wav";
import ableton_accent from "../assets/audio/clicks/ableton_accent.wav";

//Loop
import sampleLoop from "../assets/audio/loops/sample_bpm80.mp3";
import pstNath from "../assets/audio/loops/pst_nath.wav";
import worshipWar from "../assets/audio/loops/worship_war.wav";
import afroPop from "../assets/audio/loops/afro_pop.wav";
import drillogy from "../assets/audio/loops/drillogy.wav";
import worship155 from "../assets/audio/loops/worship_155.wav";
import afroDance from "../assets/audio/loops/afro_dance.wav";

export default {
  beep,
  censor,


  // Pad — keyed by chromatic root note
  pads: {
    C: PAD_C, "C#": PAD_Cs, D: PAD_D, "D#": PAD_Ds,
    E: PAD_E, F: PAD_F, "F#": PAD_Fs, G: PAD_G,
    "G#": PAD_Gs, A: PAD_A, "A#": PAD_As, B: PAD_B,
  },

  // Nature — ambience layered over the pads, on its own mixer channel
  nature_forest,


  //metronome — the Ableton click kit (keyed ableton_<beat|accent>)
  clicks: {
    ableton_beat, ableton_accent,
  },

  //Loops
  sampleLoop,
  pstNath,
  worshipWar,
  afroPop,
  drillogy,
  worship155,
  afroDance,
};
