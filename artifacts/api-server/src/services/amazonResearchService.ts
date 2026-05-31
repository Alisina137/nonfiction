/**
 * amazonResearchService
 *
 * Amazon book research powered by Apify actors.
 *
 * Apify request flow (search):
 *   1. Build Amazon search URL: https://www.amazon.com/s?k=<topic+books>&i=stripbooks
 *   2. POST https://api.apify.com/v2/acts/junglee~Amazon-crawler/run-sync-get-dataset-items
 *      Body: { startUrls: [{ url }], maxItems }
 *   3. Response is a JSON array of raw result items
 *   4. Normalize each item → NormalizedBook
 *   5. Sort: bestseller first → highest reviewCount → highest rating
 *   6. Return top maxResults entries
 *
 * Apify request flow (product detail):
 *   POST https://api.apify.com/v2/acts/junglee~free-amazon-product-scraper/run-sync-get-dataset-items
 *   Body: { startUrls: [{ url: "https://www.amazon.com/dp/<ASIN>" }] }
 */

// ─── Interfaces ────────────────────────────────────────────────────────────

/** Raw item returned by Apify junglee/Amazon-crawler */
export interface ApifyAmazonSearchItem {
  title?: string;
  url?: string;
  asin?: string;
  stars?: number;
  rating?: number;
  reviewsCount?: number;
  numberOfReviews?: number;
  price?: string | { value?: number; currency?: string };
  thumbnailImage?: string;
  image?: string;
  isBestSeller?: boolean;
  isAmazonChoice?: boolean;
  author?: string;
  authors?: string | string[];
}

/** Raw item returned by Apify junglee/free-amazon-product-scraper */
export interface ApifyAmazonProductItem {
  title?: string;
  url?: string;
  asin?: string;
  stars?: number;
  rating?: number;
  reviewsCount?: number;
  numberOfReviews?: number;
  price?: string | { value?: number; currency?: string };
  thumbnailImage?: string;
  images?: string[];
  author?: string;
  authors?: string | Array<string | { name?: string }>;
  subtitle?: string;
  publicationDate?: string;
  bestsellersRank?: Array<{ category?: string; rank?: number; url?: string }>;
  categoryRank?: string;
  categoryName?: string;
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
 *
 * Error handling covers:
 *  - Network failures
 *  - 401/403 → invalid API key
 *  - 429     → rate limit
 *  - 404     → actor not found
 *  - Other HTTP errors
 */
async function apifyRun(
  apiKey: string,
  actorId: string,
  input: Record<string, any>,
  timeoutSecs = 120
): Promise<any[]> {
  const url = `${APIFY_BASE}/${actorId}/run-sync-get-dataset-items?token=${apiKey}&timeout=${timeoutSecs}&memory=512`;

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

  if (res.status === 401 || res.status === 403) {
    throw Object.assign(
      new Error("Invalid APIFY_API_KEY — check your Replit secret"),
      { code: "INVALID_KEY", httpStatus: res.status }
    );
  }
  if (res.status === 429) {
    throw Object.assign(
      new Error("Apify rate limit reached — try again later"),
      { code: "RATE_LIMIT", httpStatus: 429 }
    );
  }
  if (!res.ok) {
    const msg =
      data?.error?.message || data?.message || `Apify request failed (HTTP ${res.status})`;
    throw Object.assign(new Error(msg), { code: "API_FAILURE", httpStatus: res.status });
  }

  if (!Array.isArray(data)) {
    console.warn(`[Apify] Unexpected response type for actor ${actorId}:`, typeof data);
    return [];
  }

  return data;
}

// ─── Mapping helpers ────────────────────────────────────────────────────────

function extractPrice(raw: any): string | null {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && raw.value != null) {
    return `$${raw.value}`;
  }
  return null;
}

