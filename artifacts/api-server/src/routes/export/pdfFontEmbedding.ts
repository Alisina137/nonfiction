// Custom-font embedding policy for final PDF exports.
//
// pdf-lib delegates TTF subsetting to @pdf-lib/fontkit. That subsetting path can
// produce incomplete/corrupted glyph programs for otherwise valid fonts. Final
// publication PDFs prioritize rendering correctness over the smaller file size
// produced by subsetting, so custom print fonts are embedded in full.
export const CUSTOM_PDF_FONT_EMBED_OPTIONS = {
  subset: false,
};
