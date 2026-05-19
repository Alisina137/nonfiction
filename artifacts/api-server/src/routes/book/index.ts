import { Router } from "express";
import { buildCompetitorSummariesForPrompt } from "../ai/analysisSummary.js";
import { contextualBookTitlesPrompt, systemPrompt } from "../ai/prompts.js";
import { createChatCompletion } from "../ai/client.js";

const router = Router();

router.post("/contextual-titles", async (req, res) => {
  try {
    const { research, analysis } = req.body || {};
    if (!research || typeof research !== "object") return res.status(400).json({ error: "Research payload required." });
    const competitorSummaries = buildCompetitorSummariesForPrompt(analysis?.books || []);
    const completion = await createChatCompletion([
      { role: "system", content: systemPrompt() },
      { role: "user", content: contextualBookTitlesPrompt({ research, competitorSummaries }) }
    ], { type: "json_object" });
    const data = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
    let titles = data.titles;
    if (!Array.isArray(titles)) titles = typeof data.title === "string" ? [data.title] : [];
    titles = titles.map((t: any) => String(t || "").trim()).filter(Boolean).slice(0, 12);
    return res.json({ titles });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate titles" });
  }
});

export default router;