function extractAsin(item: any): string | null {
  if (typeof item.asin === "string") return item.asin.toUpperCase();
  const url: string = item.url || item.link || "";
  const m = url.match(/\/dp\/([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Mapping logic: convert a raw Apify search item to NormalizedBook.
 */
function normalizeSearchItem(raw: ApifyAmazonSearchItem, rank: number): NormalizedBook {
  const asin = extractAsin(raw);
  const amazonUrl = asin
    ? `https://www.amazon.com/dp/${asin}`
    : (raw.url || "");

  const rating = typeof raw.stars === "number" ? raw.stars
    : typeof raw.rating === "number" ? raw.rating
    : null;

  const reviewCount = typeof raw.reviewsCount === "number" ? raw.reviewsCount
    : typeof raw.numberOfReviews === "number" ? raw.numberOfReviews
    : null;

  const thumbnail = raw.thumbnailImage || raw.image || null;

  return {
    asin,
    title: raw.title || "Unknown title",
    author: typeof raw.author === "string" ? raw.author
      : Array.isArray(raw.authors) ? (raw.authors as string[]).join(", ")
      : typeof raw.authors === "string" ? raw.authors
      : null,
    rating,
    reviewCount,
    price: extractPrice(raw.price),
    amazonUrl,
    thumbnail,
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
  { topic, maxResults = 20, amazonDomain = "amazon.com" }: AmazonResearchOptions
): Promise<NormalizedBook[]> {
  if (!topic || !topic.trim()) {
    throw Object.assign(new Error("Search topic is required"), { code: "BAD_INPUT" });
  }

  // Build Amazon search URL restricted to Books (i=stripbooks)
  const query = topic.trim().toLowerCase().endsWith("books")
    ? topic.trim()
    : `${topic.trim()} books`;

  const domain = amazonDomain.replace(/^www\./, "");
  const searchUrl = `https://www.${domain}/s?k=${encodeURIComponent(query)}&i=stripbooks`;

  console.log(`[amazonResearchService] Searching: "${query}" → ${searchUrl}`);

  // junglee~Amazon-crawler: crawls Amazon search/category/product pages
  // Required field is categoryOrProductUrls (confirmed from API validation error)
  const items: ApifyAmazonSearchItem[] = await apifyRun(
    apiKey,
    "junglee~Amazon-crawler",
    {
      categoryOrProductUrls: [{ url: searchUrl }],
      maxItemsPerStartUrl: Math.max(maxResults, 24),
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
 * Fetch expanded product detail for a single ASIN via Apify.
 * Maps to the same shape the "Expand details" UI panel expects.
 */
export async function amazonProductDetail(
  apiKey: string,
  { asin, amazonDomain = "amazon.com" }: { asin: string; amazonDomain?: string }
): Promise<NormalizedProductDetail> {
  console.log(`[amazonResearchService] Fetching product detail for ASIN ${asin}`);

  const domain = amazonDomain.replace(/^www\./, "");
  const productUrl = `https://www.${domain}/dp/${asin.toUpperCase()}`;

  // junglee~free-amazon-product-scraper: scrapes individual product pages
  // Uses categoryOrProductUrls to match the same pattern as the search actor
  const items: ApifyAmazonProductItem[] = await apifyRun(
    apiKey,
    "junglee~free-amazon-product-scraper",
    { categoryOrProductUrls: [{ url: productUrl }] }
  );

  const p = items[0];
  if (!p) {
    throw Object.assign(
      new Error(`No product data returned for ASIN ${asin}`),
      { code: "EMPTY_PRODUCT" }
    );
  }

  // Authors — normalize string | object[] | string[]
  let authors: string | null = null;
  if (typeof p.author === "string" && p.author) {
    authors = p.author;
  } else if (typeof p.authors === "string" && p.authors) {
    authors = p.authors;
  } else if (Array.isArray(p.authors) && p.authors.length) {
    authors = (p.authors as any[])
      .map((a: any) => (typeof a === "string" ? a : a?.name ?? ""))
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

  const thumbnail =
    Array.isArray(p.images) && p.images.length ? p.images[0]
    : p.thumbnailImage ?? null;

  const rating = typeof p.stars === "number" ? p.stars
    : typeof p.rating === "number" ? p.rating
    : null;

  const ratingsTotal = typeof p.reviewsCount === "number" ? p.reviewsCount
    : typeof p.numberOfReviews === "number" ? p.numberOfReviews
    : null;

  return {
    title:               p.title ?? null,
    subtitle:            p.subtitle ?? null,
    authors,
    thumbnail,
    rating,
    ratingsTotal,
    bestsellersRankFlat,
    bestsellersRanks,
    publicationDate:     p.publicationDate ?? null,
    expandedDetailsLoaded: true,
  };
}
