/**
 * Analysis routes — Amazon book research powered by SerpApi.
 *
 * POST /api/analysis/amazon-search  — search Amazon Books for a topic
 * POST /api/analysis/amazon-product — fetch expanded product detail for an ASIN
 *
 * Both endpoints return { needsApiKey: true } when SERPAPI_API_KEY is not set,
 * allowing the UI to degrade gracefully (manual URL entry still works).
 */

import { Router } from "express";
import { amazonResearchService, amazonProductDetail } from "../../services/amazonResearchService";

const router = Router();

// ─── ASIN extraction helpers ───────────────────────────────────────────────

function extractAsinFromAmazonUrl(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const direct = trimmed.match(/^([A-Z0-9]{10})$/i);
  if (direct) return direct[1].toUpperCase();
  const dp = trimmed.match(/\/(?:dp|gp\/product|exec\/obidos\/ASIN)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  if (dp) return dp[1].toUpperCase();
  const q = trimmed.match(/[?&]asin=([A-Z0-9]{10})/i);
  if (q) return q[1].toUpperCase();
  return null;
}

function parseAsinFromBody(body: any): string | null {
  const raw = body?.asin || body?.url;
  if (!raw) return null;
  if (typeof raw === "string" && /^[A-Z0-9]{10}$/i.test(raw.trim())) return raw.trim().toUpperCase();
  return extractAsinFromAmazonUrl(raw);
}

// ─── POST /amazon-search ──────────────────────────────────────────────────

router.post("/amazon-search", async (req, res) => {
  const apiKey = process.env.SERPAPI_API_KEY;
  const { query, amazonDomain } = req.body || {};
  const q = typeof query === "string" ? query.trim() : "";

  if (!q) return res.status(400).json({ error: "Search query is required." });

  // Graceful degradation: no API key configured
  if (!apiKey) {
    return res.json({
      needsApiKey: true,
      books: [],
      message: "Live Amazon search is disabled. Add SERPAPI_API_KEY to enable search. You can still add reference URLs manually."
    });
  }

  try {
    const normalized = await amazonResearchService(apiKey, {
      topic:        q,
      maxResults:   24,
      amazonDomain: amazonDomain || "amazon.com",
    });

    // Map NormalizedBook → app book row shape expected by the UI
    const books = normalized.map((b) => ({
      asin:                 b.asin,
      title:                b.title,
      url:                  b.amazonUrl,
      thumbnail:            b.thumbnail,
      rating:               b.rating,
      ratingsTotal:         b.reviewCount,
      recentSales:          null,
      sponsored:            false,
      bestsellerBadge:      b.bestsellerBadge ? { category: "Books" } : null,
      subtitle:             null,
      authors:              b.author,
      bestsellersRankFlat:  null,
      bestsellersRanks:     null,
      expandedDetailsLoaded: false,
    }));

    return res.json({ books, query: q });
  } catch (e: any) {
    const status = e.code === "INVALID_KEY" ? 401 : e.code === "RATE_LIMIT" ? 429 : 502;
    console.error(`[amazon-search] ${e.code || "ERROR"}: ${e.message}`);
    return res.status(status).json({ error: e.message || "Amazon search failed." });
  }
});

// ─── POST /amazon-product ─────────────────────────────────────────────────

router.post("/amazon-product", async (req, res) => {
  const apiKey = process.env.SERPAPI_API_KEY;
  const { amazonDomain } = req.body || {};
  const asin = parseAsinFromBody(req.body);

  if (!asin) return res.status(400).json({ error: "Valid Amazon product URL or ASIN is required." });

  // Graceful degradation: no API key configured
  if (!apiKey) {
    return res.json({
      needsApiKey: true,
      details: null,
      message: "Add SERPAPI_API_KEY to load ratings and bestseller rank from Amazon."
    });
  }

  try {
    const details = await amazonProductDetail(apiKey, {
      asin,
      amazonDomain: amazonDomain || "amazon.com",
    });

    return res.json({ details, asin });
  } catch (e: any) {
    const status = e.code === "INVALID_KEY" ? 401 : e.code === "RATE_LIMIT" ? 429 : 502;
    console.error(`[amazon-product] ${e.code || "ERROR"}: ${e.message}`);
    return res.status(status).json({ error: e.message || "Product lookup failed." });
  }
});

export default router;
