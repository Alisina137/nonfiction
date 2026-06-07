import { Router } from "express";
import { amazonResearchService, amazonProductDetail } from "../../services/amazonResearchService";
import { generateContent, extractJSON } from "../ai/aiRouter";

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

async function rainforestApiGet(apiKey: string, paramsObject: Record<string, any>) {
  const url = new URL("https://api.rainforestapi.com/request");
  Object.entries(paramsObject).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.append(k, String(v));
  });
  url.searchParams.set("api_key", apiKey);
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error(`Rainforest HTTP ${res.status}`);
  return res.json();
}

/**
 * AI-powered book search — asks the AI to list real bestselling books
 * in the given niche/topic. Uses existing provider keys (Gemini/Groq/etc.).
 * Falls through on failure.
 */
async function aiBookSearch(query: string, maxResults = 15): Promise<any[]> {
  const prompt = `You are a publishing market researcher. List ${maxResults} real bestselling nonfiction books relevant to: "${query}"

Respond with ONLY a valid JSON array (no markdown, no explanation). Each item:
{"title":"...","authors":"...","subtitle":"...or null","rating":4.5,"ratingsTotal":12000,"publicationDate":"2020","publisher":"...or null","description":"1-2 sentences or null","asin":"10-char or null"}

Requirements:
- Real books that exist on Amazon
- Most popular/bestselling first
- Do NOT wrap in an object — return a raw array starting with [`;

  const result = await generateContent(prompt, undefined, {
    maxTokens: 4000
  });

  let parsed: any;
  try {
    parsed = extractJSON(result.text);
  } catch (e: any) {
    throw new Error(`AI JSON parse failed: ${e.message}`);
  }

  // Handle both bare array and {books:[...]} wrapper
  let arr: any[] = [];
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && Array.isArray(parsed.books)) {
    arr = parsed.books;
  } else if (parsed && Array.isArray(parsed.results)) {
    arr = parsed.results;
  } else {
    throw new Error("AI response was not an array");
  }

  const validBooks = arr
    .filter((b: any) => b && typeof b.title === "string" && b.title.trim())
    .slice(0, maxResults);

  if (validBooks.length === 0) throw new Error("AI returned no valid books");

  return validBooks.map((b: any) => {
    const rawAsin = typeof b.asin === "string" ? b.asin.trim().toUpperCase() : null;
    const asin = rawAsin && /^[A-Z0-9]{10}$/.test(rawAsin) ? rawAsin : null;
    return {
      asin,
      title: b.title.trim(),
      subtitle: b.subtitle && b.subtitle !== "null" ? b.subtitle : null,
      authors: b.authors || null,
      url: asin
        ? `https://www.amazon.com/dp/${asin}`
        : `https://www.amazon.com/s?k=${encodeURIComponent(b.title.trim())}`,
      thumbnail: null,
      rating: typeof b.rating === "number" && b.rating > 0 ? b.rating : null,
      ratingsTotal: typeof b.ratingsTotal === "number" && b.ratingsTotal > 0 ? b.ratingsTotal : null,
      recentSales: null,
      sponsored: false,
      bestsellerBadge: null,
      bestsellersRankFlat: null,
      bestsellersRanks: null,
      expandedDetailsLoaded: false,
      pageCount: typeof b.pageCount === "number" ? b.pageCount : null,
      publisher: b.publisher && b.publisher !== "null" ? b.publisher : null,
      publicationDate: b.publicationDate && b.publicationDate !== "null" ? b.publicationDate : null,
      description: b.description && b.description !== "null" ? b.description : null,
      source_provider: "ai_research"
    };
  });
}

