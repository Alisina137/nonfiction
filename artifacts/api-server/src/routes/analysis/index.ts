import { Router } from "express";
import { amazonResearchService, amazonProductDetail } from "../../services/amazonResearchService";

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
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Rainforest API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Run a single Scale SERP Google query and extract Amazon /dp/ ASINs.
 */
async function scaleSerpOneQuery(
  apiKey: string,
  q: string,
  domain: string
): Promise<any[]> {
  const url = new URL("https://api.scaleserp.com/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("q", q);
  url.searchParams.set("num", "40");
  url.searchParams.set("gl", "us");
  url.searchParams.set("hl", "en");

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  if (!data || data.request_info?.success === false) return [];

  const organic: any[] = Array.isArray(data.organic_results) ? data.organic_results : [];
  const books: any[] = [];
  for (const result of organic) {
    const link: string = result.link || result.url || "";
    const asinMatch = link.match(/\/dp\/([A-Z0-9]{10})/i);
    if (!asinMatch) continue;
    const asin = asinMatch[1].toUpperCase();
    if (books.some((b) => b.asin === asin)) continue;
    books.push({
      asin,
      title: result.title || "Unknown title",
      url: `https://www.${domain}/dp/${asin}`,
      thumbnail: result.thumbnail || result.image || null,
      rating: null,
      ratingsTotal: null,
      recentSales: null,
      sponsored: false,
      bestsellerBadge: null,
      subtitle: null,
      authors: null,
      bestsellersRankFlat: null,
      bestsellersRanks: null,
      expandedDetailsLoaded: false,
      source_provider: "scale_serp"
    });
  }
  return books;
}

/**
 * Scale SERP: run 4 parallel Google queries targeting site:amazon.com,
 * merge unique ASINs, return up to maxResults books.
 */
async function scaleSerpSearchBooks(
  apiKey: string,
  { query, amazonDomain = "amazon.com", maxResults = 20 }: { query: string; amazonDomain?: string; maxResults?: number }
): Promise<any[]> {
  const domain = amazonDomain.replace(/^www\./, "");
  // Four query formulations that each hit different Google result sets
  const queries = [
    `site:${domain} ${query} book`,
    `site:${domain} ${query} books bestseller`,
    `site:${domain} ${query} books paperback`,
    `site:${domain} ${query} books top rated review`,
  ];

  const allResults = await Promise.all(
    queries.map((q) => scaleSerpOneQuery(apiKey, q, domain).catch(() => []))
  );

  // Merge, deduplicate by ASIN
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const batch of allResults) {
    for (const book of batch) {
      if (!seen.has(book.asin)) {
        seen.add(book.asin);
        merged.push(book);
        if (merged.length >= maxResults) return merged;
      }
    }
  }
  return merged;
}

async function openLibrarySearch(query: string, maxResults = 20): Promise<any[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "key,title,subtitle,author_name,cover_i,ratings_average,ratings_count,first_publish_year,subject");
  url.searchParams.set("limit", String(Math.min(maxResults, 40)));
  url.searchParams.set("sort", "rating");
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

// ─── POST /amazon-search ──────────────────────────────────────────────────

