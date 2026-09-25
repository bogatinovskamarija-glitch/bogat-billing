// Next's App Router SWC transform rewrites plain `import ... from "react"` in
// server-bundled files to go through Next's own internal React registry,
// which is a different React instance than the one @react-pdf/reconciler
// resolves via its own native require("react") (it's auto-externalized, so
// it always gets whatever's physically in node_modules/react). Elements
// built by one instance aren't recognized by the other's reconciler —
// "Minified React error #31". A plain require() bypasses that rewrite, so
// pointing the PDF documents' JSX runtime at this file (via @jsxImportSource)
// guarantees their elements are built with the exact same React instance
// @react-pdf/reconciler uses.
const runtime = require("react/jsx-runtime");

export const jsx = runtime.jsx;
export const jsxs = runtime.jsxs;
export const Fragment = runtime.Fragment;
