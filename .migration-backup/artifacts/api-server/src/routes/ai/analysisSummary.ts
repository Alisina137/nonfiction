export function buildCompetitorSummariesForPrompt(analysisBooks: any[], limit = 24): string[] {
  if (!Array.isArray(analysisBooks) || analysisBooks.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < Math.min(analysisBooks.length, limit); i++) {
    const b = analysisBooks[i];
    if (!b?.title) continue;
    const parts = [b.title.trim()];
    if (b.authors?.trim?.()) parts.push(`by ${b.authors}`);
    else if (typeof b.subtitle === "string" && b.subtitle.trim()) parts.push(`— ${b.subtitle.trim()}`);
    if (b.asin) parts.push(`(ASIN ${b.asin})`);
    out.push(parts.join(" ").replace(/\s+/g, " "));
  }
  return out;
}
