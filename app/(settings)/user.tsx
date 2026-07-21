import { useEffect, useState } from "react";
import {
  View,
  Text,
  StatusBar,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import ScreenHeader from "../../components/ui/screenHeader";
import { SettingLink, SettingSection } from "../../components/ui/settingRow";
import { getUserDetails, updateUserName } from "../../lib/appwrite";
import { COLORS } from "../../constants/theme";

type AccountInfo = {
  name: string;
  email: string;
  memberSince: string;
};

// Profile: real account data from Appwrite. When there's no session (the
// dev auth bypass), it says so instead of showing placeholder people.
const UserScreen = () => {
  const { width } = useWindowDimensions();
  const avatarSize = Math.min(width * 0.28, 110);

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAccount = async () => {
    try {
      const user = await getUserDetails();
      setAccount({
        name: user.name || "Musician",
        email: user.email,
        memberSince: new Date(user.registration).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
        }),
      });
    } catch {
      setAccount(null); // no active session
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccount();
  }, []);

  const handleRename = () => {
    if (!account) return;
    if (Platform.OS !== "ios") return; // Alert.prompt is iOS-only
    Alert.prompt(
      "Display Name",
      undefined,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: async (text?: string) => {
            const name = (text ?? "").trim();
            if (!name) return;
            try {
              await updateUserName(name);
              setAccount((prev) => (prev ? { ...prev, name } : prev));
            } catch {
              Alert.alert("Update failed", "Could not update your name. Try again.");
            }
          },
        },
      ],
      "plain-text",
      account.name
    );
  };

  const initial = (account?.name || account?.email || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Profile" />

      {loading ? (
        <View className="items-center justify-center flex-1">
          <ActivityIndicator color={COLORS.brand} />
        </View>
      ) : (
        <ScrollView className="flex-1 px-5">
          {/* Avatar */}
          <View className="items-center my-6">
            <View
              className="items-center justify-center rounded-full bg-brand/20 border border-brand/40"
              style={{ width: avatarSize, height: avatarSize }}
            >
              <Text
                className="text-brand font-spaceBold"
                style={{ fontSize: avatarSize * 0.4 }}
              >
                {initial}
              </Text>
            </View>
            <Text className="mt-4 text-2xl text-white font-satoshiBold">
              {account ? account.name : "Not signed in"}
            </Text>
            {account && (
              <Text className="mt-1 text-sm text-white/50 font-satoshiRegular">
                {account.email}
              </Text>
            )}
          </View>

          {account ? (
            <SettingSection title="Account">
              <SettingLink
                icon="create-outline"
                label="Display Name"
                value={account.name}
                onPress={handleRename}
              />
              <SettingLink
                icon="mail-outline"
                label="Email"
                value={account.email}
                onPress={() => {}}
              />
              <SettingLink
                icon="calendar-outline"
                label="Member Since"
                value={account.memberSince}
                onPress={() => {}}
              />
            </SettingSection>
          ) : (
            <View className="items-center px-8 py-10 rounded-2xl bg-white/5">
              <Ionicons
                name="person-circle-outline"
                size={40}
                color="rgba(255,255,255,0.3)"
              />
              <Text className="mt-3 text-center text-white/50 font-satoshiMedium">
                You're using StemBit without an account. Sign in to sync your
                profile across devices.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default UserScreen;
