import { normalizeSearchResultsForApp, rainforestSearchBooks } from "@/lib/analysis/rainforest";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.RAINFOREST_API_KEY;
  const { query, amazonDomain } = req.body || {};
  const q = typeof query === "string" ? query.trim() : "";

  if (!q) return res.status(400).json({ error: "Search query is required." });

  if (!apiKey) {
    return res.status(200).json({
      needsApiKey: true,
      books: [],
      message:
        "Live Amazon search is disabled. Add RAINFOREST_API_KEY to your server environment (see .env.example), then search again. You can still add reference URLs manually below."
    });
  }

  try {
    const data = await rainforestSearchBooks(apiKey, { searchTerm: q, amazonDomain });
    if (data.request_info && data.request_info.success === false) {
      return res.status(502).json({
        error: data.error?.message || data.error || "Amazon search failed."
      });
    }
    const books = normalizeSearchResultsForApp(data);
    return res.status(200).json({ books, query: q });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Amazon search failed." });
  }
}
