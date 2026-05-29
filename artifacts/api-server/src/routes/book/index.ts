import { Router } from "express";
import {
  contextualBookTitlesPrompt,
  titleCardsPrompt,
  titleVariationsPrompt,
  systemPrompt
} from "../ai/prompts.js";
import { buildCompetitorSummariesForPrompt } from "../ai/analysisSummary.js";
import {
  generateContentFast,
  extractJSON,
  type ProviderId
} from "../ai/aiRouter.js";

const router = Router();

const AUDIENCE_REGEX = /\bfor\s+[A-Z][A-Za-z][A-Za-z'-]*(\s+(?:Who\s+\w+|[A-Z][A-Za-z'-]+)){0,3}\b/;

function countAudienceTitles(titles: string[]): number {
  return titles.filter((t) => AUDIENCE_REGEX.test(t)).length;
}

async function runTitleGeneration(
  params: any,
  opts: { lowCredit?: boolean; disabledProviders?: string[] }
): Promise<{ titles: string[]; enhanced: any[]; usedProvider: ProviderId }> {
  const { text, usedProvider } = await generateContentFast(
    contextualBookTitlesPrompt(params),
    systemPrompt(),
    opts
  );
  const data = extractJSON(text);
  let titles = data.titles;
  if (!Array.isArray(titles))
    titles = typeof data.title === "string" ? [data.title] : [];
  titles = titles.map((t: any) => String(t || "").trim()).filter(Boolean).slice(0, 12);
  const enhanced: any[] = Array.isArray(data.enhanced)
    ? data.enhanced.filter((e: any) => e?.title).slice(0, 12)
    : [];
  return { titles, enhanced, usedProvider };
}

function aiOptsFromReq(req: any) {
  const body = req?.body || {};
  const disabledProviders: string[] = Array.isArray(body.disabledProviders)
    ? body.disabledProviders.filter((p: any) => typeof p === "string")
    : [];
  return {
    lowCredit: body.lowCostMode === true,
    ...(disabledProviders.length ? { disabledProviders } : {})
  };
}

router.post("/contextual-titles", async (req, res) => {
  try {
    const {
      research, analysis, audienceCandidates, painPoints, transformations,
      mode, intelligence
    } = req.body || {};

    if (!research || typeof research !== "object")
      return res.status(400).json({ error: "Research payload required." });

    const competitorSummaries = buildCompetitorSummariesForPrompt(analysis?.books || []);
    const opts = aiOptsFromReq(req);

    if (mode) {
      const prompt = titleCardsPrompt({ research, competitorSummaries, intelligence, mode });
      const { text, usedProvider } = await generateContentFast(prompt, systemPrompt(), opts);
      const data = extractJSON(text);
      const cards: any[] = Array.isArray(data.cards)
        ? data.cards.filter((c: any) => c?.title).slice(0, 6)
        : [];
      const titles = cards.map((c: any) => c.title).filter(Boolean);
      const enhanced = cards.map((c: any) => ({
        title: c.title,
        subtitle: c.subtitle,
        hook: c.hook,
        audience: Array.isArray(c.audienceResonance) ? c.audienceResonance[0] : "",
        angle: c.pattern
      }));
      res.setHeader("X-AI-Provider", usedProvider);
      return res.json({ titles, enhanced, cards, _provider: usedProvider });
    }

    const params = {
      research,
      competitorSummaries,
      audienceCandidates: Array.isArray(audienceCandidates) ? audienceCandidates : [],
      painPoints: Array.isArray(painPoints) ? painPoints : [],
      transformations: Array.isArray(transformations) ? transformations : []
    };

    let { titles, enhanced, usedProvider } = await runTitleGeneration(params, opts);

    const required = Math.ceil(titles.length * 0.7);
    if (titles.length >= 3 && countAudienceTitles(titles) < required) {
      try {
        const retry = await runTitleGeneration(params, opts);
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
        if (retry.enhanced.length) enhanced = retry.enhanced;
      } catch {
        // keep first batch if retry fails
      }
    }

    res.setHeader("X-AI-Provider", usedProvider);
    return res.json({ titles, enhanced, _provider: usedProvider });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate titles" });
  }
});

router.post("/title-variations", async (req, res) => {
  try {
    const { title, subtitle, research, intelligence } = req.body || {};
    if (!title) return res.status(400).json({ error: "title is required." });
    const prompt = titleVariationsPrompt({ title, subtitle, research, intelligence });
    const { text, usedProvider } = await generateContentFast(prompt, systemPrompt(), aiOptsFromReq(req));
    const data = extractJSON(text);
    const variations = Array.isArray(data.variations)
      ? data.variations.filter((v: any) => v?.style && v?.title).slice(0, 6)
      : [];
    res.setHeader("X-AI-Provider", usedProvider);
    return res.json({ variations, _provider: usedProvider });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate variations" });
  }
});

export default router;
