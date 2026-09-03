import { Alert } from "react-native";

/**
 * Ask before doing something, as a promise.
 *
 * Alert.alert is callback-shaped, which forces anything that needs an answer
 * mid-way through to be split in two around it. As a promise the question sits
 * inline in the work it is guarding, so the code still reads in the order it
 * happens.
 *
 * Dismissing without choosing resolves false, not never: on Android the alert
 * can be dismissed with the back button, and a promise that never settles would
 * leave whatever awaited it hanging forever.
 */
export function confirm({
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  destructive = false,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm in red on iOS -- for anything that loses data. */
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
