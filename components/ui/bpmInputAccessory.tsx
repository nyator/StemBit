import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Attach this to the tempo TextInput via `inputAccessoryViewID`.
export const BPM_ACCESSORY_ID = "bpm-input-accessory";

// The tempo field uses a numeric keyboard, which on iOS has no return/Done
// key — so there's otherwise no way to dismiss it and reach the transport
// controls underneath. This renders a Done bar above the keyboard that blurs
// the field (committing the typed BPM). No-op on Android, whose numeric
// keyboard is dismissible via the system back gesture and which doesn't
// support InputAccessoryView.
export function BpmInputAccessory() {
  if (Platform.OS !== "ios") return null;
  return (
    <InputAccessoryView nativeID={BPM_ACCESSORY_ID}>
      <View className="flex-row justify-end px-4 py-2 border-t bg-surface-field border-hairline-strong">
        <TouchableOpacity
          onPress={() => Keyboard.dismiss()}
          accessibilityLabel="Done editing tempo"
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        >
          <Text className="text-brand text-body font-spaceBold">Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}
