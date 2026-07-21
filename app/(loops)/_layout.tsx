import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import { Stack, useRouter } from 'expo-router'


const LoopSoundsLayout = () => {
    const router = useRouter();

    return (
        <Stack>
            <Stack.Screen name="sounds" options={{headerShown: false}}/>
        </Stack>
    )
}

export default LoopSoundsLayout