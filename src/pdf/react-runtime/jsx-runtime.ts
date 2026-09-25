// Confirmed via a runtime diagnostic against production: even a plain
// require("react") in a webpack-bundled file (route handlers, this repo's
// own .tsx components) gets rewritten by webpack into an internal module id
// pointing at Next's own bundled React (observed: 19.3.0-canary), same as a
// plain `import`. @react-pdf/reconciler is auto-externalized by Next for
// nodejs-runtime routes, so its own require("react") is a genuine native
// Node require, resolving the real node_modules/react (18.3.1) — a
// different instance, hence "Minified React error #31".
//
// eval("require") produces a call webpack's static analyzer can't trace (its
// argument is an opaque string, not a literal specifier), so it can't rewrite
// it — this is the standard technique for forcing a truly native Node
// require from inside a webpack bundle. Using it here gets the exact same
// React instance @react-pdf/reconciler resolves.
const nodeRequire = eval("require");
const runtime = nodeRequire("react/jsx-runtime");

export const jsx = runtime.jsx;
export const jsxs = runtime.jsxs;
export const Fragment = runtime.Fragment;
