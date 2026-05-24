import { Router } from "express";
import {
  contextualBookTitlesPrompt,
  systemPrompt
} from "../ai/prompts.js";
import { buildCompetitorSummariesForPrompt } from "../ai/analysisSummary.js";
import {
  generateContentFast,
  extractJSON,
  GrokApprovalRequiredError,
  type ProviderId
} from "../ai/aiRouter.js";

const router = Router();

const AUDIENCE_REGEX = /\bfor\s+[A-Z][A-Za-z][A-Za-z'-]*(\s+(?:Who\s+\w+|[A-Z][A-Za-z'-]+)){0,3}\b/;

function countAudienceTitles(titles: string[]): number {
  return titles.filter((t) => AUDIENCE_REGEX.test(t)).length;
}

async function runTitleGeneration(
  params: any,
  allowGrok: boolean
): Promise<{ titles: string[]; usedProvider: ProviderId }> {
  const { text, usedProvider } = await generateContentFast(
    contextualBookTitlesPrompt(params),
    systemPrompt(),
    { allowGrok }
  );
  const data = extractJSON(text);
  let titles = data.titles;
  if (!Array.isArray(titles))
    titles = typeof data.title === "string" ? [data.title] : [];
  titles = titles.map((t: any) => String(t || "").trim()).filter(Boolean).slice(0, 12);
  return { titles, usedProvider };
}

router.post("/contextual-titles", async (req, res) => {
  try {
    const { research, analysis, audienceCandidates, painPoints, transformations, allowGrok } =
      req.body || {};
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

    let { titles, usedProvider } = await runTitleGeneration(params, allowGrok === true);

    // Compliance audit: require >=70% audience-explicit (5/6 for 6-title batch).
    const required = Math.ceil(titles.length * 0.7);
    if (titles.length >= 3 && countAudienceTitles(titles) < required) {
      try {
        const retry = await runTitleGeneration(params, allowGrok === true);
        const orig = titles;
        const audienceOf = (arr: string[]) => arr.filter((t) => AUDIENCE_REGEX.test(t));
        const merged = [
          ...audienceOf(retry.titles),
          ...audienceOf(orig),
          ...retry.titles.filter((t) => !AUDIENCE_REGEX.test(t)),
          ...orig.filter((t) => !AUDIENCE_REGEX.test(t))
        ];
        const seen = new Set<string>();
        titles = merged.filter((t) => {
          const k = t.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        }).slice(0, 6);
        usedProvider = retry.usedProvider;
      } catch {
        // keep first batch if retry fails
      }
    }

    res.setHeader("X-AI-Provider", usedProvider);
    return res.json({ titles, _provider: usedProvider });
  } catch (error: any) {
    if (error instanceof GrokApprovalRequiredError) {
      return res.status(409).json({
        needsApproval: "grok",
        attempted: error.attempted,
        message: error.message
      });
    }
    return res.status(500).json({ error: error.message || "Failed to generate titles" });
  }
});

export default router;
