/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    theme: {
    extend: {
      colors: {
        primary: '#08C192',
        background: '#202020',
        secondary: {
          DEFAULT: "#",
          100: "#",
          200: "#",
        },
        black: {
          DEFAULT: "#",
          100: "#",
          200: "#",
        },
      },
      fontFamily: {
        rblack: ["Raleway-Black", "sans-serif"],
        rbold: ["Raleway-Bold", "sans-serif"],
        rextrabold: ["Raleway-ExtraBold", "sans-serif"],
        rextralight: ["Raleway-ExtraLight", "sans-serif"],
        rlight: ["Raleway-Light", "sans-serif"],
        rmedium: ["Raleway-Medium", "sans-serif"],
        rregular: ["Raleway-Regular", "sans-serif"],
        rsemibold: ["Raleway-SemiBold", "sans-serif"],
        rthin: ["Raleway-Thin", "sans-serif"],
      },
    },
  },
  plugins: [],
}

