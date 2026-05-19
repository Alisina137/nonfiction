/**
 * Compact lines about analysis books for LLM grounding (titles + optionally ASIN/url).
 */
export function buildCompetitorSummariesForPrompt(analysisBooks, limit = 24) {
  if (!Array.isArray(analysisBooks) || analysisBooks.length === 0) return [];
  const out = [];
  for (let i = 0; i < Math.min(analysisBooks.length, limit); i += 1) {
    const b = analysisBooks[i];
    if (!b?.title) continue;
    const parts = [b.title.trim()];
    if (b.authors?.trim?.()) parts.push(`by ${b.authors}`);
    else if (typeof b.subtitle === "string" && b.subtitle.trim()) parts.push(`— ${b.subtitle.trim()}`);
    if (b.asin) parts.push(`(ASIN ${b.asin})`);
    const line = parts.join(" ").replace(/\s+/g, " ");
    out.push(line);
  }
  return out;
}
