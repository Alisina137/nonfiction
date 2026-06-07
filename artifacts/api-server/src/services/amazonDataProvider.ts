/**
 * AmazonDataProvider — centralized Amazon book data service.
 *
 * Provider chain (search and product detail):
 *   1. Rainforest API  — primary Amazon source of truth; retry once on transient errors
 *   2. Scale SERP      — Google→Amazon fallback (4 parallel queries → ASINs)
 *   3. Open Library    — free fallback for ratings, authors, thumbnails
 *
 * Field merge rule (Rainforest always wins):
 *   finalField = rainforestValue ?? scaleSerpValue ?? openLibraryValue ?? null
 */

// ─── Canonical book shape ──────────────────────────────────────────────────

export interface UnifiedBook {
  asin:                string | null;
  openLibraryKey:      string | null;
  title:               string;
  subtitle:            string | null;
  authors:             string | null;
  url:                 string;
  thumbnail:           string | null;
  rating:              number | null;
  ratingsTotal:        number | null;
  reviewCount:         number | null;
  price:               string | null;
  bestsellersRankFlat: string | null;
  bestsellersRanks:    Array<{ rank: number; category: string; link: string | null }> | null;
  publicationDate:     string | null;
  sponsored:           boolean;
  bestsellerBadge:     { category?: string } | null;
  expandedDetailsLoaded: boolean;
  // Provider tracking
  dataSource:          "rainforest" | "scale_serp" | "open_library" | "merged";
  source_provider:     string;  // legacy compat field
}

export interface UnifiedProductDetails {
  title:               string | null;
  subtitle:            string | null;
  authors:             string | null;
  thumbnail:           string | null;
  rating:              number | null;
  ratingsTotal:        number | null;
  reviewCount:         number | null;
  price:               string | null;
  bestsellersRankFlat: string | null;
  bestsellersRanks:    Array<{ rank: number; category: string; link: string | null }> | null;
  publicationDate:     string | null;
  expandedDetailsLoaded: true;
  dataSource:          "rainforest" | "open_library" | "merged";
  // Extended fields (Rainforest only)
  description:         string | null;
  pageCount:           number | null;
  language:            string | null;
  isbn:                string | null;
  format:              string | null;
  publisher:           string | null;
}

// ─── Rainforest ────────────────────────────────────────────────────────────

async function rainforestGet(apiKey: string, params: Record<string, any>): Promise<any> {
  const url = new URL("https://api.rainforestapi.com/request");
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1200));
    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(18000) });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const err = new Error(`Rainforest ${res.status}: ${text.slice(0, 200)}`);
        // Only retry on transient server errors
        if (res.status >= 500) { lastErr = err; continue; }
        throw err;
      }
      const data = await res.json();
      if (data?.request_info?.success === false) {
        throw new Error(`Rainforest refused: ${data.request_info.message?.slice(0, 150) || "unknown"}`);
      }
      return data;
    } catch (e: any) {
      if (e?.name === "TimeoutError") { lastErr = new Error("Rainforest timeout"); continue; }
      throw e;
    }
  }
  throw lastErr ?? new Error("Rainforest failed after retry");
}

function extractRainforestPrice(product: any): string | null {
  // Try common locations for book price in Rainforest product response
  const candidates = [
    product?.buybox_winner?.price?.raw,
    product?.buybox_winner?.price?.value != null
      ? `$${product.buybox_winner.price.value}` : null,
    product?.price?.raw,
    typeof product?.price === "string" ? product.price : null,
  ];
  return candidates.find((v) => typeof v === "string" && v.length > 0) ?? null;
}

function normalizeRainforestSearchResult(r: any, domain: string): UnifiedBook {
  const asin = String(r.asin || "").toUpperCase() || null;
  return {
    asin,
    openLibraryKey:      null,
    title:               r.title || "Unknown title",
    subtitle:            null,
    authors:             null,
    url:                 asin ? `https://www.${domain}/dp/${asin}` : "",
    thumbnail:           r.image || null,
    rating:              typeof r.rating === "number" ? r.rating : null,
    ratingsTotal:        typeof r.ratings_total === "number" ? r.ratings_total : null,
    reviewCount:         typeof r.ratings_total === "number" ? r.ratings_total : null,
    price:               null,
    bestsellersRankFlat: null,
    bestsellersRanks:    null,
    publicationDate:     null,
    sponsored:           Boolean(r.sponsored),
    bestsellerBadge:     r.bestseller ? (typeof r.bestseller === "object" ? r.bestseller : {}) : null,
    expandedDetailsLoaded: false,
    dataSource:          "rainforest",
    source_provider:     "rainforest",
  };
}

// ─── Scale SERP ───────────────────────────────────────────────────────────

