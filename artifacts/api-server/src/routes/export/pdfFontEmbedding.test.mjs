import test from "node:test";
import assert from "node:assert/strict";
import { CUSTOM_PDF_FONT_EMBED_OPTIONS } from "./pdfFontEmbedding.ts";

test("fully embeds custom PDF fonts to avoid subset glyph corruption", () => {
  assert.equal(CUSTOM_PDF_FONT_EMBED_OPTIONS.subset, false);
});
