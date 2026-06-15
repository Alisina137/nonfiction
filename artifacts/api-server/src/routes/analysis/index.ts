import { Router } from "express";
import {
  searchAmazonBooks,
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

// ─── Deduplication ────────────────────────────────────────────────────────────

function normalizeStr(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function deduplicateBooks(books: any[]): any[] {
  const seenAsins     = new Set<string>();
  const seenTitleAuth = new Set<string>();
  const result: any[] = [];
  for (const b of books) {
    if (b.asin) {
      if (seenAsins.has(b.asin)) continue;
      seenAsins.add(b.asin);
    } else {
      const key = `${normalizeStr(b.title || "")}||${normalizeStr(b.authors || "")}`;
      if (seenTitleAuth.has(key)) continue;
      seenTitleAuth.add(key);
    }
    result.push(b);
  }
  return result;
}

// ─── Relevance scoring ────────────────────────────────────────────────────────

const RELEVANT_CATEGORY_KEYWORDS = [
  "time management", "productivity", "business", "professional development",
  "self improvement", "self-help", "personal development", "success",
  "entrepreneurship", "leadership", "management", "motivation", "career",
  "finance", "investing", "health", "science", "history", "biography",
  "communication", "habits", "mindset", "marketing", "sales"
];

function scoreRelevance(book: any, qWords: string[]): number {
  const title = normalizeStr(book.title || "");
  const significantWords = qWords.filter(w => w.length > 2);

  // titleMatch (0-1): fraction of significant query words in title
  const titleMatch = significantWords.length > 0
    ? significantWords.filter(w => title.includes(w)).length / significantWords.length
    : 0;

  // keywordMatch: any query word at all appears in title
  const keywordMatch = significantWords.some(w => title.includes(w)) ? 1 : 0;

  // categoryMatch: bestseller category matches a relevant topic
  let categoryMatch = 0;
  const ranks: any[] = Array.isArray(book.bestsellersRanks) ? book.bestsellersRanks : [];
  outer: for (const r of ranks) {
    const cat = normalizeStr(r.category || "");
    for (const kw of RELEVANT_CATEGORY_KEYWORDS) {
      if (cat.includes(kw)) { categoryMatch = 1; break outer; }
    }
  }
  if (!categoryMatch && book.bestsellerBadge) {
    const cat = normalizeStr(
      typeof book.bestsellerBadge === "string" ? book.bestsellerBadge
      : book.bestsellerBadge?.category || ""
    );
    for (const kw of RELEVANT_CATEGORY_KEYWORDS) {
      if (cat.includes(kw)) { categoryMatch = 1; break; }
    }
  }

  // reviewCountWeight: log scale
  const reviewWeight = book.ratingsTotal ? Math.min(Math.log10(book.ratingsTotal + 1), 5) : 0;

  // ratingWeight: 0–2
  const ratingWeight = typeof book.rating === "number" ? (book.rating / 5) * 2 : 0;

  return (titleMatch * 5) + (categoryMatch * 4) + (keywordMatch * 3) + reviewWeight + ratingWeight;
}

// ─── Expanded Rainforest search (multi-query, merge, dedup) ───────────────────

const EXPANSION_SUFFIXES = [
  " books",
  " bestseller",
  " self help",
  " productivity",
  " business",
  " professional development",
];

async function expandedRainforestSearch(query: string, domain: string): Promise<any[]> {
  // Step 1 — original query
  let initial: any[] = [];
  try {
    const books = await searchAmazonBooks(query, {
      amazonDomain: domain,
      sortBy: "bestseller_rankings",
      maxResults: 24
    });
    initial = books.map(b => ({ ...b, source_provider: "rainforest" }));
    console.log(`[amazon-search] Rainforest initial query: ${initial.length} books`);
  } catch (e: any) {
    console.log(`[amazon-search] Rainforest initial query failed: ${e.message}`);
  }

  if (initial.length >= 5) {
    return deduplicateBooks(initial);
  }

  // Step 2 — run expansion queries in parallel until we have enough
  const expansionQueries = EXPANSION_SUFFIXES.map(s => `${query}${s}`);
  console.log(`[amazon-search] Only ${initial.length} books — running ${expansionQueries.length} expansion queries`);

  const settled = await Promise.allSettled(
    expansionQueries.map(async (eq) => {
      try {
        const books = await searchAmazonBooks(eq, {
          amazonDomain: domain,
          sortBy: "bestseller_rankings",
          maxResults: 10
        });
        return books.map(b => ({ ...b, source_provider: "rainforest" }));
      } catch {
        return [] as any[];
      }
    })
  );

  const allBooks: any[] = [...initial];
  for (const r of settled) {
    if (r.status === "fulfilled") allBooks.push(...(r.value as any[]));
  }

  const deduped = deduplicateBooks(allBooks);
  console.log(`[amazon-search] After expansion + dedup: ${deduped.length} books`);
  return deduped;
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
  const data = await res.json() as any;

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
// Priority: Rainforest (+ expansion) → Scale SERP supplement → AI research → Open Library

router.post("/amazon-search", async (req, res) => {
  const { query, amazonDomain } = req.body || {};
  const q = typeof query === "string" ? query.trim() : "";
  if (!q) return res.status(400).json({ error: "Search query is required." });

  const domain  = (amazonDomain || "amazon.com").replace(/^www\./, "");
  const qWords  = normalizeStr(q).split(" ").filter(Boolean);

  let rainforestAttempted = false;
  let scaleSerpAttempted  = false;

  // ── 1. Rainforest with multi-query expansion ────────────────────────────────
  if (process.env.RAINFOREST_API_KEY) {
    rainforestAttempted = true;
    let books: any[] = [];

    try {
      books = await expandedRainforestSearch(q, domain);
    } catch (e: any) {
      console.warn("[amazon-search] Rainforest expansion threw unexpectedly:", e.message);
    }

    // ── 2. Supplement with Scale SERP if still < 5 ─────────────────────────
    if (books.length < 5 && process.env.SCALE_SERP_API_KEY) {
      scaleSerpAttempted = true;
      console.log(`[amazon-search] Rainforest yielded only ${books.length} — supplementing with Scale SERP`);
      try {
        const serpBooks = await searchBooksWithScaleSerp(q, { maxResults: 20 });
        const tagged    = serpBooks.map(b => ({ ...b, source_provider: "scale_serp" }));
        books = deduplicateBooks([...books, ...tagged]);
        console.log(`[amazon-search] After Scale SERP supplement: ${books.length} books`);
      } catch (e: any) {
        console.warn("[amazon-search] Scale SERP supplement failed:", e.message);
      }
    }

    if (books.length > 0) {
      books.sort((a, b) => scoreRelevance(b, qWords) - scoreRelevance(a, qWords));
      const top10 = books.slice(0, 10);
      console.log(`[amazon-search] Returning ${top10.length} books to client`);
      return res.json({ books: top10, query: q, source: "amazon" });
    }
  }

  // ── 3. Scale SERP as sole primary (no Rainforest key) ──────────────────────
  if (!rainforestAttempted && process.env.SCALE_SERP_API_KEY) {
    scaleSerpAttempted = true;
    console.log("[amazon-search] Using Scale SERP as primary (no Rainforest key)");
    try {
      const books  = await searchBooksWithScaleSerp(q, { maxResults: 20 });
      const tagged = books.map(b => ({ ...b, source_provider: "scale_serp" }));
      tagged.sort((a, b) => scoreRelevance(b, qWords) - scoreRelevance(a, qWords));
      console.log("[amazon-search] Scale SERP primary returned:", tagged.length);
      return res.json({ books: tagged.slice(0, 10), query: q, source: "scale_serp" });
    } catch (e: any) {
      console.warn("[amazon-search] Scale SERP primary failed:", e.message);
    }
  }

  // ── 4. AI research (Gemini / Groq) ─────────────────────────────────────────
  console.log("[amazon-search] Provider Used: ai_research");
  try {
    const books = await aiBookSearch(q, 15);
    console.log("[amazon-search] AI returned:", books.length);

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
    console.warn("[amazon-search] AI search error:", e.message);
  }

  // ── 5. Open Library (last resort) ──────────────────────────────────────────
  console.log("[amazon-search] Provider Used: open_library");
  try {
    const books = await openLibrarySearch(q, 20);
    console.log("[amazon-search] Open Library returned:", books.length);
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
