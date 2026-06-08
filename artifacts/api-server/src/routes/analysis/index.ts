import { Router } from "express";
import {
  getBestsellerBooks,
  getBookByAsin,
  RainforestError
} from "../../lib/rainforest";
import { generateContent, extractJSON } from "../ai/aiRouter";

const router = Router();

// ─── ASIN helpers ─────────────────────────────────────────────────────────────

function extractAsinFromAmazonUrl(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const t = url.trim();
  const direct = t.match(/^([A-Z0-9]{10})$/i);
  if (direct) return direct[1].toUpperCase();
  const dp = t.match(/\/(?:dp|gp\/product|exec\/obidos\/ASIN)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  if (dp) return dp[1].toUpperCase();
  const q = t.match(/[?&]asin=([A-Z0-9]{10})/i);
  if (q) return q[1].toUpperCase();
  return null;
}

function parseAsinFromBody(body: any): string | null {
  const raw = body?.asin || body?.url;
  if (!raw) return null;
  if (typeof raw === "string" && /^[A-Z0-9]{10}$/i.test(raw.trim())) return raw.trim().toUpperCase();
  return extractAsinFromAmazonUrl(raw);
}

// ─── AI fallback: generate list of real bestselling books in a niche ──────────

async function aiBookSearch(query: string, maxResults = 15): Promise<any[]> {
  const prompt = `You are a publishing market researcher. List ${maxResults} real bestselling nonfiction books relevant to: "${query}"

Respond with ONLY a valid JSON array (no markdown, no explanation). Each item:
{"title":"...","authors":"...","subtitle":"...or null","rating":4.5,"ratingsTotal":12000,"publicationDate":"2020","publisher":"...or null","description":"1-2 sentences or null","asin":"10-char or null"}

Requirements:
- Real books that exist on Amazon
- Most popular/bestselling first
- Do NOT wrap in an object — return a raw array starting with [`;

  const result = await generateContent(prompt, undefined, { maxTokens: 4000 });
  let parsed: any;
  try { parsed = extractJSON(result.text); } catch (e: any) {
    throw new Error(`AI JSON parse failed: ${e.message}`);
  }

  let arr: any[] = [];
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.books)) arr = parsed.books;
  else if (parsed && Array.isArray(parsed.results)) arr = parsed.results;
  else throw new Error("AI response was not an array");

  const valid = arr.filter((b: any) => b && typeof b.title === "string" && b.title.trim()).slice(0, maxResults);
  if (valid.length === 0) throw new Error("AI returned no valid books");

  return valid.map((b: any) => {
    const rawAsin = typeof b.asin === "string" ? b.asin.trim().toUpperCase() : null;
    const asin = rawAsin && /^[A-Z0-9]{10}$/.test(rawAsin) ? rawAsin : null;
    return {
      asin,
      title:        b.title.trim(),
      subtitle:     b.subtitle && b.subtitle !== "null" ? b.subtitle : null,
      authors:      b.authors || null,
      url:          asin
        ? `https://www.amazon.com/dp/${asin}`
        : `https://www.amazon.com/s?k=${encodeURIComponent(b.title.trim())}`,
      thumbnail:    null,
      rating:       typeof b.rating === "number" && b.rating > 0 ? b.rating : null,
      ratingsTotal: typeof b.ratingsTotal === "number" && b.ratingsTotal > 0 ? b.ratingsTotal : null,
      recentSales:  null, sponsored: false, bestsellerBadge: null,
      bestsellersRankFlat: null, bestsellersRanks: null, expandedDetailsLoaded: false,
      pageCount:    typeof b.pageCount === "number" ? b.pageCount : null,
      publisher:    b.publisher && b.publisher !== "null" ? b.publisher : null,
      publicationDate: b.publicationDate && b.publicationDate !== "null" ? b.publicationDate : null,
      description:  b.description && b.description !== "null" ? b.description : null,
      source_provider: "ai_research"
    };
  });
}

// ─── Open Library last-resort fallback ───────────────────────────────────────

