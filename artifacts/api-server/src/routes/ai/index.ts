import { Router } from "express";
import {
  contextualBookTitlesPrompt,
  coverBriefPrompt,
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
  extractJSON
} from "./aiRouter.js";

const router = Router();

// Helper: generate text → parse as JSON (long-form, Gemini-first)
async function chatJSON(userPrompt: string, system = systemPrompt()) {
  const text = await generateContent(userPrompt, system);
  return extractJSON(text);
}

// Helper: generate text → parse as JSON (fast, Groq-first)
async function chatJSONFast(userPrompt: string, system = systemPrompt()) {
  const text = await generateContentFast(userPrompt, system);
  return extractJSON(text);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.post("/titles", async (req, res) => {
  try {
    const { idea } = req.body;
    const data = await chatJSONFast(titlesPrompt(idea));
    return res.json({ titles: data.titles || [] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate titles" });
  }
});

router.post("/contextual-titles", async (req, res) => {
  try {
    const { research, analysis } = req.body || {};
    if (!research || typeof research !== "object")
      return res.status(400).json({ error: "Research payload required." });
    const competitorSummaries = buildCompetitorSummariesForPrompt(analysis?.books || []);
    const data = await chatJSONFast(
      contextualBookTitlesPrompt({ research, competitorSummaries })
    );
    let titles = data.titles;
    if (!Array.isArray(titles))
      titles = typeof data.title === "string" ? [data.title] : [];
    titles = titles.map((t: any) => String(t || "").trim()).filter(Boolean).slice(0, 12);
    return res.json({ titles });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate titles" });
  }
});

router.post("/description", async (req, res) => {
  try {
    const prompt = req.body?.enriched
      ? marketingDescriptionPrompt(req.body)
      : descriptionPrompt(req.body);
    const data = await chatJSONFast(prompt);
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate description" });
  }
});

router.post("/cover", async (req, res) => {
  try {
    const data = await chatJSONFast(coverBriefPrompt(req.body));
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate cover brief" });
  }
});

router.post("/outline", async (req, res) => {
  try {
    const data = await chatJSON(outlinePrompt(req.body));
    return res.json({ chapters: data.chapters || [] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate outline" });
  }
});

router.post("/niche-outline", async (req, res) => {
  try {
    const { research, architecture, title, description } = req.body || {};
    if (!architecture?.subNicheLabel)
      return res.status(400).json({ error: "Missing niche architecture" });
    const text = await generateContent(
      nicheOutlinePrompt({ research, architecture, title, description }),
      nicheSystemPrompt(architecture)
    );
    const data = extractJSON(text);
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate niche outline" });
  }
});

router.post("/structure", async (req, res) => {
  try {
    const data = await chatJSON(structurePrompt(req.body));
    return res.json({ sections: data.sections || [] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate structure" });
  }
});

router.post("/lesson", async (req, res) => {
  try {
    const data = await chatJSON(lessonPrompt(req.body));
    return res.json({ lesson: data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate lesson" });
  }
});

router.post("/improve", async (req, res) => {
  try {
    const { action, currentText, tone } = req.body || {};
    const text = await generateContentFast(
      improvementPrompt({ action, currentText, tone }),
      systemPrompt()
    );
    return res.json({ text });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to improve text" });
  }
});

router.post("/regenerate-title", async (req, res) => {
  try {
    const { level, currentTitle, parentChapter, parentSection, architecture, research } = req.body || {};
    if (!level) return res.status(400).json({ error: "Missing level" });
    const text = await generateContentFast(
      regenTitlePrompt({ level, currentTitle, parentChapter, parentSection, architecture, research }),
      systemPrompt()
    );
    const data = extractJSON(text);
    return res.json({ title: data.title || currentTitle });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to regenerate title" });
  }
});

export default router;
