import { Router } from "express";
import {
  contextualBookTitlesPrompt,
  titleCardsPrompt,
  titleVariationsPrompt,
  kdpPositioningTitlesPrompt,
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

/** Extract titles from a potentially-truncated AI response. */
function parseTitlesFromText(text: string): { titles: string[]; enhanced: any[] } {
  // 1. Try clean JSON parse first
  try {
    const data = extractJSON(text);
    const titles = Array.isArray(data.titles)
      ? data.titles.map((t: any) => String(t || "").trim()).filter(Boolean).slice(0, 12)
      : typeof data.title === "string" ? [data.title.trim()] : [];
    const enhanced = Array.isArray(data.enhanced)
      ? data.enhanced.filter((e: any) => e?.title).slice(0, 12)
      : [];
    if (titles.length > 0) return { titles, enhanced };
  } catch { /* fall through */ }

  // 2. Regex fallback — extract completed quoted strings from a "titles": [...] array
  //    Works even when the JSON is truncated mid-element
  const arrayMatch = text.match(/"titles"\s*:\s*\[([^\]]*)/s);
  if (arrayMatch) {
    const arrayBody = arrayMatch[1];
    const titleMatches = [...arrayBody.matchAll(/"([^"\\](?:[^"\\]|\\.)*)"/g)];
    const titles = titleMatches
      .map((m) => m[1].replace(/\\"/g, '"').trim())
      .filter(Boolean)
      .slice(0, 12);
    if (titles.length > 0) return { titles, enhanced: [] };
  }

  // 3. Last resort — pull any quoted string longer than 10 chars
  const allQuoted = [...text.matchAll(/"([A-Z][^"]{9,80})"/g)];
  const titles = allQuoted
    .map((m) => m[1].trim())
    .filter((t) => !t.includes("{") && !t.includes(":"))
    .slice(0, 12);
  return { titles, enhanced: [] };
}

async function runTitleGeneration(
  params: any,
  opts: { lowCredit?: boolean; disabledProviders?: string[]; maxTokens?: number }
): Promise<{ titles: string[]; enhanced: any[]; usedProvider: ProviderId }> {
  const { text, usedProvider } = await generateContentFast(
    contextualBookTitlesPrompt(params),
    systemPrompt(),
    { ...opts, maxTokens: opts.maxTokens ?? 1200 }
  );
  const { titles, enhanced } = parseTitlesFromText(text);
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

    if (mode === "kdp-positioning") {
      const prompt = kdpPositioningTitlesPrompt({ research });
      const { text, usedProvider } = await generateContentFast(prompt, systemPrompt(), { ...opts, maxTokens: 2500 });
      let raw: any[] = [];
      try {
        const parsed = extractJSON(text);
        raw = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.titles) ? parsed.titles : []);
      } catch { /* leave raw empty */ }
      const angleOrder = ["Outcome-Focused", "Problem-Solution Focused", "Audience-Focused"];
      const cards: any[] = raw
        .filter((r: any) => r?.title)
        .slice(0, 3)
        .map((r: any, i: number) => ({
          title:            r.title,
          subtitle:         r.subtitle || "",
          subtitleOptions:  r.subtitle ? [{ style: "Strategic", text: r.subtitle }] : [],
          category:         r.angle || angleOrder[i] || "Outcome-Focused",
          pattern:          r.angle || angleOrder[i] || "Outcome-Focused",
          hook:             r.reason || "",
          audienceResonance: r.targetAudience ? [r.targetAudience] : [],
          keywords:         [r.problem, r.desiredOutcome].filter(Boolean),
          toneProfile:      [],
          seoScore:         null,
          emotionalScore:   null,
          clickabilityScore: null,
          audienceMatch:    null,
          isRecommended:    i === 0,
          _problem:         r.problem || "",
          _desiredOutcome:  r.desiredOutcome || "",
          _targetAudience:  r.targetAudience || "",
        }));
      const titles = cards.map((c: any) => c.title).filter(Boolean);
      const enhanced = cards.map((c: any) => ({
        title:    c.title,
        subtitle: c.subtitle,
        hook:     c.hook,
        audience: c.audienceResonance?.[0] || "",
        angle:    c.category
      }));
      res.setHeader("X-AI-Provider", usedProvider);
      return res.json({ titles, enhanced, cards, _provider: usedProvider });
    }

    if (mode) {
      const prompt = titleCardsPrompt({ research, competitorSummaries, intelligence, mode });
      const { text, usedProvider } = await generateContentFast(prompt, systemPrompt(), { ...opts, maxTokens: 1200 });
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
