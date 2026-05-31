import { Router } from "express";

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
  const data = await res.json();
  if (data?.request_info?.success === false) {
    const msg = data.request_info?.message || data.request_info?.credits_used != null
      ? `Rainforest API error: ${data.request_info?.message || "request failed"}`
      : "Rainforest API request failed";
    throw Object.assign(new Error(msg), { rainforestError: true });
  }
  return data;
}

router.post("/amazon-search", async (req, res) => {
  const apiKey = process.env.RAINFOREST_API_KEY;
  const { query, amazonDomain } = req.body || {};
  const q = typeof query === "string" ? query.trim() : "";

  if (!q) return res.status(400).json({ error: "Search query is required." });

  if (!apiKey) {
    return res.json({
      needsApiKey: true,
      books: [],
      message: "Live Amazon search is disabled. Add RAINFOREST_API_KEY to enable search. You can still add reference URLs manually."
    });
  }

  try {
    const data = await rainforestApiGet(apiKey, {
      type: "search",
      amazon_domain: amazonDomain || "amazon.com",
      search_term: q,
      sort_by: "bestseller_rankings",
      number_of_results: 24,
      exclude_sponsored: true
    });

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
          expandedDetailsLoaded: false
        };
      });

    return res.json({ books, query: q });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Amazon search failed." });
  }
});

router.post("/amazon-product", async (req, res) => {
  const apiKey = process.env.RAINFOREST_API_KEY;
  const { amazonDomain } = req.body || {};
  const asin = parseAsinFromBody(req.body);

  if (!asin) return res.status(400).json({ error: "Valid Amazon product URL or ASIN is required." });

  if (!apiKey) {
    return res.json({
      needsApiKey: true,
      details: null,
      message: "Add RAINFOREST_API_KEY to load ratings and bestseller rank from Amazon."
    });
  }

  try {
    const data = await rainforestApiGet(apiKey, {
      type: "product",
      amazon_domain: amazonDomain || "amazon.com",
      asin: asin.toUpperCase()
    });

    const p = data?.product || data;
    if (!p) return res.status(502).json({ error: "Unexpected product response." });

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
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Product lookup failed." });
  }
});

export default router;