async function openLibrarySearch(query: string, maxResults = 20): Promise<any[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "key,title,subtitle,author_name,cover_i,ratings_average,ratings_count,first_publish_year,publisher");
  url.searchParams.set("limit", String(Math.min(maxResults, 40)));
  url.searchParams.set("language", "eng");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "NonfictionStudio/1.0 (book research tool)" }
  });
  if (!res.ok) throw new Error(`Open Library API error: ${res.status}`);
  const data = await res.json();

  const docs: any[] = Array.isArray(data.docs) ? data.docs : [];
  return docs
    .filter((doc: any) => doc?.title)
    .map((doc: any) => {
      const authors = Array.isArray(doc.author_name) ? doc.author_name.join(", ") : null;
      const coverId = doc.cover_i;
      const thumbnail = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null;
      const key = typeof doc.key === "string" ? doc.key : null;
      const bookUrl = key ? `https://openlibrary.org${key}` : "https://openlibrary.org";
      return {
        asin: null,
        openLibraryKey: key,
        title: doc.title,
        subtitle: doc.subtitle || null,
        authors,
        url: bookUrl,
        thumbnail,
        rating: typeof doc.ratings_average === "number" && doc.ratings_average > 0
          ? Math.round(doc.ratings_average * 10) / 10
          : null,
        ratingsTotal: typeof doc.ratings_count === "number" ? doc.ratings_count : null,
        recentSales: null,
        sponsored: false,
        bestsellerBadge: null,
        bestsellersRankFlat: null,
        bestsellersRanks: null,
        expandedDetailsLoaded: false,
        source_provider: "open_library"
      };
    });
}

