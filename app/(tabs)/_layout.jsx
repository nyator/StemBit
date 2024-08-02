import { View, Text,Image } from 'react-native'
import React from 'react'
import { Tabs, Redirect } from 'expo-router'

import { icons } from '../../constants'


const TabIcon = ({icon, name, color, focused}) => {
  return(
    <View className="items-center justify-center gap-2">
      <Image 
        source={icon} 
        resizeMode='contain'
        tintColor={color}
        className="w-6 h-6"
       />
       <Text className= {`${focused} ? 'font-psemibold' : 'font-pregular' text-sm`} style={{color : color}}>
        {name}
       </Text>
    </View>
  )
}


const TabsLayout = () => {
  return (
    <>
    <Tabs screenOptions={{
      tabBarShowLabel : false,
      tabBarActiveTintColor : "#08C192",
      tabBarInactiveTintColor : "#CDCDE0",
      tabBarStyle: {
        backgroundColor: "#161622",
        borderTopWidth: 1 ,
        borderTopColor: "#232533",
        height: 100, 
      }
     }}>

      <Tabs.Screen 
      name="home"
      options={ {
        title: "Home",
        headerShown: false,
        tabBarIcon: ({ color, focused }) =>(
           <TabIcon
           icon={icons.home} 
           color={color} 
           name='Home'
           focused={focused} 
           />
        )
      }}/>

      <Tabs.Screen 
      name="library"
      options={ {
        title: "Library",
        headerShown: false,
        tabBarIcon: ({ color, focused }) =>(
           <TabIcon
           icon={icons.library} 
           color={color} 
           name='Library'
           focused={focused} 
           />
        )
      }}/>

      <Tabs.Screen 
      name="metronome"
      options={ {
        title: "Metronome",
        headerShown: false,
        tabBarIcon: ({ color, focused }) =>(
           <TabIcon
           icon={icons.metronome} 
           color={color} 
           name='Metronome'
           focused={focused} 
           />
        )
      }}/>
      
      <Tabs.Screen 
      name="profile"
      options={ {
        title: "Profile",
        headerShown: false,
        tabBarIcon: ({ color, focused }) =>(
           <TabIcon
           icon={icons.profile} 
           color={color} 
           name='Profile'
           focused={focused} 
           />
        )
      }}/>
      <Tabs.Screen 
      name="session"
      options={ {
        title: "Session",
        headerShown: false,
        tabBarIcon: ({ color, focused }) =>(
           <TabIcon
           icon={icons.session} 
           color={color} 
           name='Session'
           focused={focused} 
           />
        )
      }}/>
    </Tabs>

    </>
  )
}

export default TabsLayout 