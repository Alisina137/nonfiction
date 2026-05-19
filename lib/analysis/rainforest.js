import { extractAsinFromAmazonUrl } from "@/lib/analysis/asin";

function cleanAmazonUrl(asin, domain) {
  const d = domain || "amazon.com";
  return `https://www.${d.replace(/^www\./, "")}/dp/${asin}`;
}

/**
 * Map Rainforest type=search search_results[] to app book rows (pre-id).
 */
export function normalizeSearchResultsForApp(data) {
  const results = Array.isArray(data.search_results) ? data.search_results : [];
  return results
    .filter((r) => r && r.asin && r.title)
    .map((r) => {
      const asin = String(r.asin).toUpperCase();
      const domain = data.request_parameters?.amazon_domain || "amazon.com";
      return {
        asin,
        title: r.title,
        url: cleanAmazonUrl(asin, domain),
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
}

/**
 * Merge product=detail payload into book-shaped fields for UI/API.
 */
export function normalizeProductForApp(payload) {
  const p = payload?.product || payload;
  if (!p) return null;

  const authors =
    Array.isArray(p.authors) && p.authors.length
      ? p.authors
          .map((a) => (typeof a === "string" ? a : a.name || a.role || "").trim())
          .filter(Boolean)
          .join(", ")
      : typeof p.book_author === "string"
        ? p.book_author
        : typeof p.book_author?.name === "string"
          ? p.book_author.name
          : null;

  let bestsellersRanks = null;
  let bestsellersRankFlat = typeof p.bestsellers_rank_flat === "string" ? p.bestsellers_rank_flat : null;
  if (Array.isArray(p.bestsellers_rank) && p.bestsellers_rank.length) {
    bestsellersRanks = p.bestsellers_rank.map((row) => ({
      category: row.category,
      rank: row.rank,
      link: row.link || null
    }));
    bestsellersRankFlat ||= p.bestsellers_rank
      .map((row) => (row.rank != null && row.category ? `#${row.rank} in ${row.category}` : null))
      .filter(Boolean)
      .join(" · ");
  }

  return {
    title: typeof p.title === "string" ? p.title : null,
    subtitle: typeof p.sub_title === "string" ? p.sub_title : typeof p.title_excluding_series === "string" ? p.title_excluding_series : null,
    authors,
    thumbnail: typeof p.main_image?.link === "string" ? p.main_image.link : typeof p.main_image?.url === "string" ? p.main_image.url : null,
    rating: typeof p.rating === "number" ? p.rating : null,
    ratingsTotal: typeof p.ratings_total === "number" ? p.ratings_total : null,
    bestsellersRankFlat,
    bestsellersRanks,
    publicationDate: p.publication_date || p.first_available?.raw || null,
    expandedDetailsLoaded: true
  };
}

export async function rainforestApiGet(apiKey, paramsObject) {
  const url = new URL("https://api.rainforestapi.com/request");
  Object.entries(paramsObject).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.append(k, String(v));
  });
  url.searchParams.set("api_key", apiKey);
  const res = await fetch(url.toString(), { method: "GET" });
  return res.json();
}

export async function rainforestSearchBooks(apiKey, { searchTerm, amazonDomain }) {
  return rainforestApiGet(apiKey, {
    type: "search",
    amazon_domain: amazonDomain || "amazon.com",
    search_term: searchTerm,
    sort_by: "bestseller_rankings",
    number_of_results: 24,
    exclude_sponsored: true
  });
}

export async function rainforestProductDetails(apiKey, { asin, amazonDomain }) {
  return rainforestApiGet(apiKey, {
    type: "product",
    amazon_domain: amazonDomain || "amazon.com",
    asin: asin.toUpperCase()
  });
}

export function parseAsinFromBody(body) {
  const raw = body?.asin || body?.url;
  if (!raw) return null;
  if (typeof raw === "string" && /^[A-Z0-9]{10}$/i.test(raw.trim())) return raw.trim().toUpperCase();
  return extractAsinFromAmazonUrl(raw);
}
