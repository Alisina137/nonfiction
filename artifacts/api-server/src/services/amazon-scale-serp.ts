/**
 * amazon-scale-serp
 *
 * Amazon book research powered by Scale SERP (Google SERP API).
 *
 * Strategy (3 parallel API calls per search):
 *   Call A: site:amazon.com organic pages 1–3  → Amazon /dp/ URLs → ASINs + titles
 *   Call B: Google Shopping search              → titles + ratings + reviews + price
 *
 *   Cross-reference A ↔ B by normalized title to assemble complete records.
 *   Fall back to shopping-only rows (no ASIN) when no organic match exists.
 *
 * Score = (reviewsCount * 0.6) + (rating * 1000 * 0.4)
 * Returns top 15–25 books sorted by score descending.
 *
 * Product detail: fetches a single organic search for `amazon.com dp <ASIN>`.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const SCALE_SERP_BASE = "https://api.scaleserp.com/search";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

// ─── TypeScript Interfaces ────────────────────────────────────────────────────

interface ScaleSerpOrganicResult {
  position?: number;
  title?: string;
  link?: string;
  domain?: string;
  snippet?: string;
  rich_snippet?: {
    top?: { extensions?: string[] };
    bottom?: { extensions?: string[] };
  };
}

interface ScaleSerpShoppingResult {
  position?: number;
  title?: string;
  image?: string;
  rating?: number;
  reviews?: number;
  price?: number;
  price_raw?: string;
  price_parsed?: { symbol?: string; value?: number; currency?: string; raw?: string };
  merchant?: string;
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

export interface ScaleSerpSearchResult {
  keyword: string;
  books: ScaleSerpBook[];
}

/** Expanded product detail — matches NormalizedProductDetail shape used by routes */
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

