/**
 * Rainforest API — centralized Amazon data service.
 *
 * All Amazon-related routes must use this module.
 * No component or route should call Rainforest directly.
 *
 * Exports:
 *   searchAmazonBooks   — keyword search, returns normalized book rows
 *   getBookByAsin       — single product lookup by ASIN
 *   getBestsellerBooks  — search sorted by bestseller rank
 *   getCompetitorBooks  — alias for getBestsellerBooks
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RainforestBookRow {
  asin:                 string;
  title:                string;
  subtitle:             string | null;
  authors:              string | null;
  url:                  string;
  thumbnail:            string | null;
  rating:               number | null;
  ratingsTotal:         number | null;
  recentSales:          string | null;
  sponsored:            boolean;
  bestsellerBadge:      any;
  bestsellersRankFlat:  string | null;
  bestsellersRanks:     Array<{ category: string; rank: number; link: string | null }> | null;
  publicationDate:      string | null;
  price:                string | null;
  expandedDetailsLoaded: boolean;
}

export interface RainforestProductDetail {
  title:               string | null;
  subtitle:            string | null;
  authors:             string | null;
  thumbnail:           string | null;
  rating:              number | null;
  ratingsTotal:        number | null;
  bestsellersRankFlat: string | null;
  bestsellersRanks:    Array<{ category: string; rank: number; link: string | null }> | null;
  publicationDate:     string | null;
  price:               string | null;
  expandedDetailsLoaded: true;
}

export interface SearchOptions {
  amazonDomain?: string;
  maxResults?:   number;
  sortBy?:       "bestseller_rankings" | "featured" | "average_review" | "price_low_to_high";
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function apiKey(): string {
  const key = process.env.RAINFOREST_API_KEY;
  if (!key) throw new RainforestError("Rainforest API key is missing. Add RAINFOREST_API_KEY to your environment secrets.", "MISSING_KEY");
  return key;
}

function cleanDomain(domain?: string): string {
  return (domain || "amazon.com").replace(/^www\./, "");
}

function canonicalUrl(asin: string, domain: string): string {
  return `https://www.${domain}/dp/${asin}`;
}

/**
 * Low-level GET to Rainforest. Throws typed RainforestError on all failure modes.
 */
async function rfGet(params: Record<string, string | number | boolean>): Promise<any> {
  const key = apiKey();
  const url = new URL("https://api.rainforestapi.com/request");
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.append(k, String(v));
  });
  url.searchParams.set("api_key", key);

  console.log("[Rainforest] URL:", url.toString().replace(/api_key=[^&]+/, "api_key=***"));
  const t0 = Date.now();

  let res: Response;
  try {
    res = await fetch(url.toString(), { method: "GET" });
  } catch (networkErr: any) {
    throw new RainforestError(`Rainforest request failed: ${networkErr.message}`, "NETWORK");
  }

  const elapsed = Date.now() - t0;
  console.log(`[Rainforest] Status: ${res.status} (${elapsed}ms)`);

  const raw = await res.text();
  let data: any;
  try { data = JSON.parse(raw); } catch { data = null; }

  if (res.status === 429) {
    throw new RainforestError("Rainforest rate limit reached. Please try again later.", "RATE_LIMIT");
  }
  if (res.status === 402) {
    throw new RainforestError("Rainforest request failed: account suspended or quota exceeded.", "ACCOUNT");
  }
  if (!res.ok) {
    const msg = data?.request_info?.message || data?.error?.message || data?.message || `HTTP ${res.status}`;
    throw new RainforestError(`Rainforest request failed: ${msg}`, "API_ERROR");
  }

  if (data?.request_info?.success === false) {
    const msg = data?.request_info?.message || data?.error?.message || data?.error || "Request rejected";
    throw new RainforestError(`Rainforest request failed: ${msg}`, "API_ERROR");
  }

  return data;
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeSearchResults(data: any, domain: string): RainforestBookRow[] {
  const results: any[] = Array.isArray(data.search_results) ? data.search_results : [];
  const domainClean = data.request_parameters?.amazon_domain || domain;
  return results
    .filter((r) => r?.asin && r?.title)
    .map((r) => ({
      asin:                 String(r.asin).toUpperCase(),
      title:                r.title,
      subtitle:             null,
      authors:              null,
      url:                  canonicalUrl(String(r.asin).toUpperCase(), domainClean),
      thumbnail:            r.image || null,
      rating:               typeof r.rating === "number" ? r.rating : null,
      ratingsTotal:         typeof r.ratings_total === "number" ? r.ratings_total : null,
      recentSales:          r.recent_sales || null,
      sponsored:            Boolean(r.sponsored),
      bestsellerBadge:      r.bestseller || null,
      bestsellersRankFlat:  null,
      bestsellersRanks:     null,
      publicationDate:      null,
      price:                r.price?.raw || null,
      expandedDetailsLoaded: false
    }));
}