async function scaleSerpOneQuery(apiKey: string, q: string, domain: string): Promise<UnifiedBook[]> {
  const url = new URL("https://api.scaleserp.com/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("q", q);
  url.searchParams.set("num", "40");
  url.searchParams.set("gl", "us");
  url.searchParams.set("hl", "en");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  if (!data || data.request_info?.success === false) return [];

  const organic: any[] = Array.isArray(data.organic_results) ? data.organic_results : [];
  const books: UnifiedBook[] = [];

  for (const result of organic) {
    const link: string = result.link || result.url || "";
    const m = link.match(/\/dp\/([A-Z0-9]{10})/i);
    if (!m) continue;
    const asin = m[1].toUpperCase();
    if (books.some((b) => b.asin === asin)) continue;
    books.push({
      asin,
      openLibraryKey:      null,
      title:               result.title || "Unknown title",
      subtitle:            null,
      authors:             null,
      url:                 `https://www.${domain}/dp/${asin}`,
      thumbnail:           result.thumbnail || result.image || null,
      rating:              null,
      ratingsTotal:        null,
      reviewCount:         null,
      price:               null,
      bestsellersRankFlat: null,
      bestsellersRanks:    null,
      publicationDate:     null,
      sponsored:           false,
      bestsellerBadge:     null,
      expandedDetailsLoaded: false,
      dataSource:          "scale_serp",
      source_provider:     "scale_serp",
    });
  }
  return books;
}

async function scaleSerpSearchBooks(
  apiKey: string,
  query: string,
  domain: string,
  maxResults = 20
): Promise<UnifiedBook[]> {
  const d = domain.replace(/^www\./, "");
  const queries = [
    `site:${d} ${query} book`,
    `site:${d} ${query} books bestseller`,
    `site:${d} ${query} books paperback`,
    `site:${d} ${query} books top rated review`,
  ];

  const batches = await Promise.all(queries.map((q) => scaleSerpOneQuery(apiKey, q, d).catch(() => [])));

  const seen = new Set<string>();
  const merged: UnifiedBook[] = [];
  for (const batch of batches) {
    for (const book of batch) {
      if (book.asin && !seen.has(book.asin)) {
        seen.add(book.asin);
        merged.push(book);
        if (merged.length >= maxResults) return merged;
      }
    }
  }
  return merged;
}

// ─── Open Library ─────────────────────────────────────────────────────────

interface OLFields {
  rating:       number | null;
  ratingsTotal: number | null;
  authors:      string | null;
  thumbnail:    string | null;
}

async function openLibraryByTitle(title: string): Promise<OLFields | null> {
  try {
    const clean = title.replace(/\s*\(.*?\)\s*/g, "").replace(/\s*:.*$/, "").trim().slice(0, 80);
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set("title", clean);
    url.searchParams.set("fields", "title,author_name,cover_i,ratings_average,ratings_count");
    url.searchParams.set("limit", "1");
    url.searchParams.set("language", "eng");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "NonfictionStudio/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const doc = data.docs?.[0];
    if (!doc) return null;

    return {
      rating: typeof doc.ratings_average === "number" && doc.ratings_average > 0
        ? Math.round(doc.ratings_average * 10) / 10 : null,
      ratingsTotal: typeof doc.ratings_count === "number" ? doc.ratings_count : null,
      authors: Array.isArray(doc.author_name) && doc.author_name.length
        ? doc.author_name.join(", ") : null,
      thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    };
  } catch { return null; }
}

async function openLibrarySearch(query: string, maxResults = 20): Promise<UnifiedBook[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "key,title,subtitle,author_name,cover_i,ratings_average,ratings_count,first_publish_year");
  url.searchParams.set("limit", String(Math.min(maxResults, 40)));
  url.searchParams.set("sort", "rating");
  url.searchParams.set("language", "eng");

  const res = await fetch(url.toString(), { headers: { "User-Agent": "NonfictionStudio/1.0" } });
  if (!res.ok) return [];
  const data = await res.json();

  return (Array.isArray(data.docs) ? data.docs : [])
    .filter((doc: any) => doc?.title)
    .map((doc: any): UnifiedBook => {
      const key = typeof doc.key === "string" ? doc.key : null;
      return {
        asin:                null,
        openLibraryKey:      key,
        title:               doc.title,
        subtitle:            doc.subtitle || null,
        authors:             Array.isArray(doc.author_name) ? doc.author_name.join(", ") : null,
        url:                 key ? `https://openlibrary.org${key}` : "https://openlibrary.org",
        thumbnail:           doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
        rating:              typeof doc.ratings_average === "number" && doc.ratings_average > 0
          ? Math.round(doc.ratings_average * 10) / 10 : null,
        ratingsTotal:        typeof doc.ratings_count === "number" ? doc.ratings_count : null,
        reviewCount:         typeof doc.ratings_count === "number" ? doc.ratings_count : null,
        price:               null,
        bestsellersRankFlat: null,
        bestsellersRanks:    null,
        publicationDate:     doc.first_publish_year ? String(doc.first_publish_year) : null,
        sponsored:           false,
        bestsellerBadge:     null,
        expandedDetailsLoaded: false,
        dataSource:          "open_library",
        source_provider:     "open_library",
      };
    });
}

