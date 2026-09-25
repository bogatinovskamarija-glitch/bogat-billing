// Dev-mode counterpart to ./jsx-runtime.ts — see that file for why this
// exists. `next dev` uses the dev JSX runtime instead of the production one.
const runtime = require("react/jsx-dev-runtime");

export const jsxDEV = runtime.jsxDEV;
export const Fragment = runtime.Fragment;
