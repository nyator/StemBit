import { Text, TouchableOpacity } from "react-native";

// The one-tap choice, used wherever a cue names something from a short list:
// a loop, a pad pack, a key, a voicing.
//
// Shared rather than redeclared per screen because the cue editor and the
// performance screen's STUDIO view are choosing from the same lists. Two chips
// that looked slightly different would read as two different kinds of control
// rather than the same one in two places.

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export default function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityState={{ selected }}
      className={`px-4 py-2 rounded-full border ${
        selected ? "bg-ink border-ink-muted" : "bg-white/10 border-white/20"
      }`}
    >
      <Text
        className={`text-sm font-satoshiMedium ${
          selected ? "text-black" : "text-white"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
