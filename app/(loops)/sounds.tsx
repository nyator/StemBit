import React, {useState} from 'react';
import {View, Text, Switch, TouchableOpacity, SafeAreaView, StatusBar, ScrollView} from 'react-native';
import {useRouter} from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

const IndexScreen = () => {
    const router = useRouter();

    const handleGoBack = () => {
        router.back();
    }

    return (
        <SafeAreaView className="flex-1 bg-primary">
            <StatusBar barStyle="light-content"/>

            {/* Header */}
            <View className="flex-row justify-between items-center px-5 mt-7 mb-5">
                <TouchableOpacity
                    onPress={handleGoBack}
                    className="p-2 rounded-full bg-white/10"
                >
                    <Ionicons name="arrow-back" size={24} color="white"/>
                </TouchableOpacity>
                <Text className="text-2xl text-white font-rBold">Loop Sounds</Text>
                <View style={{width: 32}}></View>{/* Empty view for alignment */}
            </View>

            <ScrollView className="flex-1 px-5">

            </ScrollView>
        </SafeAreaView>
    );
};

export default IndexScreen;