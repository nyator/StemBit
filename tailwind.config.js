/** @type {import('tailwindcss').Config} */

// Keep this in sync with constants/theme.ts -- that file is the source of truth
// for anything consumed as a raw value (icons, gradients, shadows). Tokens are
// duplicated here rather than imported because Tailwind's config is evaluated
// by Metro outside the TS pipeline.
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./components/**/*.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // "class" rather than the default "media": the app is dark-only by design
  // (userInterfaceStyle: "dark" in app.json, no light theme anywhere), and
  // something in Expo's own runtime tries to enforce that on web by calling
  // Appearance.setColorScheme -- which NativeWind's default "media" strategy
  // (follow the OS's prefers-color-scheme, no manual override) rejects outright,
  // crashing the whole app on --web before it ever mounts. Nothing here ever
  // toggles a class, so this changes nothing about how the app looks; it just
  // lets that call succeed instead of throwing.
  darkMode: "class",
  theme: {
    // The type scale. Roles, smallest first -- see TYPE in constants/theme.ts
    // for what each one is for.
    //
    // This REPLACES Tailwind's own scale rather than extending it (note the
    // position outside `extend`, below). The app had been running three scales
    // at once: these tokens, Tailwind's defaults (text-xs/sm/base/lg/xl/2xl),
    // and 104 one-off `text-[Npx]` values -- plus `text-md`, which is not a
    // class in any of them and so silently rendered at the platform default.
    // Deleting the defaults is what stops a fourth from growing back.
    fontSize: {
      nav: "10px",
      micro: "11px",
      overline: "12px",
      label: "14px",
      body: "16px",
      title: "18px",
      readout: "20px",
      heading: "24px",
      wordmarkSm: "28px",
      // The one tier that carries a sentence rather than a label, so it is the
      // one that needs a line height declared with it.
      hero: ["32px", "38px"],
      wordmarkLg: "36px",
      display: "48px",
    },
    extend: {
      fontFamily: {
        // Figma design system. Space Grotesk carries numerals, controls and
        // labels; Satoshi carries prose and list content; Gochi Hand is the
        // logotype only.
        spaceBold: ["SpaceGrotesk-Bold"],
        spaceMedium: ["SpaceGrotesk-Medium"],
        spaceRegular: ["SpaceGrotesk-Regular"],

        // Satoshi's full range. Regular / Medium / Bold carry the app; Light
        // and Black exist for the two ends of a hierarchy that needs more room
        // than three weights allow.
        //
        // React Native does not synthesise styles for a custom family -- asking
        // for italic on Satoshi-Regular gets you upright text on iOS and a
        // mechanical slant on Android. So each style is its own registered
        // face, and italic is a font choice here rather than a modifier.
        satoshiLight: ["Satoshi-Light"],
        satoshiLightItalic: ["Satoshi-LightItalic"],
        satoshiRegular: ["Satoshi-Regular"],
        satoshiItalic: ["Satoshi-Italic"],
        satoshiMedium: ["Satoshi-Medium"],
        satoshiMediumItalic: ["Satoshi-MediumItalic"],
        satoshiBold: ["Satoshi-Bold"],
        satoshiBoldItalic: ["Satoshi-BoldItalic"],
        satoshiBlack: ["Satoshi-Black"],
        satoshiBlackItalic: ["Satoshi-BlackItalic"],

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
          sheet: "#090B10", // bottom sheet panel, darker than the canvas
          badge: "rgba(25,25,25,0.5)", // label chip recessed into a surface row
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
      letterSpacing: {
        // The design tightens the wordmark and the status-bar clock by the
        // same amount; nothing else carries tracking.
        wordmark: "-0.3px",
      },
      spacing: {
        row: "16px", // padding inside a settings row
        screen: "20px", // horizontal padding, every screen but the instruments
        instrument: "28px", // horizontal padding, metronome/pad/loop
      },
    },
  },
  corePlugins: {
    borderOpacity: true,
  },
  plugins: [],
};
