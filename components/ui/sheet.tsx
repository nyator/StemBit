import { useCallback } from "react";
import { Dimensions, type ViewStyle } from "react-native";
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";

import { COLORS, RADII } from "../../constants/theme";

// The chrome every bottom sheet in this app shares.
//
// Not a wrapper component: a sheet's own props -- how it sizes, whether it
// rides the keyboard, whether its content can be dragged -- differ enough
// between a picker, a form and a wheel that wrapping them would mean passing
// most of the surface back through anyway. What is genuinely the same is the
// look: the dim behind it, the colour and corners of the panel, the grab
// handle. Those live here so a new sheet can't quietly dim the screen by a
// different amount than the last one.

/**
 * How much of the screen a sheet sized to its content may take.
 *
 * Read once, at module load. Sheets are portrait-only surfaces in this app and
 * a rotation mid-set is not a thing that happens on a stand.
 */
export const MAX_SHEET_HEIGHT = Dimensions.get("window").height * 0.8;

/** The panel itself: darker than the screen behind it, and rounded off. */
export const SHEET_BACKGROUND: ViewStyle = {
  backgroundColor: COLORS.surfaceSheet,
  borderTopLeftRadius: RADII.sheet,
  borderTopRightRadius: RADII.sheet,
};

/** The bar you pull. Wide enough to read as a grip rather than a divider. */
export const SHEET_HANDLE_INDICATOR: ViewStyle = {
  backgroundColor: COLORS.handle,
  width: 48,
};

/**
 * The dimming behind a sheet: fades in with it, and closes it when tapped.
 *
 * A hook rather than a plain component because it has to be the same reference
 * across renders -- gorhom takes it as `backdropComponent`, and a new function
 * every render remounts the backdrop mid-animation.
 */
export function useSheetBackdrop() {
  return useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.7}
        pressBehavior="close"
      />
    ),
    []
  );
}
