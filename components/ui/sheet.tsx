import { useCallback } from "react";
import { Dimensions, type ViewStyle } from "react-native";
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";

import { COLORS, LAYOUT, RADII, SPACING } from "../../constants/theme";

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
 * How far a sheet's last control sits off the bottom edge.
 *
 * Past the home indicator, and enough that the control does not read as cut
 * off by the edge of the panel. Larger than any SPACING step because it is
 * clearing a piece of system chrome rather than separating two things.
 */
const SHEET_BOTTOM_CLEARANCE = 40;

/**
 * Padding for a sheet's content, whichever kind of sheet it is.
 *
 * The chrome above was already shared; this was not, and six sheets had drifted
 * into two versions of it -- half at 4/40 and half at 8/44, one of them writing
 * the horizontal padding as a bare 20. None of that difference was deliberate,
 * and it is the kind that is invisible in isolation and obvious when two sheets
 * open one after the other.
 *
 * Spread it rather than replacing a content container wholesale, so a sheet that
 * genuinely needs something extra -- a centred picker, a grid gap -- can add it
 * without forking the padding too.
 */
export const SHEET_CONTENT = {
  paddingHorizontal: LAYOUT.screenPaddingX,
  // The handle already puts air above the first row; this only keeps the text
  // from touching it.
  paddingTop: SPACING.xs,
  paddingBottom: SHEET_BOTTOM_CLEARANCE,
} as const;

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
