/**
 * amazonResearchService
 *
 * Amazon book research powered by Apify actors.
 *
 * Apify request flow (search):
 *   1. Build query: append " books" to topic for relevance
 *   2. POST https://api.apify.com/v2/acts/junglee~amazon-search-results-scraper/run-sync-get-dataset-items
 *      Body: { queries, countryCode, maxItemsPerQuery }
 *   3. Response is a JSON array of raw result items
 *   4. Normalize each item to NormalizedBook
 *   5. Sort: bestseller first → highest reviewCount → highest rating
 *   6. Return top maxResults entries
 *
 * Apify request flow (product detail):
 *   POST https://api.apify.com/v2/acts/apify~amazon-crawler/run-sync-get-dataset-items
 *   Body: { startUrls: [{ url: "https://www.amazon.com/dp/<ASIN>" }] }
 */

// ─── Interfaces ────────────────────────────────────────────────────────────

/** Raw item returned by Apify junglee/amazon-search-results-scraper */
export interface ApifyAmazonSearchItem {
  title?: string;
  url?: string;
  asin?: string;
  stars?: number;
  numberOfReviews?: number;
  price?: string;
  thumbnailImage?: string;
  isBestSeller?: boolean;
  isAmazonChoice?: boolean;
  isPrime?: boolean;
  description?: string;
}

