import { View, Text, TouchableOpacity, Pressable, Animated } from "react-native";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState, useRef, useEffect } from "react";

interface OptionFieldProps {
    label: string;
    options: string[];
    onSelect?: (option: string) => void;
    selected?: string;
    otherStyles?: string;
}

function OptionField({ label, options, onSelect, selected, otherStyles }: OptionFieldProps) {
    const [isOpened, setIsOpened] = useState(false);
    const [selectedOption, setSelectedOption] = useState(selected || options[0]);
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(rotateAnim, {
            toValue: isOpened ? 1 : 0,
            duration: 100,
            useNativeDriver: true,
        }).start();
    }, [isOpened]);

    const handleSelect = (option: string) => {
        setSelectedOption(option);
        setIsOpened(false);
        onSelect && onSelect(option);
    };

    const rotate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    return (
        <View className={`flex relative justify-start w-32`}>
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Open ${label} dropdown`}
                className="flex-row justify-center items-center p-2 rounded-2xl border bg-zinc-700 border-zinc-600"
                onPress={() => setIsOpened((prev) => !prev)}
                activeOpacity={0.8}
            >
                <Animated.View style={{ transform: [{ rotate }] }}>
                    <MaterialIcons name="keyboard-arrow-down" size={24} color="white" />
                </Animated.View>
                <Text className="ml-2 text-base font-bold text-white">{selectedOption}</Text>

            </TouchableOpacity>
            {isOpened && (
                <View className="overflow-hidden absolute z-10 justify-center items-center mt-12 w-32 rounded-xl border bg-zinc-800 border-zinc-600">
                    
                    {options.map((option) => (
                        <Pressable
                            key={option}
                            onPress={() => handleSelect(option)}
                            className="px-4 py-2"
                            android_ripple={{ color: '#3f3f46' }}
                            accessibilityRole="button"
                            accessibilityLabel={`Select ${option}`}
                        >
                            {({ pressed }) => (
                                <Text className={`text-white text- ${pressed ? 'bg-zinc-700' : ''}`}>{option}</Text>
                            )}
                        </Pressable>
                    ))}
                </View>
            )}
        </View>
    );
}

export default OptionField;