// ─── AmazonDataProvider ────────────────────────────────────────────────────

export interface SearchResult {
  books:  UnifiedBook[];
  query:  string;
  source: string;
}

export class AmazonDataProvider {
  private rainforestKey: string | undefined;
  private scaleSerpKey:  string | undefined;

  constructor({ rainforestKey, scaleSerpKey }: { rainforestKey?: string; scaleSerpKey?: string }) {
    this.rainforestKey = rainforestKey;
    this.scaleSerpKey  = scaleSerpKey;
  }

  // ── Search ──────────────────────────────────────────────────────────────

  async searchBooks(query: string, amazonDomain = "amazon.com", maxResults = 20): Promise<SearchResult> {
    const domain = amazonDomain.replace(/^www\./, "");

    // ── Step 1: Rainforest ─────────────────────────────────────────────
    if (this.rainforestKey) {
      try {
        console.log(`[AmazonDataProvider] Rainforest search: "${query}"`);
        const data = await rainforestGet(this.rainforestKey, {
          type:            "search",
          amazon_domain:   domain,
          search_term:     query,
          sort_by:         "bestseller_rankings",
          number_of_results: Math.max(maxResults, 24),
          exclude_sponsored: true,
        });

        const results: any[] = Array.isArray(data.search_results) ? data.search_results : [];
        const books = results
          .filter((r) => r?.asin && r?.title)
          .map((r) => normalizeRainforestSearchResult(r, domain));

        if (books.length > 0) {
          console.log(`[AmazonDataProvider] Rainforest returned ${books.length} books`);
          return { books: books.slice(0, maxResults), query, source: "rainforest" };
        }
        console.warn("[AmazonDataProvider] Rainforest search returned 0 results, falling through");
      } catch (e: any) {
        console.warn("[AmazonDataProvider] Rainforest search failed:", e.message?.slice(0, 150));
      }
    }

    // ── Step 2: Scale SERP → enrich with Open Library ─────────────────
    if (this.scaleSerpKey) {
      try {
        console.log(`[AmazonDataProvider] Scale SERP search: "${query}"`);
        const rawBooks = await scaleSerpSearchBooks(this.scaleSerpKey, query, domain, maxResults);

        // Enrich with Open Library in parallel (only set expandedDetailsLoaded if we got a rating)
        const enriched = await Promise.all(
          rawBooks.map(async (book) => {
            const ol = await openLibraryByTitle(book.title);
            if (!ol) return book;
            const gotRating = ol.rating != null;
            const isActuallyMerged = gotRating || ol.authors != null || ol.thumbnail != null;
            return {
              ...book,
              rating:              book.rating       ?? ol.rating,
              ratingsTotal:        book.ratingsTotal  ?? ol.ratingsTotal,
              reviewCount:         book.reviewCount   ?? ol.ratingsTotal,
              authors:             book.authors       ?? ol.authors,
              thumbnail:           book.thumbnail     ?? ol.thumbnail,
              expandedDetailsLoaded: gotRating,
              dataSource:          (isActuallyMerged ? "merged" : "scale_serp") as UnifiedBook["dataSource"],
            };
          })
        );

        const MIN = 12;
        const TARGET = maxResults;

        if (enriched.length >= MIN) {
          return { books: enriched.slice(0, TARGET), query, source: "scale_serp" };
        }

        // Top up with Open Library when < 12 Amazon results
        const needed = TARGET - enriched.length;
        const olTitles = new Set(enriched.map((b) => b.title.toLowerCase().slice(0, 30)));
        let supplement: UnifiedBook[] = [];
        try {
          const libBooks = await openLibrarySearch(query, needed + 5);
          supplement = libBooks
            .filter((b) => !olTitles.has(b.title.toLowerCase().slice(0, 30)))
            .slice(0, needed);
        } catch { /* optional */ }

        const combined = [...enriched, ...supplement];
        if (combined.length > 0) {
          return { books: combined.slice(0, TARGET), query, source: "scale_serp" };
        }
        console.warn("[AmazonDataProvider] Scale SERP returned 0 results");
      } catch (e: any) {
        console.warn("[AmazonDataProvider] Scale SERP failed:", e.message?.slice(0, 150));
      }
    }

    // ── Step 3: Open Library only ──────────────────────────────────────
    console.log(`[AmazonDataProvider] Open Library fallback search: "${query}"`);
    const books = await openLibrarySearch(query, maxResults);
    return {
      books,
      query,
      source: "open_library",
    };
  }

