import { Alert } from "react-native";
import { useRouter } from "expo-router";

import type { Loop } from "../constants/loops";
import { useUserLoops } from "../context/UserLoopsContext";

/**
 * Take a copy of a loop into the user's own, and open it for editing.
 *
 * Shared because there are two places somebody realises they want their own
 * version of a loop: looking at the catalogue, and playing one. Both end in the
 * same two steps, and a second copy of them would be a second thing to keep
 * right.
 *
 * The editor opens straight after, rather than returning to wherever this was
 * called from. Copying is never the goal on its own -- the copy is identical to
 * what it came from until something is changed about it, so stopping at two
 * rows with the same name would be stopping one step short.
 */
export function useSaveLoopAsMine() {
  const router = useRouter();
  const { duplicateLoop } = useUserLoops();

  // The short editor -- name and the tempo you want to hear it at. The import
  // screen is for working out what an unknown file IS; a loop already in the
  // library has been through that, so its waveform and tempo detector would be
  // answering a question nobody is asking.
  const openEditor = (key: string) =>
    router.push({ pathname: "/(loops)/edit", params: { key } });

  const saveAsMine = async (loop: Loop) => {
    // Already theirs: there is nothing to copy, and making a second one would
    // be a surprising answer to "let me edit this".
    if (loop.userAdded) {
      openEditor(loop.key);
      return;
    }

    try {
      const copy = await duplicateLoop(loop);
      openEditor(copy.key);
    } catch (error) {
      console.error("Could not copy loop", error);
      Alert.alert(
        "Couldn't copy that loop",
        "Its audio couldn't be read. Try again, or import the file yourself."
      );
    }
  };

  return { saveAsMine, openEditor };
}
