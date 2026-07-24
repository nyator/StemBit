/** @type {import('tailwindcss').Config} */

// Keep this in sync with constants/theme.ts -- that file is the source of truth
// for anything consumed as a raw value (icons, gradients, shadows). Tokens are
// duplicated here rather than imported because Tailwind's config is evaluated
// by Metro outside the TS pipeline.
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./components/**/*.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        // Figma design system. Space Grotesk carries numerals, controls and
        // labels; Satoshi carries prose and list content; Gochi Hand is the
        // logotype only.
        spaceBold: ["SpaceGrotesk-Bold"],
        spaceMedium: ["SpaceGrotesk-Medium"],
        spaceRegular: ["SpaceGrotesk-Regular"],
        satoshiBold: ["Satoshi-Bold"],
        satoshiMedium: ["Satoshi-Medium"],
        satoshiRegular: ["Satoshi-Regular"],
        wordmark: ["GochiHand-Regular"],
      },
      colors: {
        canvas: "#101116", // app background
        surface: {
          DEFAULT: "rgba(23,28,36,0.6)", // rows, cards
          sunken: "rgba(21,21,27,0.87)", // dial interior
          muted: "rgba(42,42,42,0.7)", // segmented control, unselected
          glass: "rgba(15,20,22,0.52)", // floating nav
          field: "#17181F", // input / text-field fill
        },
        // The brand is a gradient; `brand` alone is the flat fallback.
        brand: {
          DEFAULT: "#008BC2",
          from: "#58BEEC",
          to: "#007EB7",
          blue: "#2563EB", // switch "on" track
        },
        ink: {
          DEFAULT: "#FFFFFF",
          onBrand: "#E7E7E7", // label on the gradient button
          muted: "#A0A0AB", // group headers, meta values
          dim: "#9C9C9C", // onboarding nav labels
          soft: "rgba(255,255,255,0.7)", // supporting copy under a heading
          faint: "rgba(255,255,255,0.41)", // legal copy
          inverse: "#010101", // label on white surfaces
        },
        // Separators. The design uses a desaturated teal-navy haze rather than
        // a grey line, so these are deliberately not white alphas.
        hairline: {
          DEFAULT: "rgba(0,65,91,0.26)",
          strong: "rgba(0,65,91,0.5)",
          dial: "rgba(3,40,54,0.26)",
          segment: "rgba(47,47,47,0.7)",
          glass: "rgba(255,255,255,0.12)",
          brand: "rgba(103,175,203,0.26)",
        },

        // Semantic states. Not part of the Figma palette -- the design has no
        // error or success surface yet -- but the app needs them today.
        danger: "#EF4444",
        success: "#10B981",
        warning: "#F59E0B",
      },
      borderRadius: {
        sm: "10px", // segmented control, chips
        md: "14px", // buttons
        lg: "16px", // cards, grouped lists
        xl: "20px", // screen container
        nav: "47px", // floating nav
        dial: "90px",
      },
      fontSize: {
        nav: "10px",
        overline: "12px",
        label: "14px",
        body: "16px",
        title: "18px",
        wordmarkSm: "28px",
        wordmarkLg: "36px",
        display: "48px",
      },
      letterSpacing: {
        // The design tightens the wordmark and the status-bar clock by the
        // same amount; nothing else carries tracking.
        wordmark: "-0.3px",
      },
      spacing: {
        row: "16px", // padding inside a settings row
        screen: "24px", // horizontal padding, list screens
        instrument: "28px", // horizontal padding, metronome/pad/loop
      },
    },
  },
  corePlugins: {
    borderOpacity: true,
  },
  plugins: [],
};
