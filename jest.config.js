/** @type {import('jest').Config} */
// Coverage is opt-in via `npx jest --coverage` rather than on by default --
// collecting it on every run instrumented the whole asset tree and tripled the
// suite's runtime for numbers nobody was reading.
const config = {
  preset: "jest-expo",
};

module.exports = config;
