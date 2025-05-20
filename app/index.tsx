import { StyleSheet, Text, View } from "react-native";
import '../global.css'

export default function Page() {
  return (
    <View className="mx-auto max-w-sm flex-1 justify-center gap-4 px-8 py-4">
        <View className="flex-1 flex justify-center max-w-3xl mx-auto">
        <Text style={styles.title} className="">Stem World</Text>
        {/* <Text style={styles.subtitle}>This is the first page of your app.</Text> */}
        <Text className="text-2xl underline font-extrabold text-blue-500"> App </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    padding: 24,
  },
  main: {
    flex: 1,
    justifyContent: "center",
    maxWidth: 960,
    marginHorizontal: "auto",
  },
  title: {
    fontSize: 64,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 36,
    color: "#38434D",
  },
});
