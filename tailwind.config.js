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
      },
    },
  },
  plugins: [],
};