/** Raw item returned by Apify apify/amazon-crawler (product page) */
export interface ApifyAmazonProductItem {
  title?: string;
  url?: string;
  asin?: string;
  stars?: number;
  numberOfReviews?: number;
  price?: string;
  thumbnails?: string[];
  thumbnailImage?: string;
  authors?: Array<string | { name?: string }>;
  author?: string;
  subtitle?: string;
  publicationDate?: string;
  bestsellersRank?: Array<{ category?: string; rank?: number; url?: string }>;
  categoryRank?: string;
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

// ─── Low-level Apify helper ────────────────────────────────────────────────

const APIFY_BASE = "https://api.apify.com/v2/acts";

/**
 * Run an Apify actor synchronously and return the dataset items array.
 * Uses run-sync-get-dataset-items which blocks until the actor finishes.
 *
 * Error handling:
 *  - 401/403 → invalid API key
 *  - 429     → rate limit
 *  - network → wrapped with code NETWORK_FAILURE
 *  - other   → wrapped with code API_FAILURE
 */
async function apifyRun(
  apiKey: string,
  actorId: string,
  input: Record<string, any>,
  timeoutSecs = 60
): Promise<any[]> {
  const url = `${APIFY_BASE}/${actorId}/run-sync-get-dataset-items?token=${apiKey}&timeout=${timeoutSecs}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (networkErr: any) {
    throw Object.assign(
      new Error(`Network failure reaching Apify: ${networkErr.message}`),
      { code: "NETWORK_FAILURE" }
    );
  }

  const raw = await res.text();
  let data: any;
  try { data = JSON.parse(raw); } catch { data = null; }

  // Invalid API key
  if (res.status === 401 || res.status === 403) {
    throw Object.assign(
      new Error("Invalid APIFY_API_KEY — check your Replit secret"),
      { code: "INVALID_KEY", httpStatus: res.status }
    );
  }

  // Rate limit
  if (res.status === 429) {
    throw Object.assign(
      new Error("Apify rate limit reached — try again later"),
      { code: "RATE_LIMIT", httpStatus: 429 }
    );
  }

  // Other HTTP error
  if (!res.ok) {
    const msg =
      data?.error?.message || data?.message || `Apify request failed (HTTP ${res.status})`;
    throw Object.assign(new Error(msg), { code: "API_FAILURE", httpStatus: res.status });
  }

  // Apify returns the dataset as a JSON array directly
  if (!Array.isArray(data)) {
    throw Object.assign(
      new Error("Unexpected Apify response format"),
      { code: "API_FAILURE" }
    );
  }

  return data;
}

// ─── Mapping logic ─────────────────────────────────────────────────────────

/**
 * Mapping logic: convert a raw Apify search item to NormalizedBook.
 */
function normalizeSearchItem(raw: ApifyAmazonSearchItem, rank: number): NormalizedBook {
  // Extract ASIN from url if not provided directly
  const asinFromUrl = raw.url
    ? (raw.url.match(/\/dp\/([A-Z0-9]{10})/i)?.[1]?.toUpperCase() ?? null)
    : null;
  const asin = raw.asin ? raw.asin.toUpperCase() : asinFromUrl;
  const amazonUrl = asin
    ? `https://www.amazon.com/dp/${asin}`
    : (raw.url || "");

  return {
    asin,
    title: raw.title || "Unknown title",
    author: null,
    rating: typeof raw.stars === "number" ? raw.stars : null,
    reviewCount: typeof raw.numberOfReviews === "number" ? raw.numberOfReviews : null,
    price: raw.price ?? null,
    amazonUrl,
    thumbnail: raw.thumbnailImage ?? null,
    bestsellerBadge: raw.isBestSeller === true,
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
 * Main service: search Amazon Books for a topic via Apify and return
 * normalized, sorted bestseller data.
 *
 * Sort order: bestseller first → highest reviewCount → highest rating
 */
export async function amazonResearchService(
  apiKey: string,
  { topic, maxResults = 20 }: AmazonResearchOptions
): Promise<NormalizedBook[]> {
  if (!topic || !topic.trim()) {
    throw Object.assign(new Error("Search topic is required"), { code: "BAD_INPUT" });
  }

  // Append "books" to improve relevance
  const query = topic.trim().toLowerCase().endsWith("books")
    ? topic.trim()
    : `${topic.trim()} books`;

  console.log(`[amazonResearchService] Searching: "${query}" (max=${maxResults})`);

  // Run Apify amazon-search-results-scraper actor
  const items: ApifyAmazonSearchItem[] = await apifyRun(
    apiKey,
    "junglee~amazon-search-results-scraper",
    {
      queries: query,
      countryCode: "US",
      maxItemsPerQuery: Math.max(maxResults, 24),
    }
  );

  if (items.length === 0) {
    console.warn(`[amazonResearchService] No results returned for "${query}"`);
    return [];
  }

  // Normalize
  const books = items
    .filter((r) => r && r.title)
    .map((r, i) => normalizeSearchItem(r, i + 1));

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
 * Fetch expanded product detail for a single ASIN via Apify amazon-crawler.
 * Maps to the same shape the "Expand details" UI panel expects.
 */
export async function amazonProductDetail(
  apiKey: string,
  { asin, amazonDomain = "amazon.com" }: { asin: string; amazonDomain?: string }
): Promise<NormalizedProductDetail> {
  console.log(`[amazonResearchService] Fetching product detail for ASIN ${asin}`);

  const productUrl = `https://www.${amazonDomain.replace(/^www\./, "")}/dp/${asin.toUpperCase()}`;

  const items: ApifyAmazonProductItem[] = await apifyRun(
    apiKey,
    "apify~amazon-crawler",
    { startUrls: [{ url: productUrl }] }
  );

  const p = items[0];
  if (!p) {
    throw Object.assign(
      new Error(`No product data returned for ASIN ${asin}`),
      { code: "EMPTY_PRODUCT" }
    );
  }

  // Authors — normalize string | object array
  let authors: string | null = null;
  if (typeof p.author === "string" && p.author) {
    authors = p.author;
  } else if (Array.isArray(p.authors) && p.authors.length) {
    authors = p.authors
      .map((a) => (typeof a === "string" ? a : a?.name ?? ""))
      .filter(Boolean)
      .join(", ") || null;
  }

  // Bestseller ranks
  let bestsellersRanks: NormalizedProductDetail["bestsellersRanks"] = null;
  let bestsellersRankFlat: string | null = null;

  if (Array.isArray(p.bestsellersRank) && p.bestsellersRank.length) {
    bestsellersRanks = p.bestsellersRank
      .filter((r) => r.rank != null && r.category)
      .map((r) => ({ category: r.category!, rank: r.rank!, link: r.url ?? null }));
    bestsellersRankFlat = bestsellersRanks
      .map((r) => `#${r.rank} in ${r.category}`)
      .join(" · ") || null;
  } else if (typeof p.categoryRank === "string" && p.categoryRank) {
    bestsellersRankFlat = p.categoryRank;
  }

  const thumbnail = Array.isArray(p.thumbnails) && p.thumbnails.length
    ? p.thumbnails[0]
    : (p.thumbnailImage ?? null);

  return {
    title:               p.title ?? null,
    subtitle:            p.subtitle ?? null,
    authors,
    thumbnail,
    rating:              typeof p.stars === "number" ? p.stars : null,
    ratingsTotal:        typeof p.numberOfReviews === "number" ? p.numberOfReviews : null,
    bestsellersRankFlat,
    bestsellersRanks,
    publicationDate:     p.publicationDate ?? null,
    expandedDetailsLoaded: true,
  };
}
