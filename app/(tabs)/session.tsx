import { useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { useSessions } from "../../context/SessionsContext";
import HeaderComponent from "../../components/headerComponent";
import Screen from "../../components/ui/screen";
import EmptyState from "../../components/ui/emptyState";
import {
  SHEET_BACKGROUND,
  SHEET_CONTENT,
  SHEET_HANDLE_INDICATOR,
  useSheetBackdrop,
} from "../../components/ui/sheet";
import { BrandInput } from "../../components/ui/brandInput";
import { BrandButton } from "../../components/ui/brandButton";
import { COLORS, LAYOUT, SHADOWS, SIZES } from "../../constants/theme";
import { Add, Folder, Musicnote } from "../../components/icons";

// A device's glass support can't change mid-session, so this is read once.
const HAS_LIQUID_GLASS = isLiquidGlassAvailable();

export default function SessionsScreen() {
  const router = useRouter();

  // Cast to allow renameSession or updateSession regardless of context naming
  const sessionsContext = useSessions() as ReturnType<typeof useSessions> & {
    renameSession?: (id: string, title: string) => void;
    updateSession?: (id: string, updates: Partial<{ title: string }>) => void;
  };
  const { sessions, addSession, removeSession } = sessionsContext;

  const sheetRef = useRef<BottomSheetModal>(null);
  const [title, setTitle] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  const isEmpty = sessions.length === 0;

  const close = () => {
    sheetRef.current?.dismiss();
    setTitle("");
    setEditingSessionId(null);
  };

  const openCreateSheet = () => {
    setEditingSessionId(null);
    setTitle("");
    sheetRef.current?.present();
  };

  const openRenameSheet = (id: string, currentTitle: string) => {
    setEditingSessionId(id);
    setTitle(currentTitle);
    sheetRef.current?.present();
  };

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    if (editingSessionId) {
      if (typeof sessionsContext.renameSession === "function") {
        sessionsContext.renameSession(editingSessionId, trimmed);
      } else if (typeof sessionsContext.updateSession === "function") {
        sessionsContext.updateSession(editingSessionId, { title: trimmed });
      }
      close();
    } else {
      const session = addSession(trimmed);
      close();
      router.push({ pathname: "/setlist", params: { id: session.id } });
    }
  };

  const renderBackdrop = useSheetBackdrop();

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

  const openSessionActions = (id: string, currentTitle: string) => {
    Alert.alert(
      currentTitle,
      undefined,
      [
        {
          text: "Rename",
          onPress: () => openRenameSheet(id, currentTitle),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => confirmRemove(id, currentTitle),
        },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  return (
    <Screen glows={["topLeftFar"]}>
      <HeaderComponent />

      <BottomSheetModal
        ref={sheetRef}
        enableDynamicSizing
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        backgroundStyle={SHEET_BACKGROUND}
        handleIndicatorStyle={SHEET_HANDLE_INDICATOR}
        onDismiss={() => {
          setTitle("");
          setEditingSessionId(null);
        }}
      >
        <BottomSheetView style={SHEET_CONTENT}>
          <Text className="mb-3 text-white font-satoshiBold text-title">
            {editingSessionId ? "Rename session" : "New session"}
          </Text>

          <BrandInput
            InputComponent={BottomSheetTextInput}
            label="Session name"
            value={title}
            onChangeText={setTitle}
            placeholder="Summer tour, Sunday services…"
            maxLength={40}
            selectTextOnFocus
            onSubmitEditing={save}
          />
          <BrandButton
            label={editingSessionId ? "Save changes" : "Create session"}
            onPress={save}
          />

          {!editingSessionId && (
            <>
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
            </>
          )}
        </BottomSheetView>
      </BottomSheetModal>

      {isEmpty ? (
        <View
          className="items-center justify-center flex-1 px-screen"
          style={{ paddingBottom: LAYOUT.tabBarClearance }}
        >
          <EmptyState
            icon={Musicnote}
            message="No sessions yet. Make one for a tour or a season, put a setlist in it for each night, and you'll never go looking for a loop mid-song."
          />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-screen"
          contentContainerStyle={{ paddingBottom: LAYOUT.tabBarClearance }}
        >
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
                onLongPress={() => openSessionActions(session.id, session.title)}
                delayLongPress={350}
                activeOpacity={0.75}
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

          <Text className="mt-2 text-micro text-ink-muted font-satoshiRegular">
            Hold a session to rename or delete it.
          </Text>
        </ScrollView>
      )}

      {/* Liquid Glass tinted brand on iOS 26+, the same treatment BrandButton
          uses; the flat brand circle everywhere else. */}
      {/* A plain style object, not Pressable's style function: NativeWind
          doesn't apply a function style here, and the button loses its
          absolute position and drops into the layout. Glass handles its own
          press feedback, so the fade is only for the flat fallback. */}
      <TouchableOpacity
        onPress={openCreateSheet}
        accessibilityRole="button"
        accessibilityLabel="New session"
        activeOpacity={HAS_LIQUID_GLASS ? 1 : 0.85}
        style={{
          position: "absolute",
          right: LAYOUT.screenPaddingX,
          bottom: 10,
          ...SHADOWS.float,
        }}
      >
        {HAS_LIQUID_GLASS ? (
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            tintColor={COLORS.brand}
            style={{
              width: SIZES.fab,
              height: SIZES.fab,
              borderRadius: SIZES.fab / 2,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <Add size={26} color={COLORS.white} />
          </GlassView>
        ) : (
          <View
            className="items-center justify-center rounded-full bg-brand"
            style={{ width: SIZES.fab, height: SIZES.fab }}
          >
            <Add size={26} color={COLORS.white} />
          </View>
        )}
      </TouchableOpacity>
    </Screen>
  );
}