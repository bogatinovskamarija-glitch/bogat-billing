import fs from "fs";
import path from "path";
import { Font } from "@react-pdf/renderer";

// @react-pdf/renderer's <Image> resolves a string `src` by fetching it as a
// URL — a raw filesystem path isn't a valid URL, so it fails silently
// (render succeeds, image just never appears). Reading the file into a
// Buffer up front and passing that as `src` sidesteps the fetch entirely.
export const LOGO_BUFFER = fs.readFileSync(path.join(process.cwd(), "public/brand/logo-forest.png"));

const FONT_DIR = path.join(process.cwd(), "public/fonts/montserrat");

// .woff, not .woff2 — fontkit (which @react-pdf/renderer embeds fonts
// through) has a real subsetting bug with these Google-Fonts-derived woff2
// files: it throws "Offset is outside the bounds of the DataView" once the
// requested glyph subset is more than a handful of characters. Confirmed by
// testing both formats directly; plain .woff subsets correctly.
Font.register({
  family: "Montserrat",
  fonts: [
    { src: path.join(FONT_DIR, "Montserrat-Regular.woff"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Montserrat-SemiBold.woff"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "Montserrat-Bold.woff"), fontWeight: 700 },
  ],
});