async function openLibrarySearch(query: string, maxResults = 20): Promise<any[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "key,title,subtitle,author_name,cover_i,ratings_average,ratings_count,publisher");
  url.searchParams.set("limit", String(Math.min(maxResults, 40)));
  url.searchParams.set("language", "eng");

  const res = await fetch(url.toString(), { headers: { "User-Agent": "NonfictionStudio/1.0" } });
  if (!res.ok) throw new Error(`Open Library API error: ${res.status}`);
  const data = await res.json();

  return ((data.docs as any[]) || [])
    .filter((doc: any) => doc?.title)
    .map((doc: any) => {
      const coverId = doc.cover_i;
      const key     = typeof doc.key === "string" ? doc.key : null;
      return {
        asin: null, openLibraryKey: key,
        title: doc.title, subtitle: doc.subtitle || null,
        authors: Array.isArray(doc.author_name) ? doc.author_name.join(", ") : null,
        url: key ? `https://openlibrary.org${key}` : "https://openlibrary.org",
        thumbnail: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null,
        rating: typeof doc.ratings_average === "number" && doc.ratings_average > 0
          ? Math.round(doc.ratings_average * 10) / 10 : null,
        ratingsTotal: typeof doc.ratings_count === "number" ? doc.ratings_count : null,
        recentSales: null, sponsored: false, bestsellerBadge: null,
        bestsellersRankFlat: null, bestsellersRanks: null, expandedDetailsLoaded: false,
        source_provider: "open_library"
      };
    });
}

// ─── POST /api/analysis/amazon-search ────────────────────────────────────────
// Priority: Rainforest → AI research → Open Library

router.post("/amazon-search", async (req, res) => {
  const { query, amazonDomain } = req.body || {};
  const q = typeof query === "string" ? query.trim() : "";
  if (!q) return res.status(400).json({ error: "Search query is required." });

  // ── 1. Rainforest ──────────────────────────────────────────────────────────
  if (process.env.RAINFOREST_API_KEY) {
    try {
      const books = await getBestsellerBooks(q, {
        amazonDomain: amazonDomain || "amazon.com",
        maxResults: 24
      });
      return res.json({ books, query: q });
    } catch (e: any) {
      if (e instanceof RainforestError && e.code === "MISSING_KEY") {
        // shouldn't happen here, fall through
      } else if (e instanceof RainforestError && e.code === "NO_RESULTS") {
        console.warn("[amazon-search] Rainforest: no results — falling through");
      } else if (e instanceof RainforestError) {
        console.warn(`[amazon-search] Rainforest error (${e.code}) — falling through: ${e.message}`);
      } else {
        console.warn("[amazon-search] Rainforest unexpected error — falling through:", e.message);
      }
    }
  }

  // ── 2. AI research (uses existing Gemini/Groq keys) ───────────────────────
  try {
    const books = await aiBookSearch(q, 15);
    return res.json({
      books, query: q,
      source: "ai_research",
      notice: "Results generated by AI market research. Add RAINFOREST_API_KEY for live Amazon data."
    });
  } catch (e: any) {
    console.warn("[amazon-search] AI search error — falling through:", e.message);
  }

  // ── 3. Open Library (last resort) ─────────────────────────────────────────
  try {
    const books = await openLibrarySearch(q, 20);
    return res.json({
      books, query: q,
      source: "open_library",
      notice: "Results from Open Library. Add RAINFOREST_API_KEY for live Amazon data."
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Book search failed. Please try again." });
  }
});

// ─── POST /api/analysis/amazon-product ───────────────────────────────────────
// Requires RAINFOREST_API_KEY — returns needsApiKey otherwise.

router.post("/amazon-product", async (req, res) => {
  const { amazonDomain } = req.body || {};
  const asin = parseAsinFromBody(req.body);
  if (!asin) return res.status(400).json({ error: "Valid Amazon product URL or ASIN is required." });

  if (!process.env.RAINFOREST_API_KEY) {
    return res.json({
      needsApiKey: true,
      details: null,
      message: "Add RAINFOREST_API_KEY to load Amazon ratings and bestseller rank."
    });
  }

  try {
    const details = await getBookByAsin(asin, { amazonDomain: amazonDomain || "amazon.com" });
    return res.json({ details, asin });
  } catch (e: any) {
    if (e instanceof RainforestError) {
      const statusCode = e.code === "RATE_LIMIT" ? 429
        : e.code === "MISSING_KEY" ? 400
        : 502;
      return res.status(statusCode).json({ error: e.message });
    }
    return res.status(500).json({ error: e.message || "Product lookup failed." });
  }
});

export default router;