  // ── Product detail ──────────────────────────────────────────────────────

  async getProductDetails(
    asin: string,
    title?: string,
    amazonDomain = "amazon.com"
  ): Promise<UnifiedProductDetails | null> {
    const domain = amazonDomain.replace(/^www\./, "");

    // ── Step 1: Rainforest product ──────────────────────────────────────
    if (this.rainforestKey) {
      try {
        console.log(`[AmazonDataProvider] Rainforest product: ${asin}`);
        const data = await rainforestGet(this.rainforestKey, {
          type:          "product",
          amazon_domain: domain,
          asin:          asin.toUpperCase(),
        });

        const p = data?.product;
        if (p) {
          const authors =
            Array.isArray(p.authors) && p.authors.length
              ? p.authors.map((a: any) => (typeof a === "string" ? a : a?.name || "").trim()).filter(Boolean).join(", ")
              : typeof p.book_author === "string" ? p.book_author : null;

          let bestsellersRanks: UnifiedProductDetails["bestsellersRanks"] = null;
          let bestsellersRankFlat: string | null = typeof p.bestsellers_rank_flat === "string"
            ? p.bestsellers_rank_flat : null;

          if (Array.isArray(p.bestsellers_rank) && p.bestsellers_rank.length) {
            bestsellersRanks = p.bestsellers_rank
              .filter((r: any) => r.rank != null && r.category)
              .map((r: any) => ({ category: r.category, rank: r.rank, link: r.link ?? null }));
            bestsellersRankFlat ||= bestsellersRanks
              .map((r) => `#${r.rank} in ${r.category}`)
              .join(" · ") || null;
          }

          const rating      = typeof p.rating === "number" ? p.rating : null;
          const ratingsTotal = typeof p.ratings_total === "number" ? p.ratings_total : null;
          const price       = extractRainforestPrice(p);

          // Extract extended fields
          const rawDesc = p.description;
          const description: string | null =
            typeof rawDesc === "string" ? rawDesc
            : Array.isArray(rawDesc) ? rawDesc.map((s: any) => (typeof s === "string" ? s : s?.text || "")).join(" ").trim() || null
            : null;

          const pageCount: number | null =
            typeof p.page_count === "number" ? p.page_count
            : typeof p.pages === "number" ? p.pages
            : null;

          const language: string | null =
            typeof p.language === "string" ? p.language
            : Array.isArray(p.languages) && p.languages.length ? p.languages[0]
            : null;

          const isbn: string | null =
            typeof p.isbn_13 === "string" ? p.isbn_13
            : typeof p.isbn_10 === "string" ? p.isbn_10
            : null;

          const format: string | null =
            typeof p.format === "string" ? p.format
            : typeof p.binding === "string" ? p.binding
            : null;

          const publisher: string | null =
            typeof p.publisher === "string" ? p.publisher
            : typeof p.brand === "string" ? p.brand
            : null;

          return {
            title:               typeof p.title === "string" ? p.title : null,
            subtitle:            typeof p.sub_title === "string" ? p.sub_title : null,
            authors,
            thumbnail:           typeof p.main_image?.link === "string" ? p.main_image.link : null,
            rating,
            ratingsTotal,
            reviewCount:         ratingsTotal,
            price,
            bestsellersRankFlat,
            bestsellersRanks,
            publicationDate:     p.publication_date || p.first_available?.raw || null,
            expandedDetailsLoaded: true,
            dataSource:          "rainforest",
            description,
            pageCount,
            language,
            isbn,
            format,
            publisher,
          };
        }
      } catch (e: any) {
        console.warn("[AmazonDataProvider] Rainforest product failed:", e.message?.slice(0, 150));
      }
    }

    // ── Step 2: Open Library by title ──────────────────────────────────
    if (title) {
      try {
        console.log(`[AmazonDataProvider] Open Library lookup: "${title}"`);
        const ol = await openLibraryByTitle(title);
        if (ol) {
          return {
            title:               null,
            subtitle:            null,
            authors:             ol.authors,
            thumbnail:           ol.thumbnail,
            rating:              ol.rating,
            ratingsTotal:        ol.ratingsTotal,
            reviewCount:         ol.ratingsTotal,
            price:               null,
            bestsellersRankFlat: null,
            bestsellersRanks:    null,
            publicationDate:     null,
            expandedDetailsLoaded: true,
            dataSource:          "open_library",
          };
        }
      } catch { /* ignore */ }
    }

    return null;
  }
}

// ─── Singleton factory ─────────────────────────────────────────────────────

export function createAmazonDataProvider(): AmazonDataProvider {
  return new AmazonDataProvider({
    rainforestKey: process.env.RAINFOREST_API_KEY,
    scaleSerpKey:  process.env.SCALE_SERP_API_KEY,
  });
}
