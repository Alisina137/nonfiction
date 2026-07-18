import { Router } from "express";
import {
  contextualBookTitlesPrompt,
  titleCardsPrompt,
  titleVariationsPrompt,
  kdpSuggestPrompt,
  regenTitleCardPrompt,
  systemPrompt
} from "../ai/prompts.js";
import { buildCompetitorSummariesForPrompt } from "../ai/analysisSummary.js";
import {
  generateContentFast,
  extractJSON,
  PROVIDERS,
  type ProviderId
} from "../ai/aiRouter.js";
import {
  runTitlePipeline,
  logTitlePipeline,
  type TitleItem,
  type TitleContext
} from "../ai/titleNormalizer.js";

const router = Router();

const AUDIENCE_REGEX = /\bfor\s+[A-Z][A-Za-z][A-Za-z'-]*(\s+(?:Who\s+\w+|[A-Z][A-Za-z'-]+)){0,3}\b/;

function countAudienceTitles(titles: string[]): number {
  return titles.filter((t) => AUDIENCE_REGEX.test(t)).length;
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

/** Run a single title generation call through the normalizer pipeline. */
async function runNormalizedTitleCall(
  prompt: string,
  ctx: TitleContext,
  opts: { lowCredit?: boolean; disabledProviders?: string[]; maxTokens?: number },
  endpoint: string,
  attempt: number
): Promise<{ items: TitleItem[]; usedProvider: ProviderId; valid: boolean }> {
  const providerModel = PROVIDERS.find((p) => Boolean(p.apiKey()))?.model ?? "unknown";
  const { text, usedProvider } = await generateContentFast(prompt, systemPrompt(), opts);
  const pipeline = runTitlePipeline(text, ctx);

  logTitlePipeline({
    endpoint,
    provider:         usedProvider,
    model:            providerModel,
    rawResponse:      text,
    parsedResponse:   null,
    normalizedTitles: pipeline.titles,
    validationResult: { valid: pipeline.valid, errors: pipeline.validationErrors },
    repaired:         pipeline.repaired,
    parseWarning:     pipeline.parseWarning,
    attempt
  });

  return { items: pipeline.titles, usedProvider, valid: pipeline.valid };
}

/** Convert normalized TitleItem[] into card objects for the frontend. */
function itemsToCards(items: TitleItem[]): any[] {
  return items.map((item, i) => ({
    title:             item.title,
    subtitle:          "",
    subtitleOptions:   [],
    category:          item.angle || "Audience-Focused",
    pattern:           item.angle || "",
    hook:              item.reason || "",
    audienceResonance: [],
    keywords:          [],
    toneProfile:       [],
    seoScore:          null,
    emotionalScore:    null,
    clickabilityScore: null,
    audienceMatch:     null,
    isRecommended:     i === 0,
    _angle:            item.angle  || "",
    _reason:           item.reason || ""
  }));
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
    const ctx: TitleContext = {
      idea:     research.bookTopic?.trim() || research.deepNicheLabel?.trim() || "",
      niche:    research.mainNicheLabel?.trim() || "",
      subNiche: research.subNicheLabel?.trim()  || ""
    };

    // ── Mode: kdp-positioning ────────────────────────────────────────────────
    if (mode === "kdp-positioning") {
      const prompt = kdpSuggestPrompt({
        action:    "suggest_titles",
        mainNiche: research.mainNicheLabel?.trim() || "",
        subNiche:  research.subNicheLabel?.trim()  || "",
        deepNiche: research.deepNicheLabel?.trim()  || "",
      });

      let { items, usedProvider, valid } = await runNormalizedTitleCall(
        prompt, ctx, { ...opts, maxTokens: 1500 }, "kdp-positioning", 1
      );

      // Retry once if invalid
      if (!valid) {
        try {
          const retry = await runNormalizedTitleCall(
            prompt, ctx, { ...opts, maxTokens: 1500 }, "kdp-positioning", 2
          );
          if (retry.valid) { items = retry.items; usedProvider = retry.usedProvider; }
        } catch { /* keep first result */ }
      }

      const cards    = itemsToCards(items);
      const titles   = items.map((t) => t.title);
      const enhanced = items.map((t) => ({ title: t.title, angle: t.angle, hook: t.reason, reason: t.reason }));
      res.setHeader("X-AI-Provider", usedProvider);
      return res.json({ titles, enhanced, cards, _provider: usedProvider });
    }

    // ── Mode: bestseller / other named modes ─────────────────────────────────
    if (mode) {
      const prompt = titleCardsPrompt({ research, competitorSummaries, intelligence, mode });
      const { text, usedProvider } = await generateContentFast(prompt, systemPrompt(), { ...opts, maxTokens: 7000, taskType: "idea" as const });

      // titleCardsPrompt returns rich card objects — parse as-is, then normalize titles
      let data: any = {};
      try { data = extractJSON(text); } catch { /* ignore */ }

      let cards: any[] = Array.isArray(data.cards)
        ? data.cards.filter((c: any) => c?.title).slice(0, 25)
        : [];

      // If cards came back empty, fall back through normalizer
      if (!cards.length) {
        const pipeline = runTitlePipeline(text, ctx);
        logTitlePipeline({
          endpoint:         "contextual-titles:" + mode,
          provider:         usedProvider,
          model:            PROVIDERS.find((p) => Boolean(p.apiKey()))?.model ?? "unknown",
          rawResponse:      text,
          parsedResponse:   data,
          normalizedTitles: pipeline.titles,
          validationResult: { valid: pipeline.valid, errors: pipeline.validationErrors },
          repaired:         pipeline.repaired,
          parseWarning:     pipeline.parseWarning,
          attempt:          1
        });
        cards = itemsToCards(pipeline.titles);
      }

      const titles   = cards.map((c: any) => c.title).filter(Boolean);
      const enhanced = cards.map((c: any) => ({
        title:    c.title,
        subtitle: c.subtitle   || "",
        hook:     c.hook       || "",
        audience: Array.isArray(c.audienceResonance) ? c.audienceResonance[0] : "",
        angle:    c.pattern    || c.category || ""
      }));
      const recommendations = (data.recommendations && typeof data.recommendations === "object") ? data.recommendations : {};
      res.setHeader("X-AI-Provider", usedProvider);
      return res.json({ titles, enhanced, cards, recommendations, _provider: usedProvider });
    }

    // ── Default mode: contextual titles ──────────────────────────────────────
    const prompt = contextualBookTitlesPrompt({
      research,
      competitorSummaries,
      audienceCandidates: Array.isArray(audienceCandidates) ? audienceCandidates : [],
      painPoints:         Array.isArray(painPoints) ? painPoints : [],
      transformations:    Array.isArray(transformations) ? transformations : []
    });

    let { items: firstItems, usedProvider, valid } = await runNormalizedTitleCall(
      prompt, ctx, { ...opts, maxTokens: 1200 }, "contextual-titles", 1
    );

    // Audience-rule enforcement retry (70% of titles must name audience)
    const firstTitles = firstItems.map((t) => t.title);
    const required    = Math.ceil(firstTitles.length * 0.7);
    if (firstTitles.length >= 3 && countAudienceTitles(firstTitles) < required) {
      try {
        const retry = await runNormalizedTitleCall(
          prompt, ctx, { ...opts, maxTokens: 1200 }, "contextual-titles", 2
        );
        // Prefer retry if it satisfies the audience rule or is equally valid
        const retryAudience = countAudienceTitles(retry.items.map((t) => t.title));
        if (retryAudience >= required || retry.valid) {
          firstItems    = retry.items;
          usedProvider  = retry.usedProvider;
        }
      } catch { /* keep first batch */ }
    }

    const titles   = firstItems.map((t) => t.title);
    const enhanced = firstItems.map((t) => ({
      title:  t.title,
      angle:  t.angle,
      hook:   t.reason,
      reason: t.reason
    }));

    res.setHeader("X-AI-Provider", usedProvider);
    return res.json({ titles, enhanced, _provider: usedProvider });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate titles" });
  }
});

router.post("/regenerate-card", async (req, res) => {
  try {
    const { research, analysis, intelligence, avoidTitles, style } = req.body || {};
    if (!research || typeof research !== "object")
      return res.status(400).json({ error: "Research payload required." });

    const competitorSummaries = buildCompetitorSummariesForPrompt(analysis?.books || []);
    const opts = aiOptsFromReq(req);
    const prompt = regenTitleCardPrompt({ research, competitorSummaries, intelligence, avoidTitles, style });

    const { text, usedProvider } = await generateContentFast(prompt, systemPrompt(), {
      ...opts, maxTokens: 1500, taskType: "idea" as const
    });

    let card: any = null;
    try { card = extractJSON(text); } catch { /* ignore */ }

    if (!card?.title) {
      return res.status(500).json({ error: "Failed to generate a replacement title card." });
    }

    card.isRecommended = false;
    res.setHeader("X-AI-Provider", usedProvider);
    return res.json({ card, _provider: usedProvider });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Generation failed." });
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
