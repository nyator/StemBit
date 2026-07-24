// Central design tokens, derived from the stembits Figma file (node 4:1235).
// Tailwind classes cover most styling; these exist for the places that need raw
// values (icons, switches, gradients, navigation options) so hex codes aren't
// scattered through the codebase.
//
// Every value under the "Figma" headings below was read off the design rather
// than eyeballed. When a screen disagrees with a token here, the token is wrong
// -- fix it in one place instead of overriding at the call site.

/* -------------------------------------------------------------------------- */
/* Colors                                                                      */
/* -------------------------------------------------------------------------- */

export const COLORS = {
  // Backgrounds
  canvas: "#101116", // app background, every screen
  surface: "rgba(23,28,36,0.6)", // settings rows, cards
  surfaceSunken: "rgba(21,21,27,0.87)", // metronome dial interior
  surfaceMuted: "rgba(42,42,42,0.7)", // segmented control, unselected
  surfaceGlass: "rgba(15,20,22,0.52)", // floating nav bar
  surfaceField: "#17181F", // input / text-field fill

  // The one hue the design derives its depth from: separators, the dial's
  // shadow, and the ambient corner glow are all this teal-navy at low alpha.
  glow: "#00415A",

  // Borders. Reads as a "dark blue haze" rather than a visible line.
  border: "rgba(0,65,91,0.26)", // row dividers
  borderStrong: "rgba(0,65,91,0.5)", // outlined buttons (TAP TEMPO)
  borderDial: "rgba(3,40,54,0.26)", // metronome dial ring
  borderSegment: "rgba(47,47,47,0.7)", // segmented control, unselected
  borderGlass: "rgba(255,2ed55,255,0.12)", // floating nav bar
  borderBrand: "rgba(103,175,203,0.26)", // primary gradient button
  borderIdle: "#4F4F4F", // unselected radio ring

  // Slider track behind the filled portion.
  track: "#2D3332",

  // Brand. It's a gradient, not a flat color -- prefer GRADIENTS.brand and
  // reach for these only where a single value is required.
  brand: "#008BC2", // active nav label, flat fallback
  brandFrom: "#58BEEC", // gradient start
  brandTo: "#007EB7", // gradient end
  brandBlue: "#2563EB", // Figma's control blue -- superseded by CONTROL below

  // Text
  text: "#FFFFFF",
  textOnBrand: "#E7E7E7", // label on the gradient button
  textMuted: "#A0A0AB", // BPM caption, group headers, meta values
  textDim: "#9C9C9C", // onboarding nav labels and body copy
  textSoft: "rgba(255,255,255,0.7)", // supporting copy under a heading
  textFaint: "rgba(255,255,255,0.41)", // legal copy
  hairlineOnDark: "rgba(255,255,255,0.3)", // onboarding arrow strokes
  textInverse: "#010101", // label on white buttons

  white: "#FFFFFF",
  black: "#000000",

  // Semantic states. Not part of the Figma palette -- the design has no error
  // or success surface yet -- but the app needs them today.
  danger: "#EF4444",
  success: "#10B981",
  warning: "#F59E0B",
} as const;

/* -------------------------------------------------------------------------- */
/* Controls                                                                    */
/* -------------------------------------------------------------------------- */

// Switches, radios and sliders share one fill so they read as the same family
// when they sit in adjacent rows of the same screen -- which they do on the
// Audio Output / Volume screen.
//
// Figma draws these in #2563EB, a generic system blue. We use the brand accent
// instead so the controls belong to the rest of the UI rather than looking
// borrowed from the OS. Change `active` here and every control follows.
export const CONTROL = {
  active: COLORS.brand, // filled radio, switch "on" track, slider fill
  idle: "#3A3A3F", // switch "off" track
  track: COLORS.track, // slider's unfilled remainder
  knob: "#F4F3F4", // switch thumb
  ring: COLORS.white, // outline on a selected radio
} as const;

/* -------------------------------------------------------------------------- */
/* Gradients                                                                   */
/* -------------------------------------------------------------------------- */

