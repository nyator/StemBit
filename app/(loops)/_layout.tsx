import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import { Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons' // or any icon library you use


const LoopSoundsLayout = () => {
    const router = useRouter();

    return (
        <Stack>
            <Stack.Screen name="index" options={{headerShown: false}}/>
            <Stack.Screen name="sounds" options={{headerShown: false}}/>
        </Stack>
    )
}

export default LoopSoundsLayout