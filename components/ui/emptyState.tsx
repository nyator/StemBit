import type { ComponentType } from "react";
import { Text, View } from "react-native";

import { COLORS } from "../../constants/theme";

type EmptyStateProps = {
  icon?: ComponentType<{ size?: number; color?: string }>;
  message: string;
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
                                                                                                                    