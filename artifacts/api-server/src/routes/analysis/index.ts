import { Router } from "express";
import { createAmazonDataProvider } from "../../services/amazonDataProvider.js";
import { amazonResearchService, amazonProductDetail } from "../../services/amazonResearchService.js";

const router = Router();

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

// ─── POST /amazon-search ───────────────────────────────────────────────────
// Priority chain: Rainforest → Scale SERP + OL enrichment → Open Library

router.post("/amazon-search", async (req, res) => {
  const { query, amazonDomain } = req.body || {};
  const q = typeof query === "string" ? query.trim() : "";
  if (!q) return res.status(400).json({ error: "Search query is required." });

  const provider = createAmazonDataProvider();

  try {
    const result = await provider.searchBooks(q, amazonDomain || "amazon.com", 20);
    return res.json(result);
  } catch (e: any) {
    // Last-resort: try legacy Apify service
    const apifyKey = process.env.APIFY_API_KEY;
    if (apifyKey) {
      try {
        const results = await amazonResearchService(apifyKey, {
          topic: q, maxResults: 20, amazonDomain: amazonDomain || "amazon.com"
        });
        const books = results.map((r) => ({
          asin:                r.asin,
          openLibraryKey:      null,
          title:               r.title,
          subtitle:            null,
          authors:             r.author || null,
          url:                 r.amazonUrl,
          thumbnail:           r.thumbnail,
          rating:              r.rating,
          ratingsTotal:        r.reviewCount,
          reviewCount:         r.reviewCount,
          price:               r.price,
          bestsellersRankFlat: null,
          bestsellersRanks:    null,
          publicationDate:     null,
          sponsored:           false,
          bestsellerBadge:     r.bestsellerBadge ? {} : null,
          expandedDetailsLoaded: false,
          dataSource:          "scale_serp",
          source_provider:     "apify",
        }));
        return res.json({ books, query: q, source: "apify" });
      } catch { /* fall through to error */ }
    }
    return res.status(500).json({ error: e.message || "Book search failed." });
  }
});

// ─── POST /amazon-product ──────────────────────────────────────────────────
// Priority chain: Rainforest → Open Library (by title) → empty

router.post("/amazon-product", async (req, res) => {
  const { amazonDomain } = req.body || {};
  const asin = parseAsinFromBody(req.body);
  if (!asin) return res.status(400).json({ error: "Valid Amazon ASIN or URL is required." });

  const provider  = createAmazonDataProvider();
  const bookTitle = typeof req.body?.title === "string" ? req.body.title : undefined;

  const details = await provider.getProductDetails(asin, bookTitle, amazonDomain || "amazon.com");

  if (details) return res.json({ details, asin });

  // Legacy Apify fallback
  const apifyKey = process.env.APIFY_API_KEY;
  if (apifyKey) {
    try {
      const detail = await amazonProductDetail(apifyKey, { asin, amazonDomain: amazonDomain || "amazon.com" });
      return res.json({
        details: { ...detail, dataSource: "scale_serp", reviewCount: detail.ratingsTotal, price: null },
        asin
      });
    } catch { /* ignore */ }
  }

  return res.json({
    needsApiKey: true,
    details:     null,
    message:     "Add a RAINFOREST_API_KEY to load full Amazon product details.",
  });
});

export default router;
