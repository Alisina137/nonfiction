import { Router } from "express";
import {
  analyzeBookConceptPrompt,
  architecturePreviewPrompt,
  competitiveIntelligencePrompt,
  contextualBookTitlesPrompt,
  coverBriefPrompt,
  coverCriticPrompt,
  coverVariantsPrompt,
  descriptionPrompt,
  improvementPrompt,
  lessonPrompt,
  marketingDescriptionPrompt,
  nicheOutlinePrompt,
  nicheSystemPrompt,
  outlinePrompt,
  regenTitlePrompt,
  structurePrompt,
  systemPrompt,
  titlesPrompt
} from "./prompts.js";
import { buildCompetitorSummariesForPrompt } from "./analysisSummary.js";
import {
  generateContent,
  generateContentFast,
  extractJSON,
  GrokApprovalRequiredError,
  TOKEN_LIMITS
} from "./aiRouter.js";

const router = Router();

/**
 * Express response shape for AI endpoints:
 *   - 200: { ...payload, _provider: "openai"|"anthropic"|"xai"|"gemini" }
 *   - 409: { needsApproval: "grok", attempted, message }  ← client should show modal
 *   - 500: { error }
 */
function aiErrorResponse(res: any, error: any) {
  if (error instanceof GrokApprovalRequiredError) {
    return res.status(409).json({
      needsApproval: "grok",
      attempted: error.attempted,
      message: error.message
    });
  }
  return res.status(500).json({ error: error?.message || "AI request failed" });
}

function aiOptsFromReq(req: any, maxTokens?: number) {
  return {
    allowGrok: req?.body?.allowGrok === true,
    lowCredit: req?.body?.lowCostMode === true,
    maxTokens: maxTokens ?? TOKEN_LIMITS.default
  };
}

// Context compression for lesson generation — prevents oversized prompts.
// Only sends fields the model actually needs; drops redundant content.
function compressLessonBody(body: any): any {
  const { subsection, chapterContext, previousConcepts, ...rest } = body || {};

  const compressedSubsection = subsection ? {
    title:       subsection.title,
    description: String(subsection.description || subsection.objective || "").slice(0, 300),
    keyPoints:   Array.isArray(subsection.keyPoints)   ? subsection.keyPoints.slice(0, 4)   : undefined,
    sections:    Array.isArray(subsection.sections)    ? subsection.sections.slice(0, 3).map((s: any) => s.title) : undefined
  } : subsection;

  const compressedChapter = chapterContext ? {
    title:       chapterContext.title,
    description: String(chapterContext.description || "").slice(0, 200)
  } : chapterContext;

  const compressedPrev = Array.isArray(previousConcepts)
    ? previousConcepts.slice(-2).map((c: any) =>
        typeof c === "string" ? c.slice(0, 120) : { title: c.title, summary: String(c.summary || "").slice(0, 120) }
      )
    : previousConcepts;

  return { ...rest, subsection: compressedSubsection, chapterContext: compressedChapter, previousConcepts: compressedPrev };
}

function setProviderHeader(res: any, provider: string) {
  res.setHeader("X-AI-Provider", provider);
}

// Long-form (OpenAI primary) — uses short chain when client sets lowCostMode=true
async function runLong(prompt: string, system: string, req: any, res: any, contentType = "default") {
  const maxTokens = TOKEN_LIMITS[contentType] ?? TOKEN_LIMITS.default;
  const opts = aiOptsFromReq(req, maxTokens);
  const useFast = req?.body?.lowCostMode === true;
  const { text, usedProvider } = useFast
    ? await generateContentFast(prompt, system, opts)
    : await generateContent(prompt, system, opts);
  setProviderHeader(res, usedProvider);
  return { text, usedProvider };
}

