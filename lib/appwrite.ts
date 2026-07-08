import { Client, Account, ID } from "react-native-appwrite";

type UserCredentials = {
  email: string;
  password: string;
};

export const config = {
  endpoint: "https://fra.cloud.appwrite.io/v1",
  projectId: "686d2362001e8efdbe12",
  platformId: "com.nehtek.stembit",
  databaseId: "687d364600374f54f23a",
  usersCollectionId: "687d37b80037b383d642",
  audiosCollectionId: "687d38270022eb62d7b9",
  filesStorageId: "687d3c0b002c67c563f2",
  // Never commit keys: this comes from .env (see .env.example). Rotate any
  // key that was previously committed to git history.
  devKey: process.env.EXPO_PUBLIC_APPWRITE_DEV_KEY,
};

const client = new Client()
  .setEndpoint(config.endpoint)
  .setProject(config.projectId)
  .setPlatform(config.platformId);

// The dev key only exists to bypass rate limits in development builds.
if (config.devKey) {
  client.setDevKey(config.devKey);
}

const account = new Account(client);

export const createUser = async ({ email, password }: UserCredentials) => {
  return account.create(ID.unique(), email, password);
};

export const loginUser = async ({ email, password }: UserCredentials) => {
  // createSession(userId, secret) is for token-based sessions — passing
  // email/password to it always fails. Email + password login is
  // createEmailPasswordSession.
  return account.createEmailPasswordSession(email, password);
};

export const logoutUser = async () => {
  return account.deleteSession("current");
};

export const getUserDetails = async () => {
  return account.get();
};
