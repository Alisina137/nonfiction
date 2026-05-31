/**
 * amazon-scale-serp
 *
 * Amazon book research powered by Scale SERP.
 *
 * Flow (search):
 *   1. POST https://api.scaleserp.com/search with search_type=amazon
 *   2. Paginate until at least 25 valid books collected (or no more pages)
 *   3. Extract: asin, title, author, rating, reviewsCount, price, thumbnail, url
 *   4. Score = (reviewsCount * 0.6) + (rating * 1000 * 0.4)
 *   5. Sort descending by score, return top 15–25
 *
 * Flow (product detail):
 *   GET https://api.scaleserp.com/search?search_type=amazon&amazon_type=product&asin=<ASIN>
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const SCALE_SERP_BASE = "https://api.scaleserp.com/search";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const MAX_PAGES = 5;

// ─── TypeScript Interfaces ────────────────────────────────────────────────────

/** A single item from Scale SERP amazon_results */
export interface ScaleSerpAmazonResultItem {
  position?: number;
  asin?: string;
  title?: string;
  link?: string;
  image?: string;
  rating?: number;
  ratings_total?: number;
  price?: {
    value?: number;
    symbol?: string;
    currency?: string;
    raw?: string;
  } | string;
  authors?: string | string[];
  byline?: string;
  byline_info?: {
    contributers?: Array<{ name?: string; link?: string }>;
    by_text?: string;
  };
  is_sponsored?: boolean;
  categories?: string[];
}

/** Raw Scale SERP product detail response */
export interface ScaleSerpProductResult {
  title?: string;
  full_title?: string;
  link?: string;
  asin?: string;
  rating?: number;
  ratings_total?: number;
  main_image?: string;
  images?: string[];
  authors?: string | string[] | Array<{ name?: string; link?: string }>;
  author?: string;
  byline?: string;
  byline_info?: {
    contributers?: Array<{ name?: string; link?: string }>;
    by_text?: string;
  };
  publication_date?: string;
  date_first_available?: string;
  bestsellers_rank?: Array<{
    category?: string;
    rank?: number;
    link?: string;
  }>;
  price?: {
    value?: number;
    symbol?: string;
    currency?: string;
    raw?: string;
  } | string;
  subtitle?: string;
}

/** Canonical book shape used by the app */
export interface ScaleSerpBook {
  asin: string;
  title: string;
  author: string | null;
  rating: number | null;
  reviewsCount: number | null;
  price: string | null;
  thumbnail: string | null;
  url: string;
  score: number;
}

/** Shape returned by searchAmazonBooks */
export interface ScaleSerpSearchResult {
  keyword: string;
  books: ScaleSerpBook[];
}

/** Expanded product detail — matches NormalizedProductDetail used by routes */
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function extractPrice(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object") {
    if (raw.raw) return raw.raw as string;
    if (raw.value != null) return `${raw.symbol || "$"}${raw.value}`;
  }
  return null;
}

function extractAuthorFromItem(item: ScaleSerpAmazonResultItem): string | null {
  // 1. byline_info.contributers
  if (item.byline_info?.contributers?.length) {
    const names = item.byline_info.contributers
      .map((c) => c.name)
      .filter(Boolean) as string[];
    if (names.length) return names.join(", ");
  }
  // 2. authors field
  if (item.authors) {
    if (typeof item.authors === "string") return item.authors;
    if (Array.isArray(item.authors)) return item.authors.join(", ");
  }
  // 3. byline string (often "by Author Name")
  if (item.byline) {
    return item.byline.replace(/^by\s+/i, "").trim() || null;
  }
  return null;
}

function extractAuthorsFromProduct(p: ScaleSerpProductResult): string | null {
  if (p.byline_info?.contributers?.length) {
    const names = p.byline_info.contributers
      .map((c) => c.name)
      .filter(Boolean) as string[];
    if (names.length) return names.join(", ");
  }
  if (p.authors) {
    if (typeof p.authors === "string") return p.authors;
    if (Array.isArray(p.authors)) {
      return (p.authors as any[])
        .map((a: any) => (typeof a === "string" ? a : a?.name ?? ""))
        .filter(Boolean)
        .join(", ") || null;
    }
  }
  if (p.author) return p.author;
  if (p.byline) return p.byline.replace(/^by\s+/i, "").trim() || null;
  return null;
}

