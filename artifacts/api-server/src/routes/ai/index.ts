import { Router } from "express";
import {
  analyzeBookConceptPrompt,
  architecturePreviewPrompt,
  chapterWritingStrategyPrompt,
  competitiveIntelligencePrompt,
  contextualBookTitlesPrompt,
  coverConceptsPrompt,
  coverBriefPrompt,
  coverCriticPrompt,
  coverVariantsPrompt,
  descriptionPrompt,
  generateAuthorPersonaPrompt,
  generateStrategicBookPlanPrompt,
  regenerateBookSectionPrompt,
  generateDetailsPrompt,
  generateFieldSuggestionPrompt,
  generateFocusAreasPrompt,
  sectionGenerationPrompt,
  sectionGenerationFallbackPrompt,
  subsectionGenerationPrompt,
  generateFindingPrompt,
  generateResourcePrompt,
  improvementPrompt,
  extractResourcePrompt,
  lessonPrompt,
  marketingDescriptionPrompt,
  nicheOutlinePrompt,
  nicheSystemPrompt,
  transformationPlanPrompt,
  outlinePrompt,
  regenTitlePrompt,
  resourcesBlock,
  sectionBriefPrompt,
  structurePrompt,
  subtitleSuggestPrompt,
  topicSuggestPrompt,
  kdpSuggestPrompt,
  systemPrompt,
  titlesPrompt,
  backMatterKeyLessonsPrompt,
  backMatterGlossaryPrompt,
  backMatterFurtherReadingPrompt,
  backMatterAppendixEntryPrompt,
  backMatterTheEndPrompt
} from "./prompts.js";
import { buildCompetitorSummariesForPrompt } from "./analysisSummary.js";
import {
  generateContent,
  generateContentFast,
  extractJSON,
  getModelStatus,
  resetProviders,
  TOKEN_LIMITS,
  PROVIDERS,
  type TaskType
} from "./aiRouter.js";
import {
  runTitlePipeline,
  logTitlePipeline,
  type TitleContext
} from "./titleNormalizer.js";

const router = Router();

const VALID_BLUEPRINT_COMPONENTS = new Set([
  "Key Takeaways","Action Plan","Checklist","Exercise","Reflection Questions",
  "Templates","Case Study","Real-Life Example","Research Insight","Resources",
  "One Small Step","Common Mistakes","Pro Tips","7-Day Challenge","FAQ",
  "Myth vs Reality","Success Story","Brain Science","Statistics","Why This Happens",
  "Practical Technique","Self-Assessment","Common Traps","Expert Quote","Story",
]);

/**
 * Strip the "Label: " prefix from section titles.
 * "The Productivity Trap: Why Being Busy..." → "Why Being Busy..."
 * Leaves titles without a colon unchanged.
 */
function stripSectionColon(title: string): string {
  const s = String(title || "").trim();
  const idx = s.indexOf(":");
  if (idx === -1) return s;
  const right = s.slice(idx + 1).trim();
  return right.length > 0 ? right : s;
}

/**
 * Force the transformation plan's part chapterCounts to sum exactly to `target`.
 * Also pads/trims chapterSlots arrays to match the adjusted count.
 * The AI consistently under- or over-counts — this makes the blueprint authoritative.
 */
function normalizePlanCounts(parts: any[], target: number): any[] {
  const n = parts.length;
  if (n === 0) return parts;

  // Start with AI-provided counts, floor to at least 1
  const counts = parts.map((p: any) => Math.max(1, Math.round(Number(p.chapterCount) || 1)));
  let total = counts.reduce((a: number, b: number) => a + b, 0);
  let diff = target - total;

  // Distribute the difference one unit at a time
  let guard = 0;
  while (diff !== 0 && guard++ < 50) {
    if (diff > 0) {
      // Add to the part that currently has the most chapters (middle parts)
      const maxIdx = counts.indexOf(Math.max(...counts));
      counts[maxIdx]++;
      diff--;
    } else {
      // Remove from the largest part, never below 1
      const eligible = counts.map((c: number, i: number) => (c > 1 ? i : -1)).filter((i: number) => i !== -1);
      if (eligible.length === 0) break;
      const maxIdx = eligible.reduce((a: number, b: number) => (counts[a] >= counts[b] ? a : b));
      counts[maxIdx]--;
      diff++;
    }
  }

  // Rebuild parts with corrected counts + synced chapterSlots
  return parts.map((p: any, i: number) => {
    const newCount = counts[i];
    const slots: any[] = Array.isArray(p.chapterSlots) ? p.chapterSlots : [];
    const newSlots = Array.from({ length: newCount }, (_: any, si: number) =>
      slots[si] || { slotIndex: si, beforeState: "", action: "", afterState: "" }
    );
    return { ...p, chapterCount: newCount, chapterSlots: newSlots };
  });
}

function sanitizeOutlineSections(chapters: any[]): any[] {
  if (!Array.isArray(chapters)) return chapters;
  return chapters.map((ch: any) => ({
    ...ch,
    sections: Array.isArray(ch.sections)
      ? ch.sections.map((sec: any) => ({
          ...sec,
          title: stripSectionColon(sec.title || ""),
          subsections: Array.isArray(sec.subsections)
            ? sec.subsections.map((sub: any) => ({
                ...sub,
                title: stripSectionColon(sub.title || "")
              }))
            : sec.subsections
        }))
      : ch.sections
  }));
}

/**
 * Express response shape for AI endpoints:
 *   - 200: { ...payload, _provider: "openai"|"anthropic"|"xai"|"gemini" }
 *   - 500: { error }
 */
function aiErrorResponse(res: any, error: any) {
  return res.status(500).json({ error: error?.message || "AI request failed" });
}

function aiOptsFromReq(req: any, maxTokens?: number) {
  const body = req?.body || {};
  const disabledProviders: string[] = Array.isArray(body.disabledProviders)
    ? body.disabledProviders.filter((p: any) => typeof p === "string")
    : [];
  const preferredProvider = typeof body.preferredProvider === "string" && body.preferredProvider
    ? body.preferredProvider
    : undefined;
  return {
    lowCredit: body.lowCostMode === true,
    maxTokens: maxTokens ?? TOKEN_LIMITS.default,
    ...(disabledProviders.length ? { disabledProviders } : {}),
    ...(preferredProvider ? { preferredProvider } : {})
  };
}

// Context compression for lesson generation — prevents oversized prompts.
// Only sends fields the model actually needs; drops redundant content.
function compressLessonBody(body: any): any {
  const { subsection, chapterContext, previousConcepts, upcomingTopics, chapterSummaries, ...rest } = body || {};

  const compressedSubsection = subsection ? {
    title:       subsection.title,
    description: String(subsection.description || subsection.objective || "").slice(0, 300),
    keyPoints:   Array.isArray(subsection.keyPoints)   ? subsection.keyPoints.slice(0, 4)   : undefined,
    sections:    Array.isArray(subsection.sections)    ? subsection.sections.slice(0, 3).map((s: any) => s.title) : undefined
  } : subsection;

  const compressedChapter = chapterContext ? {
    title:       chapterContext.title,
    description: String(chapterContext.description || "").slice(0, 200),
    ...(chapterContext.role ? { role: chapterContext.role } : {})
  } : chapterContext;

  const compressedPrev = Array.isArray(previousConcepts)
    ? previousConcepts.slice(-14).map((c: any) =>
        typeof c === "string"
          ? { title: c.slice(0, 100) }
          : {
              title:    String(c.title    || "").slice(0, 100),
              chapter:  String(c.chapter  || "").slice(0, 60),
              section:  String(c.section  || "").slice(0, 60),
              takeaway: String(c.takeaway || "").slice(0, 150),
            }
      )
    : previousConcepts;

  const compressedUpcoming = Array.isArray(upcomingTopics)
    ? upcomingTopics.slice(0, 8).map((t: any) => String(t || "").slice(0, 80)).filter(Boolean)
    : undefined;

  const compressedChSummaries = Array.isArray(chapterSummaries)
    ? chapterSummaries.slice(0, 6).map((s: any) => ({
        chapter:  String(s.chapter || "").slice(0, 80),
        keyIdeas: Array.isArray(s.keyIdeas)
          ? s.keyIdeas.slice(0, 4).map((k: any) => String(k || "").slice(0, 140))
          : []
      })).filter((s: any) => s.keyIdeas.length)
    : undefined;

  return {
    ...rest,
    subsection:       compressedSubsection,
    chapterContext:   compressedChapter,
    previousConcepts: compressedPrev,
    ...(compressedUpcoming?.length    ? { upcomingTopics:   compressedUpcoming    } : {}),
    ...(compressedChSummaries?.length ? { chapterSummaries: compressedChSummaries } : {}),
  };
}

