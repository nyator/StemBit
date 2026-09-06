import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { COLORS, SIZES } from "../../constants/theme";
import { Download, Lock, TickCircle } from "../icons";

/**
 * The one control that gets a loop onto the device, in every state it can be in.
 *
 * Four states rather than a button plus a separate badge, because they are the
 * same slot in the row and only one of them is ever true. Sharing the footprint
 * is also what keeps a list from reflowing as its rows finish downloading.
 */
export type DownloadStatus = "idle" | "downloading" | "downloaded" | "locked";

type DownloadButtonProps = {
  status: DownloadStatus;
  /** 0..1 while downloading. Undefined means "started, size unknown". */
  progress?: number;
  onPress: () => void;
  /** What is being downloaded, for the screen reader. */
  label: string;
};

export default function DownloadButton({
  status,
  progress,
  onPress,
  label,
}: DownloadButtonProps) {
  // Downloaded is the only state with nothing left to do. Locked stays
  // pressable: tapping it is how somebody finds out why it's locked, and a dead
  // control that explains nothing is the reason they'd assume the app is broken.
  const disabled = status === "downloaded" || status === "downloading";

  const accessibilityLabel =
    status === "downloaded"
      ? `${label}, downloaded`
      : status === "downloading"
        ? `Downloading ${label}`
        : status === "locked"
          ? `${label}, locked`
          : `Download ${label}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      activeOpacity={0.7}
      className="items-center justify-center rounded-full"
      style={{
        width: SIZES.minTouch,
        height: SIZES.minTouch,
        backgroundColor:
          status === "downloaded" ? "transparent" : "rgba(255,255,255,0.08)",
      }}
    >
      {status === "downloading" ? (
        <View className="items-center justify-center">
          <ActivityIndicator size="small" color={COLORS.brandFrom} />
          {/* The percentage sits under the spinner rather than replacing it:
              a server that sends no Content-Length leaves us with no percentage
              at all, and the spinner alone still reads as "working". */}
          {progress !== undefined && (
            <Text className="mt-0.5 text-micro text-ink-muted font-spaceBold">
              {Math.round(progress * 100)}
            </Text>
          )}
        </View>
      ) : status === "downloaded" ? (
        <TickCircle size={SIZES.rowIcon} color={COLORS.success} />
      ) : status === "locked" ? (
        <Lock size={SIZES.rowIcon} color={COLORS.textMuted} />
      ) : (
        <Download size={SIZES.rowIcon} color={COLORS.white} />
      )}
    </TouchableOpacity>
  );
}
