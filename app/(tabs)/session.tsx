import { useRef, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";

import { useSessions } from "../../context/SessionsContext";
import HeaderComponent from "../../components/headerComponent";
import Screen from "../../components/ui/screen";
import EmptyState from "../../components/ui/emptyState";
import {
  SHEET_BACKGROUND,
  SHEET_HANDLE_INDICATOR,
  useSheetBackdrop,
} from "../../components/ui/sheet";
import { BrandInput } from "../../components/ui/brandInput";
import { BrandButton } from "../../components/ui/brandButton";
import { COLORS, LAYOUT, SHADOWS, SIZES } from "../../constants/theme";
import { Add, Folder, Musicnote } from "../../components/icons";

// Sessions: what's been set up in advance so nothing is hunted for on stage.
//
// A session is a body of work -- a tour, a residency, a season -- and holds the
// setlists for its nights. The tab lists sessions; a session lists its setlists;
// a setlist is the running order you actually tap through.

export default function SessionsScreen() {
  const router = useRouter();
  const { sessions, addSession, removeSession } = useSessions();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [title, setTitle] = useState("");
  // Nothing made yet and not in the middle of making one -- the state the screen
  // is in the very first time it's opened, which is the one worth designing for.
  // The new-session form used to be an inline panel that pushed the list down,
  // so this also excluded it -- the empty-state invitation had to get out of its
  // way. The sheet covers the list instead, and keeping that guard only made the
  // invitation flicker away and back as the sheet opened and closed.
  const isEmpty = sessions.length === 0;

  const close = () => {
    sheetRef.current?.dismiss();
    setTitle("");
  };

  const create = () => {
    if (!title.trim()) return;
    const session = addSession(title.trim());
    close();
    router.push({ pathname: "/setlist", params: { id: session.id } });
  };

  // Same backdrop as the info sheets and the loop picker, so every sheet in the
  // app dims the screen by the same amount and closes the same way.
  const renderBackdrop = useSheetBackdrop();

  // Placeholder for bringing a whole project in -- stems, cues and running
  // order in one file, rather than building a set a cue at a time. It's here
  // rather than hidden until it's built because this is where someone will look
  // for it, and being told it's coming is more use than finding nothing.
  const importProject = () =>
    Alert.alert(
      "Import project",
      "Bringing in stems and running orders from a project file isn't ready yet. For now, make a session and add cues to it by hand.",
      [{ text: "OK" }]
    );

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
    <Screen glows={["topLeftFar"]}>
      <HeaderComponent />


      {/* The same sheet the subdivision hints and the loop picker use, so
          everything that comes up from the bottom of this app looks and
          behaves the same way.

          enableDynamicSizing rather than a fixed snap point: this is a short
          form, and a fixed height would leave it floating in empty space. */}
      <BottomSheetModal
        ref={sheetRef}
        enableDynamicSizing
        // The name field lives in here, so the sheet has to ride the keyboard
        // rather than sit under it.
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        // Without this Android pans the whole window instead of resizing it,
        // and the sheet has no room to move into -- the field stays under the
        // keyboard however the sheet is configured.
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        backgroundStyle={SHEET_BACKGROUND}
        handleIndicatorStyle={SHEET_HANDLE_INDICATOR}
      >
        <BottomSheetView
          style={{
            paddingHorizontal: LAYOUT.screenPaddingX,
            paddingTop: 8,
            paddingBottom: 44,
          }}
        >
          <Text className="mb-4 text-white text-heading font-spaceBold">
            New session
          </Text>

          <BrandInput
            // Gorhom's input, not React Native's: the sheet only lifts itself
            // clear of the keyboard for fields it can see the focus of, so a
            // plain TextInput here would end up underneath it.
            InputComponent={BottomSheetTextInput}
            label="Session name"
            value={title}
            onChangeText={setTitle}
            placeholder="Summer tour, Sunday services…"
            maxLength={40}
            onSubmitEditing={create}
          />
          <BrandButton label="Create session" onPress={create} />

          <View className="flex-row items-center my-5">
            <View className="flex-1 h-px bg-hairline" />
            <Text className="mx-3 text-micro text-ink-muted font-satoshiRegular">
              OR
            </Text>
            <View className="flex-1 h-px bg-hairline" />
          </View>

          <TouchableOpacity
            onPress={importProject}
            accessibilityLabel="Import project"
            activeOpacity={0.8}
            className="flex-row items-center p-4 border rounded-lg border-hairline"
          >
            <Folder size={22} color={COLORS.textMuted} />
            <View className="flex-1 ml-3">
              <Text className="text-white font-satoshiMedium">
                Import project
              </Text>
              <Text className="text-ink-muted text-overline font-satoshiRegular mt-0.5">
                Stems and running order from a file — coming soon
              </Text>
            </View>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>

      <ScrollView
        className="flex-1 px-screen"
        // Empty, the invitation sits in the middle of the screen rather than
        // clinging to the top of an otherwise blank page. flexGrow is what lets
        // a scroll view centre at all: without it the content box is only as
        // tall as its contents, and there's nothing to centre within.
        contentContainerStyle={{
          paddingBottom: LAYOUT.tabBarClearance,
          flexGrow: 1,
          justifyContent: isEmpty ? "center" : "flex-start",
        }}
      >
        {isEmpty ? (
          <EmptyState
            icon={Musicnote}
            message="No sessions yet. Make one for a tour or a season, put a setlist in it for each night, and you'll never go looking for a loop mid-song."
          />
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
              <Text className="text-ink-muted text-overline font-satoshiRegular mt-0.5">
                {cues} {cues === 1 ? "cue" : "cues"}
              </Text>
            </TouchableOpacity>
          );
        })}

        {sessions.length > 0 && (
          <Text className="mt-2 text-micro text-ink-muted font-satoshiRegular">
            Hold a session to delete it.
          </Text>
        )}
      </ScrollView>

      {/* Sits beside the floating tab bar rather than in the header: the tab
          pill is 228pt wide and centred, so the right-hand corner is empty, and
          a thumb reaches it without crossing the screen. */}
      <TouchableOpacity
        onPress={() => sheetRef.current?.present()}
        accessibilityLabel="New session"
        activeOpacity={0.85}
        className="absolute items-center justify-center rounded-full bg-brand"
        style={{
          right: LAYOUT.screenPaddingX,
          bottom: 10,
          width: SIZES.fab,
          height: SIZES.fab,
          ...SHADOWS.float,
        }}
      >
        {/* No longer rotates to a close: the sheet owns its own dismissal, so
            the button only ever means "new". */}
        <Add size={26} color={COLORS.white} />
      </TouchableOpacity>
    </Screen>
  );
}