function setProviderHeader(res: any, provider: string, exhausted: string[] = []) {
  res.setHeader("X-AI-Provider", provider);
  if (exhausted.length) res.setHeader("X-Exhausted-Providers", exhausted.join(","));
}

// ─── Content-type → task-phase routing ────────────────────────────────────────
// Each content type maps to one of the 6 task phases in aiRouter.ts.
// runLong / runShort use this to select the right specialist model chain.
const CONTENT_TYPE_TO_TASK: Record<string, TaskType> = {
  title:               "idea",
  subtitle:            "idea",
  regenTitle:          "idea",
  description:         "metadata",
  cover:               "metadata",
  conceptGen:          "metadata",
  details:             "metadata",
  fieldSuggestion:     "metadata",
  outline:             "outline",
  structure:           "outline",
  sectionGen:          "outline",
  subsectionGen:       "outline",
  chapterStrategy:     "outline",
  sectionBrief:        "write",
  lesson:              "write",
  bookSection:         "write",
  authorPersona:       "write",
  strategicPlan:       "research",
  competitiveIntel:    "research",
  analysis:            "research",
  architecturePreview: "research",
  improve:             "edit",
  default:             "write",
};

// Long-form — uses free chain when client sets lowCostMode=true
async function runLong(prompt: string, system: string, req: any, res: any, contentType = "default") {
  const maxTokens = TOKEN_LIMITS[contentType] ?? TOKEN_LIMITS.default;
  const taskType  = CONTENT_TYPE_TO_TASK[contentType];
  const opts      = { ...aiOptsFromReq(req, maxTokens), ...(taskType ? { taskType } : {}) };
  const { text, usedProvider, exhaustedProviders } = await generateContent(prompt, system, opts);
  setProviderHeader(res, usedProvider, exhaustedProviders);
  return { text, usedProvider };
}

// Long-form + JSON parse with one automatic retry if the AI response fails to parse
// or doesn't pass `isValid`. Guards against occasional truncated/malformed JSON output.
async function runLongJSON(
  prompt: string,
  system: string,
  req: any,
  res: any,
  contentType: string,
  isValid: (data: any) => boolean,
  label: string
): Promise<{ data: any; usedProvider: string }> {
  const first = await runLong(prompt, system, req, res, contentType);
  let data: any = null;
  try { data = extractJSON(first.text); } catch (e: any) {
    console.log(`[${label}] JSON parse failed on attempt 1:`, e?.message?.slice(0, 120));
  }

  if (!data || !isValid(data)) {
    console.log(`[${label}] Invalid/unparseable on attempt 1 — retrying`);
    try {
      const retry = await runLong(prompt, system, req, res, contentType);
      const retryData = extractJSON(retry.text);
      if (isValid(retryData)) return { data: retryData, usedProvider: retry.usedProvider };
    } catch (e: any) {
      console.log(`[${label}] Retry failed:`, e?.message?.slice(0, 120));
    }
  }

  if (!data || !isValid(data)) {
    throw new Error(`AI returned unparseable data for ${label}. Please try again.`);
  }
  return { data, usedProvider: first.usedProvider };
}