function extractAsinFromUrl(url: string): string | null {
  if (!url) return null;
  const m = url.match(/\/dp\/([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}

/** Amazon CDN thumbnail URL built from ASIN — always a valid image URL */
function asinThumbnail(asin: string): string {
  return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_.jpg`;
}

function computeScore(reviewsCount: number | null, rating: number | null): number {
  return (reviewsCount ?? 0) * 0.6 + (rating ?? 0) * 1000 * 0.4;
}

/** Normalize title for cross-referencing: lowercase, strip punctuation, collapse spaces */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns true if two titles refer to the same book.
 * Handles truncated Google snippet titles (end with "...") gracefully.
 */
function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a.replace(/\.\.\.$/g, "").replace(/\s*:\s*.*$/, ""));
  const nb = normalizeTitle(b.replace(/\.\.\.$/g, "").replace(/\s*:\s*.*$/, ""));
  if (na === nb) return true;
  // Prefix match — one title is a leading substring of the other (handles truncation)
  const shorter = na.length <= nb.length ? na : nb;
  const longer  = na.length <= nb.length ? nb : na;
  if (shorter.length >= 10 && longer.startsWith(shorter)) return true;
  // Word-overlap: 3+ shared meaningful words in first 6 words
  const stopWords = new Set(["a", "an", "the", "of", "to", "for", "and", "with", "in", "on", "its"]);
  const wa = na.split(" ").slice(0, 6).filter((w) => w.length > 2 && !stopWords.has(w));
  const wb = new Set(nb.split(" ").slice(0, 6).filter((w) => w.length > 2 && !stopWords.has(w)));
  const overlap = wa.filter((w) => wb.has(w)).length;
  return overlap >= 3;
}

/** Try to extract author from organic snippet text: "by John Smith" */
function extractAuthorFromSnippet(snippet?: string): string | null {
  if (!snippet) return null;
  const m = snippet.match(/\bby\s+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)/);
  return m ? m[1].trim() : null;
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
        const delay = Number(res.headers.get("retry-after") || "2") * 1000 || 3000;
        console.warn(`[scale-serp] Rate limited, waiting ${delay}ms (attempt ${attempt})`);
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
        console.warn(`[scale-serp] HTTP ${res.status} (attempt ${attempt}): ${msg}`);
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw lastErr;
    }

    if (data?.request_info?.success === false) {
      const msg = data.request_info.message || "Scale SERP request was rejected";
      throw Object.assign(new Error(msg), { code: "API_REJECTED" });
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
 *
 * Three parallel calls:
 *   - Organic pages 1, 2, 3: `site:amazon.com <keyword> books`
 *   - Shopping: `<keyword> books`
 *
 * Organic results yield ASINs + titles from amazon.com/dp/ URLs.
 * Shopping results yield ratings, review counts, and prices.
 * The two sets are cross-referenced by normalized title.
 */
export async function searchAmazonBooks(
  apiKey: string,
  { keyword, amazonDomain = "amazon.com", maxResults = 25 }: AmazonSearchOptions
): Promise<ScaleSerpSearchResult> {
  if (!keyword?.trim()) {
    throw Object.assign(new Error("keyword is required"), { code: "BAD_INPUT" });
  }

  const domain = (amazonDomain || "amazon.com").replace(/^www\./, "");
  const baseQ = keyword.trim().toLowerCase().endsWith("books")
    ? keyword.trim()
    : `${keyword.trim()} books`;

  console.log(`[scale-serp] Searching: "${baseQ}" on ${domain}`);

  const organicQ = `site:${domain} ${baseQ}`;

  // Fire 4 calls in parallel: 3 organic pages + 1 shopping
  const [p1, p2, p3, shopping] = await Promise.allSettled([
    scaleSerpFetch(apiKey, { q: organicQ, num: 20, gl: "us", hl: "en", page: 1 }),
    scaleSerpFetch(apiKey, { q: organicQ, num: 20, gl: "us", hl: "en", page: 2 }),
    scaleSerpFetch(apiKey, { q: organicQ, num: 20, gl: "us", hl: "en", page: 3 }),
    scaleSerpFetch(apiKey, { search_type: "shopping", q: baseQ, num: 40, gl: "us", hl: "en" }),
  ]);

  // Collect organic results from all 3 pages
  const allOrganic: ScaleSerpOrganicResult[] = [];
  for (const r of [p1, p2, p3]) {
    if (r.status === "fulfilled") {
      const items: ScaleSerpOrganicResult[] = r.value?.organic_results ?? [];
      allOrganic.push(...items);
    }
  }

  // Collect shopping results
  const allShopping: ScaleSerpShoppingResult[] =
    shopping.status === "fulfilled" ? (shopping.value?.shopping_results ?? []) : [];

  console.log(`[scale-serp] Raw organic: ${allOrganic.length}, shopping: ${allShopping.length}`);

  // ── Extract Amazon /dp/ entries from organic results ──────────────────────
  const seenAsins = new Set<string>();
  const organicBooks: Array<{
    asin: string;
    title: string;
    author: string | null;
    url: string;
    snippet: string;
  }> = [];

  for (const item of allOrganic) {
    if (!item.link || !item.title) continue;
    if (!item.link.includes(domain)) continue;
    const asin = extractAsinFromUrl(item.link);
    if (!asin || seenAsins.has(asin)) continue;
    seenAsins.add(asin);
    organicBooks.push({
      asin,
      title: item.title,
      author: extractAuthorFromSnippet(item.snippet),
      url: `https://www.${domain}/dp/${asin}`,
      snippet: item.snippet ?? "",
    });
  }

  console.log(`[scale-serp] Unique ASINs from organic: ${organicBooks.length}`);

  // ── Build final books list ────────────────────────────────────────────────
  const books: ScaleSerpBook[] = [];
  const usedShoppingIdx = new Set<number>();

  // Pass 1: organic-anchored books — enrich with shopping data by title match
  for (const ob of organicBooks) {
    let rating: number | null = null;
    let reviewsCount: number | null = null;
    let price: string | null = null;

    const matchIdx = allShopping.findIndex(
      (s, i) => !usedShoppingIdx.has(i) && s.title && titlesMatch(ob.title, s.title)
    );
    if (matchIdx !== -1) {
      const s = allShopping[matchIdx];
      usedShoppingIdx.add(matchIdx);
      rating = typeof s.rating === "number" ? s.rating : null;
      reviewsCount = typeof s.reviews === "number" ? s.reviews : null;
      price = s.price_raw ?? (s.price != null ? `$${s.price}` : null);
    }

    books.push({
      asin: ob.asin,
      title: ob.title,
      author: ob.author,
      rating,
      reviewsCount,
      price,
      thumbnail: asinThumbnail(ob.asin),
      url: ob.url,
      score: computeScore(reviewsCount, rating),
    });
  }

  // Pass 2: shopping-only books — no ASIN, but have ratings
  // Include when we still need more results
  const seenTitles = new Set(books.map((b) => normalizeTitle(b.title)));

  for (let i = 0; i < allShopping.length && books.length < maxResults + 10; i++) {
    if (usedShoppingIdx.has(i)) continue;
    const s = allShopping[i];
    if (!s.title) continue;
    if (seenTitles.has(normalizeTitle(s.title))) continue;
    seenTitles.add(normalizeTitle(s.title));

    const rating = typeof s.rating === "number" ? s.rating : null;
    const reviewsCount = typeof s.reviews === "number" ? s.reviews : null;
    const price = s.price_raw ?? (s.price != null ? `$${s.price}` : null);

    books.push({
      asin: "",
      title: s.title,
      author: null,
      rating,
      reviewsCount,
      price,
      thumbnail: null,
      url: `https://www.amazon.com/s?k=${encodeURIComponent(s.title)}`,
      score: computeScore(reviewsCount, rating),
    });
  }

  // Sort by score descending, return top 15–25
  books.sort((a, b) => b.score - a.score);
  const topN = Math.max(15, Math.min(maxResults, 25));
  const result = books.slice(0, topN);

  console.log(`[scale-serp] Returning ${result.length} books (${books.filter(b => b.asin).length} with ASIN, ${books.filter(b => !b.asin).length} shopping-only)`);
  return { keyword, books: result };
}

