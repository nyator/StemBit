import { Text, TouchableOpacity } from 'react-native'
import React from 'react'

type LaunchPadComponentProp = {
    selectKey: string;
    isPlaying: boolean;
    onPress: () => void;
}

export default function LaunchPadComponent({ selectKey, isPlaying, onPress }: LaunchPadComponentProp) {
    return (
        <TouchableOpacity
            // Removed transition-all to fix the crash. Added active:scale-95 for instant tactile depth.
            className={`w-[30%] h-28 m-[1.5%] rounded-xl flex justify-center items-center border-2 active:scale-95
                ${isPlaying 
                    ? "border-green-400 bg-accent shadow-lg shadow-green-500/50" 
                    : "bg-white/5 border-white/10 active:bg-white/10"
                }`}
            onPress={onPress}
            activeOpacity={0.7} // Built-in iOS/Android fading overlay
        >
            <Text 
                className={`text-xl tracking-wider
                    ${isPlaying ? "font-cBold text-white text-2xl" : "font-cMedium text-gray-400"}`}
            >
                {selectKey || "•"}
            </Text>
        </TouchableOpacity>
    )
}