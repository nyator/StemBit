import { useEffect, useState } from "react";
import { AppState } from "react-native";

import {
  addRouteChangeListener,
  getOutputs,
  type AudioOutput,
} from "../modules/audio-routes";

// What the phone falls back to when the platform tells us nothing -- either
// nothing is connected, or this binary predates the native module. Both cases
// are the same to the user: sound is coming out of the phone speaker, so that's
// what the list says. The module itself reports an empty list in those cases
// because "I don't know" is the truth at that layer; deciding what to *show* is
// this hook's job.
const PHONE_SPEAKER: AudioOutput = {
  id: "builtInSpeaker",
  name: "Phone Speaker",
  kind: "speaker",
  isActive: true,
  isSelectable: false,
};

/**
 * The live list of connected audio outputs, kept in sync as devices come and
 * go. Never empty: with nothing detected it reports the phone speaker, which is
 * where audio actually goes by default.
 */
export function useAudioOutputs(): AudioOutput[] {
  const [outputs, setOutputs] = useState<AudioOutput[]>(getOutputs);

  useEffect(() => {
    const subscription = addRouteChangeListener((event) =>
      setOutputs(event.outputs)
    );

    // Routes change while we're backgrounded too -- pairing headphones from
    // Control Center is the obvious case -- and a suspended app doesn't
    // reliably get the notification, so the list is re-read on foreground.
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") setOutputs(getOutputs());
    });

    // The lazy initializer above ran before the listener was attached; re-read
    // once here so nothing that changed in between is missed.
    setOutputs(getOutputs());

    return () => {
      subscription?.remove();
      appState.remove();
    };
  }, []);

  return outputs.length > 0 ? outputs : [PHONE_SPEAKER];
}