// ─── Public: Amazon product detail ───────────────────────────────────────────

/**
 * Fetch expanded product detail for a single ASIN.
 * Searches `amazon.com dp <ASIN>` and extracts the matching result.
 */
export async function fetchAmazonProductDetail(
  apiKey: string,
  { asin, amazonDomain = "amazon.com" }: { asin: string; amazonDomain?: string }
): Promise<NormalizedProductDetail> {
  const domain = (amazonDomain || "amazon.com").replace(/^www\./, "");
  const asinUpper = asin.toUpperCase();
  console.log(`[scale-serp] Product detail for ASIN ${asinUpper} on ${domain}`);

  const data = await scaleSerpFetch(apiKey, {
    q:   `${domain} dp ${asinUpper}`,
    num: 10,
    gl:  "us",
    hl:  "en",
  });

  const organics: ScaleSerpOrganicResult[] = data?.organic_results ?? [];

  // Prefer the result that contains this exact ASIN
  const match =
    organics.find((r) => r.link && extractAsinFromUrl(r.link) === asinUpper) ??
    organics.find((r) => r.link?.includes(domain)) ??
    organics[0];

  if (!match) {
    throw Object.assign(
      new Error(`No product data found for ASIN ${asin}`),
      { code: "EMPTY_PRODUCT" }
    );
  }

  const authors = extractAuthorFromSnippet(match.snippet);

  return {
    title:               match.title ?? null,
    subtitle:            null,
    authors,
    thumbnail:           asinThumbnail(asinUpper),
    rating:              null,
    ratingsTotal:        null,
    bestsellersRankFlat: null,
    bestsellersRanks:    null,
    publicationDate:     null,
    expandedDetailsLoaded: true,
  };
}
