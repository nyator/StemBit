import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  SafeAreaView, 
  StatusBar, 
  TouchableOpacity, 
  ScrollView,
  Image,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import CustomButton from '../../components/customButton';

const UserScreen = () => {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('John Doe');
  const [email, setEmail] = useState('john@example.com');
  const [bio, setBio] = useState('Software developer passionate about mobile apps and technology.');
  const [location, setLocation] = useState('San Francisco, CA');
  const [joinDate] = useState('August 2023');

  const handleGoBack = () => {
    router.back();
  };

  const handleSave = () => {
    // In a real app, you would save the data to a backend or local storage
    setEditing(false);
    Alert.alert('Success', 'Profile updated successfully!');
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancel = () => {
    // Reset to original values if needed
    setEditing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View className="flex-row justify-between items-center px-5 mt-7 mb-1">
        <TouchableOpacity 
          onPress={handleGoBack}
          className="p-2 rounded-full bg-white/10"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        {/*<View style={{ width: 32 }} /> /!* Empty view for alignment *!/*/}
      </View>

      <ScrollView className="flex-1 px-5">
        {/* Profile Picture */}
        <View className="items-center my-6">
          <View className="relative">
            <View className="w-28 h-28 rounded-full bg-accent/20 items-center justify-center">
              <Ionicons name="person" size={60} color="#098F6D" />
            </View>
            {editing && (
              <TouchableOpacity 
                className="absolute bottom-0 right-0 bg-accent rounded-full p-2"
                onPress={() => Alert.alert('Feature', 'Photo upload would be implemented here')}
              >
                <Ionicons name="camera" size={18} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Profile Information */}
        <View className="bg-white/5 rounded-xl p-5 mb-6">
          <View className="mb-4">
            <Text className="text-accent font-rMedium mb-1">Name</Text>
            {editing ? (
              <TextInput
                className="bg-white/10 text-white font-rMedium p-3 rounded-lg"
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor="rgba(255,255,255,0.5)"
              />
            ) : (
              <Text className="text-white text-lg font-rBold">{name}</Text>
            )}
          </View>

          <View className="mb-4">
            <Text className="text-accent font-rMedium mb-1">Email</Text>
            {editing ? (
              <TextInput
                className="bg-white/10 text-white font-rMedium p-3 rounded-lg"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="rgba(255,255,255,0.5)"
                keyboardType="email-address"
              />
            ) : (
              <Text className="text-white text-lg">{email}</Text>
            )}
          </View>

          <View className="mb-4">
            <Text className="text-accent font-rMedium mb-1">Bio</Text>
            {editing ? (
              <TextInput
                className="bg-white/10 text-white font-rMedium p-3 rounded-lg"
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself"
                placeholderTextColor="rgba(255,255,255,0.5)"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            ) : (
              <Text className="text-white">{bio}</Text>
            )}
          </View>

          <View className="mb-4">
            <Text className="text-accent font-rMedium mb-1">Location</Text>
            {editing ? (
              <TextInput
                className="bg-white/10 text-white font-rMedium p-3 rounded-lg"
                value={location}
                onChangeText={setLocation}
                placeholder="Your location"
                placeholderTextColor="rgba(255,255,255,0.5)"
              />
            ) : (
              <Text className="text-white">{location}</Text>
            )}
          </View>

          <View>
            <Text className="text-accent font-rMedium mb-1">Member Since</Text>
            <Text className="text-white">{joinDate}</Text>
          </View>
        </View>

        {/* Stats Section */}
        <View className="bg-white/5 rounded-xl p-5 mb-6">
          <Text className="text-xl text-accent font-rBold mb-4">Activity Stats</Text>
          
          <View className="flex-row justify-between mb-3">
            <View className="items-center bg-white/10 rounded-lg p-3 flex-1 mr-2">
              <Text className="text-2xl text-white font-rBold">12</Text>
              <Text className="text-white/70">Projects</Text>
            </View>
            <View className="items-center bg-white/10 rounded-lg p-3 flex-1 ml-2">
              <Text className="text-2xl text-white font-rBold">156</Text>
              <Text className="text-white/70">Hours</Text>
            </View>
          </View>
          
          <View className="flex-row justify-between">
            <View className="items-center bg-white/10 rounded-lg p-3 flex-1 mr-2">
              <Text className="text-2xl text-white font-rBold">8</Text>
              <Text className="text-white/70">Badges</Text>
            </View>
            <View className="items-center bg-white/10 rounded-lg p-3 flex-1 ml-2">
              <Text className="text-2xl text-white font-rBold">4.8</Text>
              <Text className="text-white/70">Rating</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        {editing ? (
          <View className="flex-row mb-10">
            <TouchableOpacity 
              className="flex-1 py-4 bg-white/10 rounded-xl mr-2"
              onPress={handleCancel}
            >
              <Text className="text-white text-center text-lg font-rMedium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className="flex-1 py-4 bg-accent rounded-xl ml-2"
              onPress={handleSave}
            >
              <Text className="text-white text-center text-lg font-rBold">Save</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CustomButton 
            title="Edit Profile"
            handlePress={handleEdit}
            containerStyles="mb-10"
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default UserScreen;