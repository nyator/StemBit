import { View, Text, Image, TouchableOpacity } from 'react-native'
import icons from '../constants/icons'
import { useRouter } from 'expo-router'

const HeaderComponent = () => {
    const router = useRouter();

    return (
        <View className="flex flex-row justify-between items-center px-5 mt-7 mb-5 w-full">
            <View className="flex flex-row justify-between items-center w-2/5">
                <TouchableOpacity onPress={() => router.push('/(profile)')} className='p-1 rounded-full bg-white/20'>
                    <Image
                        source={icons.user}
                        resizeMode="contain"
                        style={{
                            width: 24,
                            height: 24,
                        }}
                        tintColor="white"
                    />
                </TouchableOpacity>

                <View className="flex flex-row justify-center items-center">
                    <Text className="text-2xl text-white font-rBlack">Stem</Text>
                    <Text className="text-2xl text-accent font-rBlack">Bits</Text>
                </View>
            </View>


            <View className="">
                <TouchableOpacity>
                    <Image
                        source={icons.bell}
                        resizeMode="contain"
                        style={{
                            width: 30,
                            height: 30,
                        }}
                        tintColor="white"
                    />
                </TouchableOpacity>



            </View>
        </View>
    )
}

export default HeaderComponent