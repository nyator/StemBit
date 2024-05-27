import { View, Text,Image } from 'react-native'
import { Tabs } from "expo-router"

const TabLayout = () => {
  return (
    <>
    <Tabs>
      <Tabs.Screen name="home" 
      options={
        {
          tabBarLabel: "Live",
          headerShown: false,
        }
      } />
    </Tabs>

    </>
  )
}

export default TabLayout