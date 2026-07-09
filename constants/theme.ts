// Central design tokens. Tailwind classes cover most styling; these exist
// for the places that need raw values (icons, switches, navigation options)
// so hex codes aren't scattered through the codebase.
export const COLORS = {
  primary: "#101116", // app background
  surface: "rgba(255,255,255,0.08)", // cards / rows
  surfaceBorder: "rgba(255,255,255,0.10)",
  accent: "#08C192", // brand green
  accentDark: "#098E6C",
  accentSoft: "rgba(8,193,146,0.20)",
  text: "#FFFFFF",
  textDim: "rgba(255,255,255,0.60)",
  textFaint: "rgba(255,255,255,0.35)",
  danger: "#EF4444",
  black: "#000000",
} as const;

export const APP_VERSION = "1.0.0";
export const SUPPORT_EMAIL = "support@nehtek.com";
