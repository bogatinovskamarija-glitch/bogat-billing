// Bogat Architecture & Design brand values, taken directly from
// "Bogat Architecture & Design - Brand Kit.docx" — used by the invoice PDF
// template and any client-facing UI. Update here if the brand kit changes;
// nothing else in the app should hardcode a color or font name.

export const brand = {
  colors: {
    primary: "#242E22", // Deep Forest
    accent: "#3B5237", // Canopy Green
    white: "#FFFFFF", // Pure White
    text: "#2B2926", // Warm Charcoal — body text on light backgrounds, never pure black
    sageLight: "#D4DDD1",
    sageMedium: "#8A9E85",
    gold: "#C9A84C", // Muted Gold — premium accent, cap ~5% of coverage
    stone: "#E8E8E3",
    linen: "#F5F5F0",
  },
  fonts: {
    // Sole brand font, weights 300-700. Google Fonts. Never substitute a serif.
    family: "Montserrat",
    fallback: "Helvetica Neue, Helvetica, Arial, sans-serif",
  },
  logo: {
    // logo-transparent.png is white line-art with a transparent background —
    // legible only over the Deep Forest gradient, NOT on white/light surfaces.
    transparent: "/brand/logo-transparent.png",
    // Use this one on white/light backgrounds (invoice PDF, login card, etc).
    solid: "/brand/logo.png",
  },
  tagline: "Designed for what comes next.",
} as const;
