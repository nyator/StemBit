import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'

type LaunchPadComponentProp = {
    selectKey: string,
    isPlaying: Boolean,
    onPress: () => void,
}

export default function LaunchPadComponent({ selectKey, isPlaying, onPress }: LaunchPadComponentProp) {
    return (
        <TouchableOpacity
            className={` w-4/12 h-32 rounded-2xl flex justify-center items-center  ${isPlaying ? "border-2 border-green-300 shadow-sm bg-accent shadow-accent" : "bg-white border-2 border-gray-300 shadow-sm shadow-gray-400"}`}
            onPress={onPress}
        >
            <Text className={`font-cBold text-xl ${isPlaying ? "text-white" : "text-black"}`}>{selectKey ? selectKey : "NaN"}</Text>
        </TouchableOpacity>
    )
}