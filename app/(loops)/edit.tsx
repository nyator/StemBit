import { useMemo, useState } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
// Not @react-navigation/native directly: as of SDK 56, expo-router's require.context
// scan rejects any direct react-navigation import from app code (it manages the
// navigation tree itself now). expo-router/react-navigation is the sanctioned
// re-export -- same hook, same behavior, just routed through the package expo-router
// expects app code to go through.
import { usePreventRemove } from "expo-router/react-navigation";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import { BrandButton } from "../../components/ui/brandButton";
import { BrandInput } from "../../components/ui/brandInput";
import { BpmDial } from "../../components/ui/instrument";
import { useBpmControl } from "../../hooks/useBpmControl";
import { findLoopByKey } from "../../constants/loops";
import { useUserLoops } from "../../context/UserLoopsContext";
import {
  useLoopPlayback,
  LOOP_MAX_BPM,
  LOOP_MIN_BPM,
} from "../../context/LoopPlaybackContext";
import { confirm } from "../../utils/confirm";

// Renaming a loop of your own, and setting the tempo you want to hear it at.
//
// Deliberately not the import screen. That one exists to answer "what IS this
// audio" -- where the beats fall, what tempo it runs at, which part of the file
// is the loop -- and it has a waveform and a tempo detector because none of
// that is known yet. By the time a loop is in your library all of it is known,
// and the only things left are the two you chose: what it is called, and how
// fast you want it.
//
// Nothing here is written until Save. The rest of the app saves as you go,
// which is right for a fader you are riding against a band, and wrong for a
// name you are halfway through typing.
export default function EditLoopScreen() {
  const router = useRouter();
  // The navigator, not the router: usePreventRemove hands back the navigation
  // action it blocked, and only the navigator can replay it.
  const navigation = useNavigation();
  const { key } = useLocalSearchParams<{ key?: string }>();
  const { updateUserLoop } = useUserLoops();
  const { selectedKey, setSelectedLoopKey } = useLoopPlayback();

  // Read once. The record changes underneath as soon as Save writes it, and a
  // live read would swap the "what it was" that the dirty check compares to.
  const [loop] = useState(() => (key ? findLoopByKey(key) : undefined));

  const [title, setTitle] = useState(loop?.title ?? "");
  // Falls back to the recorded tempo, which is what "no preference" means.
  const [bpm, setBpm] = useState(loop?.playbackBpm ?? loop?.bpm ?? 120);

  const controls = useBpmControl({
    bpm,
    setBpm,
    minBpm: LOOP_MIN_BPM,
    maxBpm: LOOP_MAX_BPM,
  });

  const trimmedTitle = title.trim();
  const isDirty = useMemo(() => {
    if (!loop) return false;
    return (
      trimmedTitle !== loop.title ||
      bpm !== (loop.playbackBpm ?? loop.bpm)
    );
  }, [loop, trimmedTitle, bpm]);

  const canSave = !!loop && trimmedTitle.length > 0 && isDirty;

  // Catches every way out of here -- the header's back button, the hardware
  // back button, and the swipe -- rather than only the one with a handler on
  // it. Registered against unsaved changes, so leaving a clean screen is never
  // interrupted.
  usePreventRemove(isDirty, ({ data }) => {
    confirm({
      title: "Discard changes?",
      message: `${trimmedTitle || loop?.title} won't be changed.`,
      confirmLabel: "Discard",
      cancelLabel: "Keep editing",
      destructive: true,
    }).then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });

  const save = () => {
    if (!loop || !canSave) return;

    updateUserLoop(loop.key, {
      title: trimmedTitle,
      category: loop.category,
      bpm: loop.bpm,
      timeSignature: loop.timeSignature,
      trimStart: loop.trimStart ?? 0,
      trimEnd: loop.trimEnd ?? 0,
      // Back to "no preference" when it matches the recorded tempo, rather than
      // storing the same number twice -- so a loop that has been set back to
      // its own tempo stops carrying an override that says nothing.
      playbackBpm: bpm === loop.bpm ? undefined : bpm,
    });

    // Re-select it if it is the loaded one, so the Loop tab picks up the new
    // name and opens at the new tempo instead of keeping what it read before.
    if (selectedKey === loop.key) setSelectedLoopKey(loop.key);

    router.back();
  };

  if (!loop) {
    return (
      <Screen glows={["topLeft"]}>
        <ScreenHeader title="Edit Loop" />
        <View className="flex-1 px-screen">
          <Text className="text-ink-soft font-satoshiRegular text-label">
            That loop couldn&apos;t be found — it may have been deleted.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen glows={["topLeft"]}>
      <ScreenHeader title="Edit Loop" />

      <View className="flex-1 px-screen">
        <BrandInput
          label="Name"
          placeholder="Name this loop"
          value={title}
          onChangeText={setTitle}
          maxLength={40}
          returnKeyType="done"
          error={
            trimmedTitle.length === 0 && title.length > 0
              ? "Give it a name."
              : undefined
          }
        />

        <Text className="mt-2 mb-3 text-ink font-spaceMedium text-label">
          Plays at
        </Text>

        <View className="items-center">
          <BpmDial controls={controls} isPlaying={false} variant="compact" />
        </View>

        <Text className="mt-3 text-center text-ink-muted text-overline font-satoshiRegular leading-5">
          {bpm === loop.bpm
            ? `Its own tempo. Recorded at ${loop.bpm} BPM.`
            : `Opens at ${bpm} instead of the ${loop.bpm} BPM it was recorded at — the audio is stretched to fit, so the pitch doesn't move.`}
        </Text>

        <View className="mt-auto mb-4">
          <BrandButton
            label="Save"
            onPress={save}
            disabled={!canSave}
          />
        </View>
      </View>
    </Screen>
  );
}
