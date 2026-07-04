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

//Metronome
import metronome_bright from "../assets/audio/clicks/metronome_bright.wav";
import metronome_low from "../assets/audio/clicks/metronome_low.wav";
import metronome_loop_2 from "../assets/audio/clicks/generated/metronome_2_base160.wav";
import metronome_loop_3 from "../assets/audio/clicks/generated/metronome_3_base160.wav";
import metronome_loop_4 from "../assets/audio/clicks/generated/metronome_4_base160.wav";
import metronome_loop_5 from "../assets/audio/clicks/generated/metronome_5_base160.wav";
import metronome_loop_6 from "../assets/audio/clicks/generated/metronome_6_base160.wav";
import metronome_loop_7 from "../assets/audio/clicks/generated/metronome_7_base160.wav";
import metronome_loop_9 from "../assets/audio/clicks/generated/metronome_9_base160.wav";
import metronome_loop_12 from "../assets/audio/clicks/generated/metronome_12_base160.wav";

//Loop
import sampleLoop from "../assets/audio/loops/sample_bpm80.mp3";

export default {
  beep,
  censor,


  // Pad — keyed by chromatic root note
  pads: {
    C: PAD_C, "C#": PAD_Cs, D: PAD_D, "D#": PAD_Ds,
    E: PAD_E, F: PAD_F, "F#": PAD_Fs, G: PAD_G,
    "G#": PAD_Gs, A: PAD_A, "A#": PAD_As, B: PAD_B,
  },


  //metronome
  metronome_bright,
  metronome_low,
  metronomeLoops: {
    2: metronome_loop_2,
    3: metronome_loop_3,
    4: metronome_loop_4,
    5: metronome_loop_5,
    6: metronome_loop_6,
    7: metronome_loop_7,
    9: metronome_loop_9,
    12: metronome_loop_12,
  },

  //Loops
  sampleLoop
};
