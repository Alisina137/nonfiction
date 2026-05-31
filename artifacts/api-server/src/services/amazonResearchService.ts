/**
 * amazonResearchService
 *
 * Replaces all Rainforest API functionality with SerpApi for Amazon book research.
 *
 * SerpApi request flow:
 *   1. Build query: append " books" to topic, restrict to Amazon Books category
 *   2. GET https://serpapi.com/search.json?engine=amazon&k=<query>&category_id=stripbooks&...
 *   3. Parse organic_results[], normalize each to NormalizedBook
 *   4. Sort: bestseller first → highest reviewCount → highest rating
 *   5. Return top maxResults entries
 *
 * For product detail expansion:
 *   GET https://serpapi.com/search.json?engine=amazon_product&asin=<ASIN>&...
 */

// ─── Interfaces ────────────────────────────────────────────────────────────

/** Raw SerpApi Amazon search result item */
export interface SerpApiAmazonResult {
  position?: number;
  asin?: string;
  title?: string;
  link?: string;
  image?: string;
  rating?: number;
  reviews?: number;
  price?: { raw?: string; value?: number; currency?: string };
  is_best_seller?: boolean;
  badge?: string;
  badges?: { best_seller?: boolean; [key: string]: any };
}

/** Raw SerpApi Amazon search response */
export interface SerpApiSearchResponse {
  search_metadata?: { status?: string; id?: string };
  search_parameters?: { engine?: string; k?: string; amazon_domain?: string };
  organic_results?: SerpApiAmazonResult[];
  error?: string;
}

/** Raw SerpApi Amazon product response */
export interface SerpApiProductResponse {
  product_results?: {
    title?: string;
    asin?: string;
    link?: string;
    rating?: number;
    reviews?: number;
    price?: { raw?: string; value?: number };
    thumbnails?: string[];
    main_image?: string;
    authors?: Array<{ name?: string; link?: string }>;
    seller_rank?: Array<{ rank?: number; category?: string; link?: string }>;
    bestsellers_rank?: Array<{ rank?: number; category?: string; link?: string }>;
    publication_date?: string;
    subtitle?: string;
    description?: string;
  };
  error?: string;
}

/** Normalized book result — canonical shape used throughout the app */
export interface NormalizedBook {
  asin: string | null;
  title: string;
  author: string | null;
  rating: number | null;
  reviewCount: number | null;
  price: string | null;
  amazonUrl: string;
  thumbnail: string | null;
  bestsellerBadge: boolean;
  rank: number;
}

