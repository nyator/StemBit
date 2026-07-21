import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import { Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons' // or any icon library you use
import { COLORS } from '../../constants/theme'


const SettingsLayout = () => {
  const router = useRouter();

  return (
    <Stack>
      <Stack.Screen
        name="user"
        options={{
          headerShown: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
              {/* You can customize the icon, size, and color */}
            </TouchableOpacity>
          ),
          headerBackTitle: "Back",
          headerBackTitleStyle: { fontFamily: "font-satoshiBold" },
          contentStyle: { backgroundColor: COLORS.canvas },
          headerStyle: { backgroundColor: "#000" },
        }}
      />
      <Stack.Screen
        name="help"
        options={{
          headerShown: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
              {/* You can customize the icon, size, and color */}
            </TouchableOpacity>
          ),
          headerBackTitle: "Back",
          headerBackTitleStyle: { fontFamily: "font-satoshiBold" },
          contentStyle: { backgroundColor: COLORS.canvas },
          headerStyle: { backgroundColor: "#000" },
        }}
      />
        <Stack.Screen name="index" options={{headerShown: false}}/>
    </Stack>
  )
}

export default SettingsLayout