import React, { useState } from 'react';
import { View, Text, Button, TextInput, SafeAreaView } from 'react-native';

const ProfileScreen = () => {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState('John Doe');
    const [email, setEmail] = useState('john@example.com');

    return (
        <SafeAreaView >
            <View style={{ padding: 20 }}>
                {editing ? (
                    <>
                        <TextInput className='text-3xl text-white font-rMedium' value={name} onChangeText={setName} placeholder="Name" />
                        <TextInput className='text-3xl text-white font-rMedium' value={email} onChangeText={setEmail} placeholder="Email" />
                        <Button title="Save" onPress={() => setEditing(false)} />
                    </>
                ) : (
                    <>
                        <Text className='text-3xl text-white font-rMedium'>Name: {name}</Text>
                        <Text className='text-3xl text-white font-rMedium'>Email: {email}</Text>
                        <Button title="Edit" onPress={() => setEditing(true)} />
                    </>
                )}
            </View>
        </SafeAreaView>
    );
};

export default ProfileScreen;