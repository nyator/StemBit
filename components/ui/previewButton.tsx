import { TouchableOpacity, View } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { COLORS } from "../../constants/theme";
import { PauseCircle, PlayCircle } from "../icons";

// Real Liquid Glass on iOS 26+; every other platform (older iOS, Android,
// web) falls back to the flat well this button already had. A device's
// glass support can't change mid-session, so this is read once.
const HAS_LIQUID_GLASS = isLiquidGlassAvailable();

// Audition a row without loading it.
//
// The loop browser and the pad browser had grown one of these each, byte for
// byte the same button -- same well, same diameter, same two icons -- except
// that only the pad one told a screen reader what it was. They are the same
// control on the same kind of list, so they are one component, and the loop
// browser gets the label it was missing.

/**
 * The well behind the icon: a translucent teal, dark enough to read as a
 * recess on the row rather than a second, competing button.
 *
 * Deliberately not the brand blue. The brand marks what is *loaded*, and a
 * preview is the opposite of that -- it is what you are listening to before
 * deciding, and it should not look like a selection.
 */
const PREVIEW_WELL = "rgba(0,89,128,0.3)";

/** Big enough to hit beside a row's text without crowding the title. */
const BUTTON_SIZE = 34;
const ICON_SIZE = 24;

export default function PreviewButton({
  isPlaying,
  onPress,
  title,
}: {
  isPlaying: boolean;
  onPress: () => void;
  /** What is being auditioned, for the screen-reader label. */
  title: string;
}) {
  const Icon = isPlaying ? PauseCircle : PlayCircle;

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${isPlaying ? "Stop preview of" : "Preview"} ${title}`}
    >
      {HAS_LIQUID_GLASS ? (
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          tintColor={PREVIEW_WELL}
          style={{
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            borderRadius: BUTTON_SIZE / 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={ICON_SIZE} color={COLORS.white} />
        </GlassView>
      ) : (
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            backgroundColor: PREVIEW_WELL,
          }}
        >
          <Icon size={ICON_SIZE} color={COLORS.white} />
        </View>
      )}
    </TouchableOpacity>
  );
}
