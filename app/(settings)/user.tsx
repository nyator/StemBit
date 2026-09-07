import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useUser } from "@clerk/expo";

import { useProfilePhoto } from "../../hooks/useProfilePhoto";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import { SettingLink, SettingNoLink, SettingSection } from "../../components/ui/settingRow";
import { COLORS } from "../../constants/theme";
import { Edit2, Sms, Calendar, Warning2, Close } from "../../components/icons";
import { ProfileCircle } from "../../components/icons";
import { wipeLocalData } from "../../utils/wipeLocalData";
import { clerkNameFromEmail } from "../../utils/nameFromEmail";

type AccountInfo = {
  name: string;
  email: string;
  memberSince: string;
};

// Profile, read straight off Clerk's user resource.
//
// No fetch and no local copy: useUser subscribes to the signed-in user, so an
// edit made here re-renders from the same source that persisted it. The old
// version kept its own state and had to remember to patch it after a rename,
// which is a second place for the name to be wrong.
const UserScreen = () => {
  const { width } = useWindowDimensions();
  const avatarSize = Math.min(width * 0.28, 110);

  const router = useRouter();
  const { user, isLoaded } = useUser();
  const loading = !isLoaded;
  const [deleting, setDeleting] = useState(false);
  const {
    choose: choosePhoto,
    remove: removePhoto,
    busy: photoBusy,
    hasPhoto,
  } = useProfilePhoto();

  const account: AccountInfo | null = useMemo(() => {
    if (!user) return null;
    return {
      // fullName is null until somebody sets one; the address is the only
      // thing guaranteed to exist after a passwordless sign-up.
      name: user.fullName || user.username || "Musician",
      email: user.primaryEmailAddress?.emailAddress ?? "",
      memberSince: user.createdAt
        ? user.createdAt.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
          })
        : "",
    };
  }, [user]);

  // Accounts created before sign-up started seeding a name still have none.
  // Fill it in once, from the same guess, rather than leaving them reading
  // "Musician" forever. Only ever writes into an empty field -- a name the user
  // chose is never overwritten.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !isLoaded || !user) return;
    if (user.firstName || user.lastName) return;

    const email = user.primaryEmailAddress?.emailAddress;
    const guessed = email ? clerkNameFromEmail(email) : undefined;
    if (!guessed) return;

    // Set before the await, so a re-render mid-flight can't start a second one.
    seeded.current = true;
    user.update(guessed).catch((error) => {
      console.warn("Could not seed a display name", error);
    });
  }, [isLoaded, user]);

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
            if (!name || !user) return;
            try {
              // Clerk splits a name in two, and this screen collects one
              // string. Everything past the first space is the last name, so
              // "Henry Nyator" round-trips as fullName rather than becoming a
              // first name with a space in it.
              const [firstName, ...rest] = name.split(/\s+/);
              await user.update({
                firstName,
                lastName: rest.join(" "),
              });
              // No local setState: useUser re-renders from the updated
              // resource, so there is only ever one copy of the name.
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

  /**
   * Delete the account, for real.
   *
   * Required by App Store guideline 5.1.1(v): anything that lets somebody
   * create an account has to let them destroy it from inside the app, without
   * emailing support first.
   *
   * Two confirmations rather than one. The first explains what goes; the second
   * exists because this is unrecoverable and the first is the one people tap
   * without reading. Nothing here is undoable and none of it is backed up.
   */
  const confirmDelete = () => {
    Alert.alert(
      "Delete your account?",
      "Your account, your imported loops, your downloaded packs and your setlists are all deleted from this device. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "This is permanent",
              "There's no way to get any of it back.",
              [
                { text: "Keep my account", style: "cancel" },
                {
                  text: "Delete everything",
                  style: "destructive",
                  onPress: runDelete,
                },
              ]
            ),
        },
      ]
    );
  };

  const runDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      // The account goes first. If this throws, the user still has both their
      // account and their loops, and can be told plainly that nothing happened
      // -- whereas wiping the device first and then failing here would cost
      // them their work for nothing.
      await user.delete();
    } catch (error) {
      console.error("Account deletion failed", error);
      setDeleting(false);
      Alert.alert(
        "Couldn't delete your account",
        "Nothing was removed. Check your connection and try again."
      );
      return;
    }

    // Best effort, and intentionally not awaited for correctness of the flow:
    // the account is already gone, so this finishing or not cannot change
    // whether the deletion "worked". Deleting the session invalidates it, which
    // unmounts this screen via the (tabs) guard -- the file operations carry on
    // regardless, since they hold no React state.
    wipeLocalData().catch(console.error);

    // Navigated explicitly, for the same reason sign-out is: (settings) is a
    // sibling of (tabs) in the root Stack, so the guard in (tabs)/_layout never
    // renders this screen and cannot redirect it. Without this, the user is
    // left sitting on the profile page of an account that no longer exists.
    router.replace("/login");
  };

  const initial = (account?.name || account?.email || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <Screen glows={["topLeft"]}>
      <ScreenHeader title="Profile" />

      {loading ? (
        <View className="items-center justify-center flex-1">
          <ActivityIndicator color={COLORS.brand} />
        </View>
      ) : (
        <ScrollView className="flex-1 px-screen">
          {/* Avatar. Tapping it is the only way to set a picture, so it says
              so underneath -- a circle that happens to be tappable is a
              feature nobody finds. */}
          <View className="items-center my-6">
            {/* The avatar and its remove button are siblings inside this box
                rather than nested: the avatar clips to a circle
                (overflow-hidden), and a button placed inside it would have its
                corner clipped away with it. */}
            <View style={{ width: avatarSize, height: avatarSize }}>
              <TouchableOpacity
                onPress={account ? choosePhoto : undefined}
                disabled={!account || photoBusy}
                accessibilityRole="button"
                accessibilityLabel={
                  hasPhoto ? "Change your profile picture" : "Add a profile picture"
                }
                activeOpacity={0.8}
                className="items-center justify-center overflow-hidden rounded-full bg-brand/20 border border-brand/40"
                style={{ width: avatarSize, height: avatarSize }}
              >
                {photoBusy ? (
                  <ActivityIndicator color={COLORS.brand} />
                ) : hasPhoto && user?.imageUrl ? (
                  <Image
                    source={{ uri: user.imageUrl }}
                    style={{ width: avatarSize, height: avatarSize }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text
                    className="text-brand font-spaceBold"
                    style={{ fontSize: avatarSize * 0.4 }}
                  >
                    {initial}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Only when there is something to remove. It sits on the
                  canvas colour with a ring, so it reads as a control on top of
                  the photo rather than part of it -- and hitSlop takes the
                  28pt badge up to the 44pt the platform asks for without
                  drawing a button that size over the picture. */}
              {account && hasPhoto && !photoBusy && (
                <TouchableOpacity
                  onPress={removePhoto}
                  accessibilityRole="button"
                  accessibilityLabel="Remove your profile picture"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                  className="absolute items-center justify-center rounded-full"
                  style={{
                    top: 0,
                    right: 0,
                    width: 28,
                    height: 28,
                    backgroundColor: COLORS.canvas,
                    borderWidth: 1,
                    borderColor: COLORS.borderGlass,
                  }}
                >
                  <Close size={14} color={COLORS.white} />
                </TouchableOpacity>
              )}
            </View>

            {account && !photoBusy && (
              <TouchableOpacity
                onPress={choosePhoto}
                accessibilityRole="button"
                className="mt-3"
              >
                <Text className="text-brand text-label font-satoshiMedium">
                  {hasPhoto ? "Change photo" : "Add photo"}
                </Text>
              </TouchableOpacity>
            )}

            <Text className="mt-4 text-heading text-white font-satoshiBold">
              {account ? account.name : "Not signed in"}
            </Text>
            {account && (
              <Text className="mt-1 text-label text-white/50 font-satoshiRegular">
                {account.email}
              </Text>
            )}
          </View>

          {account ? (
            <SettingSection title="Account">
              <SettingLink
                icon={Edit2}
                label="Display Name"
                value={account.name}
                onPress={handleRename}
              />
              <SettingNoLink
                icon={Sms}
                label="Email"
                value={account.email}
                onPress={() => {}}
              />
              <SettingNoLink
                icon={Calendar}
                label="Member Since"
                value={account.memberSince}
                onPress={() => {}}
              />
            </SettingSection>
          ) : null}

          {/* Its own section, below everything else and visibly separated.
              Deleting an account is not one of the things you do to a profile
              -- it is the end of having one -- and putting it in the same group
              as "Display Name" is how it gets tapped by mistake. */}
          {account ? (
            <View className="mt-6">
              <SettingSection title="Danger zone">
                <SettingLink
                  icon={Warning2}
                  label={deleting ? "Deleting…" : "Delete Account"}
                  danger
                  onPress={deleting ? () => {} : confirmDelete}
                />
              </SettingSection>
              <Text className="px-2 mt-2 text-ink-faint text-overline font-satoshiRegular leading-4">
                Removes your account and everything StemBit has stored on this
                device — imported loops, downloaded packs, setlists and
                settings. It can&apos;t be undone.
              </Text>
            </View>
          ) : (
            <View className="items-center px-8 py-10 rounded-2xl bg-white/5">
              <ProfileCircle size={40}
                color="rgba(255,255,255,0.3)" />
              <Text className="mt-3 text-center text-white/50 font-satoshiMedium">
                You're using StemBit without an account. Sign in to sync your
                profile across devices.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
};

export default UserScreen;
