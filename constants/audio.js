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

//Metronome — original synthetic clicks (kept for backwards compatibility with
//saved preferences that reference the "bright"/"low" ids).
import metronome_bright from "../assets/audio/clicks/metronome_bright.wav";
import metronome_low from "../assets/audio/clicks/metronome_low.wav";

//Metronome — DAW click kits. Each kit ships a "beat" voice (the DAW's normal
//click) and an "accent" voice (its accented/downbeat click), converted offline
//to mono 44.1kHz/16-bit WAV via ffmpeg (see scripts/generate_clicks.sh). WAV,
//not m4a: AAC priming silence would offset each click's onset and smear the
//metronome's timing — see METRONOME_SOUNDS in context/MetronomeContext.tsx.
import ableton_beat from "../assets/audio/clicks/ableton_beat.wav";
import ableton_accent from "../assets/audio/clicks/ableton_accent.wav";
import cubase_beat from "../assets/audio/clicks/cubase_beat.wav";
import cubase_accent from "../assets/audio/clicks/cubase_accent.wav";
import fl_beat from "../assets/audio/clicks/fl_beat.wav";
import fl_accent from "../assets/audio/clicks/fl_accent.wav";
import logic_beat from "../assets/audio/clicks/logic_beat.wav";
import logic_accent from "../assets/audio/clicks/logic_accent.wav";
import maschine_beat from "../assets/audio/clicks/maschine_beat.wav";
import maschine_accent from "../assets/audio/clicks/maschine_accent.wav";
import mpc_beat from "../assets/audio/clicks/mpc_beat.wav";
import mpc_accent from "../assets/audio/clicks/mpc_accent.wav";
import protools_beat from "../assets/audio/clicks/protools_beat.wav";
import protools_accent from "../assets/audio/clicks/protools_accent.wav";
import marimba_beat from "../assets/audio/clicks/marimba_beat.wav";
import marimba_accent from "../assets/audio/clicks/marimba_accent.wav";
import reason_beat from "../assets/audio/clicks/reason_beat.wav";
import reason_accent from "../assets/audio/clicks/reason_accent.wav";
import sonar_beat from "../assets/audio/clicks/sonar_beat.wav";
import sonar_accent from "../assets/audio/clicks/sonar_accent.wav";

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


  //metronome — synthetic clicks
  metronome_bright,
  metronome_low,

  //metronome — DAW click kits (keyed <kit>_<beat|accent>)
  clicks: {
    ableton_beat, ableton_accent,
    cubase_beat, cubase_accent,
    fl_beat, fl_accent,
    logic_beat, logic_accent,
    maschine_beat, maschine_accent,
    mpc_beat, mpc_accent,
    protools_beat, protools_accent,
    marimba_beat, marimba_accent,
    reason_beat, reason_accent,
    sonar_beat, sonar_accent,
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