router.post("/amazon-search", async (req, res) => {
  const rainforestKey = process.env.RAINFOREST_API_KEY;
  const apifyKey = process.env.APIFY_API_KEY;
  const { query, amazonDomain } = req.body || {};
  const q = typeof query === "string" ? query.trim() : "";

  if (!q) return res.status(400).json({ error: "Search query is required." });

  // ── 1. Rainforest (Amazon direct) ─────────────────────────────────────────
  if (rainforestKey) {
    try {
      const data = await rainforestApiGet(rainforestKey, {
        type: "search",
        amazon_domain: amazonDomain || "amazon.com",
        search_term: q,
        sort_by: "bestseller_rankings",
        number_of_results: 24,
        exclude_sponsored: true
      });

      if (data.request_info?.success === false) {
        console.warn("[amazon-search] Rainforest account error — falling through:", data.error?.message || data.error);
      } else {
        const results: any[] = Array.isArray(data.search_results) ? data.search_results : [];
        const books = results
          .filter((r: any) => r?.asin && r?.title)
          .map((r: any) => {
            const asin = String(r.asin).toUpperCase();
            const domain = (data.request_parameters?.amazon_domain || amazonDomain || "amazon.com").replace(/^www\./, "");
            return {
              asin,
              title: r.title,
              url: `https://www.${domain}/dp/${asin}`,
              thumbnail: r.image || null,
              rating: typeof r.rating === "number" ? r.rating : null,
              ratingsTotal: typeof r.ratings_total === "number" ? r.ratings_total : null,
              recentSales: r.recent_sales || null,
              sponsored: Boolean(r.sponsored),
              bestsellerBadge: r.bestseller || null,
              subtitle: null,
              authors: null,
              bestsellersRankFlat: null,
              bestsellersRanks: null,
              expandedDetailsLoaded: false
            };
          });

        if (books.length > 0) {
          return res.json({ books, query: q });
        }
        console.warn("[amazon-search] Rainforest returned 0 results — falling through.");
      }
    } catch (e: any) {
      console.warn("[amazon-search] Rainforest error — falling through:", e.message);
    }
  }

  // ── 2. Apify (Amazon via scraper) ─────────────────────────────────────────
  if (apifyKey) {
    try {
      const results = await amazonResearchService(apifyKey, {
        topic: q,
        maxResults: 20,
        amazonDomain: amazonDomain || "amazon.com"
      });
      const books = results.map((r) => ({
        asin: r.asin,
        title: r.title,
        authors: r.author || null,
        url: r.amazonUrl,
        thumbnail: r.thumbnail,
        rating: r.rating,
        ratingsTotal: r.reviewCount,
        recentSales: null,
        sponsored: false,
        bestsellerBadge: r.bestsellerBadge ? { category: "" } : null,
        subtitle: null,
        bestsellersRankFlat: null,
        bestsellersRanks: null,
        expandedDetailsLoaded: false
      }));
      if (books.length > 0) {
        return res.json({ books, query: q });
      }
      console.warn("[amazon-search] Apify returned 0 results — falling through.");
    } catch (e: any) {
      console.warn("[amazon-search] Apify error — falling through:", e.message);
    }
  }

  // ── 3. AI-powered competitor research (uses existing Gemini/Groq keys) ────
  try {
    const books = await aiBookSearch(q, 18);
    if (books.length > 0) {
      return res.json({
        books,
        query: q,
        source: "ai_research",
        notice: "Results generated by AI market research. Add RAINFOREST_API_KEY for live Amazon data."
      });
    }
    console.warn("[amazon-search] AI search returned 0 results — falling through.");
  } catch (e: any) {
    console.warn("[amazon-search] AI search error — falling through:", e.message);
  }

  // ── 4. Open Library (last resort) ─────────────────────────────────────────
  try {
    const books = await openLibrarySearch(q, 20);
    return res.json({
      books,
      query: q,
      source: "open_library",
      notice: "Results from Open Library. Add RAINFOREST_API_KEY for live Amazon data."
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Book search failed. Please try again." });
  }
});

router.post("/amazon-product", async (req, res) => {
  const rainforestKey = process.env.RAINFOREST_API_KEY;
  const apifyKey = process.env.APIFY_API_KEY;
  const { amazonDomain } = req.body || {};
  const asin = parseAsinFromBody(req.body);

  if (!asin) return res.status(400).json({ error: "Valid Amazon product URL or ASIN is required." });

  // ── 1. Rainforest ──────────────────────────────────────────────────────────
  if (rainforestKey) {
    try {
      const data = await rainforestApiGet(rainforestKey, {
        type: "product",
        amazon_domain: amazonDomain || "amazon.com",
        asin: asin.toUpperCase()
      });

      if (data.request_info?.success === false) {
        console.warn("[amazon-product] Rainforest account error — falling through:", data.error?.message || data.error);
      } else {
        const p = data?.product || data;
        if (p) {
          const authors =
            Array.isArray(p.authors) && p.authors.length
              ? p.authors.map((a: any) => (typeof a === "string" ? a : a.name || a.role || "").trim()).filter(Boolean).join(", ")
              : typeof p.book_author === "string" ? p.book_author : null;

          let bestsellersRankFlat: string | null = typeof p.bestsellers_rank_flat === "string" ? p.bestsellers_rank_flat : null;
          let bestsellersRanks: any[] | null = null;
          if (Array.isArray(p.bestsellers_rank) && p.bestsellers_rank.length) {
            bestsellersRanks = p.bestsellers_rank.map((row: any) => ({
              category: row.category,
              rank: row.rank,
              link: row.link || null
            }));
            bestsellersRankFlat ||= p.bestsellers_rank
              .map((row: any) => (row.rank != null && row.category ? `#${row.rank} in ${row.category}` : null))
              .filter(Boolean)
              .join(" · ");
          }

          return res.json({
            details: {
              title: typeof p.title === "string" ? p.title : null,
              subtitle: typeof p.sub_title === "string" ? p.sub_title : null,
              authors,
              thumbnail: typeof p.main_image?.link === "string" ? p.main_image.link : null,
              rating: typeof p.rating === "number" ? p.rating : null,
              ratingsTotal: typeof p.ratings_total === "number" ? p.ratings_total : null,
              bestsellersRankFlat,
              bestsellersRanks,
              publicationDate: p.publication_date || p.first_available?.raw || null,
              expandedDetailsLoaded: true
            },
            asin
          });
        }
        console.warn("[amazon-product] Rainforest returned no product — falling through.");
      }
    } catch (e: any) {
      console.warn("[amazon-product] Rainforest error — falling through:", e.message);
    }
  }

  // ── 2. Apify ───────────────────────────────────────────────────────────────
  if (apifyKey) {
    try {
      const detail = await amazonProductDetail(apifyKey, { asin, amazonDomain: amazonDomain || "amazon.com" });
      return res.json({ details: detail, asin });
    } catch (e: any) {
      console.warn("[amazon-product] Apify error — falling through:", e.message);
    }
  }

  // ── No API key available ───────────────────────────────────────────────────
  return res.json({
    needsApiKey: true,
    details: null,
    message: "Add RAINFOREST_API_KEY or APIFY_API_KEY to load Amazon ratings and bestseller rank."
  });
});

export default router;
