import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import { Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons' // or any icon library you use

const ProfileScreen = () => {
  const router = useRouter();

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
              {/* You can customize the icon, size, and color */}
            </TouchableOpacity>
          ),
          headerBackTitle: "Back",
          headerBackTitleStyle: { fontFamily: "font-rBold" },
          contentStyle: { backgroundColor: "#101116" },
          headerStyle: { backgroundColor: "#000" },
        }}
      />
    </Stack>
  )
}

export default ProfileScreen