// Dev-mode counterpart to ./jsx-runtime.ts — see that file for why eval("require")
// is used here instead of a plain require().
const nodeRequire = eval("require");
const runtime = nodeRequire("react/jsx-dev-runtime");

export const jsxDEV = runtime.jsxDEV;
export const Fragment = runtime.Fragment;
