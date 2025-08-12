import React, { useState } from "react";
import { Dimensions } from "react-native";
import {
  View,
  Text,
  TextInput,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import CustomButton from "../../components/customButton";

const UserScreen = () => {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("John Doe");
  const [email, setEmail] = useState("john@example.com");
  const [bio, setBio] = useState(
    "Software developer passionate about mobile apps and technology."
  );
  const [location, setLocation] = useState("San Francisco, CA");
  const [joinDate] = useState("August 2023");

  const handleGoBack = () => {
    router.back();
  };

  const handleSave = () => {
    // In a real app, you would save the data to a backend or local storage
    setEditing(false);
    Alert.alert("Success", "Profile updated successfully!");
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancel = () => {
    // Reset to original values if needed
    setEditing(false);
  };

  // Responsive avatar size (30% of screen width, max 120)
  const screenWidth = Dimensions.get('window').width;
  const avatarSize = Math.min(screenWidth * 0.3, 120);

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View className="flex-row justify-between items-center px-4 md:px-8 my-5 mb-1">
        <TouchableOpacity
          onPress={handleGoBack}
          className="p-2 rounded-full bg-white/10"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 md:px-8">
        {/* Profile Picture */}
        <View className="items-center my-4 md:my-8">
          <View className="relative" style={{ width: avatarSize, height: avatarSize }}>
            <View
              className="rounded-full bg-accent/20 items-center justify-center"
              style={{ width: avatarSize, height: avatarSize }}
            >
              <Ionicons name="person" size={avatarSize * 0.5} color="#098F6D" />
            </View>
            {editing && (
              <TouchableOpacity
                className="absolute bottom-0 right-0 bg-accent rounded-full"
                style={{ padding: avatarSize * 0.13 }}
                onPress={() =>
                  Alert.alert(
                    "Feature",
                    "Photo upload would be implemented here"
                  )
                }
              >
                <Ionicons name="camera" size={avatarSize * 0.15} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Profile Information */}
        <View className="bg-white/5 rounded-xl p-4 md:p-6 mb-6">
          <View className="mb-3 md:mb-4">
            <Text className="text-accent font-rMedium mb-1 text-base md:text-lg">Name</Text>
            {editing ? (
              <TextInput
                className="bg-white/10 text-white font-rMedium p-3 rounded-lg text-base md:text-lg"
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor="rgba(255,255,255,0.5)"
              />
            ) : (
              <Text className="text-white text-lg md:text-xl font-rBold">{name}</Text>
            )}
          </View>

          <View className="mb-3 md:mb-4">
            <Text className="text-accent font-rMedium mb-1 text-base md:text-lg">Email</Text>
            {editing ? (
              <TextInput
                className="bg-white/10 text-white font-rMedium p-3 rounded-lg text-base md:text-lg"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="rgba(255,255,255,0.5)"
                keyboardType="email-address"
              />
            ) : (
              <Text className="text-white text-lg md:text-xl">{email}</Text>
            )}
          </View>

          <View className="mb-3 md:mb-4">
            <Text className="text-accent font-rMedium mb-1 text-base md:text-lg">Bio</Text>
            {editing ? (
              <TextInput
                className="bg-white/10 text-white font-rMedium p-3 rounded-lg text-base md:text-lg"
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself"
                placeholderTextColor="rgba(255,255,255,0.5)"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            ) : (
              <Text className="text-white text-base md:text-lg">{bio}</Text>
            )}
          </View>

          <View className="mb-3 md:mb-4">
            <Text className="text-accent font-rMedium mb-1 text-base md:text-lg">Location</Text>
            {editing ? (
              <TextInput
                className="bg-white/10 text-white font-rMedium p-3 rounded-lg text-base md:text-lg"
                value={location}
                onChangeText={setLocation}
                placeholder="Your location"
                placeholderTextColor="rgba(255,255,255,0.5)"
              />
            ) : (
              <Text className="text-white text-base md:text-lg">{location}</Text>
            )}
          </View>

          <View>
            <Text className="text-accent font-rMedium mb-1 text-base md:text-lg">Member Since</Text>
            <Text className="text-white text-base md:text-lg">{joinDate}</Text>
          </View>
        </View>

        {/* Stats Section */}
        <View className="bg-white/5 rounded-xl p-4 md:p-6 mb-6">
          <Text className="text-lg md:text-xl text-accent font-rBold mb-4">
            Activity Stats
          </Text>

          <View className="flex-row justify-between mb-3">
            <View className="items-center bg-white/10 rounded-lg p-3 flex-1 mr-2 min-w-0">
              <Text className="text-xl md:text-2xl text-white font-rBold">12</Text>
              <Text className="text-white/70 text-xs md:text-base">Projects</Text>
            </View>
            <View className="items-center bg-white/10 rounded-lg p-3 flex-1 ml-2 min-w-0">
              <Text className="text-xl md:text-2xl text-white font-rBold">156</Text>
              <Text className="text-white/70 text-xs md:text-base">Hours</Text>
            </View>
          </View>

          <View className="flex-row justify-between">
            <View className="items-center bg-white/10 rounded-lg p-3 flex-1 mr-2 min-w-0">
              <Text className="text-xl md:text-2xl text-white font-rBold">8</Text>
              <Text className="text-white/70 text-xs md:text-base">Badges</Text>
            </View>
            <View className="items-center bg-white/10 rounded-lg p-3 flex-1 ml-2 min-w-0">
              <Text className="text-xl md:text-2xl text-white font-rBold">4.8</Text>
              <Text className="text-white/70 text-xs md:text-base">Rating</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        {editing ? (
          <View className="flex-row mb-8 md:mb-10">
            <TouchableOpacity
              className="flex-1 py-3 md:py-4 bg-white/10 rounded-xl mr-2"
              onPress={handleCancel}
            >
              <Text className="text-white text-center text-base md:text-lg font-rMedium">
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 py-3 md:py-4 bg-accent rounded-xl ml-2"
              onPress={handleSave}
            >
              <Text className="text-white text-center text-base md:text-lg font-rBold">
                Save
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CustomButton
            title="Edit Profile"
            handlePress={handleEdit}
            containerStyles="mb-8 md:mb-10"
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default UserScreen;
