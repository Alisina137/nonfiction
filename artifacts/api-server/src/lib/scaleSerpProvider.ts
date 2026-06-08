/**
 * Scale SERP Amazon book search.
 *
 * Scale SERP doesn't have a native Amazon search type — instead we query Google
 * with a `site:amazon.com` restriction and parse the results.
 *
 * Two result shapes are handled:
 *   1. Individual product pages  → /dp/ASIN10 in URL — direct ASIN + cover
 *   2. Category/search list pages → snippet contains "Title · Author ·" or
 *      "#N · Title ; #N+1 · Title" patterns
 */

import type { RainforestBookRow } from "./rainforest";

// ─── Error ────────────────────────────────────────────────────────────────────

export class ScaleSerpError extends Error {
  constructor(
    message: string,
    public readonly code: "MISSING_KEY" | "API_ERROR" | "NO_RESULTS" | "NETWORK"
  ) {
    super(message);
    this.name = "ScaleSerpError";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractAsin(url: string): string | null {
  // Handles amazon.com, us.amazon.com, www.amazon.com, amazon.co.uk etc.
  const m = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?#]|$)/i);
  return m ? m[1].toUpperCase() : null;
}

function normalizeAmazonUrl(url: string, asin: string): string {
  // Normalise us.amazon.com → www.amazon.com
  return `https://www.amazon.com/dp/${asin}`;
}

function buildCoverUrl(asin: string): string {
  return `https://m.media-amazon.com/images/P/${asin}.01._SX300_.jpg`;
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/^Amazon\.com\s*[:|-]\s*/i, "")
    .replace(/\s*[-–]\s*(Kindle Edition|Paperback|Hardcover|Audio CD|Audiobook).*$/i, "")
    .trim();
}

/**
 * Parse book titles from Amazon search / category page snippets.
 *
 * Pattern A — bestseller list: "#1 · Four Thousand Weeks ; #2 · Deep Work …"
 * Pattern B — search results:  "Title · Author · Kindle, Paperback …"
 */
function parseBooksFromSnippet(
  snippet: string
): Array<{ title: string; authors: string | null }> {
  const out: Array<{ title: string; authors: string | null }> = [];

  // Pattern A: numbered bestseller list
  const bsMatches = snippet.match(/#\d+\s*·\s*([^;#]+)/g);
  if (bsMatches && bsMatches.length > 1) {
    for (const m of bsMatches) {
      const inner = m.replace(/^#\d+\s*·\s*/, "").trim();
      const parts = inner.split(/\s*·\s*/);
      const title = parts[0].trim();
      if (title.length > 3) out.push({ title, authors: parts[1]?.trim() || null });
    }
    return out;
  }

  // Pattern B: "Title · Author · Format" (Amazon search snippet)
  const parts = snippet.split(/\s*·\s*/);
  if (parts.length >= 2) {
    const title = parts[0].trim();
    const second = parts[1]?.trim() || "";
    const isFormat = /^(Kindle|Paperback|Hardcover|Audiobook|MP3|CD)/i.test(second);
    if (title.length > 3) {
      out.push({ title, authors: isFormat ? null : second || null });
    }
  }

  return out;
}

/**
 * Extract ratings from a Rainforest-style rich_snippet extensions array.
 */
function parseRichSnippetRating(
  ext: Record<string, any>,
  extensions: string[]
): { rating: number | null; ratingsTotal: number | null } {
  let rating: number | null = null;
  let ratingsTotal: number | null = null;

  // detected_extensions.rating is sometimes store rating (1–10), skip if > 5
  if (typeof ext.rating === "number" && ext.rating >= 1 && ext.rating <= 5) {
    rating = ext.rating;
  }

  for (const e of extensions) {
    const s = String(e);
    if (!rating) {
      const ratingMatch = s.match(/(\d+\.?\d*)\s+out\s+of\s+5/i);
      if (ratingMatch) rating = parseFloat(ratingMatch[1]);
    }
    if (ratingsTotal === null) {
      const reviewMatch = s.match(/^([\d,]+)\s+(?:rating|review)/i);
      if (reviewMatch) ratingsTotal = parseInt(reviewMatch[1].replace(/,/g, ""), 10);
    }
  }

  return { rating, ratingsTotal };
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeScaleSerpResults(data: any): RainforestBookRow[] {
  const organic: any[] = Array.isArray(data.organic_results) ? data.organic_results : [];
  const books: RainforestBookRow[] = [];
  const seenAsins = new Set<string>();
  const seenTitles = new Set<string>();

  for (const r of organic) {
    const link: string = r.link || "";
    const asin = extractAsin(link);

    if (asin) {
      // ── Individual product page ──────────────────────────────────────────
      if (seenAsins.has(asin)) continue;
      seenAsins.add(asin);

      const rawTitle = r.title || "";
      const title = cleanTitle(rawTitle);
      if (!title || title.length < 3) continue;

      const ext: Record<string, any> = r.rich_snippet?.top?.detected_extensions || {};
      const exts: string[] = r.rich_snippet?.top?.extensions || [];
      const { rating, ratingsTotal } = parseRichSnippetRating(ext, exts);

      // Try to extract author from snippet
      let authors: string | null = null;
      const snippet: string = r.snippet || "";
      const byMatch =
        snippet.match(/^[Bb]y\s+([A-Z][^·|\n,]{2,50})/i) ||
        snippet.match(/[Aa]uthor[:\s]+([^·\n,]{2,50})/);
      if (byMatch) authors = byMatch[1].trim();

      const thumbnail = buildCoverUrl(asin);
      console.log("[ScaleSerp] Book Cover URL:", thumbnail, "| ASIN:", asin);

      books.push({
        asin,
        title,
        subtitle:             null,
        authors,
        url:                  normalizeAmazonUrl(link, asin),
        thumbnail,
        rating,
        ratingsTotal,
        recentSales:          null,
        sponsored:            false,
        bestsellerBadge:      null,
        bestsellersRankFlat:  null,
        bestsellersRanks:     null,
        publicationDate:      null,
        price:                null,
        expandedDetailsLoaded: false
      });
    } else if (link.includes("amazon.com")) {
      // ── Category / search result page — parse snippet ─────────────────
      const snippet: string = r.snippet || "";
      if (!snippet) continue;

      const parsed = parseBooksFromSnippet(snippet);
      for (const p of parsed) {
        if (!p.title || p.title.length < 3) continue;
        const key = p.title.toLowerCase();
        if (seenTitles.has(key)) continue;
        seenTitles.add(key);

        // Build a search URL on Amazon if no direct product link
        const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(p.title)}`;

        books.push({
          asin:                 null,
          title:                p.title,
          subtitle:             null,
          authors:              p.authors,
          url:                  searchUrl,
          thumbnail:            null,
          rating:               null,
          ratingsTotal:         null,
          recentSales:          null,
          sponsored:            false,
          bestsellerBadge:      null,
          bestsellersRankFlat:  null,
          bestsellersRanks:     null,
          publicationDate:      null,
          price:                null,
          expandedDetailsLoaded: false
        });
      }
    }
  }

  console.log("[ScaleSerp] Raw Results:", organic.length, "| Books After Mapping:", books.length);
  return books;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch basic product detail for a single ASIN via Scale SERP (Google search fallback).
 * Returns title, thumbnail, rating — no bestseller ranks (Google doesn't surface those).
 */
export async function getProductDetailWithScaleSerp(
  asin: string
): Promise<Partial<import("./rainforest").RainforestProductDetail>> {
  const key = process.env.SCALE_SERP_API_KEY;
  if (!key) throw new ScaleSerpError("SCALE_SERP_API_KEY is not set.", "MISSING_KEY");

  const upperAsin = asin.toUpperCase();
  const url = new URL("https://api.scaleserp.com/search");
  url.searchParams.set("api_key", key);
  url.searchParams.set("q", `site:amazon.com/dp/${upperAsin}`);
  url.searchParams.set("num", "5");
  url.searchParams.set("gl", "us");
  url.searchParams.set("hl", "en");

  console.log("[ScaleSerp] Product lookup for ASIN:", upperAsin);

  let res: Response;
  try {
    res = await fetch(url.toString(), { method: "GET" });
  } catch (e: any) {
    throw new ScaleSerpError(`Scale SERP network error: ${e.message}`, "NETWORK");
  }

  const raw = await res.text();
  let data: any;
  try { data = JSON.parse(raw); } catch { data = null; }

  if (!res.ok || data?.request_info?.success === false) {
    const msg = data?.request_info?.message || `HTTP ${res.status}`;
    throw new ScaleSerpError(`Scale SERP error: ${msg}`, "API_ERROR");
  }

  const organic: any[] = Array.isArray(data.organic_results) ? data.organic_results : [];

  for (const r of organic) {
    const foundAsin = extractAsin(r.link || "");
    if (!foundAsin || foundAsin !== upperAsin) continue;

    const title = cleanTitle(r.title || "");
    if (!title || title.length < 3) continue;

    const ext: Record<string, any> = r.rich_snippet?.top?.detected_extensions || {};
    const exts: string[] = r.rich_snippet?.top?.extensions || [];
    const { rating, ratingsTotal } = parseRichSnippetRating(ext, exts);

    let authors: string | null = null;
    const snippet: string = r.snippet || "";
    const byMatch =
      snippet.match(/^[Bb]y\s+([A-Z][^·|\n,]{2,50})/i) ||
      snippet.match(/[Aa]uthor[:\s]+([^·\n,]{2,50})/);
    if (byMatch) authors = byMatch[1].trim();

    const thumbnail = buildCoverUrl(upperAsin);
    console.log("[ScaleSerp] Product found:", title, "| Rating:", rating);

    return {
      title,
      subtitle:            null,
      authors,
      thumbnail,
      rating,
      ratingsTotal,
      bestsellersRankFlat: null,
      bestsellersRanks:    null,
      publicationDate:     null,
      price:               null,
      expandedDetailsLoaded: true
    };
  }

  throw new ScaleSerpError(`No product page found for ASIN ${upperAsin}`, "NO_RESULTS");
}

export async function searchBooksWithScaleSerp(
  query: string,
  opts: { maxResults?: number } = {}
): Promise<RainforestBookRow[]> {
  const key = process.env.SCALE_SERP_API_KEY;
  if (!key) {
    throw new ScaleSerpError("SCALE_SERP_API_KEY is not set.", "MISSING_KEY");
  }

  // site:amazon.com/dp restricts Google to individual product pages → every result has an ASIN
  const searchQuery = `${query} books site:amazon.com/dp`;
  const url = new URL("https://api.scaleserp.com/search");
  url.searchParams.set("api_key", key);
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("num", "20");
  url.searchParams.set("gl", "us");
  url.searchParams.set("hl", "en");

  console.log("[ScaleSerp] Searching:", searchQuery);
  const t0 = Date.now();

  let res: Response;
  try {
    res = await fetch(url.toString(), { method: "GET" });
  } catch (e: any) {
    throw new ScaleSerpError(`Scale SERP network error: ${e.message}`, "NETWORK");
  }

  const elapsed = Date.now() - t0;
  console.log(`[ScaleSerp] Status: ${res.status} (${elapsed}ms)`);

  const raw = await res.text();
  let data: any;
  try { data = JSON.parse(raw); } catch { data = null; }

  if (!res.ok || data?.request_info?.success === false) {
    const msg = data?.request_info?.message || `HTTP ${res.status}`;
    throw new ScaleSerpError(`Scale SERP error: ${msg}`, "API_ERROR");
  }

  const books = normalizeScaleSerpResults(data);

  if (books.length === 0) {
    throw new ScaleSerpError("Scale SERP returned no books for this query.", "NO_RESULTS");
  }

  return books.slice(0, opts.maxResults ?? 20);
}
