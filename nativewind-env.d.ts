/// <reference types="nativewind/types" />

// TypeScript 6 checks side-effect imports for a resolvable module by default
// (noUncheckedSideEffectImports); NativeWind never shipped an ambient type for
// the global.css import that its own setup docs tell you to add, because older
// TypeScript never required one.
declare module "*.css";