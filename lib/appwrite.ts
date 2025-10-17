import { Client, Account, ID } from "react-native-appwrite";

type createUserProp = {
  email: string;
  password: string;
  // username: string;
};

export const config = {
  endpoint: "https://fra.cloud.appwrite.io/v1",
  projectId: "686d2362001e8efdbe12",
  platformId: "com.nehtek.stembit",
  databaseId: "687d364600374f54f23a",
  usersCollectionId: "687d37b80037b383d642",
  audiosCollectionId: "687d38270022eb62d7b9",
  filesStorageId: "687d3c0b002c67c563f2",

  devKey:
    "aea935b6936e6b9a7ea19aa4d164e92826aede78ca9743624040e136a6a4c6201179ee610ea9f323dd607116607a6470b590d0e3de05d1ffb2d12ced0d0c2aa91fda9c33fc63db6cb78e979fa57d3f2373c45cddb142af9b71a3b55f2dceb43057b9a8c60c4af1476bbd700367602ae9fec9a784a064ea9d50481b327d8a142a",
};

// Init your React Native SDK
const client = new Client();
const account = new Account(client);

client
  .setEndpoint(config.endpoint) // Your Appwrite Endpoint
  .setProject(config.projectId) // Your project ID
  .setPlatform(config.platformId) // Your application ID or bundle ID.
  .setDevKey(config.devKey);

export const createUser = async ({ email, password }: createUserProp) => {
  try {
    const response = await account.create(ID.unique(), email, password);
    return response;
  } catch (error) {
    throw error;
  }
};

export const loginUser = async ({ email, password }: createUserProp) => {
  try {
    console.log("Attempting login with:", email);
    // Creates a session for the user
    const response = await account.createSession(email, password);
    console.log("Login success:", response);
    return response;
  } catch (error) {
    console.log("Login error:", error);
    throw error;
  }
};

export const getUserDetails = async () => {
  try {
    const user = await account.get();
    return user;
  } catch (error) {
    throw error;
  }
};