function computeScore(reviewsCount: number | null, rating: number | null): number {
  const r = reviewsCount ?? 0;
  const s = rating ?? 0;
  return r * 0.6 + s * 1000 * 0.4;
}

// ─── Low-level Scale SERP fetch with retry ───────────────────────────────────

async function scaleSerpFetch(
  apiKey: string,
  params: Record<string, string | number>
): Promise<any> {
  const url = new URL(SCALE_SERP_BASE);
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url.toString());
    } catch (netErr: any) {
      lastErr = Object.assign(
        new Error(`Network failure reaching Scale SERP: ${netErr.message}`),
        { code: "NETWORK_FAILURE" }
      );
      if (attempt < MAX_RETRIES) {
        console.warn(`[scale-serp] Network error (attempt ${attempt}/${MAX_RETRIES}), retrying…`);
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw lastErr;
    }

    if (res.status === 401 || res.status === 403) {
      throw Object.assign(
        new Error("Invalid SCALE_SERP_API_KEY — check your Replit secret"),
        { code: "INVALID_KEY", httpStatus: res.status }
      );
    }

    if (res.status === 429) {
      if (attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get("retry-after") || "2");
        const delay = (retryAfter || 2) * 1000;
        console.warn(`[scale-serp] Rate limited, waiting ${delay}ms before retry ${attempt + 1}`);
        await sleep(delay);
        continue;
      }
      throw Object.assign(
        new Error("Scale SERP rate limit reached — try again later"),
        { code: "RATE_LIMIT", httpStatus: 429 }
      );
    }

    const raw = await res.text();
    let data: any;
    try { data = JSON.parse(raw); } catch { data = null; }

    if (!res.ok) {
      const msg = data?.error || data?.message || `Scale SERP request failed (HTTP ${res.status})`;
      lastErr = Object.assign(new Error(msg), { code: "API_FAILURE", httpStatus: res.status });
      if (attempt < MAX_RETRIES) {
        console.warn(`[scale-serp] HTTP ${res.status} (attempt ${attempt}/${MAX_RETRIES}): ${msg}`);
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw lastErr;
    }

    return data;
  }

  throw lastErr ?? new Error("Scale SERP request failed after retries");
}

// ─── Public: Amazon book search ───────────────────────────────────────────────

export interface AmazonSearchOptions {
  keyword: string;
  amazonDomain?: string;
  maxResults?: number;
}

/**
 * Search Amazon Books via Scale SERP.
 * Paginates until maxResults valid books are collected or no more pages exist.
 */
