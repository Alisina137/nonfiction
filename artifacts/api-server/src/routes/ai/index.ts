import { Router } from "express";
import {
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
  GrokApprovalRequiredError
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

function aiOptsFromReq(req: any) {
  return { allowGrok: req?.body?.allowGrok === true };
}

function setProviderHeader(res: any, provider: string) {
  res.setHeader("X-AI-Provider", provider);
}

// Long-form (OpenAI primary)
async function runLong(prompt: string, system: string, req: any, res: any) {
  const { text, usedProvider } = await generateContent(prompt, system, aiOptsFromReq(req));
  setProviderHeader(res, usedProvider);
  return { text, usedProvider };
}

// Short-form (Gemini primary)
async function runShort(prompt: string, system: string, req: any, res: any) {
  const { text, usedProvider } = await generateContentFast(prompt, system, aiOptsFromReq(req));
  setProviderHeader(res, usedProvider);
  return { text, usedProvider };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.post("/titles", async (req, res) => {
  try {
    const { idea } = req.body;
    const { text, usedProvider } = await runShort(titlesPrompt(idea), systemPrompt(), req, res);
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
      res
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
    const { text, usedProvider } = await runLong(prompt, systemPrompt(), req, res);
    const data = extractJSON(text);
    return res.json({ ...data, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/cover", async (req, res) => {
  try {
    const { text, usedProvider } = await runLong(coverBriefPrompt(req.body), systemPrompt(), req, res);
    const data = extractJSON(text);
    return res.json({ ...data, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/cover-critic", async (req, res) => {
  try {
    const { text, usedProvider } = await runLong(coverCriticPrompt(req.body), systemPrompt(), req, res);
    const data = extractJSON(text);
    return res.json({ ...data, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/cover-variants", async (req, res) => {
  try {
    const { text, usedProvider } = await runLong(coverVariantsPrompt(req.body), systemPrompt(), req, res);
    const data = extractJSON(text);
    return res.json({ variants: data.variants || [], _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/outline", async (req, res) => {
  try {
    const { text, usedProvider } = await runShort(outlinePrompt(req.body), systemPrompt(), req, res);
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
    const { text, usedProvider } = await runShort(
      nicheOutlinePrompt({ research, architecture, title, description }),
      nicheSystemPrompt(architecture),
      req,
      res
    );
    const data = extractJSON(text);
    return res.json({ ...data, _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/structure", async (req, res) => {
  try {
    const { text, usedProvider } = await runShort(structurePrompt(req.body), systemPrompt(), req, res);
    const data = extractJSON(text);
    return res.json({ sections: data.sections || [], _provider: usedProvider });
  } catch (error: any) {
    return aiErrorResponse(res, error);
  }
});

router.post("/lesson", async (req, res) => {
  try {
    const { text, usedProvider } = await runLong(lessonPrompt(req.body), systemPrompt(), req, res);
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
      res
    );
    return res.json({ text, _provider: usedProvider });
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

export default router;
