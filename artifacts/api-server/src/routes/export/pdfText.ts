export function normalizePdfPunctuation(text: unknown): string {
  return String(text ?? "")
    // Apostrophes / quotation marks
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    // Hyphen / dash family. U+2011 is the current WinAnsi failure.
    .replace(/[\u2010\u2011\u2012\u2013\u2212\u2043]/g, "-")
    .replace(/[\u2014\u2015]/g, "--")
    // Ellipsis
    .replace(/\u2026/g, "...")
    // Spaces that standard PDF fonts frequently reject or handle inconsistently
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    // Invisible joiners / zero-width characters should never reach pdf-lib
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, "")
    // Soft hyphen is discretionary; use a visible ASCII hyphen in exported text
    .replace(/\u00AD/g, "-")
    // Common symbols emitted by AI that are not available in WinAnsi fonts
    .replace(/\u2192/g, "->")
    .replace(/\u2190/g, "<-")
    .replace(/\u2194/g, "<->")
    .replace(/\u2191/g, "^")
    .replace(/\u2193/g, "v")
    .replace(/[\u2713\u2714]/g, "OK")
    .replace(/[\u2715\u2716\u2717\u2718]/g, "x")
    .replace(/\u2264/g, "<=")
    .replace(/\u2265/g, ">=")
    .replace(/\u2260/g, "!=")
    .replace(/[\u2028\u2029]/g, "\n");
}
