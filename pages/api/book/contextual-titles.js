import { AI } from "@/lib/ai";
import { buildCompetitorSummariesForPrompt } from "@/lib/context/analysisSummary";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "OpenAI API key not configured." });
  }

  try {
    const { research, analysis } = req.body || {};
    if (!research || typeof research !== "object") {
      return res.status(400).json({ error: "Research payload required." });
    }

    const books = analysis?.books;
    const competitorSummaries = buildCompetitorSummariesForPrompt(books || []);

    const data = await AI.getContextualTitles({ research, competitorSummaries });

    let titles = data.titles;
    if (!Array.isArray(titles)) {
      if (typeof data.title === "string") titles = [data.title];
      else titles = [];
    }

    titles = titles.map((t) => String(t || "").trim()).filter(Boolean).slice(0, 12);

    return res.status(200).json({ titles });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to generate titles" });
  }
}
