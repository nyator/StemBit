import { useState } from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Modal,
  Pressable,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AntDesign from "@expo/vector-icons/AntDesign";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import HeaderComponent from "../../components/headerComponent";
import { useSessions, type Session } from "../../context/SessionsContext";
import { LOOPS, findLoopByKey, type Loop } from "../../constants/loops";

// Sessions are setlists for a show: each holds an ordered list of loops for
// quick access. Tap a loop and it's loaded on the Loop tab, ready to play.
export default function SessionScreen() {
  const router = useRouter();
  const {
    sessions,
    createSession,
    renameSession,
    deleteSession,
    addLoopToSession,
    removeLoopFromSession,
    moveLoopInSession,
  } = useSessions();

  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const openSession = sessions.find((s) => s.id === openSessionId) ?? null;

  // --- native dialogs -------------------------------------------------------

  const promptForName = (
    title: string,
    initial: string,
    onSubmit: (name: string) => void
  ) => {
    if (Platform.OS === "ios") {
      Alert.prompt(
        title,
        undefined,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: (text?: string) => onSubmit(text ?? initial),
          },
        ],
        "plain-text",
        initial
      );
    } else {
      // Alert.prompt is iOS-only; auto-name on other platforms.
      onSubmit(initial);
    }
  };

  const handleCreateSession = () => {
    promptForName("New Session", `Session ${sessions.length + 1}`, (name) => {
      const id = createSession(name);
      setOpenSessionId(id);
    });
  };

  const handleSessionOptions = (session: Session) => {
    Alert.alert(session.name, undefined, [
      {
        text: "Rename",
        onPress: () =>
          promptForName("Rename Session", session.name, (name) =>
            renameSession(session.id, name)
          ),
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          Alert.alert(
            "Delete Session",
            `Delete "${session.name}"? This can't be undone.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                  if (openSessionId === session.id) setOpenSessionId(null);
                  deleteSession(session.id);
                },
              },
            ]
          ),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // --- quick access: fire a loop from the setlist ----------------------------

  const fireLoop = (loop: Loop) => {
    router.push({
      pathname: "/(tabs)/loop",
      params: {
        title: loop.title,
        artist: loop.artist,
        bpm: String(loop.bpm),
        loopKey: loop.key,
        loadedAt: String(Date.now()),
      },
    });
  };

  const handleLoopRowOptions = (session: Session, index: number) => {
    const loop = findLoopByKey(session.loopKeys[index]);
    Alert.alert(loop ? loop.title : "Unknown loop", undefined, [
      {
        text: "Remove from session",
        style: "destructive",
        onPress: () => removeLoopFromSession(session.id, index),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // --- add-loop picker --------------------------------------------------------

  const renderLoopPicker = () =>
    openSession && (
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable
          style={{ flex: 1, justifyContent: "flex-end" }}
          onPress={() => setPickerVisible(false)}
        >
          <View
            style={{
              backgroundColor: "#000000",
              borderRadius: 16,
              padding: 24,
              maxHeight: 520,
            }}
          >
            <Text className="mb-3 text-lg text-white font-rBold">
              Add loop to {openSession.name}
            </Text>
            <FlatList
              data={LOOPS}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="flex-row items-center justify-between py-4 px-5 my-[2px] rounded-lg bg-white/10 border-white/30 border-[0.2px]"
                  onPress={() => {
                    addLoopToSession(openSession.id, item.key);
                    setPickerVisible(false);
                  }}
                >
                  <View>
                    <Text className="text-base text-white font-rBold">
                      {item.title}
                    </Text>
                    <Text className="text-xs text-white/60 font-rRegular">
                      {item.artist} • {item.bpm} BPM • {item.timeSignature}
                    </Text>
                  </View>
                  <AntDesign name="plus" size={18} color="#08C192" />
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    );

  // --- detail view: one setlist -----------------------------------------------

  const renderDetail = (session: Session) => (
    <View className="flex-1 w-full px-5">
      <View className="flex-row items-center justify-between mt-2 mb-4">
        <TouchableOpacity
          onPress={() => setOpenSessionId(null)}
          className="p-2 rounded-full bg-white/10"
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleSessionOptions(session)}>
          <Text className="text-xl text-white font-rBold">{session.name}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setPickerVisible(true)}
          className="p-2 rounded-full bg-accent"
        >
          <AntDesign name="plus" size={22} color="black" />
        </TouchableOpacity>
      </View>

      {session.loopKeys.length === 0 ? (
        <View className="items-center justify-center flex-1 px-10">
          <MaterialCommunityIcons
            name="playlist-music-outline"
            size={44}
            color="rgba(255,255,255,0.3)"
          />
          <Text className="mt-4 text-center text-white/50 font-rMedium">
            No loops yet. Tap + to build your setlist.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1">
          {session.loopKeys.map((key, index) => {
            const loop = findLoopByKey(key);
            return (
              <TouchableOpacity
                key={`${key}-${index}`}
                className="flex-row items-center py-3 px-3 mb-2 rounded-xl bg-white/10 border-white/10 border"
                onPress={() => loop && fireLoop(loop)}
                onLongPress={() => handleLoopRowOptions(session, index)}
              >
                <Text className="w-8 text-lg text-center text-accent font-cBold">
                  {index + 1}
                </Text>
                <View className="flex-1 ml-2">
                  {loop ? (
                    <>
                      <Text className="text-base text-white font-rBold">
                        {loop.title}
                      </Text>
                      <Text className="text-xs text-white/60 font-rRegular">
                        {loop.artist} • {loop.bpm} BPM • {loop.timeSignature}
                      </Text>
                    </>
                  ) : (
                    <Text className="text-base text-white/40 font-rMedium">
                      Loop no longer in catalog
                    </Text>
                  )}
                </View>
                <View className="flex-row items-center">
                  <TouchableOpacity
                    accessibilityLabel="Move up"
                    hitSlop={6}
                    onPress={() => moveLoopInSession(session.id, index, index - 1)}
                    className="p-2 mr-1 rounded-lg bg-white/10"
                  >
                    <Ionicons name="chevron-up" size={16} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel="Move down"
                    hitSlop={6}
                    onPress={() => moveLoopInSession(session.id, index, index + 1)}
                    className="p-2 mr-1 rounded-lg bg-white/10"
                  >
                    <Ionicons name="chevron-down" size={16} color="white" />
                  </TouchableOpacity>
                  {loop && (
                    <View className="p-2 rounded-full bg-accent/20">
                      <Ionicons name="play" size={16} color="#08C192" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          <Text className="mt-2 mb-6 text-xs text-center text-white/30 font-rRegular">
            Tap a loop to load it on the Loop tab. Long-press to remove.
          </Text>
        </ScrollView>
      )}
    </View>
  );

  // --- list view: all setlists --------------------------------------------------

  const renderList = () => (
    <View className="flex-1 w-full px-5">
      <View className="flex-row items-center justify-between mt-2 mb-4">
        <Text className="text-xl text-white font-rBold">Sessions</Text>
        <TouchableOpacity
          onPress={handleCreateSession}
          className="p-2 rounded-full bg-accent"
        >
          <AntDesign name="plus" size={22} color="black" />
        </TouchableOpacity>
      </View>

      {sessions.length === 0 ? (
        <View className="items-center justify-center flex-1 px-10">
          <MaterialCommunityIcons
            name="playlist-plus"
            size={44}
            color="rgba(255,255,255,0.3)"
          />
          <Text className="mt-4 text-center text-white/50 font-rMedium">
            Create a session for your next show — a setlist of loops you can
            fire instantly.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1">
          {sessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              className="flex-row items-center justify-between py-4 px-4 mb-3 rounded-xl bg-white/10 border-white/10 border"
              onPress={() => setOpenSessionId(session.id)}
              onLongPress={() => handleSessionOptions(session)}
            >
              <View className="flex-1">
                <Text className="text-lg text-white font-rBold">
                  {session.name}
                </Text>
                <Text className="text-xs text-white/60 font-rRegular">
                  {session.loopKeys.length}{" "}
                  {session.loopKeys.length === 1 ? "loop" : "loops"}
                </Text>
              </View>
              <View className="px-1 py-4 rounded-lg bg-accent" />
              <Ionicons
                name="chevron-forward"
                size={20}
                color="rgba(255,255,255,0.5)"
                style={{ marginLeft: 10 }}
              />
            </TouchableOpacity>
          ))}
          <Text className="mt-2 mb-6 text-xs text-center text-white/30 font-rRegular">
            Long-press a session to rename or delete.
          </Text>
        </ScrollView>
      )}
    </View>
  );

  return (
    <SafeAreaView className="items-center justify-start flex-1 bg-primary">
      <HeaderComponent />
      {openSession ? renderDetail(openSession) : renderList()}
      {renderLoopPicker()}
      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
}
