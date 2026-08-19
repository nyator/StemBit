import { Text, View } from "react-native";

export default function AuthFooter() {
  return (
    <View className="flex-row justify-center pb-2">
      <Text className="text-ink-faint font-satoshiMedium text-label">by </Text>
      <Text className="text-brand font-satoshiMedium text-label">builtelo</Text>
    </View>
  );
}
