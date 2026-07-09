import { View, Text, TouchableOpacity, Switch } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS } from "../../constants/theme";

type BaseProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  danger?: boolean;
};

type LinkRowProps = BaseProps & {
  onPress: () => void;
  value?: string; // right-aligned value text (e.g. current setting)
};

type SwitchRowProps = BaseProps & {
  value: boolean;
  onValueChange: (value: boolean) => void;
};

const RowShell = ({
  icon,
  label,
  sublabel,
  danger,
  right,
}: BaseProps & { right: React.ReactNode }) => (
  <View className="flex-row items-center py-4 border-b border-white/10">
    {icon && (
      <View className="items-center justify-center w-8 h-8 mr-3 rounded-lg bg-white/10">
        <Ionicons
          name={icon}
          size={17}
          color={danger ? COLORS.danger : COLORS.accent}
        />
      </View>
    )}
    <View className="flex-1">
      <Text
        className={`text-base font-rMedium ${danger ? "text-error" : "text-white"}`}
      >
        {label}
      </Text>
      {sublabel && (
        <Text className="mt-[2px] text-xs text-white/50 font-rRegular">
          {sublabel}
        </Text>
      )}
    </View>
    {right}
  </View>
);

// Tappable settings row (navigates or triggers an action).
export function SettingLink({ onPress, value, ...base }: LinkRowProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <RowShell
        {...base}
        right={
          <View className="flex-row items-center">
            {value && (
              <Text className="mr-2 text-sm text-white/50 font-rRegular">
                {value}
              </Text>
            )}
            <Ionicons
              name="chevron-forward"
              size={18}
              color="rgba(255,255,255,0.4)"
            />
          </View>
        }
      />
    </TouchableOpacity>
  );
}

// Toggle settings row.
export function SettingSwitch({ value, onValueChange, ...base }: SwitchRowProps) {
  return (
    <RowShell
      {...base}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: "#3a3a3f", true: COLORS.accentDark }}
          thumbColor="#f4f3f4"
        />
      }
    />
  );
}

// Section wrapper: accent-colored heading + card of rows.
export function SettingSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-7">
      <Text className="mb-2 text-xs tracking-widest uppercase text-accent font-rBold">
        {title}
      </Text>
      <View className="px-4 rounded-2xl bg-white/5">{children}</View>
    </View>
  );
}
