import { useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useUser } from "@clerk/expo";

/**
 * Picking, cropping and uploading a profile picture.
 *
 * Kept out of the screen because almost none of it is layout: there is a
 * permission to handle, a cancel that is a decision rather than an error, a
 * size ceiling, and an upload that can fail. The screen just needs "choose" and
 * "remove".
 */

// Clerk rejects anything over 10MB. Squaring and re-encoding at 0.7 keeps a
// modern phone photo an order of magnitude under that, so the ceiling below is
// a backstop rather than something users are expected to hit.
const MAX_BYTES = 10 * 1024 * 1024;

export function useProfilePhoto() {
  const { user } = useUser();
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    if (!user) return;

    // Asked for at the moment it is needed rather than at launch, so the system
    // prompt arrives with the reason on screen behind it.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo access is off",
        "StemBit needs permission to open your photos. You can turn it on in Settings."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      // Square crop up front: the avatar is a circle everywhere it appears, so
      // letting somebody frame it themselves beats centre-cropping whatever
      // they picked and hoping their face is in the middle.
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    // A cancel is a decision, not an error, and shouldn't surface as one.
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("Couldn't read that photo", "Try picking a different one.");
      return;
    }

    // base64 inflates by roughly 4/3, so this measures the payload actually
    // being uploaded rather than the file on disk.
    if ((asset.base64.length * 3) / 4 > MAX_BYTES) {
      Alert.alert("That photo is too large", "Pick one under 10MB.");
      return;
    }

    setBusy(true);
    try {
      const mime = asset.mimeType ?? "image/jpeg";
      // Clerk's setProfileImage takes a Blob, a File, or a data URI string.
      // React Native has no File, and Blob support is partial, so the data URI
      // is the one form that works on both platforms.
      await user.setProfileImage({ file: `data:${mime};base64,${asset.base64}` });
    } catch (error) {
      console.error("Profile photo upload failed", error);
      Alert.alert(
        "Couldn't upload that photo",
        "Check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!user) return;
    setBusy(true);
    try {
      // null is Clerk's documented way to clear the image; the avatar falls
      // back to the user's initial.
      await user.setProfileImage({ file: null });
    } catch (error) {
      console.error("Could not remove the profile photo", error);
      Alert.alert("Couldn't remove that photo", "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return { choose, remove, busy, hasPhoto: !!user?.hasImage };
}