// Short-form (Gemini primary)
async function runShort(prompt: string, system: string, req: any, res: any, contentType = "default") {
  const maxTokens = TOKEN_LIMITS[contentType] ?? TOKEN_LIMITS.default;
  const { text, usedProvider } = await generateContentFast(prompt, system, aiOptsFromReq(req, maxTokens));
  setProviderHeader(res, usedProvider);
  return { text, usedProvider };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.post("/titles", async (req, res) => {
  try {
    const { idea } = req.body;
    const { text, usedProvider } = await runShort(titlesPrompt(idea), systemPrompt(), req, res, "title");
    const data = extractJSON(text);
    return res.json({ titles: data.titles || [], _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/contextual-titles", async (req, res) => {
  try {
    const { research, analysis } = req.body || {};
    if (!research || typeof research !== "object")
      return res.status(400).json({ error: "Research payload required." });
    const competitorSummaries = buildCompetitorSummariesForPrompt(analysis?.books || []);
    const { text, usedProvider } = await runShort(
      contextualBookTitlesPrompt({ research, competitorSummaries }),
      systemPrompt(),
      req,
      res,
      "title"
    );
    const data = extractJSON(text);
    let titles = data.titles;
    if (!Array.isArray(titles))
      titles = typeof data.title === "string" ? [data.title] : [];
    titles = titles.map((t: any) => String(t || "").trim()).filter(Boolean).slice(0, 12);
    return res.json({ titles, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/description", async (req, res) => {
  try {
    const prompt = req.body?.enriched
      ? marketingDescriptionPrompt(req.body)
      : descriptionPrompt(req.body);
    const { text, usedProvider } = await runLong(prompt, systemPrompt(), req, res, "description");
    const data = extractJSON(text);
    return res.json({ ...data, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/cover", async (req, res) => {
  try {
    const { text, usedProvider } = await runLong(coverBriefPrompt(req.body), systemPrompt(), req, res, "cover");
    const data = extractJSON(text);
    return res.json({ ...data, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/cover-critic", async (req, res) => {
  try {
    const { text, usedProvider } = await runLong(coverCriticPrompt(req.body), systemPrompt(), req, res, "cover");
    const data = extractJSON(text);
    return res.json({ ...data, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/cover-variants", async (req, res) => {
  try {
    const { text, usedProvider } = await runLong(coverVariantsPrompt(req.body), systemPrompt(), req, res, "cover");
    const data = extractJSON(text);
    return res.json({ variants: data.variants || [], _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/outline", async (req, res) => {
  try {
    const { text, usedProvider } = await runShort(outlinePrompt(req.body), systemPrompt(), req, res, "outline");
    const data = extractJSON(text);
    return res.json({ chapters: data.chapters || [], _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/niche-outline", async (req, res) => {
  try {
    const { research, architecture, title, description } = req.body || {};
    if (!architecture?.subNicheLabel)
      return res.status(400).json({ error: "Missing niche architecture" });
    const { text, usedProvider } = await runLong(
      nicheOutlinePrompt({ research, architecture, title, description }),
      nicheSystemPrompt(architecture),
      req,
      res,
      "outline"
    );
    const data = extractJSON(text);
    return res.json({ ...data, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/structure", async (req, res) => {
  try {
    const { text, usedProvider } = await runShort(structurePrompt(req.body), systemPrompt(), req, res, "structure");
    const data = extractJSON(text);
    return res.json({ sections: data.sections || [], _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/lesson", async (req, res) => {
  try {
    const compressed = compressLessonBody(req.body);
    const { text, usedProvider } = await runLong(lessonPrompt(compressed), systemPrompt(), req, res, "lesson");
    const data = extractJSON(text);
    return res.json({ lesson: data, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/improve", async (req, res) => {
  try {
    const { action, currentText, tone } = req.body || {};
    const { text, usedProvider } = await runLong(
      improvementPrompt({ action, currentText, tone }),
      systemPrompt(),
      req,
      res,
      "improve"
    );
    return res.json({ text, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/analyze-book-concept", async (req, res) => {
  try {
    const { niche, subNiche, title } = req.body || {};
    if (!niche || !subNiche || !title)
      return res.status(400).json({ error: "niche, subNiche, and title are required." });
    const { text, usedProvider } = await runShort(
      analyzeBookConceptPrompt(req.body),
      systemPrompt(),
      req,
      res
    );
    const raw = extractJSON(text);
    const str = (v: any) => (typeof v === "string" ? v.trim() : "");
    const arr = (v: any) => (Array.isArray(v) ? v.map((x: any) => String(x).trim()).filter(Boolean) : []);
    const num = (v: any, def = 7.0) => (typeof v === "number" && isFinite(v) ? Math.min(10, Math.max(0, v)) : def);
    const lvl = (v: any) => (["Low", "Medium", "High"].includes(v) ? v : "Medium");
    const out = {
      targetAudience: str(raw.targetAudience),
      painPoints: arr(raw.painPoints),
      transformations: arr(raw.transformations),
      writingStyle: str(raw.writingStyle),
      uniqueAngle: str(raw.uniqueAngle),
      standoutFactor: str(raw.standoutFactor),
      readerEnergy: str(raw.readerEnergy),
      promise: str(raw.promise),
      tone: str(raw.tone),
      idealReader: str(raw.idealReader),
      bookTopic: str(raw.bookTopic),
      strategyInsights: arr(raw.strategyInsights),
      demandScore: num(raw.demandScore, 7.5),
      competitionLevel: lvl(raw.competitionLevel),
      emotionalBuyingScore: num(raw.emotionalBuyingScore, 7.0),
      viralityPotential: lvl(raw.viralityPotential),
      tiktokCompatibility: lvl(raw.tiktokCompatibility),
      youtubeCompatibility: lvl(raw.youtubeCompatibility),
      kdpOpportunityScore: num(raw.kdpOpportunityScore, 7.5)
    };
    return res.json({ ...out, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/architecture-preview", async (req, res) => {
  try {
    const { niche, subNiche } = req.body || {};
    if (!niche || !subNiche)
      return res.status(400).json({ error: "niche and subNiche are required." });
    const { text, usedProvider } = await runLong(
      architecturePreviewPrompt(req.body),
      systemPrompt(),
      req,
      res
    );
    const data = extractJSON(text);
    const out = {
      structure: String(data.structure || "").trim(),
      chapters: String(data.chapters || "").trim(),
      emotionalArc: String(data.emotionalArc || "").trim(),
      pacing: String(data.pacing || "").trim(),
      wordBand: String(data.wordBand || "").trim(),
      contentDirection: String(data.contentDirection || "").trim()
    };
    return res.json({ ...out, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/regenerate-title", async (req, res) => {
  try {
    const { level, currentTitle, parentChapter, parentSection, architecture, research } = req.body || {};
    if (!level) return res.status(400).json({ error: "Missing level" });
    const { text, usedProvider } = await runShort(
      regenTitlePrompt({ level, currentTitle, parentChapter, parentSection, architecture, research }),
      systemPrompt(),
      req,
      res
    );
    const data = extractJSON(text);
    return res.json({ title: data.title || currentTitle, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/competitive-intelligence", async (req, res) => {
  try {
    const { niche, subNiche, deepNiche, bookTopic, books } = req.body || {};
    const prompt = competitiveIntelligencePrompt({ niche, subNiche, deepNiche, bookTopic, books });
    const { text, usedProvider } = await runShort(prompt, systemPrompt(), req, res, "default");
    const data = extractJSON(text);
    if (!data || typeof data !== "object") {
      return res.status(500).json({ error: "AI returned unparseable intelligence data." });
    }
    return res.json({ ...data, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

export default router;
