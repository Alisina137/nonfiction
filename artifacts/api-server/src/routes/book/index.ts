import { Router } from "express";
import { buildCompetitorSummariesForPrompt } from "../ai/analysisSummary.js";
import { contextualBookTitlesPrompt, systemPrompt } from "../ai/prompts.js";
import { generateContentFast, extractJSON } from "../ai/aiRouter.js";

const router = Router();

const AUDIENCE_REGEX = /\bfor\s+[A-Z][A-Za-z][A-Za-z'-]*(\s+(?:Who\s+\w+|[A-Z][A-Za-z'-]+)){0,3}\b/;

function countAudienceTitles(titles: string[]): number {
  return titles.filter((t) => AUDIENCE_REGEX.test(t)).length;
}

async function runTitleGeneration(params: any): Promise<string[]> {
  const text = await generateContentFast(contextualBookTitlesPrompt(params), systemPrompt());
  const data = extractJSON(text);
  let titles = data.titles;
  if (!Array.isArray(titles))
    titles = typeof data.title === "string" ? [data.title] : [];
  return titles.map((t: any) => String(t || "").trim()).filter(Boolean).slice(0, 12);
}

router.post("/contextual-titles", async (req, res) => {
  try {
    const { research, analysis, audienceCandidates, painPoints, transformations } = req.body || {};
    if (!research || typeof research !== "object")
      return res.status(400).json({ error: "Research payload required." });
    const competitorSummaries = buildCompetitorSummariesForPrompt(analysis?.books || []);
    const params = {
      research,
      competitorSummaries,
      audienceCandidates: Array.isArray(audienceCandidates) ? audienceCandidates : [],
      painPoints: Array.isArray(painPoints) ? painPoints : [],
      transformations: Array.isArray(transformations) ? transformations : []
    };

    let titles = await runTitleGeneration(params);

    // Compliance audit: require >=70% audience-explicit (5/6 for 6-title batch).
    const required = Math.ceil(titles.length * 0.7);
    if (titles.length >= 3 && countAudienceTitles(titles) < required) {
      const retryTitles = await runTitleGeneration(params);
      const orig = titles;
      const audienceOf = (arr: string[]) => arr.filter((t) => AUDIENCE_REGEX.test(t));
      const merged = [
        ...audienceOf(retryTitles),
        ...audienceOf(orig),
        ...retryTitles.filter((t) => !AUDIENCE_REGEX.test(t)),
        ...orig.filter((t) => !AUDIENCE_REGEX.test(t))
      ];
      const seen = new Set<string>();
      titles = merged.filter((t) => {
        const k = t.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).slice(0, 6);
    }

    return res.json({ titles });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate titles" });
  }
});

export default router;