// Stop arrays shaped for expo-linear-gradient's `colors` prop. Left-to-right in
// the design, hence start/end on the x axis.
export const GRADIENTS = {
  brand: {
    colors: [COLORS.brandFrom, COLORS.brandTo] as [string, string],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Radii                                                                       */
/* -------------------------------------------------------------------------- */

export const RADII = {
  sm: 10, // segmented control, chips
  md: 14, // buttons
  lg: 16, // cards, grouped list containers
  xl: 20, // screen container
  nav: 47, // floating nav bar
  dial: 90, // metronome dial (half of its 180px box)
  pill: 100,
} as const;

/* -------------------------------------------------------------------------- */
/* Spacing                                                                     */
/* -------------------------------------------------------------------------- */

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 28,
} as const;

// Screen-level layout constants. Horizontal padding is 24 on list screens and
// 28 on the instrument screens (metronome, pad, loop) -- that difference is
// intentional in the design, not drift.
export const LAYOUT = {
  screenPaddingX: 24,
  instrumentPaddingX: 28,
  screenPaddingTop: 66,
  groupGap: 24, // between settings groups
  rowGap: 12, // between a group header and its rows
  rowPadding: 16, // inside a settings row
} as const;

/* -------------------------------------------------------------------------- */
/* Shadows                                                                     */
/* -------------------------------------------------------------------------- */

// RN shadow props plus an Android `elevation` approximation, since Android
// ignores shadowColor/Offset/Radius entirely.
export const SHADOWS = {
  // Blue bloom under the metronome dial.
  glow: {
    shadowColor: "#00415B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 16,
    elevation: 8,
  },
  // Floating nav bar lifting off the screen.
  float: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  // Switch knob.
  knob: {
    shadowColor: "#272727",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Typography                                                                  */
/* -------------------------------------------------------------------------- */

// Family names must match the keys registered in app/_layout.tsx and the
// fontFamily entries in tailwind.config.js.
export const FONTS = {
  spaceBold: "SpaceGrotesk-Bold",
  spaceMedium: "SpaceGrotesk-Medium",
  spaceRegular: "SpaceGrotesk-Regular",
  satoshiBold: "Satoshi-Bold",
  satoshiMedium: "Satoshi-Medium",
  satoshiRegular: "Satoshi-Regular",
  wordmark: "GochiHand-Regular",
} as const;

// Roles, not sizes -- reach for the one that matches what the text *is*.
// Space Grotesk carries numerals, controls and labels; Satoshi carries prose
// and list content; Gochi Hand is the logotype only.
export const TYPE = {
  /** 48 -- the BPM readout. Painted with GRADIENTS.brand in the design. */
  display: { fontFamily: FONTS.spaceBold, fontSize: 48 },
  /** 36 -- "stembits" on splash and sign-in. */
  wordmarkLg: { fontFamily: FONTS.wordmark, fontSize: 36, letterSpacing: -0.3 },
  /** 28 -- "stembits" in the app header. */
  wordmarkSm: { fontFamily: FONTS.wordmark, fontSize: 28, letterSpacing: -0.3 },
  /** 18 -- screen titles. */
  title: { fontFamily: FONTS.satoshiBold, fontSize: 18 },
  /** 18 -- segmented control values (4/4, 1x, 0.5x), TAP TEMPO. */
  control: { fontFamily: FONTS.spaceBold, fontSize: 18 },
  /** 16 -- list rows, form fields, prose. */
  body: { fontFamily: FONTS.satoshiMedium, fontSize: 16 },
  /** 16 -- button labels. */
  button: { fontFamily: FONTS.spaceBold, fontSize: 16 },
  /** 14 -- inline section labels ("Time Signature", "Subdivision"). */
  label: { fontFamily: FONTS.spaceBold, fontSize: 14 },
  /** 14 -- legal and helper copy. 20pt line height in the design. */
  caption: { fontFamily: FONTS.satoshiRegular, fontSize: 14, lineHeight: 20 },
  /** 14 -- trailing metadata in list rows (version numbers, etc). */
  meta: { fontFamily: FONTS.spaceRegular, fontSize: 14 },
  /** 12 -- uppercase settings group headers. Pair with textTransform. */
  overline: { fontFamily: FONTS.spaceBold, fontSize: 12 },
  /** 10 -- floating nav labels. */
  nav: { fontFamily: FONTS.spaceBold, fontSize: 10 },
} as const;

/* -------------------------------------------------------------------------- */
/* Component metrics                                                           */
/* -------------------------------------------------------------------------- */

// Fixed sizes the design repeats verbatim across screens.
export const SIZES = {
  buttonHeight: 55,
  rowIcon: 20,
  navIcon: 24,
  transportPrimary: 80, // play/stop
  transportSecondary: 36, // +/- BPM
  dial: 180,
  dialGlow: 220,
  dialGlowOuter: 240,
  switchWidth: 40,
  switchHeight: 22,
  switchKnob: 18,
  segmentWidth: 105,
} as const;

/* -------------------------------------------------------------------------- */
/* App metadata                                                                */
/* -------------------------------------------------------------------------- */

export const APP_VERSION = "1.0.0";
export const SUPPORT_EMAIL = "support.sb@builtelo.com";
