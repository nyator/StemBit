import {View, Text, TouchableOpacity} from "react-native";
import {useRouter} from "expo-router";
import { Setting2, Setting4 } from "./icons";

const HeaderComponent = () => {
    const router = useRouter();

    return (
        <View className="flex flex-row justify-between items-center px-8 my-5 w-full">
            <View className="flex flex-row justify-between items-center w-2/5">
                <View className="flex flex-row justify-center items-center">
                    <Text className="text-3xl text-white font-wordmark">Stembits</Text>
                </View>
            </View>

            <View className="flex-row">
                <TouchableOpacity
                    className="p-2 rounded-full"
                    onPress={() => router.push("/(settings)/audiovolume")}
                    accessibilityLabel="Go to settings"
                >
                    <Setting4 size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                    className="p-2 rounded-full"
                    onPress={() => router.push("/(settings)")}
                    accessibilityLabel="Go to settings"
                >
                    <Setting2 size={24} color="white" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default HeaderComponent;
