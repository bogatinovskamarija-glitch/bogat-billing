// See ./jsx-runtime.ts for why eval("require") is used here instead of a
// plain import/require — it's the one createElement call each PDF route
// uses to wrap its top-level Document component, and it needs the same
// genuinely-native react resolution the JSX inside that component gets.
const nodeRequire = eval("require");
export const createElement = nodeRequire("react").createElement;
