/** @type {import('jest').Config} */
// Coverage is opt-in via `npx jest --coverage` rather than on by default --
// collecting it on every run instrumented the whole asset tree and tripled the
// suite's runtime for numbers nobody was reading.
const config = {
  preset: "jest-expo",
  // reanimated 4 delegates its native runtime to a separate react-native-worklets
  // package, which ships a native (.native.ts) and a web implementation. Jest's
  // default resolver picks the native one -- react-native-worklets' own resolver
  // steers it to the web implementation instead, since the native one reaches for
  // a real native module that doesn't exist under Jest and crashes on import.
  resolver: "react-native-worklets/jest/resolver",
};

module.exports = config;