// Short-form
async function runShort(prompt: string, system: string, req: any, res: any, contentType = "default") {
  const maxTokens = TOKEN_LIMITS[contentType] ?? TOKEN_LIMITS.default;
  const taskType  = CONTENT_TYPE_TO_TASK[contentType];
  const opts      = { ...aiOptsFromReq(req, maxTokens), ...(taskType ? { taskType } : {}) };
  const { text, usedProvider, exhaustedProviders } = await generateContentFast(prompt, system, opts);
  setProviderHeader(res, usedProvider, exhaustedProviders);
  return { text, usedProvider };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/** GET /api/ai/model-status — real-time provider health for the client status badge. */
router.get("/model-status", (_req, res) => {
  try {
    const providers = getModelStatus();
    res.json({ providers, timestamp: Date.now() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to get model status" });
  }
});

/** POST /api/ai/reset-providers — clears all server-side provider disable state. */
router.post("/reset-providers", (_req, res) => {
  try {
    resetProviders();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to reset providers" });
  }
});

router.post("/suggest-subtitles", async (req, res) => {
  try {
    const { title, niche, subNiche, deepNiche } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: "title is required" });

    const subtitlePrompt = kdpSuggestPrompt({
      action:    "suggest_subtitles",
      mainNiche: niche     || "",
      subNiche:  subNiche  || "",
      deepNiche: deepNiche || "",
      title:     title.trim(),
    });

    function parseSubtitles(raw: string): Array<{ subtitle: string; angle: string }> {
      try {
        const parsed = extractJSON(raw);
        if (!Array.isArray(parsed?.subtitles)) return [];
        return parsed.subtitles
          .filter((s: any) => typeof s?.subtitle === "string" && s.subtitle.trim().length >= 10)
          .map((s: any) => ({ subtitle: s.subtitle.trim(), angle: s.angle || "" }));
      } catch {
        return [];
      }
    }

    // ── Attempt 1 ────────────────────────────────────────────────────────
    const first = await runShort(subtitlePrompt, systemPrompt(), req, res, "subtitle");
    let subtitles = parseSubtitles(first.text);

    // ── Retry once if empty or insufficient ──────────────────────────────
    if (!subtitles.length) {
      console.log("[suggest-subtitles] No subtitles on attempt 1 — retrying");
      try {
        const retry = await runShort(subtitlePrompt, systemPrompt(), req, res, "subtitle");
        const retrySubtitles = parseSubtitles(retry.text);
        if (retrySubtitles.length) subtitles = retrySubtitles;
      } catch (retryErr: any) {
        console.log("[suggest-subtitles] Retry failed:", retryErr?.message?.slice(0, 80));
      }
    }

    if (!subtitles.length) {
      return res.status(500).json({ error: "No subtitles returned. Try again." });
    }
    res.json({ subtitles, _provider: first.usedProvider });
  } catch (e: any) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

router.post("/suggest-topic", async (req, res) => {
  try {
    const { title, subtitle, niche, subNiche, deepNiche } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: "title is required" });
    const { text, usedProvider } = await runShort(
      kdpSuggestPrompt({
        action:    "suggest_topics",
        mainNiche: niche     || "",
        subNiche:  subNiche  || "",
        deepNiche: deepNiche || "",
        title:     title.trim(),
        subtitle:  subtitle  || "",
      }),
      systemPrompt(),
      req, res, "title"
    );
    let topics: Array<{ topic: string; style: string }> = [];
    try {
      const parsed = extractJSON(text);
      topics = Array.isArray(parsed?.topics)
        ? parsed.topics
            .filter((t: any) => typeof t?.topic === "string" && t.topic.trim())
            .map((t: any) => ({ topic: t.topic.trim(), style: t.style || "" }))
        : [];
    } catch { /* leave topics empty */ }
    if (!topics.length) return res.status(500).json({ error: "No topics returned. Try again." });
    res.json({ topics, usedProvider });
  } catch (e: any) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

router.post("/titles", async (req, res) => {
  try {
    const { idea, niche, subNiche } = req.body || {};
    const ctx: TitleContext = { idea: idea?.trim(), niche: niche?.trim(), subNiche: subNiche?.trim() };
    const prompt = titlesPrompt(idea || "");
    const providerModel = PROVIDERS.find((p) => Boolean(p.apiKey()))?.model ?? "unknown";

    // ── Attempt 1 ─────────────────────────────────────────────────────────
    const first = await runShort(prompt, systemPrompt(), req, res, "title");
    let pipeline = runTitlePipeline(first.text, ctx);

    logTitlePipeline({
      endpoint:         "titles",
      provider:         first.usedProvider,
      model:            providerModel,
      rawResponse:      first.text,
      parsedResponse:   null,
      normalizedTitles: pipeline.titles,
      validationResult: { valid: pipeline.valid, errors: pipeline.validationErrors },
      repaired:         pipeline.repaired,
      parseWarning:     pipeline.parseWarning,
      attempt:          1
    });

    // ── Retry once if invalid ──────────────────────────────────────────────
    if (!pipeline.valid) {
      console.log("[titles] Validation failed — retrying once with same model");
      try {
        const retry = await runShort(prompt, systemPrompt(), req, res, "title");
        const retryPipeline = runTitlePipeline(retry.text, ctx);

        logTitlePipeline({
          endpoint:         "titles",
          provider:         retry.usedProvider,
          model:            providerModel,
          rawResponse:      retry.text,
          parsedResponse:   null,
          normalizedTitles: retryPipeline.titles,
          validationResult: { valid: retryPipeline.valid, errors: retryPipeline.validationErrors },
          repaired:         retryPipeline.repaired,
          parseWarning:     retryPipeline.parseWarning,
          attempt:          2
        });

        // Use retry result if better (fewer errors / repaired fewer items)
        if (retryPipeline.valid || retryPipeline.titles.filter((t) => !t.title).length < pipeline.titles.filter((t) => !t.title).length) {
          pipeline = retryPipeline;
        }
      } catch (retryErr: any) {
        console.log("[titles] Retry failed:", retryErr?.message?.slice(0, 100));
        // Keep the first attempt's (repaired) result — never error out to user
      }
    }

    return res.json({ titles: pipeline.titles, _provider: first.usedProvider });
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
    if (!data || typeof data.description !== "string" || !data.description.trim()) {
      console.error("[description] AI returned no parseable description. Raw:", text.slice(0, 300));
      return res.status(500).json({ error: "AI returned an empty or unparseable description. Please try again." });
    }
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

router.post("/cover-concepts", async (req, res) => {
  try {
    const { text, usedProvider } = await runLong(coverConceptsPrompt(req.body), systemPrompt(), req, res, "conceptGen");
    const data = extractJSON(text);
    return res.json({ concepts: Array.isArray(data.concepts) ? data.concepts : [], _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/outline", async (req, res) => {
  try {
    const { text, usedProvider } = await runShort(outlinePrompt(req.body), systemPrompt(), req, res, "outline");
    const data = extractJSON(text);
    return res.json({ chapters: sanitizeOutlineSections(data.chapters || []), _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/niche-outline", async (req, res) => {
  try {
    const {
      research, architecture, title, description, resources,
      bookContext, chapterCount: reqChapterCount, proposedBook
    } = req.body || {};

    if (!architecture?.subNicheLabel)
      return res.status(400).json({ error: "Missing niche architecture" });

    const expectedCount = Math.max(5, Math.min(15, Number(reqChapterCount) || architecture?.recommendedChapters?.default || 10));

    // ── Phase 1: Transformation Engine ────────────────────────────────────
    // Build an internal transformation plan when the user has completed
    // the Proposed Book step (Book Flow Preview exists with ≥2 parts).
    // This plan becomes the canonical blueprint for chapter generation.
    let transformationPlan: any = null;
    const bookFlowParts = proposedBook?.content?.bookFlowPreview?.parts;

    if (Array.isArray(bookFlowParts) && bookFlowParts.length >= 2) {
      try {
        const planResult = await runShort(
          transformationPlanPrompt({
            parts: bookFlowParts,
            title, description, research, architecture, bookContext,
            chapterCount: expectedCount
          }),
          nicheSystemPrompt(architecture),
          req, res, "transformationPlan"
        );
        const planData = extractJSON(planResult.text);
        if (Array.isArray(planData?.parts) && planData.parts.length > 0) {
          // Force plan chapter counts to sum exactly to expectedCount.
          // The AI often drifts (returns 8 when asked for 10, etc.).
          const normalizedParts = normalizePlanCounts(planData.parts, expectedCount);
          const planTotal = normalizedParts.reduce((s: number, p: any) => s + p.chapterCount, 0);
          transformationPlan = { ...planData, parts: normalizedParts };
          console.log(
            `[niche-outline] Transformation plan: ${normalizedParts.map((p: any) =>
              `${p.partSubtitle || p.partTitle}(${p.chapterCount})`
            ).join(" → ")} = ${planTotal} chapters`
          );
        }
      } catch (planErr: any) {
        console.warn(`[niche-outline] Transformation plan failed: ${String(planErr?.message).slice(0, 120)} — continuing without plan`);
      }
    }

    // ── Phase 2: Chapter Generation ────────────────────────────────────────
    // The transformation plan (when available) is woven into the prompt as
    // the PRIMARY blueprint — driving Part-anchored, sequential generation.
    const { text, usedProvider } = await runLong(
      nicheOutlinePrompt({ research, architecture, title, description, resources, bookContext, chapterCount: expectedCount, transformationPlan }),
      nicheSystemPrompt(architecture),
      req, res, "outline"
    );

    // ── Primary parse ──────────────────────────────────────────────────────
    let primaryChapters: any[] = [];
    try {
      const data = extractJSON(text);
      primaryChapters = sanitizeOutlineSections(data.chapters || []);
      if (primaryChapters.length >= Math.ceil(expectedCount / 2)) {
        return res.json({ ...data, chapters: primaryChapters, _provider: usedProvider, _hasTransformationPlan: !!transformationPlan });
      }
      console.warn(`[niche-outline] Primary returned ${primaryChapters.length}/${expectedCount} chapters — truncated, trying rescue`);
    } catch (parseErr: any) {
      console.warn(`[niche-outline] Primary parse failed (${usedProvider}): ${String(parseErr?.message).slice(0, 200)}`);
      console.warn(`[niche-outline] Raw snippet: ${String(text).slice(0, 500)}`);
    }

    // ── Rescue: compact focused prompt, harder to truncate ────────────────
    const rescuePrompt = `Generate exactly ${expectedCount} chapters for this nonfiction book.

TITLE: "${title || "Untitled"}"
TOPIC: ${research?.bookTopic || description || ""}
NICHE: ${architecture?.mainNicheLabel || ""} › ${architecture?.subNicheLabel || ""}
AUDIENCE: ${research?.targetAudience || ""}
${transformationPlan ? `
BOOK FLOW PARTS:
${(transformationPlan.parts || []).map((p: any, i: number) => `Part ${i + 1} "${p.partSubtitle || ""}" → ${p.chapterCount} chapters`).join("\n")}
` : ""}
Scores are integers 1–100. Use the full range — do NOT cluster at the same value.
importanceScore = how critical this chapter is to the book's core promise
complexityScore = how dense/demanding the content is
expansionScore = how much depth, examples, and elaboration it needs

Return ONLY valid JSON, no markdown, no preamble:
{"chapters":[{"title":"Chapter title","chapterObjective":"One sentence.","arcRole":"Part N — Subtitle","importanceScore":80,"complexityScore":65,"expansionScore":75,"sections":[]}]}

All ${expectedCount} chapters:`;

    try {
      const rescue = await runShort(rescuePrompt, nicheSystemPrompt(architecture), req, res, "outline");
      const rescueData = extractJSON(rescue.text);
      const rescueChapters = sanitizeOutlineSections(rescueData.chapters || []);
      if (rescueChapters.length >= Math.ceil(expectedCount / 2)) {
        console.log(`[niche-outline] Rescue: ${rescueChapters.length} chapters via ${rescue.usedProvider}`);
        return res.json({ chapters: rescueChapters, _provider: rescue.usedProvider, _rescued: true });
      }
      console.warn(`[niche-outline] Rescue returned only ${rescueChapters.length} chapters`);
    } catch (rescueErr: any) {
      console.warn(`[niche-outline] Rescue failed: ${String(rescueErr?.message).slice(0, 200)}`);
    }

    return res.status(500).json({ error: "Could not generate a complete chapter outline — please try again." });
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

router.post("/chapter-strategy", async (req, res) => {
  try {
    const {
      chapterTitle, chapterNumber, chapterPurpose,
      sectionTitles, bookContext, bookStructure, bookTone
    } = req.body || {};
    if (!chapterTitle) return res.status(400).json({ error: "chapterTitle is required." });
    const prompt = chapterWritingStrategyPrompt({
      chapterTitle, chapterNumber, chapterPurpose,
      sectionTitles, bookContext, bookStructure, bookTone
    });
    const { text, usedProvider } = await runLong(prompt, systemPrompt(), req, res, "chapterStrategy");
    const data = extractJSON(text);
    if (!data || typeof data !== "object") {
      return res.status(500).json({ error: "AI returned unparseable chapter strategy." });
    }
    return res.json({ strategy: data, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

const SECTION_BRIEF_MIN_WORDS = 130;
const SECTION_BRIEF_MAX_WORDS = 180;

function countWords(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Reasoning models (e.g. Nemotron via OpenRouter) sometimes leak their visible
 * chain-of-thought into the response instead of just the final answer, often
 * ending in a "Draft:" / "Final:" marker followed by the actual text. Strip
 * that preamble when detected so downstream word-count checks operate on the
 * real answer, not the model's internal monologue.
 */
function stripReasoningLeak(text: string): string {
  const t = String(text || "").trim();
  const quoted = t.match(/(?:draft|final(?:\s*(?:answer|brief|version))?)\s*:\s*"([\s\S]+)"\s*$/i);
  if (quoted) return quoted[1].trim();
  const unquoted = t.match(/(?:draft|final(?:\s*(?:answer|brief|version))?)\s*:\s*([\s\S]+)$/i);
  if (unquoted && unquoted[1].trim().length > 40) {
    return unquoted[1].trim().replace(/^["']|["']$/g, "");
  }
  return t;
}

/** Truncate text to at most `maxWords` words, ending on a sentence boundary when possible. */
function truncateToWordRange(text: string, maxWords: number): string {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  const truncated = words.slice(0, maxWords).join(" ");
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf(". "), truncated.lastIndexOf("! "), truncated.lastIndexOf("? ")
  );
  // Only snap to a sentence boundary if we don't lose too much length doing so.
  if (lastSentenceEnd > truncated.length * 0.6) {
    return truncated.slice(0, lastSentenceEnd + 1).trim();
  }
  return truncated.trim() + ".";
}

router.post("/section-brief", async (req, res) => {
  try {
    const {
      bookTitle, bookSubtitle, niche, audience, tone, objectives,
      chapterTitle, chapterDesc, sectionTitle, sectionDesc, subsections
    } = req.body || {};
    if (!sectionTitle?.trim()) return res.status(400).json({ error: "sectionTitle is required." });
    const basePrompt = sectionBriefPrompt({
      bookTitle:    bookTitle    || "",
      bookSubtitle: bookSubtitle || "",
      niche:        niche        || "",
      audience:     audience     || "",
      tone:         tone         || "",
      objectives:   objectives   || "",
      chapterTitle: chapterTitle || "",
      chapterDesc:  chapterDesc  || "",
      sectionTitle: sectionTitle || "",
      sectionDesc:  sectionDesc  || "",
      subsections:  Array.isArray(subsections) ? subsections : []
    });

    let brief = "";
    let usedProvider: string | undefined;
    const MAX_LENGTH_ATTEMPTS = 2;

    for (let attempt = 0; attempt <= MAX_LENGTH_ATTEMPTS; attempt++) {
      const prompt = attempt === 0
        ? basePrompt
        : `${basePrompt}\n\n━━━ LENGTH CORRECTION ━━━\nYour previous attempt was ${countWords(brief)} words, which is outside the required ${SECTION_BRIEF_MIN_WORDS}–${SECTION_BRIEF_MAX_WORDS} word range. Rewrite the brief so its total length falls strictly between ${SECTION_BRIEF_MIN_WORDS} and ${SECTION_BRIEF_MAX_WORDS} words.`;
      const result = await runLong(prompt, systemPrompt(), req, res, "sectionBrief");
      brief = stripReasoningLeak(result.text.trim());
      usedProvider = result.usedProvider;
      const wc = countWords(brief);
      if (wc >= SECTION_BRIEF_MIN_WORDS && wc <= SECTION_BRIEF_MAX_WORDS) break;
    }

    // Guarantee the hard cap even if the model still overshoots after retries.
    if (countWords(brief) > SECTION_BRIEF_MAX_WORDS) {
      brief = truncateToWordRange(brief, SECTION_BRIEF_MAX_WORDS);
    }

    return res.json({ brief, wordCount: countWords(brief), _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/lesson", async (req, res) => {
  try {
    const compressed = compressLessonBody(req.body);
    const { chapterStrategy, bookStructure, sectionTitle, subsectionPurpose, blueprintComponents, upcomingTopics, chapterSummaries } = req.body || {};
    const { text, usedProvider } = await runLong(
      lessonPrompt({
        ...compressed,
        resources: req.body?.resources,
        bookContext: req.body?.bookContext,
        chapterStrategy,
        bookStructure,
        sectionTitle,
        subsectionPurpose,
        blueprintComponents,
        upcomingTopics,
        chapterSummaries
      }),
      systemPrompt(),
      req,
      res,
      "lesson"
    );
    let data: any;
    try {
      data = extractJSON(text);
    } catch {
      // AI returned plain prose instead of JSON — wrap it so lessonToProse can use it
      console.warn("[lesson] extractJSON failed — using raw text as content fallback");
      data = { content: text.trim() };
    }
    return res.json({ lesson: data, _provider: usedProvider });
  } catch (error: any) {
    console.error("[lesson] route error:", (error as any)?.message);
    return aiErrorResponse(res, error);
  }
});

router.post("/extract-resource", async (req, res) => {
  try {
    const { text, title, category } = req.body || {};
    if (!text || typeof text !== "string" || text.trim().length < 20)
      return res.status(400).json({ error: "text is required (min 20 chars)." });
    const { text: rawText, usedProvider } = await generateContentFast(
      extractResourcePrompt({ text, title, category }),
      systemPrompt(),
      { ...aiOptsFromReq(req, TOKEN_LIMITS.default), taskType: "metadata" as const }
    );
    setProviderHeader(res, usedProvider);
    return res.json({ summary: rawText.trim(), _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/improve", async (req, res) => {
  try {
    const { action, currentText, tone, audience, bookStructure, subsectionTitle, bookContext, blueprintComponents } = req.body || {};
    const { text, usedProvider } = await runLong(
      improvementPrompt({ action, currentText, tone, audience, bookStructure, subsectionTitle, bookContext, blueprintComponents }),
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
      res,
      "analysis"
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
      res,
      "architecturePreview"
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
      res,
      "regenTitle"
    );
    const data = extractJSON(text);
    const rawTitle = data.title || currentTitle;
    const title = (level === "section" || level === "subsection")
      ? stripSectionColon(rawTitle)
      : rawTitle;
    return res.json({ title, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/generate-finding", async (req, res) => {
  try {
    const { bookContext, category, priority, useFor, existingFindings, competitorBooks } = req.body || {};
    const prompt = generateFindingPrompt({ bookContext, category, priority, useFor, existingFindings, competitorBooks });
    const { text, usedProvider } = await runLong(prompt, systemPrompt(), req, res, "lesson");

    // Parse delimiter format: "TITLE: ...\nCONTENT:\n..."
    const titleMatch   = text.match(/TITLE:\s*(.+?)(?:\r?\n|$)/i);
    const contentMatch = text.match(/CONTENT:\s*\r?\n([\s\S]+)/i);

    const title   = titleMatch?.[1]?.trim()   || "";
    const content = contentMatch?.[1]?.trim() || "";

    if (!title && !content) {
      console.error("[generate-finding] Could not parse delimiter output. Raw:", text.slice(0, 400));
      return res.status(500).json({ error: "AI returned unparseable finding data." });
    }

    return res.json({ title, content, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/generate-resource", async (req, res) => {
  try {
    const { bookContext, category, priority, useFor, existingResources, competitorBooks } = req.body || {};
    const prompt = generateResourcePrompt({ bookContext, category, priority, useFor, existingResources, competitorBooks });
    const { text, usedProvider } = await runShort(prompt, systemPrompt(), req, res, "default");
    const data = extractJSON(text);
    if (!data || typeof data !== "object") {
      return res.status(500).json({ error: "AI returned unparseable resource data." });
    }
    return res.json({
      url:   typeof data.url   === "string" ? data.url.trim()   : "",
      label: typeof data.label === "string" ? data.label.trim() : "",
      note:  typeof data.note  === "string" ? data.note.trim()  : "",
      _provider: usedProvider
    });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/generate-author-persona", async (req, res) => {
  try {
    const { project } = req.body || {};
    if (!project || typeof project !== "object") {
      return res.status(400).json({ error: "project object is required" });
    }
    const prompt = generateAuthorPersonaPrompt(project);
    const { text, usedProvider } = await runLong(prompt, systemPrompt(), req, res, "authorPersona");
    const data = extractJSON(text);
    if (!data || typeof data !== "object") {
      return res.status(500).json({ error: "AI returned unparseable persona data." });
    }
    const clamp = (v: any, def: number) =>
      typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : def;
    const strArr = (v: any) => Array.isArray(v) ? v.filter((x: any) => typeof x === "string" && x.trim()) : [];

    const controls = data.writingStyleControls || {};
    const strength = data.personaStrength      || {};

    return res.json({
      authorArchetype:        typeof data.authorArchetype    === "string" ? data.authorArchetype.trim()    : "",
      authorName:             typeof data.authorName         === "string" ? data.authorName.trim()         : "",
      inspiredBy:             typeof data.inspiredBy         === "string" ? data.inspiredBy.trim()         : "",
      authorDescription:      typeof data.authorDescription  === "string" ? data.authorDescription.trim()  : "",
      coreAuthorPromise:      typeof data.coreAuthorPromise  === "string" ? data.coreAuthorPromise.trim()  : "",
      readerRelationship:     typeof data.readerRelationship === "string" ? data.readerRelationship.trim() : "",
      signatureTeachingStyle: strArr(data.signatureTeachingStyle),
      signatureElements:      strArr(data.signatureElements),
      signatureFramework:     typeof data.signatureFramework === "string" ? data.signatureFramework.trim() : "",
      voiceSummary:           typeof data.voiceSummary       === "string" ? data.voiceSummary.trim()       : "",
      writingStyleControls: {
        tone:         clamp(controls.tone,         30),
        inspiration:  clamp(controls.inspiration,  50),
        authority:    clamp(controls.authority,     70),
        storytelling: clamp(controls.storytelling,  40),
        complexity:   clamp(controls.complexity,    30)
      },
      personaStrength: {
        score:       clamp(strength.score, 0),
        strengths:   strArr(strength.strengths),
        suggestions: strArr(strength.suggestions)
      },
      dos:               strArr(data.dos),
      donts:             strArr(data.donts),
      contentGuidelines: strArr(data.contentGuidelines),
      writingSample: typeof data.writingSample === "string" ? data.writingSample.trim() : "",
      _provider: usedProvider
    });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

const VALID_BOOK_SECTIONS = new Set([
  "recommendedStructure", "structureExplanation", "signatureFramework",
  "chapterComponents", "bookFlowPreview", "competitiveDifferentiation",
  "bookPitch", "bookConceptScore"
]);

function clampScore10(v: any, def = 0): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  return isFinite(n) ? Math.round(Math.min(10, Math.max(0, n)) * 10) / 10 : def;
}

function normalizeStrategicPlan(data: any) {
  const strArr = (v: any) => Array.isArray(v) ? v.filter((x: any) => typeof x === "string" && x.trim()) : [];
  const clamp100 = (v: any) => {
    const n = typeof v === "number" ? Math.round(v) : 0;
    return Math.min(100, Math.max(0, n));
  };

  const rs  = data.recommendedStructure  || {};
  const sf  = data.signatureFramework    || {};
  const cc  = data.chapterComponents     || {};
  const bfp = data.bookFlowPreview       || {};
  const cd  = data.competitiveDifferentiation || {};
  const bcs = data.bookConceptScore      || {};
  const bd  = bcs.breakdown              || {};

  const stages = Array.isArray(sf.stages)
    ? sf.stages.filter((s: any) => typeof s?.stage === "string" && typeof s?.label === "string")
    : [];

  const parts = Array.isArray(bfp.parts)
    ? bfp.parts.filter((p: any) => typeof p?.title === "string" || typeof p?.subtitle === "string")
    : [];

  const ALLOWED_COMPONENTS = new Set([
    "Key Takeaways", "Action Plan", "Checklist", "Exercises",
    "Reflection Questions", "Templates", "Case Studies", "Examples",
    "Research Highlights", "Resources", "Summary"
  ]);

  const recommended = strArr(cc.recommended).filter((x: string) => ALLOWED_COMPONENTS.has(x));

  return {
    recommendedStructure: {
      structureName:   typeof rs.structureName  === "string" ? rs.structureName.trim()  : "",
      structureType:   typeof rs.structureType  === "string" ? rs.structureType.trim()  : "",
      confidenceScore: clampScore10(rs.confidenceScore),
      reasoning:       typeof rs.reasoning      === "string" ? rs.reasoning.trim()      : ""
    },
    structureExplanation: typeof data.structureExplanation === "string" ? data.structureExplanation.trim() : "",
    signatureFramework: {
      name:   typeof sf.name === "string" ? sf.name.trim() : "",
      stages
    },
    chapterComponents: {
      recommended,
      selected: recommended.slice()
    },
    bookFlowPreview: { parts },
    competitiveDifferentiation: {
      points: strArr(cd.points),
      score:  clampScore10(cd.score)
    },
    bookPitch: typeof data.bookPitch === "string" ? data.bookPitch.trim() : "",
    bookConceptScore: {
      overall: clamp100(bcs.overall),
      breakdown: {
        marketDemand:           clampScore10(bd.marketDemand),
        differentiation:        clampScore10(bd.differentiation),
        transformationStrength: clampScore10(bd.transformationStrength),
        readerClarity:          clampScore10(bd.readerClarity),
        commercialPotential:    clampScore10(bd.commercialPotential),
        outlineReadiness:       clampScore10(bd.outlineReadiness)
      },
      strengths:   strArr(bcs.strengths),
      suggestions: strArr(bcs.suggestions)
    }
  };
}

router.post("/generate-strategic-book-plan", async (req, res) => {
  try {
    const { project } = req.body || {};
    if (!project || typeof project !== "object") {
      return res.status(400).json({ error: "project object is required" });
    }
    const prompt = generateStrategicBookPlanPrompt(project);

    // ── Attempt 1 ─────────────────────────────────────────────────────────
    const first = await runLong(prompt, systemPrompt(), req, res, "strategicPlan");
    let raw = extractJSON(first.text);

    // ── Retry once if invalid or empty ────────────────────────────────────
    function planHasContent(r: any): boolean {
      if (!r || typeof r !== "object") return false;
      return !!(r.bookPitch || r.recommendedStructure?.structureName || r.signatureFramework?.name || r.bookConceptScore?.overall);
    }

    if (!planHasContent(raw)) {
      console.log("[generate-strategic-book-plan] Invalid/empty on attempt 1 — retrying");
      try {
        const retry = await runLong(prompt, systemPrompt(), req, res, "strategicPlan");
        const retryRaw = extractJSON(retry.text);
        if (planHasContent(retryRaw)) raw = retryRaw;
      } catch (retryErr: any) {
        console.log("[generate-strategic-book-plan] Retry failed:", retryErr?.message?.slice(0, 80));
      }
    }

    if (!planHasContent(raw)) {
      return res.status(500).json({ error: "AI returned unparseable strategic plan data. Please try again." });
    }

    const plan = normalizeStrategicPlan(raw);
    return res.json({ ...plan, _provider: first.usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/regenerate-book-section", async (req, res) => {
  try {
    const { project, section } = req.body || {};
    if (!project || typeof project !== "object") {
      return res.status(400).json({ error: "project object is required" });
    }
    if (!section || !VALID_BOOK_SECTIONS.has(section)) {
      return res.status(400).json({ error: `Invalid section. Must be one of: ${[...VALID_BOOK_SECTIONS].join(", ")}` });
    }
    const prompt = regenerateBookSectionPrompt(section, project);
    const { text, usedProvider } = await runLong(prompt, systemPrompt(), req, res, "bookSection");
    const raw = extractJSON(text);
    if (!raw || typeof raw !== "object") {
      return res.status(500).json({ error: "AI returned unparseable data for section." });
    }
    const full = normalizeStrategicPlan({ ...{
      recommendedStructure: {}, structureExplanation: "", signatureFramework: {},
      chapterComponents: {}, bookFlowPreview: {}, competitiveDifferentiation: {},
      bookPitch: "", bookConceptScore: {}
    }, ...raw });
    return res.json({ section, data: (full as any)[section], _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/competitive-intelligence", async (req, res) => {
  try {
    const { niche, subNiche, deepNiche, bookTopic, books } = req.body || {};
    const prompt = competitiveIntelligencePrompt({ niche, subNiche, deepNiche, bookTopic, books });
    const { text, usedProvider } = await runLong(prompt, systemPrompt(), req, res, "competitiveIntel");
    const data = extractJSON(text);
    if (!data || typeof data !== "object") {
      return res.status(500).json({ error: "AI returned unparseable intelligence data." });
    }

    const isArr = (v: any) => (Array.isArray(v) ? v : []);
    const isObj = (v: any) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
    const isStr = (v: any) => (typeof v === "string" ? v : "");

    const intelligence = {
      targetAudience:            isObj(data.targetAudience),
      readerPainPoints:          isArr(data.readerPainPoints),
      desiredOutcomes:           isArr(data.desiredOutcomes),
      marketGaps:                isArr(data.marketGaps),
      uniqueSellingPropositions: isArr(data.uniqueSellingPropositions),
      positioningStrategies:     isArr(data.positioningStrategies),
      titleInsights:             isObj(data.titleInsights),
      authorPersonaGuidance:     isObj(data.authorPersonaGuidance),
      outlineGenerationBrief:    isStr(data.outlineGenerationBrief) || isStr(Object.values(isObj(data.outlineGenerationBrief)).join(" ")),
    };

    const REQUIRED = ["targetAudience", "readerPainPoints", "desiredOutcomes", "marketGaps"] as const;
    const missingFields = REQUIRED.filter((k) => {
      const v = (intelligence as any)[k];
      return !v || (Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0);
    });

    return res.json({
      ...intelligence,
      _provider:      usedProvider,
      _partial:       missingFields.length > 0,
      _missingFields: missingFields.length > 0 ? missingFields : undefined,
    });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

/** POST /api/ai/generate-details — auto-fill the Details step from all project data */
router.post("/generate-details", async (req, res) => {
  try {
    const { project } = req.body || {};
    if (!project || typeof project !== "object") {
      return res.status(400).json({ error: "project object is required" });
    }

    const prompt = generateDetailsPrompt(project);
    const { text, usedProvider } = await runLong(prompt, systemPrompt(), req, res, "details");

    const data = extractJSON(text);
    if (!data || typeof data !== "object") {
      console.error("[generate-details] Could not parse JSON. Raw snippet:", text.slice(0, 600));
      return res.status(500).json({ error: "AI returned unparseable details data." });
    }

    const GENRE_OPTIONS     = ["Business","Self-help","Productivity","Personal finance","Entrepreneurship","Leadership","Investing","Marketing","Career development","Philosophy / ideas","Health & wellness","Cookbooks & food writing","Spirituality","Parenting & family","Technology","Memoir / narrative nonfiction","Other"];
    const STRUCTURE_OPTIONS = ["Chronological","Comparative","How-to","List-based","Modular","Problem-solution","Workbook","Question and answer","Thematic","Hybrid / mixed","Other"];
    const TONE_OPTIONS      = ["Conversational","Academic","Neutral","Reflective","Authoritative","Witty","Narrative","Persuasive","Minimalist","Direct & practical"];
    const AUDIENCE_OPTIONS  = ["Adult","Young adult","Child","Teen","Senior"];
    const WC_OPTIONS        = ["10k–15k","15k–20k","20k–25k","25k–30k","30k–35k","35k–40k","40k–50k","50k–70k","70k–90k","90k–120k"];
    const RI_OPTIONS        = ["Light","Moderate","Heavy"];

    function strArr(v: any): string[] {
      return Array.isArray(v) ? v.filter((x: any) => typeof x === "string" && x.trim()) : [];
    }
    function validateList(arr: string[], list: string[]): string[] {
      return strArr(arr).map((val) => {
        const exact = list.find((o) => o.toLowerCase() === val.toLowerCase());
        if (exact) return exact;
        return list.find((o) => o.toLowerCase().includes(val.toLowerCase()) || val.toLowerCase().includes(o.toLowerCase())) || val;
      }).filter(Boolean);
    }

    const genreSuggestions     = validateList(data.genreSuggestions, GENRE_OPTIONS).slice(0, 3);
    const structureSuggestions = validateList(data.structureSuggestions, STRUCTURE_OPTIONS).slice(0, 3);
    const structureReasons     = strArr(data.structureReasons).slice(0, 3);
    const toneSuggestions      = validateList(data.toneSuggestions, TONE_OPTIONS).slice(0, 3);
    const audienceSuggestions  = validateList(data.audienceSuggestions, AUDIENCE_OPTIONS).slice(0, 3);
    const riSuggestions        = validateList(data.researchIntensitySuggestions, RI_OPTIONS).slice(0, 3);

    const rawChapters = parseInt(String(data.chapterCount ?? ""), 10);
    const chapters    = !isNaN(rawChapters) && rawChapters >= 5 && rawChapters <= 15 ? rawChapters : null;
    const wordCount   = WC_OPTIONS.find((o) => o === data.wordCountRange) || WC_OPTIONS.find((o) => String(data.wordCountRange || "").includes(o.split("–")[0])) || "";

    const mechArr = Array.isArray(data.uniqueMechanismSuggestions)
      ? data.uniqueMechanismSuggestions.filter((m: any) => m && typeof m === "object" && m.name).slice(0, 3)
      : [];
    const mechFirst = mechArr[0] ? `${mechArr[0].name}\n\n${mechArr[0].description}` : "";

    return res.json({
      // ── Suggestions arrays (new) ──────────────────────────────────────────
      genreSuggestions,
      structureSuggestions,
      structureReasons,
      toneSuggestions,
      audienceSuggestions,
      researchIntensitySuggestions: riSuggestions,
      positioningStatementSuggestions: strArr(data.positioningStatementSuggestions).slice(0, 3),
      corePromiseSuggestions:          strArr(data.corePromiseSuggestions).slice(0, 3),
      coreThesisSuggestions:           strArr(data.coreThesisSuggestions).slice(0, 3),
      uniqueMechanismSuggestions:      mechArr,
      beforeStateSuggestions:          strArr(data.beforeStateSuggestions).slice(0, 3),
      afterStateSuggestions:           strArr(data.afterStateSuggestions).slice(0, 3),
      desiredEmotionalOutcomeSuggestions: strArr(data.desiredEmotionalOutcomeSuggestions).slice(0, 3),
      uspSuggestions:                  strArr(data.uspSuggestions).slice(0, 3),
      focusTopicsList:                 strArr(data.focusTopics),
      readerObjectionsSuggestions:     strArr(data.readerObjectionsSuggestions).slice(0, 3),
      readerPainPointsSuggestions:     strArr(data.readerPainPointsSuggestions).slice(0, 3),
      subtitleSuggestions:             typeof data.subtitle === "string" && data.subtitle.trim()
                                         ? [data.subtitle.trim()] : [],

      // ── Recommendation card data (click-to-apply, not auto-fill) ──────────
      chapterCount:       chapters,
      chapterCountReason: typeof data.chapterCountReason === "string" ? data.chapterCountReason : "",
      wordCountRange:     wordCount,
      wordCountReason:    typeof data.wordCountReason === "string" ? data.wordCountReason : "",

      _provider: usedProvider
    });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

/** POST /api/ai/generate-sections — generate all section titles for a chapter at once */
router.post("/generate-sections", async (req, res) => {
  try {
    const { bookTitle, chapterTitle, sectionCount, research, corePromise, coreThesis, chapterPurpose, chapterNumber, totalChapters } = req.body || {};
    if (!chapterTitle) {
      return res.status(400).json({ error: "chapterTitle is required" });
    }
    const count = Math.min(15, Math.max(1, Number(sectionCount) || 3));

    function parseSections(text: string): Array<{ title: string; objective: string; blueprintComponents: string[]; expansionScore: number }> {
      let raw: any;
      try { raw = extractJSON(text); } catch { return []; }
      if (!raw) return [];
      if (!Array.isArray(raw) && Array.isArray(raw.sections)) {
        return raw.sections
          .filter((s: any) => s && typeof s.sectionTitle === "string" && s.sectionTitle.trim())
          .map((s: any) => ({
            title:               stripSectionColon(String(s.sectionTitle).trim()),
            objective:           typeof s.sectionObjective === "string" ? s.sectionObjective.trim() : "",
            blueprintComponents: Array.isArray(s.blueprintComponents)
              ? s.blueprintComponents.filter((c: any) => typeof c === "string" && VALID_BLUEPRINT_COMPONENTS.has(c))
              : [],
            expansionScore:      Number.isFinite(Number(s.expansionScore)) ? Number(s.expansionScore) : 50
          }));
      }
      if (Array.isArray(raw)) {
        return raw
          .filter((t: any) => typeof t === "string" && t.trim())
          .map((t: any) => ({ title: stripSectionColon(String(t).trim()), objective: "", blueprintComponents: [], expansionScore: 50 }));
      }
      return [];
    }

    // Deterministically assigns subsection counts from AI-scored importance/expansion-need:
    // the top 2 highest-scoring sections get 3 subsections, every other section gets 4.
    // This is computed in code (not trusted to the model) so the split is always exact.
    function assignSubsectionCounts<T extends { expansionScore: number }>(items: T[]): Array<T & { suggestedSubsectionCount: number }> {
      if (items.length <= 1) {
        return items.map((item) => ({ ...item, suggestedSubsectionCount: 4 }));
      }
      const topCount = Math.min(2, items.length);
      const ranked = [...items]
        .map((item, index) => ({ index, score: item.expansionScore }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topCount)
        .map((r) => r.index);
      const topIndices = new Set(ranked);
      return items.map((item, index) => ({
        ...item,
        suggestedSubsectionCount: topIndices.has(index) ? 3 : 4
      }));
    }

    const MAX_ATTEMPTS = 3;
    let sections: Array<{ title: string; objective: string; expansionScore: number }> = [];
    let usedProvider = "";
    let lastError = "";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Attempt 1 uses the full, richly-guided prompt. If that fails to parse
      // (weaker/smaller fallback models can choke on its length), later
      // attempts switch to a much shorter prompt that's easier to follow.
      const prompt = attempt === 1
        ? sectionGenerationPrompt(
            String(bookTitle || ""),
            String(chapterTitle),
            count,
            research,
            corePromise    ? String(corePromise)    : undefined,
            coreThesis     ? String(coreThesis)     : undefined,
            chapterPurpose ? String(chapterPurpose) : undefined,
            chapterNumber  ? Number(chapterNumber)  : undefined,
            totalChapters  ? Number(totalChapters)  : undefined
          )
        : sectionGenerationFallbackPrompt(
            String(bookTitle || ""),
            String(chapterTitle),
            count,
            chapterPurpose ? String(chapterPurpose) : undefined
          );
      const result = await runShort(prompt, systemPrompt(), req, res, "sectionGen");
      usedProvider = result.usedProvider;
      const parsed = parseSections(result.text);

      if (parsed.length === count) {
        sections = parsed;
        break;
      }

      lastError = `attempt ${attempt}: got ${parsed.length} sections, need ${count}`;
      console.warn(`[generate-sections] ${lastError} — retrying`);

      // On last attempt, accept if we got something (frontend will slice to exact count)
      if (attempt === MAX_ATTEMPTS && parsed.length > 0) {
        sections = parsed;
      }
    }

    if (sections.length === 0) {
      console.error("[generate-sections] All attempts failed. Last error:", lastError);
      return res.status(500).json({ error: "AI returned unparseable section data." });
    }

    const sectionsWithSubCounts = assignSubsectionCounts(sections);
    const titles = sectionsWithSubCounts.map((s) => s.title);
    return res.json({ sections: sectionsWithSubCounts, titles, _provider: usedProvider, _requestedCount: count });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

/** POST /api/ai/generate-subsections — generate all subsection titles for a section at once */
router.post("/generate-subsections", async (req, res) => {
  try {
    const {
      chapterTitle, sectionTitle, subsectionCount, research,
      sectionObjective, chapterPurpose, corePromise, coreThesis,
      chapterNumber, totalChapters,
    } = req.body || {};
    if (!chapterTitle || !sectionTitle) {
      return res.status(400).json({ error: "chapterTitle and sectionTitle are required" });
    }
    const count = Math.min(15, Math.max(1, Number(subsectionCount) || 3));

    function parseSubsections(text: string): Array<{ title: string; purpose: string; blueprintComponents: string[] }> {
      let raw: any;
      try { raw = extractJSON(text); } catch { return []; }
      if (!raw) return [];
      if (!Array.isArray(raw) && Array.isArray(raw.subsections)) {
        // New format: { subsections: [{ subsectionTitle, subsectionPurpose, blueprintComponents }] }
        return raw.subsections
          .filter((s: any) => s && typeof s.subsectionTitle === "string" && s.subsectionTitle.trim())
          .map((s: any) => ({
            title:   stripSectionColon(String(s.subsectionTitle).trim()),
            purpose: typeof s.subsectionPurpose === "string" ? s.subsectionPurpose.trim() : "",
            blueprintComponents: Array.isArray(s.blueprintComponents)
              ? s.blueprintComponents.filter((c: any) => typeof c === "string" && VALID_BLUEPRINT_COMPONENTS.has(c)).slice(0, 4)
              : []
          }));
      }
      if (Array.isArray(raw)) {
        // Legacy format: string array
        return raw
          .filter((t: any) => typeof t === "string" && t.trim())
          .map((t: any) => ({ title: stripSectionColon(String(t).trim()), purpose: "", blueprintComponents: [] }));
      }
      return [];
    }

    const MAX_ATTEMPTS = 3;
    let subsections: Array<{ title: string; purpose: string; blueprintComponents: string[] }> = [];
    let usedProvider = "";
    let lastError = "";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const prompt = subsectionGenerationPrompt(
        String(chapterTitle),
        String(sectionTitle),
        count,
        research,
        sectionObjective   ? String(sectionObjective)   : undefined,
        chapterPurpose     ? String(chapterPurpose)     : undefined,
        corePromise        ? String(corePromise)        : undefined,
        coreThesis         ? String(coreThesis)         : undefined,
        chapterNumber      ? Number(chapterNumber)      : undefined,
        totalChapters      ? Number(totalChapters)      : undefined
      );
      const result = await runShort(prompt, systemPrompt(), req, res, "subsectionGen");
      usedProvider = result.usedProvider;
      const parsed = parseSubsections(result.text);

      if (parsed.length === count) {
        subsections = parsed;
        break;
      }

      lastError = `attempt ${attempt}: got ${parsed.length} subsections, need ${count}`;
      console.warn(`[generate-subsections] ${lastError} — retrying`);

      // On last attempt, accept whatever we got — it will be hard-enforced to the exact count below.
      if (attempt === MAX_ATTEMPTS && parsed.length > 0) {
        subsections = parsed;
      }
    }

    if (subsections.length === 0) {
      console.error("[generate-subsections] All attempts failed. Last error:", lastError);
      return res.status(500).json({ error: "AI returned unparseable subsection data." });
    }

    // Hard-enforce the exact requested count — this count was already computed
    // upstream (generate-sections) from importance/expansion scoring and must
    // never silently drift regardless of what the model returns.
    if (subsections.length > count) {
      subsections = subsections.slice(0, count);
    } else if (subsections.length < count) {
      while (subsections.length < count) {
        subsections.push({ title: "New subsection", purpose: "", blueprintComponents: [] });
      }
    }

    const titles = subsections.map((s) => s.title);
    return res.json({ subsections, titles, _provider: usedProvider, _requestedCount: count });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

/** POST /api/ai/generate-field-suggestion — generate suggestions for a single Details field */
router.post("/generate-field-suggestion", async (req, res) => {
  try {
    const { project, fieldName } = req.body || {};
    if (!project || typeof project !== "object") {
      return res.status(400).json({ error: "project object is required" });
    }
    const VALID_FIELDS = [
      "positioningStatement","corePromise","coreThesis","uniqueMechanism",
      "readerTransformation","readerObjections","desiredEmotionalOutcome"
    ];
    if (!fieldName || !VALID_FIELDS.includes(String(fieldName))) {
      return res.status(400).json({ error: `fieldName must be one of: ${VALID_FIELDS.join(", ")}` });
    }

    const prompt = generateFieldSuggestionPrompt(String(fieldName), project);
    const { text, usedProvider } = await runShort(prompt, systemPrompt(), req, res, "fieldSuggestion");

    const data = extractJSON(text);
    if (!data || typeof data !== "object") {
      console.error("[generate-field-suggestion] Could not parse JSON:", text.slice(0, 400));
      return res.status(500).json({ error: "AI returned unparseable suggestion data." });
    }

    function strArr(v: any): string[] {
      return Array.isArray(v) ? v.filter((x: any) => typeof x === "string" && x.trim()) : [];
    }

    const response: Record<string, any> = { _provider: usedProvider };

    if (fieldName === "readerTransformation") {
      response.beforeSuggestions = strArr(data.beforeSuggestions).slice(0, 3);
      response.afterSuggestions  = strArr(data.afterSuggestions).slice(0, 3);
    } else if (fieldName === "uniqueMechanism") {
      response.recommendations = Array.isArray(data.recommendations)
        ? data.recommendations.filter((m: any) => m && typeof m === "object" && m.name).slice(0, 4)
        : [];
    } else {
      response.recommendations = strArr(data.recommendations).slice(0, 4);
    }

    return res.json(response);
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

/** POST /api/ai/generate-focus-areas — suggest 10 AI-generated focus areas from project data */
router.post("/generate-focus-areas", async (req, res) => {
  try {
    const { project } = req.body || {};
    if (!project || typeof project !== "object") {
      return res.status(400).json({ error: "project object is required" });
    }
    const prompt = generateFocusAreasPrompt(project);
    const { text, usedProvider } = await runShort(prompt, systemPrompt(), req, res, "fieldSuggestion");
    const data = extractJSON(text);
    if (!data || !Array.isArray(data.focusAreas)) {
      return res.status(500).json({ error: "AI returned unparseable focus areas." });
    }
    const focusAreas: string[] = data.focusAreas
      .filter((x: any) => typeof x === "string" && x.trim())
      .map((x: string) => x.trim())
      .slice(0, 10);
    return res.json({ focusAreas, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

/** POST /api/ai/back-matter/key-lessons — generate structured Key Lessons cards */
router.post("/back-matter/key-lessons", async (req, res) => {
  try {
    const { bookContext, chapterSummaries, manuscriptContent, tone, audience } = req.body || {};
    const prompt = backMatterKeyLessonsPrompt({
      bookContext:       String(bookContext || ""),
      chapterSummaries:  Array.isArray(chapterSummaries)  ? chapterSummaries  : [],
      manuscriptContent: Array.isArray(manuscriptContent) ? manuscriptContent : [],
      tone:              String(tone || ""),
      audience:          String(audience || ""),
    });
    const { data, usedProvider } = await runLongJSON(
      prompt, systemPrompt(), req, res, "lesson",
      (d) => !!(d?.lessons && Array.isArray(d.lessons) && d.lessons.length > 0),
      "back-matter/key-lessons"
    );
    const lessons = data.lessons
      .filter((l: any) => l && typeof l === "object" && String(l.title || "").trim() && String(l.principle || "").trim())
      .map((l: any, i: number) => ({
        id:              `kl-${Date.now()}-${i}`,
        title:           String(l.title      || "").trim(),
        principle:       String(l.principle  || "").trim(),
        explanation:     String(l.explanation|| "").trim(),
        relatedChapters: Array.isArray(l.relatedChapters)
          ? l.relatedChapters.map((c: any) => String(c || "").trim()).filter(Boolean)
          : [],
      }))
      .slice(0, 20);
    return res.json({ lessons, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

/** POST /api/ai/back-matter/glossary — generate structured Glossary terms */
router.post("/back-matter/glossary", async (req, res) => {
  try {
    const { bookContext, chapterSummaries, manuscriptContent, tone, audience } = req.body || {};
    const prompt = backMatterGlossaryPrompt({
      bookContext:       String(bookContext || ""),
      chapterSummaries:  Array.isArray(chapterSummaries)  ? chapterSummaries  : [],
      manuscriptContent: Array.isArray(manuscriptContent) ? manuscriptContent : [],
      tone:              String(tone || ""),
      audience:          String(audience || ""),
    });
    const { data, usedProvider } = await runLongJSON(
      prompt, systemPrompt(), req, res, "lesson",
      (d) => !!(d?.terms && Array.isArray(d.terms) && d.terms.length > 0),
      "back-matter/glossary"
    );
    const terms = data.terms
      .filter((t: any) => t && typeof t === "object" && String(t.term || "").trim() && String(t.definition || "").trim())
      .map((t: any, i: number) => ({
        id:              `gl-${Date.now()}-${i}`,
        term:            String(t.term            || "").trim(),
        definition:      String(t.definition      || "").trim(),
        firstChapter:    String(t.firstChapter    || "").trim(),
        relatedChapters: Array.isArray(t.relatedChapters)
          ? t.relatedChapters.map((c: any) => String(c || "").trim()).filter(Boolean)
          : [],
        synonyms: Array.isArray(t.synonyms)
          ? t.synonyms.map((s: any) => String(s || "").trim()).filter(Boolean)
          : [],
      }))
      .sort((a: any, b: any) => a.term.localeCompare(b.term))
      .slice(0, 30);
    return res.json({ terms, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

/** POST /api/ai/back-matter/further-reading — generate structured Further Reading recommendations */
router.post("/back-matter/further-reading", async (req, res) => {
  try {
    const { bookContext, chapterSummaries, tone, audience } = req.body || {};
    const prompt = backMatterFurtherReadingPrompt({
      bookContext:      String(bookContext || ""),
      chapterSummaries: Array.isArray(chapterSummaries) ? chapterSummaries : [],
      tone:             String(tone || ""),
      audience:         String(audience || ""),
    });
    const { text, usedProvider } = await runLong(prompt, systemPrompt(), req, res, "lesson");
    const data = extractJSON(text);
    if (!data?.recommendations || !Array.isArray(data.recommendations)) {
      return res.status(500).json({ error: "AI returned unexpected format for further reading." });
    }
    const VALID_TYPES       = new Set(["Book", "Article", "Course", "Website", "Podcast", "Research Paper"]);
    const VALID_DIFFICULTIES = new Set(["Beginner", "Intermediate", "Advanced"]);
    const recommendations = data.recommendations
      .filter((r: any) => r && typeof r === "object" && String(r.title || "").trim())
      .map((r: any, i: number) => ({
        id:          `fr-${Date.now()}-${i}`,
        title:       String(r.title       || "").trim(),
        author:      String(r.author      || "").trim(),
        type:        VALID_TYPES.has(String(r.type || ""))       ? String(r.type)       : "Book",
        description: String(r.description || "").trim(),
        why:         String(r.why         || "").trim(),
        difficulty:  VALID_DIFFICULTIES.has(String(r.difficulty || "")) ? String(r.difficulty) : "Intermediate",
        url:         String(r.url         || "").trim(),
      }))
      .slice(0, 15);
    return res.json({ recommendations, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

/** POST /api/ai/back-matter/the-end — generate thank-you message and closing quote */
router.post("/back-matter/the-end", async (req, res) => {
  try {
    const { bookContext, manuscriptContent, tone, audience } = req.body || {};
    const prompt = backMatterTheEndPrompt({
      bookContext:       String(bookContext || ""),
      manuscriptContent: Array.isArray(manuscriptContent) ? manuscriptContent : [],
      tone:              String(tone || ""),
      audience:          String(audience || ""),
    });
    const { data, usedProvider } = await runLongJSON(
      prompt, systemPrompt(), req, res, "metadata",
      (d) => !!(String(d?.thankYouMessage || "").trim() || String(d?.quote || "").trim()),
      "back-matter/the-end"
    );
    return res.json({
      thankYouMessage: String(data.thankYouMessage || "").trim(),
      quote:           String(data.quote           || "").trim(),
      _provider: usedProvider,
    });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

/** POST /api/ai/back-matter/appendix-entry — generate a single AI appendix entry from the manuscript */
router.post("/back-matter/appendix-entry", async (req, res) => {
  try {
    const { bookContext, manuscriptContent, tone, audience } = req.body || {};
    const prompt = backMatterAppendixEntryPrompt({
      bookContext:       String(bookContext || ""),
      manuscriptContent: Array.isArray(manuscriptContent) ? manuscriptContent : [],
      tone:              String(tone || ""),
      audience:          String(audience || ""),
    });
    const { data, usedProvider } = await runLongJSON(
      prompt, systemPrompt(), req, res, "lesson",
      (d) => !!(String(d?.title || "").trim() && String(d?.content || "").trim()),
      "back-matter/appendix-entry"
    );
    return res.json({
      title:    String(data.title    || "").trim(),
      category: String(data.category || "").trim(),
      content:  String(data.content  || "").trim(),
      _provider: usedProvider,
    });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

export default router;
