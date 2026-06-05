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

async function scaleSerpApiGet(apiKey: string, paramsObject: Record<string, any>) {
  const url = new URL("https://api.scaleserp.com/search");
  Object.entries(paramsObject).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.append(k, String(v));
  });
  url.searchParams.set("api_key", apiKey);
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Scale SERP API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function normalizeScaleSerpSearchResults(data: any, amazonDomain: string) {
  const results: any[] = Array.isArray(data.amazon_results) ? data.amazon_results : [];
  return results
    .filter((r: any) => r && r.asin && r.title)
    .map((r: any) => {
      const asin = String(r.asin).toUpperCase();
      const domain = amazonDomain.replace(/^www\./, "");
      return {
        asin,
        title: r.title,
        url: `https://www.${domain}/dp/${asin}`,
        thumbnail: r.image || r.thumbnail || null,
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
        source_provider: "scale_serp"
      };
    });
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

  // ── 1. Rainforest API ──────────────────────────────────────────────────
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
        const errMsg = data.error?.message || data.error || "Rainforest API returned an error.";
        console.error("[amazon-search] Rainforest error:", errMsg);
        // Fall through to Scale SERP if key is set, otherwise return error
        if (!scaleSerpKey && !apifyKey) {
          return res.status(502).json({ error: errMsg });
        }
      } else {
        const results = Array.isArray(data.search_results) ? data.search_results : [];
        const books = results
          .filter((r: any) => r && r.asin && r.title)
          .map((r: any) => {
            const asin = String(r.asin).toUpperCase();
            const domain = data.request_parameters?.amazon_domain || "amazon.com";
            return {
              asin,
              title: r.title,
              url: `https://www.${domain.replace(/^www\./, "")}/dp/${asin}`,
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
      console.error("[amazon-search] Rainforest fetch error:", e.message);
      if (!scaleSerpKey && !apifyKey) {
        return res.status(500).json({ error: e.message || "Amazon search failed." });
      }
    }
  }

  // ── 2. Scale SERP ─────────────────────────────────────────────────────
  if (scaleSerpKey) {
    try {
      const data = await scaleSerpApiGet(scaleSerpKey, {
        search_type: "amazon",
        amazon_domain: amazonDomain || "amazon.com",
        q,
        amazon_search_type: "books",
        sort_by: "featured",
        num: 24
      });

      if (data.request_info && data.request_info.success === false) {
        const errMsg = data.error?.message || data.error || "Scale SERP API returned an error.";
        console.error("[amazon-search] Scale SERP error:", errMsg);
        if (!apifyKey) return res.status(502).json({ error: errMsg });
      } else {
        const books = normalizeScaleSerpSearchResults(data, amazonDomain || "amazon.com");
        return res.json({ books, query: q, source: "scale_serp" });
      }
    } catch (e: any) {
      console.error("[amazon-search] Scale SERP fetch error:", e.message);
      if (!apifyKey) {
        return res.status(500).json({ error: e.message || "Amazon search failed." });
      }
    }
  }

  // ── 3. Apify ──────────────────────────────────────────────────────────
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
      return res.status(500).json({ error: e.message || "Apify search failed." });
    }
  }

  // ── 4. Open Library fallback ──────────────────────────────────────────
  try {
    const books = await openLibrarySearch(q, 20);
    return res.json({
      books,
      query: q,
      source: "open_library",
      notice: "Results from Open Library. Add RAINFOREST_API_KEY or SCALE_SERP_API_KEY to search Amazon directly."
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Book search failed." });
  }
});

// ─── POST /amazon-product ─────────────────────────────────────────────────

