export const COLORS = {
  canvas: "#101116",
  surface: "rgba(23,28,36,0.6)",
  surfaceSunken: "rgba(21,21,27,0.87)",
  surfaceMuted: "rgba(42,42,42,0.7)",
  surfaceGlass: "rgba(15,20,22,0.52)",
  surfaceField: "#17181F",
  surfaceSheet: "#090B10",
  surfaceBadge: "rgba(25,25,25,0.5)",

  glow: "#00415A",

  border: "rgba(0,65,91,0.26)",
  borderStrong: "rgba(0,65,91,0.5)",
  borderDial: "rgba(3,40,54,0.26)",
  borderSegment: "rgba(47,47,47,0.7)",
  borderGlass: "rgba(255,255,255,0.12)",
  borderBrand: "rgba(103,175,203,0.26)",
  borderIdle: "#4F4F4F",
  handle: "rgba(255,255,255,0.4)",

  track: "#2D3332",
  progressTrack: "rgba(255,255,255,0.10)",

  brand: "#008BC2",
  brandFrom: "#58BEEC",
  brandTo: "#007EB7",
  brandBlue: "#2563EB",

  text: "#FFFFFF",
  textOnBrand: "#E7E7E7",
  textMuted: "#A0A0AB",
  textDim: "#9C9C9C",
  textSoft: "rgba(255,255,255,0.7)",
  textFaint: "rgba(255,255,255,0.41)",
  hairlineOnDark: "rgba(255,255,255,0.3)",
  textInverse: "#010101",

  white: "#FFFFFF",
  black: "#000000",

  danger: "#EF4444",
  success: "#10B981",
  warning: "#F59E0B",
} as const;

export const TRACK_PALETTE = [
  "#38BDF8",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#A855F7",
  "#14B8A6",
  "#EC4899",
  "#84CC16",
] as const;

export const CONTROL = {
  active: COLORS.brand,
  idle: "#3A3A3F",
  track: COLORS.track,
  knob: "#F4F3F4",
  ring: COLORS.white,
} as const;

export const GRADIENTS = {
  brand: {
    colors: [COLORS.brandFrom, COLORS.brandTo] as [string, string],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
} as const;

export const RADII = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  sheet: 30,
  nav: 47,
  dial: 90,
  pill: 100,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 28,
} as const;

export const LAYOUT = {
  screenPaddingX: 20,
  instrumentPaddingX: 28,
  screenPaddingTop: 66,
  groupGap: 24,
  rowGap: 12,
  rowPadding: 16,
  tabBarClearance: 190,
} as const;

export const SHADOWS = {
  glow: {
    shadowColor: "#00415B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 16,
    elevation: 8,
  },
  float: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  knob: {
    shadowColor: "#272727",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
} as const;

export const FONTS = {
  spaceBold: "SpaceGrotesk-Bold",
  spaceMedium: "SpaceGrotesk-Medium",
  spaceRegular: "SpaceGrotesk-Regular",

  satoshiLight: "Satoshi-Light",
  satoshiLightItalic: "Satoshi-LightItalic",
  satoshiRegular: "Satoshi-Regular",
  satoshiItalic: "Satoshi-Italic",
  satoshiMedium: "Satoshi-Medium",
  satoshiMediumItalic: "Satoshi-MediumItalic",
  satoshiBold: "Satoshi-Bold",
  satoshiBoldItalic: "Satoshi-BoldItalic",
  satoshiBlack: "Satoshi-Black",
  satoshiBlackItalic: "Satoshi-BlackItalic",

  wordmark: "GochiHand-Regular",
} as const;

export const TYPE = {
  display: { fontFamily: FONTS.spaceBold, fontSize: 48 },
  hero: { fontFamily: FONTS.spaceBold, fontSize: 32, lineHeight: 38 },
  wordmarkLg: { fontFamily: FONTS.wordmark, fontSize: 36, letterSpacing: -0.3 },
  wordmarkSm: { fontFamily: FONTS.wordmark, fontSize: 28, letterSpacing: -0.3 },
  heading: { fontFamily: FONTS.satoshiBold, fontSize: 24 },
  title: { fontFamily: FONTS.satoshiBold, fontSize: 18 },
  control: { fontFamily: FONTS.spaceBold, fontSize: 18 },
  readout: { fontFamily: FONTS.spaceBold, fontSize: 20 },
  body: { fontFamily: FONTS.satoshiMedium, fontSize: 16 },
  button: { fontFamily: FONTS.spaceBold, fontSize: 16 },
  label: { fontFamily: FONTS.spaceBold, fontSize: 14 },
  caption: { fontFamily: FONTS.satoshiRegular, fontSize: 14, lineHeight: 20 },
  meta: { fontFamily: FONTS.spaceRegular, fontSize: 14 },
  overline: { fontFamily: FONTS.spaceBold, fontSize: 12 },
  micro: { fontFamily: FONTS.spaceBold, fontSize: 11 },
  nav: { fontFamily: FONTS.spaceBold, fontSize: 10 },
} as const;

export const SIZES = {
  minTouch: 44,
  buttonHeight: 55,
  // One height for every control on the instrument screens -- tap tempo, the
  // buttons beside it, steppers, the picker, the subdivision row -- so they
  // share an edge instead of each landing wherever its padding put it.
  control: 42,
  rowIcon: 20,
  navIcon: 24,
  transportPrimary: 80,
  transportSecondary: 36,
  dial: 180,
  dialGlow: 220,
  dialGlowOuter: 240,
  switchWidth: 40,
  switchHeight: 22,
  switchKnob: 18,
  segmentWidth: 105,
  fab: 56,
} as const;

export const APP_VERSION = "1.0.0";
export const SUPPORT_EMAIL = "support.sb@builtelo.com";