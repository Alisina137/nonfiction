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
  structurePrompt,
  systemPrompt,
  titlesPrompt
} from "./prompts.js";
import { buildCompetitorSummariesForPrompt } from "./analysisSummary.js";
import { createChatCompletion } from "./client.js";

const router = Router();

async function chatJSON(userPrompt: string, system = systemPrompt()) {
  const completion = await createChatCompletion([
    { role: "system", content: system },
    { role: "user", content: userPrompt }
  ], { type: "json_object" });
  return JSON.parse(completion.choices?.[0]?.message?.content || "{}");
}

router.post("/titles", async (req, res) => {
  try {
    const { idea } = req.body;
    const data = await chatJSON(titlesPrompt(idea));
    return res.json({ titles: data.titles || [] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate titles" });
  }
});

router.post("/contextual-titles", async (req, res) => {
  try {
    const { research, analysis } = req.body || {};
    if (!research || typeof research !== "object") return res.status(400).json({ error: "Research payload required." });
    const competitorSummaries = buildCompetitorSummariesForPrompt(analysis?.books || []);
    const data = await chatJSON(contextualBookTitlesPrompt({ research, competitorSummaries }));
    let titles = data.titles;
    if (!Array.isArray(titles)) titles = typeof data.title === "string" ? [data.title] : [];
    titles = titles.map((t: any) => String(t || "").trim()).filter(Boolean).slice(0, 12);
    return res.json({ titles });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate titles" });
  }
});

router.post("/description", async (req, res) => {
  try {
    const prompt = req.body?.enriched ? marketingDescriptionPrompt(req.body) : descriptionPrompt(req.body);
    const data = await chatJSON(prompt);
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate description" });
  }
});

router.post("/cover", async (req, res) => {
  try {
    const data = await chatJSON(coverBriefPrompt(req.body));
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
    if (!architecture?.subNicheLabel) return res.status(400).json({ error: "Missing niche architecture" });
    const completion = await createChatCompletion(
      [
        { role: "system", content: nicheSystemPrompt(architecture) },
        { role: "user", content: nicheOutlinePrompt({ research, architecture, title, description }) }
      ],
      { type: "json_object" }
    );
    const data = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
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
    const completion = await createChatCompletion([
      { role: "system", content: systemPrompt() },
      { role: "user", content: improvementPrompt({ action, currentText, tone }) }
    ]);
    const text = completion.choices?.[0]?.message?.content || "";
    return res.json({ text });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to improve text" });
  }
});

export default router;
