import { useState } from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useSessions } from "../../context/SessionsContext";
import HeaderComponent from "../../components/headerComponent";
import AmbientGlow from "../../components/ui/ambientGlow";
import { GLOW_PLACEMENTS } from "../../components/ui/screen";
import { BrandInput } from "../../components/ui/brandInput";
import { BrandButton } from "../../components/ui/brandButton";
import { COLORS, SHADOWS } from "../../constants/theme";
import { Add, Musicnote } from "../../components/icons";

// Sessions: what's been set up in advance so nothing is hunted for on stage.
//
// A session is a body of work -- a tour, a residency, a season -- and holds the
// setlists for its nights. The tab lists sessions; a session lists its setlists;
// a setlist is the running order you actually tap through.

export default function SessionsScreen() {
  const router = useRouter();
  const { sessions, addSession, removeSession } = useSessions();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  // Nothing made yet and not in the middle of making one -- the state the screen
  // is in the very first time it's opened, which is the one worth designing for.
  const isEmpty = sessions.length === 0 && !creating;

  const create = () => {
    const session = addSession(title);
    setTitle("");
    setCreating(false);
    router.push({ pathname: "/setlist", params: { id: session.id } });
  };

  const confirmRemove = (id: string, name: string) =>
    Alert.alert(
      "Delete session",
      `Delete "${name}" and its setlists? The loops and pads themselves aren't touched.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => removeSession(id),
        },
      ],
      { cancelable: true }
    );

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <StatusBar barStyle="light-content" />
      <AmbientGlow style={GLOW_PLACEMENTS.topLeftFar} />

      <HeaderComponent />


      {creating && (
        <View className="px-5 mb-2">
          <BrandInput
            label="Session name"
            value={title}
            onChangeText={setTitle}
            placeholder="Summer tour, Sunday services…"
            maxLength={40}
            autoFocus
            onSubmitEditing={create}
          />
          <BrandButton label="Create session" onPress={create} />
        </View>
      )}

      <ScrollView
        className="flex-1 px-5"
        // Empty, the invitation sits in the middle of the screen rather than
        // clinging to the top of an otherwise blank page. flexGrow is what lets
        // a scroll view centre at all: without it the content box is only as
        // tall as its contents, and there's nothing to centre within.
        contentContainerStyle={{
          paddingBottom: 190,
          flexGrow: 1,
          justifyContent: isEmpty ? "center" : "flex-start",
        }}
      >
        {isEmpty ? (
          <View className="items-center justify-center px-6">
            <Musicnote size={40} color="rgba(255,255,255,0.3)" />
            <Text className="mt-4 text-center text-white/50 font-satoshiMedium">
              No sessions yet. Make one for a tour or a season, put a setlist in
              it for each night, and you'll never go looking for a loop mid-song.
            </Text>
          </View>
        ) : null}

        {sessions.map((session) => {
          const cues = session.items.length;
          return (
            <TouchableOpacity
              key={session.id}
              onPress={() =>
                router.push({
                  pathname: "/setlist",
                  params: { id: session.id },
                })
              }
              onLongPress={() => confirmRemove(session.id, session.title)}
              delayLongPress={400}
              className="p-4 mb-3 border rounded-lg bg-surface border-hairline"
            >
              <Text
                className="text-white font-satoshiBold text-body"
                numberOfLines={1}
              >
                {session.title}
              </Text>
              <Text className="text-ink-muted text-xs font-satoshiRegular mt-[2px]">
                {cues} {cues === 1 ? "cue" : "cues"}
              </Text>
            </TouchableOpacity>
          );
        })}

        {sessions.length > 0 && (
          <Text className="mt-2 text-[11px] text-ink-muted font-satoshiRegular">
            Hold a session to delete it.
          </Text>
        )}
      </ScrollView>

      {/* Sits beside the floating tab bar rather than in the header: the tab
          pill is 228pt wide and centred, so the right-hand corner is empty, and
          a thumb reaches it without crossing the screen. */}
      <TouchableOpacity
        onPress={() => setCreating((open) => !open)}
        accessibilityLabel={creating ? "Close the new session form" : "New session"}
        activeOpacity={0.85}
        className="absolute items-center justify-center rounded-full bg-brand"
        style={{
          right: 20,
          bottom: 10,
          width: 56,
          height: 56,
          ...SHADOWS.float,
        }}
      >
        <Add
          size={26}
          color={COLORS.white}
          // A quarter turn makes the same glyph read as a close.
          style={creating ? { transform: [{ rotate: "45deg" }] } : undefined}
        />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
