import { View, Text, StatusBar, ScrollView, TouchableOpacity, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import ScreenHeader from "../../components/ui/screenHeader";
import { COLORS, SUPPORT_EMAIL } from "../../constants/theme";

const GUIDES: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}[] = [
  {
    icon: "musical-notes-outline",
    title: "Bits (Loops)",
    body: "Browse loops by category or artist, preview them, and load one with the Load dialog. Change the BPM freely — loops warp to your tempo without changing key, and the loop point stays seamless.",
  },
  {
    icon: "grid-outline",
    title: "WPad",
    body: "Sustained pads in every major and minor key. Tap a key to fade it in; tap again to stop. Switching keys crossfades smoothly so you can move with the song.",
  },
  {
    icon: "speedometer-outline",
    title: "Metronome",
    body: "Set the tempo with +/- (hold to scrub), type it in, or tap the tempo pad in time. Choose a time signature — compound and odd meters click in their natural groups. Use ½× / 1× / 2× to change the feel without changing the BPM.",
  },
  {
    icon: "list-outline",
    title: "Sessions",
    body: "A session is your setlist: an ordered list of loops for a show. Build it at rehearsal, then tap any loop to load it instantly between songs. Long-press to rename, reorder with the arrows.",
  },
  {
    icon: "play-circle-outline",
    title: "One sound at a time",
    body: "The metronome and loop player never fight: starting one asks you to stop the other. A floating pill shows anything playing from another tab — tap it to jump there, or hit its stop button.",
  },
];

const Help = () => {
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Help & Support" />

      <ScrollView className="flex-1 px-5">
        {GUIDES.map((guide) => (
          <View
            key={guide.title}
            className="p-4 mb-3 border rounded-2xl bg-white/5 border-white/10"
          >
            <View className="flex-row items-center mb-2">
              <View className="items-center justify-center w-8 h-8 mr-3 rounded-lg bg-brand/20">
                <Ionicons name={guide.icon} size={17} color={COLORS.brand} />
              </View>
              <Text className="text-base text-white font-satoshiBold">
                {guide.title}
              </Text>
            </View>
            <Text className="text-sm leading-5 text-white/60 font-satoshiRegular">
              {guide.body}
            </Text>
          </View>
        ))}

        <TouchableOpacity
          className="flex-row items-center justify-center py-4 mt-2 mb-10 rounded-2xl bg-brand"
          onPress={() =>
            Linking.openURL(
              `mailto:${SUPPORT_EMAIL}?subject=StemBit Support`
            ).catch(() => {})
          }
        >
          <Ionicons name="mail-outline" size={18} color="black" />
          <Text className="ml-2 text-base text-black font-satoshiBold">
            Email Support
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Help;