/** Expanded product detail shape for the "Expand details" feature */
export interface NormalizedProductDetail {
  title: string | null;
  subtitle: string | null;
  authors: string | null;
  thumbnail: string | null;
  rating: number | null;
  ratingsTotal: number | null;
  bestsellersRankFlat: string | null;
  bestsellersRanks: Array<{ category: string; rank: number; link: string | null }> | null;
  publicationDate: string | null;
  expandedDetailsLoaded: true;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const SERPAPI_BASE = "https://serpapi.com/search.json";

/**
 * Low-level SerpApi GET helper.
 * Appends api_key and all params, fetches, returns parsed JSON.
 * Throws on network failure or explicit API error field.
 */
async function serpApiGet(
  apiKey: string,
  params: Record<string, string>
): Promise<any> {
  const url = new URL(SERPAPI_BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  url.searchParams.set("api_key", apiKey);

  let res: Response;
  try {
    res = await fetch(url.toString(), { method: "GET" });
  } catch (networkErr: any) {
    // Network failure (DNS, timeout, etc.)
    throw Object.assign(
      new Error(`Network failure reaching SerpApi: ${networkErr.message}`),
      { code: "NETWORK_FAILURE" }
    );
  }

  const raw = await res.text();
  let data: any = {};
  try { data = JSON.parse(raw); } catch { /* leave empty */ }

  // Invalid API key
  if (res.status === 401 || res.status === 403) {
    throw Object.assign(
      new Error("Invalid SERPAPI_API_KEY — check your Replit secret"),
      { code: "INVALID_KEY", httpStatus: res.status }
    );
  }

  // Rate limit
  if (res.status === 429) {
    throw Object.assign(
      new Error("SerpApi rate limit reached — try again later"),
      { code: "RATE_LIMIT", httpStatus: 429 }
    );
  }

  // Other HTTP error
  if (!res.ok) {
    const msg = data?.error || `SerpApi request failed (HTTP ${res.status})`;
    throw Object.assign(new Error(msg), { code: "API_FAILURE", httpStatus: res.status });
  }

  // Explicit error field in 200 response
  if (data?.error) {
    throw Object.assign(new Error(`SerpApi error: ${data.error}`), { code: "API_ERROR" });
  }

  return data;
}

/**
 * Mapping logic: convert a raw SerpApi organic_result to NormalizedBook.
 */
function normalizeSearchResult(raw: SerpApiAmazonResult, rank: number): NormalizedBook {
  const asin = typeof raw.asin === "string" ? raw.asin.toUpperCase() : null;
  const domain = "amazon.com";
  const amazonUrl = asin
    ? `https://www.${domain}/dp/${asin}`
    : (raw.link || "");

  const isBestseller =
    raw.is_best_seller === true ||
    raw.badges?.best_seller === true ||
    (typeof raw.badge === "string" && raw.badge.toLowerCase().includes("best seller"));

  return {
    asin,
    title: raw.title || "Unknown title",
    author: null,
    rating: typeof raw.rating === "number" ? raw.rating : null,
    reviewCount: typeof raw.reviews === "number" ? raw.reviews : null,
    price: raw.price?.raw ?? null,
    amazonUrl,
    thumbnail: raw.image ?? null,
    bestsellerBadge: isBestseller,
    rank,
  };
}

// ─── Public: Amazon book search ────────────────────────────────────────────

export interface AmazonResearchOptions {
  topic: string;
  maxResults?: number;
  amazonDomain?: string;
}

/**
 * Main service: search Amazon Books for a topic via SerpApi and return
 * normalized, sorted bestseller data.
 *
 * Sort order: bestseller first → highest reviewCount → highest rating
 */
export async function amazonResearchService(
  apiKey: string,
  { topic, maxResults = 20, amazonDomain = "amazon.com" }: AmazonResearchOptions
): Promise<NormalizedBook[]> {
  if (!topic || !topic.trim()) {
    throw Object.assign(new Error("Search topic is required"), { code: "BAD_INPUT" });
  }

  // Append "books" to improve relevance; SerpApi strips duplicates automatically
  const query = topic.trim().toLowerCase().endsWith("books")
    ? topic.trim()
    : `${topic.trim()} books`;

  console.log(`[amazonResearchService] Searching: "${query}" (domain=${amazonDomain}, max=${maxResults})`);

  const data: SerpApiSearchResponse = await serpApiGet(apiKey, {
    engine:      "amazon",
    k:           query,
    amazon_domain: amazonDomain,
    category_id: "stripbooks", // restrict to Books
  });

  const rawResults = Array.isArray(data.organic_results) ? data.organic_results : [];

  if (rawResults.length === 0) {
    console.warn(`[amazonResearchService] No results returned for "${query}"`);
    return [];
  }

  // Normalize
  const books = rawResults
    .filter((r) => r && r.title)
    .map((r, i) => normalizeSearchResult(r, i + 1));

  // Sort: bestseller → review count → rating
  books.sort((a, b) => {
    if (a.bestsellerBadge !== b.bestsellerBadge) return a.bestsellerBadge ? -1 : 1;
    if ((b.reviewCount ?? 0) !== (a.reviewCount ?? 0)) return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
    return (b.rating ?? 0) - (a.rating ?? 0);
  });

  const result = books.slice(0, maxResults);
  console.log(`[amazonResearchService] Returning ${result.length} results for "${query}"`);
  return result;
}

// ─── Public: Amazon product detail ────────────────────────────────────────

/**
 * Fetch expanded product detail for a single ASIN via SerpApi.
 * Maps to the same shape the "Expand details" UI panel expects.
 */
export async function amazonProductDetail(
  apiKey: string,
  { asin, amazonDomain = "amazon.com" }: { asin: string; amazonDomain?: string }
): Promise<NormalizedProductDetail> {
  console.log(`[amazonResearchService] Fetching product detail for ASIN ${asin}`);

  const data: SerpApiProductResponse = await serpApiGet(apiKey, {
    engine:        "amazon_product",
    asin:          asin.toUpperCase(),
    amazon_domain: amazonDomain,
  });

  const p = data?.product_results;
  if (!p) {
    throw Object.assign(
      new Error(`No product data returned for ASIN ${asin}`),
      { code: "EMPTY_PRODUCT" }
    );
  }

  // Authors
  const authors = Array.isArray(p.authors) && p.authors.length
    ? p.authors.map((a) => a.name || "").filter(Boolean).join(", ")
    : null;

  // Bestseller ranks — try seller_rank then bestsellers_rank
  const rankArray = Array.isArray(p.bestsellers_rank) && p.bestsellers_rank.length
    ? p.bestsellers_rank
    : Array.isArray(p.seller_rank) && (p.seller_rank as any[]).length
      ? (p.seller_rank as any[])
      : null;

  let bestsellersRanks: NormalizedProductDetail["bestsellersRanks"] = null;
  let bestsellersRankFlat: string | null = null;

  if (rankArray) {
    bestsellersRanks = rankArray
      .filter((r: any) => r.rank != null && r.category)
      .map((r: any) => ({ category: r.category, rank: r.rank, link: r.link ?? null }));
    bestsellersRankFlat = bestsellersRanks
      .map((r) => `#${r.rank} in ${r.category}`)
      .join(" · ") || null;
  }

  const thumbnail = Array.isArray(p.thumbnails) && p.thumbnails.length
    ? p.thumbnails[0]
    : (typeof p.main_image === "string" ? p.main_image : null);

  return {
    title:               p.title ?? null,
    subtitle:            p.subtitle ?? null,
    authors,
    thumbnail,
    rating:              typeof p.rating === "number" ? p.rating : null,
    ratingsTotal:        typeof p.reviews === "number" ? p.reviews : null,
    bestsellersRankFlat,
    bestsellersRanks,
    publicationDate:     p.publication_date ?? null,
    expandedDetailsLoaded: true,
  };
}
