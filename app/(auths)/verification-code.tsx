import { useRef, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { OtpInput, type OtpInputRef } from "react-native-otp-entry";

import Screen from "../../components/ui/screen";
import ScreenHeader from "../../components/ui/screenHeader";
import AuthFooter from "../../components/ui/authFooter";
import { BrandButton } from "../../components/ui/brandButton";
import { COLORS, FONTS, RADII } from "../../constants/theme";
import { usePreferences } from "../../context/PreferencesContext";
import {
  useEmailCodeAuth,
  type EmailAuthMode,
} from "../../hooks/useEmailCodeAuth";

const DIGITS = 6;

export default function VerificationCodeScreen() {
  const router = useRouter();
  const { email, mode } = useLocalSearchParams<{
    email?: string;
    mode?: EmailAuthMode;
  }>();

  const otpRef = useRef<OtpInputRef>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const { verifyCode, sendCode, isLoaded } = useEmailCodeAuth();
  const { prefs } = usePreferences();
  const launchRoute = `/(tabs)/${prefs.launchScreen}` as const;

  // Whichever flow sent the code has to be the one that completes it: a
  // sign-in attempts a first factor, a sign-up attempts an email verification.
  // Defaulting to sign_in covers somebody deep-linking here without the param.
  const flow: EmailAuthMode = mode === "sign_up" ? "sign_up" : "sign_in";

  /**
   * `submitted` comes from onFilled, which hands over the completed code
   * directly. Reading component state there would race the render that set it
   * -- on autofill the whole code arrives in one change, and the state update
   * has not landed by the time the callback runs.
   */
  const submit = async (submitted?: string) => {
    const value = (submitted ?? code).trim();

    if (value.length < DIGITS) {
      setError(`Enter all ${DIGITS} digits.`);
      return;
    }
    // Autofill fires onFilled, and a fast second tap on Verify would otherwise
    // send the same spent code twice.
    if (isSubmitting) return;

    setError("");
    setNotice("");
    setIsSubmitting(true);
    try {
      await verifyCode(value, flow);
      // replace, not push: the code is spent and the screen behind this is the
      // email form. Neither is somewhere a back swipe should land.
      router.replace(launchRoute);
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "That code isn't right, or it has expired."
      );
      // Clear the boxes on a failure, so the next attempt starts from empty
      // rather than making somebody delete six digits by hand.
      otpRef.current?.clear();
      setCode("");
      setIsSubmitting(false);
    }
  };

  const resend = async () => {
    if (!email) {
      setError("Go back and enter your email again.");
      return;
    }

    setError("");
    setNotice("");
    setIsResending(true);
    try {
      await sendCode(email, flow);
      otpRef.current?.clear();
      setCode("");
      setNotice("A new code is on its way.");
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : "Couldn't send another code."
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Screen glows={["topLeft"]}>
      <ScreenHeader title="Check your email" />

      <View className="flex-1 px-screen">
        <Text className="mb-8 text-ink-soft font-satoshiRegular text-label leading-5">
          {email
            ? `We sent a ${DIGITS}-digit code to ${email}.`
            : `Enter the ${DIGITS}-digit code we sent you.`}
        </Text>

        <OtpInput
          ref={otpRef}
          numberOfDigits={DIGITS}
          type="numeric"
          autoFocus
          blurOnFilled
          focusColor={COLORS.brand}
          onTextChange={(text) => {
            setCode(text);
            if (error) setError("");
          }}
          // Submitting the moment the last digit lands is the whole point of
          // autofill: the code arrives from the keyboard suggestion and the
          // user never touches the screen again.
          onFilled={(text) => submit(text)}
          disabled={isSubmitting}
          textInputProps={{
            // The two attributes that make autofill work at all. iOS reads the
            // code out of the notification and offers it above the keyboard;
            // Android's autofill service fills it directly.
            textContentType: "oneTimeCode",
            autoComplete: "sms-otp",
            accessibilityLabel: `${DIGITS} digit verification code`,
          }}
          theme={{
            containerStyle: { marginBottom: 20 },
            pinCodeContainerStyle: {
              width: 48,
              height: 58,
              borderRadius: RADII.md,
              backgroundColor: COLORS.surfaceField,
              borderWidth: 1,
              borderColor: COLORS.borderIdle,
            },
            focusedPinCodeContainerStyle: {
              borderColor: COLORS.brand,
              backgroundColor: "rgba(0,139,194,0.10)",
            },
            filledPinCodeContainerStyle: { borderColor: COLORS.borderStrong },
            // Space Grotesk, because the design system gives it the numerals --
            // the same face the BPM readout and every tempo control use.
            pinCodeTextStyle: {
              color: COLORS.white,
              fontFamily: FONTS.spaceBold,
              fontSize: 24,
            },
            focusStickStyle: { backgroundColor: COLORS.brand },
          }}
        />

        {error ? (
          <Text className="mb-3 text-center text-danger font-satoshiMedium text-label">
            {error}
          </Text>
        ) : notice ? (
          <Text className="mb-3 text-center text-brand-from font-satoshiMedium text-label">
            {notice}
          </Text>
        ) : null}

        {/* Still here despite the auto-submit: autofill can be off, the
            suggestion can be missed, and a code typed by hand needs somewhere
            to go. */}
        <BrandButton
          label="Verify"
          onPress={() => submit()}
          loading={isSubmitting}
          disabled={!isLoaded || code.length < DIGITS}
        />

        {/* A code that never arrives is the most common failure of this flow,
            and without a way out the only recovery is force-quitting the app. */}
        <TouchableOpacity
          onPress={resend}
          disabled={isResending || isSubmitting || !isLoaded}
          accessibilityRole="button"
          accessibilityLabel="Send another code"
          className="self-center mt-4"
        >
          <Text className="text-ink-soft font-satoshiMedium text-label">
            Didn&apos;t get it?{" "}
            <Text className="text-brand underline">
              {isResending ? "Sending…" : "Send again"}
            </Text>
          </Text>
        </TouchableOpacity>
      </View>

      <AuthFooter />
    </Screen>
  );
}
