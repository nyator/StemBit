import { View, Text, StatusBar, ScrollView, TouchableOpacity, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ScreenHeader from "../../components/ui/screenHeader";
import { COLORS, SUPPORT_EMAIL } from "../../constants/theme";
import {
  Clipboard,
  type IconComponent,
  Musicnote,
  Setting4,
  PlayCircleOutline,
} from "../../components/icons";

const GUIDES: {
  icon: IconComponent;
  title: string;
  body: string;
}[] = [
    {
      icon: Musicnote,
      title: "Bits (Loops)",
      body: "Browse loops by category or artist, preview them, and load one with the Load dialog. Change the BPM freely — loops warp to your tempo without changing key, and the loop point stays seamless.",
    },
    {
      icon: Clipboard,
      title: "Pad",
      body: "Sustained pads in every major and minor key. Tap a key to fade it in; tap again to stop. Switching keys crossfades smoothly so you can move with the song.",
    },
    {
      icon: Setting4,
      title: "Metronome",
      body: "Set the tempo with +/- (hold to scrub), type it in, or tap the tempo pad in time. Choose a time signature — compound and odd meters click in their natural groups. Use 0.5× / 1× / 2× to change the feel without changing the BPM.",
    },
    {
      icon: PlayCircleOutline,
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
                <guide.icon size={17} color={COLORS.brand} />
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
            ).catch(() => { })
          }
        >
          <Text className="ml-2 text-base text-black font-satoshiBold">
            Email Support
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Help;
