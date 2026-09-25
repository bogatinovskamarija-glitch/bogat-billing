import fs from "fs";
import path from "path";
import { Font } from "@react-pdf/renderer";

// @react-pdf/renderer's <Image> resolves a string `src` by fetching it as a
// URL — a raw filesystem path isn't a valid URL, so it fails silently
// (render succeeds, image just never appears). Reading the file into a
// Buffer and passing that as `src` sidesteps the fetch entirely.
//
// Both this and the Font.register call below used to run eagerly at module
// load time. That meant any failure here (working directory not what was
// expected, a file genuinely missing, whatever it turns out to be) crashed
// the whole route module before a single request handler ever ran — every
// PDF route died with a bare, bodyless 500 no try/catch inside the handler
// could ever catch, since the crash happened before the handler was even
// reachable. Making both lazy and memoized means the first real request
// that needs them is the first time they run, inside the route's own
// try/catch, where a failure is diagnosable instead of a silent module-load
// crash.
let _logoBuffer: Buffer | null = null;
let _fontsRegistered = false;

export function ensurePdfAssetsLoaded(): Buffer {
  if (!_fontsRegistered) {
    const FONT_DIR = path.join(process.cwd(), "public/fonts/montserrat");
    // .woff, not .woff2 — fontkit (which @react-pdf/renderer embeds fonts
    // through) has a real subsetting bug with these Google-Fonts-derived
    // woff2 files: it throws "Offset is outside the bounds of the
    // DataView" once the requested glyph subset is more than a handful of
    // characters. Confirmed by testing both formats directly; plain .woff
    // subsets correctly.
    Font.register({
      family: "Montserrat",
      fonts: [
        { src: path.join(FONT_DIR, "Montserrat-Regular.woff"), fontWeight: 400 },
        { src: path.join(FONT_DIR, "Montserrat-SemiBold.woff"), fontWeight: 600 },
        { src: path.join(FONT_DIR, "Montserrat-Bold.woff"), fontWeight: 700 },
      ],
    });
    _fontsRegistered = true;
  }
  if (!_logoBuffer) {
    _logoBuffer = fs.readFileSync(path.join(process.cwd(), "public/brand/logo-forest.png"));
  }
  return _logoBuffer;
}
