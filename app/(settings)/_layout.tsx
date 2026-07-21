import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import { Stack, useRouter } from 'expo-router'
import { COLORS } from '../../constants/theme'
import { ArrowLeft } from "../../components/icons";


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
              <ArrowLeft size={24} color="#fff" />
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
              <ArrowLeft size={24} color="#fff" />
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
        name="termsofservice"
        options={{
          headerShown: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 10 }}>
              <ArrowLeft size={24} color="#fff" />
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
        name="privacypolicy"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="audiovolume"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  )
}

export default SettingsLayout