function normalizeProductDetail(data: any): RainforestProductDetail {
  const p = data?.product || data;

  const authors =
    Array.isArray(p.authors) && p.authors.length
      ? p.authors
          .map((a: any) => (typeof a === "string" ? a : a?.name || a?.role || "").trim())
          .filter(Boolean)
          .join(", ")
      : typeof p.book_author === "string"
        ? p.book_author
        : typeof p.book_author?.name === "string"
          ? p.book_author.name
          : null;

  let bestsellersRankFlat: string | null = typeof p.bestsellers_rank_flat === "string" ? p.bestsellers_rank_flat : null;
  let bestsellersRanks: RainforestProductDetail["bestsellersRanks"] = null;
  if (Array.isArray(p.bestsellers_rank) && p.bestsellers_rank.length) {
    bestsellersRanks = p.bestsellers_rank
      .filter((r: any) => r.rank != null && r.category)
      .map((r: any) => ({ category: r.category, rank: r.rank, link: r.link || null }));
    bestsellersRankFlat ||= bestsellersRanks!
      .map((r) => `#${r.rank} in ${r.category}`)
      .join(" · ") || null;
  }

  return {
    title:               typeof p.title === "string" ? p.title : null,
    subtitle:            typeof p.sub_title === "string" ? p.sub_title
                         : typeof p.title_excluding_series === "string" ? p.title_excluding_series
                         : null,
    authors,
    thumbnail:           typeof p.main_image?.link === "string" ? p.main_image.link
                         : typeof p.main_image?.url === "string" ? p.main_image.url
                         : null,
    rating:              typeof p.rating === "number" ? p.rating : null,
    ratingsTotal:        typeof p.ratings_total === "number" ? p.ratings_total : null,
    bestsellersRankFlat,
    bestsellersRanks,
    publicationDate:     p.publication_date || p.first_available?.raw || null,
    price:               p.buybox_winner?.price?.raw || p.price?.raw || null,
    expandedDetailsLoaded: true
  };
}

// ─── Error class ─────────────────────────────────────────────────────────────

export class RainforestError extends Error {
  constructor(
    message: string,
    public readonly code: "MISSING_KEY" | "RATE_LIMIT" | "ACCOUNT" | "API_ERROR" | "NO_RESULTS" | "NETWORK"
  ) {
    super(message);
    this.name = "RainforestError";
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search Amazon books by keyword.
 * Returns an empty array if no books found (not an error).
 */
export async function searchAmazonBooks(
  query: string,
  opts: SearchOptions = {}
): Promise<RainforestBookRow[]> {
  const domain = cleanDomain(opts.amazonDomain);
  console.log("[Rainforest] Amazon Query:", query);

  const data = await rfGet({
    type:             "search",
    amazon_domain:    domain,
    search_term:      query,
    sort_by:          opts.sortBy || "featured",
    number_of_results: opts.maxResults ?? 24,
    exclude_sponsored: true
  });

  const books = normalizeSearchResults(data, domain);
  console.log("[Rainforest] Books Found:", books.length, "| ASINs:", books.map((b) => b.asin).join(", "));

  if (books.length === 0) {
    throw new RainforestError(
      "No competitor books found. Try a broader search term.",
      "NO_RESULTS"
    );
  }

  return books;
}

/**
 * Search sorted by bestseller rank — best for competitor discovery.
 */
export async function getBestsellerBooks(
  query: string,
  opts: SearchOptions = {}
): Promise<RainforestBookRow[]> {
  return searchAmazonBooks(query, { ...opts, sortBy: "bestseller_rankings" });
}

/**
 * Alias for getBestsellerBooks — semantically clearer in routes.
 */
export const getCompetitorBooks = getBestsellerBooks;

/**
 * Fetch full product details for a single ASIN.
 * Throws RainforestError if product not found or API fails.
 */
export async function getBookByAsin(
  asin: string,
  opts: { amazonDomain?: string } = {}
): Promise<RainforestProductDetail> {
  const domain = cleanDomain(opts.amazonDomain);
  const upperAsin = asin.toUpperCase();
  console.log("[Rainforest] Fetching ASIN:", upperAsin, "| Domain:", domain);

  const data = await rfGet({
    type:          "product",
    amazon_domain: domain,
    asin:          upperAsin
  });

  const detail = normalizeProductDetail(data);
  console.log("[Rainforest] Product:", detail.title, "| Rating:", detail.rating, "| Reviews:", detail.ratingsTotal);
  return detail;
}
