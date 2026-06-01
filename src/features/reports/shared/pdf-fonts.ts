import "server-only";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Font family used by all report/document PDFs.
 *
 * The PDF built-in Helvetica (AFM, WinAnsi-encoded) cannot render the peso
 * sign ₱ (U+20B1) — that is why legacy code printed the literal "PHP ". We
 * embed Roboto (Apache-2.0, ships the ₱ glyph) so amounts render correctly.
 *
 * Font files live in `public/fonts/` so they are available at runtime in both
 * `next dev` and a built `next start` (the `public/` dir is always served from
 * `process.cwd()`).
 */
export const REPORT_FONT_FAMILY = "Roboto";

let registered = false;

/** Register report fonts once. Call before `renderToBuffer`. */
export function registerReportFonts(): void {
  if (registered) return;

  const fontsDir = path.join(process.cwd(), "public", "fonts");
  Font.register({
    family: REPORT_FONT_FAMILY,
    fonts: [
      { src: path.join(fontsDir, "Roboto-Regular.ttf"), fontWeight: "normal" },
      { src: path.join(fontsDir, "Roboto-Bold.ttf"), fontWeight: "bold" },
    ],
  });

  // Keep amounts/words intact — no hyphenated line breaks inside table cells.
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
}
