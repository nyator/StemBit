import * as SecureStore from "expo-secure-store";
import type { TokenCache } from "@clerk/expo";

// Where the session token lives between launches.
//
// Clerk keeps it in memory by default, which means every cold start is a signed
// -out start -- for an app somebody opens on stage between songs, that is the
// difference between "it just works" and "why am I logging in again". SecureStore
// puts it in the iOS Keychain / Android Keystore rather than in plain storage,
// which is the right place for something that IS the session.
//
// Every method swallows its errors on purpose. A cache miss must degrade to
// "not signed in", never to a crash: the Keychain can genuinely fail -- a
// restore to a new device, a corrupted entry, a user who has never unlocked the
// device since boot -- and none of those are worth a red screen when the honest
// answer is just to ask them to sign in again.
export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // A value that can't be read is a value that can't be trusted. Drop it so
      // the next save starts from a clean slot rather than failing forever
      // against a corrupted one.
      await SecureStore.deleteItemAsync(key).catch(() => {});
      return null;
    }
  },

  async saveToken(key: string, token: string) {
    try {
      await SecureStore.setItemAsync(key, token);
    } catch (error) {
      // Failing to persist costs the user a sign-in on next launch. Failing
      // loudly here would cost them this one.
      console.error("Could not persist the session token", error);
    }
  },

  async clearToken(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Already gone is the outcome we wanted anyway.
    }
  },
};
