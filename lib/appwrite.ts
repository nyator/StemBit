import { Client, Account, ID } from "react-native-appwrite";

type createUserProp = {
  email: string;
  password: string;
  // username: string;
};

export const config = {
  endpoint: "https://fra.cloud.appwrite.io/v1",
  projectId: "686d2362001e8efdbe12",
  Platform: "com.nehtek.stembit",
  databaseId: "687d364600374f54f23a",
  usersCollectionId: "687d37b80037b383d642",
  audiosCollectionId: "687d38270022eb62d7b9",
  filesStorageId: "687d3c0b002c67c563f2",
};

// Init your React Native SDK
const client = new Client();
const account = new Account(client);

client
  .setEndpoint(config.endpoint) // Your Appwrite Endpoint
  .setProject(config.projectId) // Your project ID
  .setPlatform(config.projectId); // Your application ID or bundle ID.

// export const createUser = () => {
export const createUser = ({ email, password }: createUserProp) => {
  // account.create(ID.unique(), "me@example.com", "password", "Jane Doe").then(
  account.create(ID.unique(), email, password).then(
    function (response) {
      console.log(response);
    },
    function (error) {
      console.log(error);
    }
  );
};
