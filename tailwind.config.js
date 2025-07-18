/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./components/**/*.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        cBold: ["Chillax-Bold"],
        cSemibold: ["Chillax-Semibold"],
        cMedium: ["Chillax-Medium"],
        cRegular: ["Chillax-Regular"],
        cLight: ["Chillax-Light"],
        cExtraLight: ["Chillax-ExtraLight"],
        rBlack: ["Raleway-Black"],
        rBold: ["Raleway-Bold"],
        rMedium: ["Raleway-Medium"],
        rRegular: ["Raleway-Regular"],
        rSemiBold: ["Raleway-SemiBold"],
        rThin: ["Raleway-Thin"],
      },
      colors: {
        primary: "#101116",
        secondary: "#1F2937",
        accent: "#08C192",
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
      },
    },
  },
   corePlugins: {
    borderOpacity: true,
  },
  plugins: [],
};