router.post("/amazon-product", async (req, res) => {
  const rainforestKey = process.env.RAINFOREST_API_KEY;
  const scaleSerpKey  = process.env.SCALE_SERP_API_KEY;
  const apifyKey      = process.env.APIFY_API_KEY;
  const { amazonDomain } = req.body || {};
  const asin = parseAsinFromBody(req.body);

  if (!asin) return res.status(400).json({ error: "Valid Amazon product URL or ASIN is required." });

  // ── 1. Rainforest API ──────────────────────────────────────────────────
  if (rainforestKey) {
    try {
      const data = await rainforestApiGet(rainforestKey, {
        type: "product",
        amazon_domain: amazonDomain || "amazon.com",
        asin: asin.toUpperCase()
      });

      if (data.request_info && data.request_info.success === false) {
        const errMsg = data.error?.message || data.error || "Product lookup failed.";
        console.error("[amazon-product] Rainforest error:", errMsg);
        if (!scaleSerpKey && !apifyKey) return res.status(502).json({ error: errMsg });
      } else {
        const p = data?.product || data;
        if (!p) {
          if (!scaleSerpKey && !apifyKey) return res.status(502).json({ error: "Unexpected product response." });
        } else {
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

          const details = {
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
          };
          return res.json({ details, asin });
        }
      }
    } catch (e: any) {
      console.error("[amazon-product] Rainforest fetch error:", e.message);
      if (!scaleSerpKey && !apifyKey) {
        return res.status(500).json({ error: e.message || "Product lookup failed." });
      }
    }
  }

  // ── 2. Scale SERP ─────────────────────────────────────────────────────
  if (scaleSerpKey) {
    try {
      const data = await scaleSerpApiGet(scaleSerpKey, {
        search_type: "amazon_product",
        amazon_domain: amazonDomain || "amazon.com",
        asin: asin.toUpperCase()
      });

      if (data.request_info && data.request_info.success === false) {
        const errMsg = data.error?.message || data.error || "Scale SERP product lookup failed.";
        console.error("[amazon-product] Scale SERP error:", errMsg);
        if (!apifyKey) return res.status(502).json({ error: errMsg });
      } else {
        const s = data?.summary || data?.product || {};
        const authors =
          typeof s.author === "string" ? s.author :
          Array.isArray(s.authors) ? s.authors.map((a: any) => (typeof a === "string" ? a : a.name || "")).filter(Boolean).join(", ") :
          null;

        let bestsellersRanks: any = null;
        let bestsellersRankFlat: string | null = null;
        if (Array.isArray(s.bestsellers_rank) && s.bestsellers_rank.length) {
          bestsellersRanks = s.bestsellers_rank.map((r: any) => ({
            category: r.category || r.name || "",
            rank: r.rank,
            link: r.link || null
          }));
          bestsellersRankFlat = bestsellersRanks
            .map((r: any) => (r.rank != null && r.category ? `#${r.rank} in ${r.category}` : null))
            .filter(Boolean)
            .join(" · ") || null;
        } else if (typeof s.bestsellers_rank_flat === "string") {
          bestsellersRankFlat = s.bestsellers_rank_flat;
        }

        const details = {
          title: s.title || null,
          subtitle: s.sub_title || s.subtitle || null,
          authors,
          thumbnail: s.main_image?.link || s.image || s.thumbnail || null,
          rating: typeof s.rating === "number" ? s.rating : null,
          ratingsTotal: typeof s.ratings_total === "number" ? s.ratings_total : null,
          bestsellersRankFlat,
          bestsellersRanks,
          publicationDate: s.publication_date || s.first_available?.raw || null,
          expandedDetailsLoaded: true
        };
        return res.json({ details, asin });
      }
    } catch (e: any) {
      console.error("[amazon-product] Scale SERP fetch error:", e.message);
      if (!apifyKey) {
        return res.status(500).json({ error: e.message || "Product lookup failed." });
      }
    }
  }

  // ── 3. Apify ──────────────────────────────────────────────────────────
  if (apifyKey) {
    try {
      const detail = await amazonProductDetail(apifyKey, { asin, amazonDomain: amazonDomain || "amazon.com" });
      return res.json({ details: detail, asin });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Apify product lookup failed." });
    }
  }

  // ── 4. No key configured ──────────────────────────────────────────────
  return res.json({
    needsApiKey: true,
    details: null,
    message: "Add RAINFOREST_API_KEY or SCALE_SERP_API_KEY to load ratings and bestseller rank from Amazon."
  });
});

export default router;