export async function searchAmazonBooks(
  apiKey: string,
  { keyword, amazonDomain = "amazon.com", maxResults = 25 }: AmazonSearchOptions
): Promise<ScaleSerpSearchResult> {
  if (!keyword?.trim()) {
    throw Object.assign(new Error("keyword is required"), { code: "BAD_INPUT" });
  }

  const domain = amazonDomain.replace(/^www\./, "");
  // Append "books" if not already present to bias toward book results
  const q = keyword.trim().toLowerCase().endsWith("books")
    ? keyword.trim()
    : `${keyword.trim()} books`;

  console.log(`[scale-serp] Searching Amazon for: "${q}" on ${domain}`);

  const collected: ScaleSerpAmazonResultItem[] = [];

  for (let page = 1; page <= MAX_PAGES && collected.length < maxResults; page++) {
    const data = await scaleSerpFetch(apiKey, {
      search_type: "amazon",
      amazon_domain: domain,
      q,
      page,
    });

    const results: ScaleSerpAmazonResultItem[] = Array.isArray(data?.amazon_results)
      ? data.amazon_results
      : [];

    console.log(`[scale-serp] Page ${page}: ${results.length} raw results`);

    if (results.length === 0) break;

    // Only keep items that look like books (have title + asin)
    for (const item of results) {
      if (item.title && (item.asin || item.link)) {
        collected.push(item);
      }
    }

    // Stop early if Scale SERP signals no next page
    if (!data?.pagination?.next && page > 1) break;
  }

  console.log(`[scale-serp] Total collected: ${collected.length} for "${q}"`);

  // Normalize and score
  const books: ScaleSerpBook[] = collected.map((item) => {
    const asin = item.asin?.toUpperCase() ?? "";
    const link = item.link ?? (asin ? `https://www.${domain}/dp/${asin}` : "");
    const rating = typeof item.rating === "number" ? item.rating : null;
    const reviewsCount = typeof item.ratings_total === "number" ? item.ratings_total : null;

    return {
      asin: asin || extractAsinFromUrl(link) || "",
      title: item.title ?? "Unknown title",
      author: extractAuthorFromItem(item),
      rating,
      reviewsCount,
      price: extractPrice(item.price),
      thumbnail: item.image ?? null,
      url: link,
      score: computeScore(reviewsCount, rating),
    };
  });

  // Sort descending by score
  books.sort((a, b) => b.score - a.score);

  const top = books.slice(0, Math.max(15, Math.min(maxResults, 25)));
  console.log(`[scale-serp] Returning ${top.length} books for "${q}"`);

  return { keyword, books: top };
}

// ─── Public: Amazon product detail ───────────────────────────────────────────

/**
 * Fetch expanded product detail for a single ASIN via Scale SERP.
 */
export async function fetchAmazonProductDetail(
  apiKey: string,
  { asin, amazonDomain = "amazon.com" }: { asin: string; amazonDomain?: string }
): Promise<NormalizedProductDetail> {
  const domain = amazonDomain.replace(/^www\./, "");
  console.log(`[scale-serp] Fetching product detail for ASIN ${asin} on ${domain}`);

  const data = await scaleSerpFetch(apiKey, {
    search_type: "amazon",
    amazon_domain: domain,
    amazon_type: "product",
    asin: asin.toUpperCase(),
  });

  const p: ScaleSerpProductResult = data?.product ?? data ?? {};

  if (!p || (!p.title && !p.full_title)) {
    throw Object.assign(
      new Error(`No product data returned for ASIN ${asin}`),
      { code: "EMPTY_PRODUCT" }
    );
  }

  // Bestseller ranks
  let bestsellersRanks: NormalizedProductDetail["bestsellersRanks"] = null;
  let bestsellersRankFlat: string | null = null;

  if (Array.isArray(p.bestsellers_rank) && p.bestsellers_rank.length) {
    bestsellersRanks = p.bestsellers_rank
      .filter((r) => r.rank != null && r.category)
      .map((r) => ({ category: r.category!, rank: r.rank!, link: r.link ?? null }));
    bestsellersRankFlat = bestsellersRanks
      .map((r) => `#${r.rank} in ${r.category}`)
      .join(" · ") || null;
  }

  const thumbnail =
    p.main_image
    ?? (Array.isArray(p.images) && p.images.length ? p.images[0] : null)
    ?? null;

  const rating = typeof p.rating === "number" ? p.rating : null;
  const ratingsTotal = typeof p.ratings_total === "number" ? p.ratings_total : null;
  const publicationDate = p.publication_date ?? p.date_first_available ?? null;

  return {
    title: p.full_title ?? p.title ?? null,
    subtitle: p.subtitle ?? null,
    authors: extractAuthorsFromProduct(p),
    thumbnail,
    rating,
    ratingsTotal,
    bestsellersRankFlat,
    bestsellersRanks,
    publicationDate,
    expandedDetailsLoaded: true,
  };
}

// ─── Internal: ASIN extraction from URL ──────────────────────────────────────

function extractAsinFromUrl(url: string): string | null {
  if (!url) return null;
  const m = url.match(/\/dp\/([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}
