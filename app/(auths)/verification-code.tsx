import { useState } from 'react'
import { View, Text, TextInput } from 'react-native'

export default function VerificationCodeScreen() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    code: "",
  })

  const submit = async () => {
    setIsSubmitting(true)
    // Handle verification code submission
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000))
      console.log("Verification code submitted:", form.code)
    } catch (error) {
      console.error("Error submitting verification code:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View>
      <Text>Verification</Text>
      <View>
        <Text className="text-2xl text-white font-rBold">Enter Verification Code</Text>
        <View className="flex flex-col gap-6 items-center w-full">
          <TextInput
            className="border border-gray-300 rounded-lg p-2 w-full"
            placeholder="Enter verification code"
            keyboardType="numeric"
          />
          <Text className="text-white/50 font-rMedium">A verification code has been sent to your email.</Text>
        </View>
      </View>
    </View>
  )
}