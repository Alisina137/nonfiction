import { Router } from "express";
import {
  getBestsellerBooks,
  getBookByAsin,
  RainforestError
} from "../../lib/rainforest";
import { searchBooksWithScaleSerp, getProductDetailWithScaleSerp, ScaleSerpError } from "../../lib/scaleSerpProvider";
import { generateContent, extractJSON } from "../ai/aiRouter";

const router = Router();

// ─── Startup key detection ────────────────────────────────────────────────────

console.log("[amazon-provider] Rainforest Key Exists:", !!process.env.RAINFOREST_API_KEY);
console.log("[amazon-provider] Scale SERP Key Exists:", !!process.env.SCALE_SERP_API_KEY);

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

Respond with ONLY a valid JSON array (no markdown, no explanation, no code fences). Each item:
{"title":"...","authors":"...","subtitle":"...or null","rating":4.5,"ratingsTotal":12000,"publicationDate":"2020","publisher":"...or null","description":"1-2 sentences or null","asin":"10-char or null"}

Requirements:
- Real books that exist on Amazon
- Most popular/bestselling first
- Return a raw JSON array starting with [ and ending with ]
- No wrapping object, no markdown fences`;

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
    const thumbnail = asin
      ? `https://m.media-amazon.com/images/P/${asin}.01._SX300_.jpg`
      : null;
    if (thumbnail) console.log("[AI] Book Cover URL:", thumbnail, "| ASIN:", asin);
    return {
      asin,
      title:        b.title.trim(),
      subtitle:     b.subtitle && b.subtitle !== "null" ? b.subtitle : null,
      authors:      b.authors || null,
      url:          asin
        ? `https://www.amazon.com/dp/${asin}`
        : `https://www.amazon.com/s?k=${encodeURIComponent(b.title.trim())}`,
      thumbnail,
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
// Priority: Rainforest → Scale SERP → AI research → Open Library

router.post("/amazon-search", async (req, res) => {
  const { query, amazonDomain } = req.body || {};
  const q = typeof query === "string" ? query.trim() : "";
  if (!q) return res.status(400).json({ error: "Search query is required." });

  let rainforestAttempted = false;
  let scaleSerpAttempted  = false;

  // ── 1. Rainforest ──────────────────────────────────────────────────────────
  if (process.env.RAINFOREST_API_KEY) {
    rainforestAttempted = true;
    console.log("[amazon-search] Provider Used: rainforest");
    try {
      const books = await getBestsellerBooks(q, {
        amazonDomain: amazonDomain || "amazon.com",
        maxResults: 24
      });
      console.log("[amazon-search] Rainforest Success:", true, "| Books Returned:", books.length);
      return res.json({ books, query: q, source: "amazon" });
    } catch (e: any) {
      console.log("[amazon-search] Rainforest Success:", false, "—", e.message);
    }
  }

  // ── 2. Scale SERP ──────────────────────────────────────────────────────────
  if (process.env.SCALE_SERP_API_KEY) {
    scaleSerpAttempted = true;
    console.log("[amazon-search] Provider Used: scale_serp");
    console.log("[amazon-search] Scale SERP Fallback Triggered");
    try {
      const books = await searchBooksWithScaleSerp(q, { maxResults: 20 });
      console.log("[amazon-search] Books Returned:", books.length);
      return res.json({ books, query: q, source: "scale_serp" });
    } catch (e: any) {
      console.warn("[amazon-search] Scale SERP error — falling through:", e.message);
    }
  }

  // ── 3. AI research (Gemini/Groq) ───────────────────────────────────────────
  console.log("[amazon-search] Provider Used: ai_research");
  try {
    const books = await aiBookSearch(q, 15);
    console.log("[amazon-search] Books Returned:", books.length);

    // Build a helpful notice based on which keys were tried
    let notice = "Results generated by AI market research.";
    if (rainforestAttempted && scaleSerpAttempted) {
      notice += " Both Rainforest and Scale SERP were tried but unavailable.";
    } else if (rainforestAttempted) {
      notice += " Rainforest API key is set but the account may be suspended.";
    } else if (scaleSerpAttempted) {
      notice += " Scale SERP was tried but failed.";
    } else {
      notice += " Add RAINFOREST_API_KEY or SCALE_SERP_API_KEY for live Amazon data.";
    }

    return res.json({ books, query: q, source: "ai_research", notice });
  } catch (e: any) {
    console.warn("[amazon-search] AI search error — falling through:", e.message);
  }

  // ── 4. Open Library (last resort) ─────────────────────────────────────────
  console.log("[amazon-search] Provider Used: open_library");
  try {
    const books = await openLibrarySearch(q, 20);
    console.log("[amazon-search] Books Returned:", books.length);
    return res.json({
      books, query: q,
      source: "open_library",
      notice: "Results from Open Library. Add RAINFOREST_API_KEY or SCALE_SERP_API_KEY for live Amazon data."
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Book search failed. Please try again." });
  }
});

// ─── POST /api/analysis/amazon-product ───────────────────────────────────────
// Priority: Rainforest → Scale SERP → error

router.post("/amazon-product", async (req, res) => {
  const { amazonDomain } = req.body || {};
  const asin = parseAsinFromBody(req.body);
  if (!asin) return res.status(400).json({ error: "Valid Amazon product URL or ASIN is required." });

  // ── 1. Rainforest ──────────────────────────────────────────────────────────
  if (process.env.RAINFOREST_API_KEY) {
    try {
      const details = await getBookByAsin(asin, { amazonDomain: amazonDomain || "amazon.com" });
      console.log("[amazon-product] Provider Used: rainforest | ASIN:", asin);
      return res.json({ details, asin, source: "rainforest" });
    } catch (e: any) {
      console.warn("[amazon-product] Rainforest failed —", e.message);
      if (e instanceof RainforestError && (e.code === "RATE_LIMIT" || e.code === "ACCOUNT")) {
        return res.status(429).json({ error: e.message });
      }
      // Fall through to Scale SERP
    }
  }

  // ── 2. Scale SERP ──────────────────────────────────────────────────────────
  if (process.env.SCALE_SERP_API_KEY) {
    try {
      const details = await getProductDetailWithScaleSerp(asin);
      console.log("[amazon-product] Provider Used: scale_serp | ASIN:", asin);
      return res.json({
        details,
        asin,
        source: "scale_serp",
        notice: "Basic details loaded via Scale SERP. Bestseller ranks require Rainforest API."
      });
    } catch (e: any) {
      console.warn("[amazon-product] Scale SERP failed —", e.message);
    }
  }

  // ── No provider available ──────────────────────────────────────────────────
  if (!process.env.RAINFOREST_API_KEY && !process.env.SCALE_SERP_API_KEY) {
    return res.json({
      needsApiKey: true,
      details: null,
      message: "Add RAINFOREST_API_KEY for full bestseller rank data, or SCALE_SERP_API_KEY for basic details."
    });
  }

  return res.status(502).json({ error: "Product lookup failed. Both Rainforest and Scale SERP are unavailable." });
});

export default router;
