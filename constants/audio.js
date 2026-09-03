import beep from "../assets/audio/beep.mp3";
import censor from "../assets/audio/censor.mp3";

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

import nature_forest from "../assets/audio/nature/forest_awakening.m4a";

import ableton_beat from "../assets/audio/clicks/ableton_beat.wav";
import ableton_accent from "../assets/audio/clicks/ableton_accent.wav";

import afro from "../assets/audio/loops/afro.wav";
import afro97 from "../assets/audio/loops/afro_97.wav";
import afro97Ii from "../assets/audio/loops/afro_97_ii.wav";
import backHome from "../assets/audio/loops/back_home.wav";
import afroDancehall from "../assets/audio/loops/afro_dancehall.wav";
import afroLocal from "../assets/audio/loops/afro_local.wav";
import afroOi from "../assets/audio/loops/afro_oi.wav";
import afroP from "../assets/audio/loops/afro_p.wav";
import afroPiano from "../assets/audio/loops/afro_piano.wav";
import afroPraise from "../assets/audio/loops/afro_praise.wav";
import drill from "../assets/audio/loops/drill.wav";
import pstNath from "../assets/audio/loops/pst_nath.wav";
import worship80 from "../assets/audio/loops/worship_80.wav";
import worship80Ii from "../assets/audio/loops/worship_80_ii.wav";
import worship80Iii from "../assets/audio/loops/worship_80_iii.wav";
import worshipMm from "../assets/audio/loops/worship_mm.wav";
import worship68 from "../assets/audio/loops/worship_68.wav";
import worship82 from "../assets/audio/loops/worship_82.wav";
import worshipMover from "../assets/audio/loops/worship_mover.wav";
import worship91 from "../assets/audio/loops/worship_91.wav";
import worshipUnderdog from "../assets/audio/loops/worship_underdog.wav";
import worshipWarDrum from "../assets/audio/loops/worship_war_drum.wav";
import worshipWar from "../assets/audio/loops/worship_war.wav";
import worship135 from "../assets/audio/loops/worship_135.wav";
import worship155 from "../assets/audio/loops/worship_155.wav";
import worship155Ii from "../assets/audio/loops/worship_155_ii.wav";
import worship155Iii from "../assets/audio/loops/worship_155_iii.wav";

export default {
  beep,
  censor,


  // Pad — keyed by chromatic root note
  pads: {
    C: PAD_C,
    "C#": PAD_Cs,
    D: PAD_D, 
    "D#": PAD_Ds,
    E: PAD_E, 
    F: PAD_F, 
    "F#": PAD_Fs, 
    G: PAD_G,
    "G#": PAD_Gs, 
    A: PAD_A, 
    "A#": PAD_As, 
    B: PAD_B,
  },

  // Nature — ambience layered over the pads, on its own mixer channel
  nature_forest,


  //metronome — the Ableton click kit (keyed ableton_<beat|accent>)
  clicks: {
    ableton_beat, ableton_accent,
  },

  //Loops
  afro,
  afro97,
  afro97Ii,
  backHome,
  afroDancehall,
  afroLocal,
  afroOi,
  afroP,
  afroPiano,
  afroPraise,
  drill,
  pstNath,
  worship80,
  worship80Ii,
  worship80Iii,
  worshipMm,
  worship68,
  worship82,
  worshipMover,
  worship91,
  worshipUnderdog,
  worshipWarDrum,
  worshipWar,
  worship135,
  worship155,
  worship155Ii,
  worship155Iii,
};