router.post("/amazon-search", async (req, res) => {
  const rainforestKey = process.env.RAINFOREST_API_KEY;
  const scaleSerpKey  = process.env.SCALE_SERP_API_KEY;
  const apifyKey      = process.env.APIFY_API_KEY;
  const { query, amazonDomain } = req.body || {};
  const q = typeof query === "string" ? query.trim() : "";

  if (!q) return res.status(400).json({ error: "Search query is required." });

  // ── 1. Rainforest API ────────────────────────────────────────────────
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

      if (data.request_info && data.request_info.success === false) {
        console.warn("[amazon-search] Rainforest not available:", data.request_info.message?.slice(0, 100));
        // fall through to next provider
      } else {
        const results = Array.isArray(data.search_results) ? data.search_results : [];
        const books = results
          .filter((r: any) => r && r.asin && r.title)
          .map((r: any) => {
            const asin = String(r.asin).toUpperCase();
            const domain = (data.request_parameters?.amazon_domain || "amazon.com").replace(/^www\./, "");
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
              expandedDetailsLoaded: false,
              source_provider: "rainforest"
            };
          });
        return res.json({ books, query: q, source: "rainforest" });
      }
    } catch (e: any) {
      console.warn("[amazon-search] Rainforest error:", e.message);
    }
  }

  // ── 2. Scale SERP (4 parallel Google queries → Amazon /dp/ ASINs) ────
  if (scaleSerpKey) {
    try {
      const amazonBooks = await scaleSerpSearchBooks(scaleSerpKey, {
        query: q,
        amazonDomain: amazonDomain || "amazon.com",
        maxResults: 20
      });

      const MIN_BOOKS = 12;
      const TARGET = 20;

      if (amazonBooks.length >= MIN_BOOKS) {
        return res.json({ books: amazonBooks.slice(0, TARGET), query: q, source: "scale_serp" });
      }

      // Not enough Amazon results — top up with Open Library
      const needed = TARGET - amazonBooks.length;
      let supplement: any[] = [];
      try {
        const libBooks = await openLibrarySearch(q, needed + 5);
        // Exclude any Open Library books that share a title with an Amazon result
        const amazonTitles = new Set(amazonBooks.map((b) => b.title.toLowerCase().slice(0, 30)));
        supplement = libBooks
          .filter((b) => !amazonTitles.has(b.title.toLowerCase().slice(0, 30)))
          .slice(0, needed);
      } catch { /* open library optional */ }

      const combined = [...amazonBooks, ...supplement];
      if (combined.length > 0) {
        return res.json({ books: combined.slice(0, TARGET), query: q, source: "scale_serp" });
      }
      console.warn("[amazon-search] Scale SERP + Open Library returned 0 results, falling through");
    } catch (e: any) {
      console.warn("[amazon-search] Scale SERP error:", e.message);
    }
  }

  // ── 3. Apify ─────────────────────────────────────────────────────────
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
        expandedDetailsLoaded: false,
        source_provider: "apify"
      }));
      return res.json({ books, query: q, source: "apify" });
    } catch (e: any) {
      console.warn("[amazon-search] Apify error:", e.message);
    }
  }

  // ── 4. Open Library fallback ─────────────────────────────────────────
  try {
    const books = await openLibrarySearch(q, 20);
    return res.json({
      books,
      query: q,
      source: "open_library",
      notice: "Showing Open Library results. Add a working RAINFOREST_API_KEY or SCALE_SERP_API_KEY to search Amazon directly."
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Book search failed." });
  }
});

// ─── POST /amazon-product ─────────────────────────────────────────────────

router.post("/amazon-product", async (req, res) => {
  const rainforestKey = process.env.RAINFOREST_API_KEY;
  const apifyKey      = process.env.APIFY_API_KEY;
  const { amazonDomain } = req.body || {};
  const asin = parseAsinFromBody(req.body);

  if (!asin) return res.status(400).json({ error: "Valid Amazon product URL or ASIN is required." });

  // ── 1. Rainforest API ────────────────────────────────────────────────
  if (rainforestKey) {
    try {
      const data = await rainforestApiGet(rainforestKey, {
        type: "product",
        amazon_domain: amazonDomain || "amazon.com",
        asin: asin.toUpperCase()
      });

      if (data.request_info && data.request_info.success === false) {
        console.warn("[amazon-product] Rainforest not available:", data.request_info.message?.slice(0, 100));
      } else {
        const p = data?.product || data;
        if (p) {
          const authors =
            Array.isArray(p.authors) && p.authors.length
              ? p.authors.map((a: any) => (typeof a === "string" ? a : a.name || a.role || "").trim()).filter(Boolean).join(", ")
              : typeof p.book_author === "string" ? p.book_author : null;

          let bestsellersRankFlat = typeof p.bestsellers_rank_flat === "string" ? p.bestsellers_rank_flat : null;
          let bestsellersRanks = null;
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
      }
    } catch (e: any) {
      console.warn("[amazon-product] Rainforest error:", e.message);
    }
  }

  // ── 2. Apify ─────────────────────────────────────────────────────────
  if (apifyKey) {
    try {
      const detail = await amazonProductDetail(apifyKey, { asin, amazonDomain: amazonDomain || "amazon.com" });
      return res.json({ details: detail, asin });
    } catch (e: any) {
      console.warn("[amazon-product] Apify error:", e.message);
    }
  }

  // ── 3. No working key ────────────────────────────────────────────────
  return res.json({
    needsApiKey: true,
    details: null,
    message: "Add a working RAINFOREST_API_KEY to load ratings and bestseller rank from Amazon."
  });
});

export default router;
