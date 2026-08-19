import type { ComponentType } from "react";
import { Text, View } from "react-native";

import { COLORS } from "../../constants/theme";

// What a list says when it has nothing in it.
//
// Three screens had grown their own -- the sessions tab, the setlist, and the
// loop browser -- and they disagreed on whether an empty list gets an icon, how
// far down the page it sits, and how wide the sentence is allowed to run. They
// are the same moment in the same product, so they are one component.
//
// The copy stays with the caller. What a list is for differs every time, and an
// empty state that says "Nothing here" is a wasted screen: this is the one
// place the app gets to explain what the thing is before the user has made one.

type EmptyStateProps = {
  /** Optional glyph above the message. Sized and tinted to match every other. */
  icon?: ComponentType<{ size?: number; color?: string }>;
  message: string;
  /** A button, usually. Sits below the message with room around it. */
  action?: React.ReactNode;
};

export default function EmptyState({ icon: Icon, message, action }: EmptyStateProps) {
  return (
    <View className="items-center justify-center px-8">
      {Icon ? <Icon size={40} color={COLORS.hairlineOnDark} /> : null}
      <Text
        className={`text-center text-body text-white/50 font-satoshiMedium ${
          Icon ? "mt-4" : ""
        }`}
      >
        {message}
      </Text>
      {action ? <View className="mt-6">{action}</View> : null}
    </View>
  );
}
