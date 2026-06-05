import { useEffect, useRef, useState } from "react";
import { extractAsinFromAmazonUrl } from "@/lib/analysis/asin";

function newBookId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `bk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function IntelChip({ label, value }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-800 leading-snug">{value}</p>
    </div>
  );
}

function IntelTags({ label, values, colorClass = "bg-sky-100 text-sky-800" }) {
  if (!Array.isArray(values) || !values.length) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>{v}</span>
        ))}
      </div>
    </div>
  );
}

export default function AnalysisStep({ research, analysis, errors, updateAnalysis, patchBook, removeBook }) {
  const [searchQuery, setSearchQuery]           = useState(analysis.lastSearchQuery || "");
  const [loadingSearch, setLoadingSearch]       = useState(false);
  const [loadingProductId, setLoadingProductId] = useState(null);
  const [localMsg, setLocalMsg]                 = useState("");
  const [manualUrl, setManualUrl]               = useState("");
  const [manualTitle, setManualTitle]           = useState("");
  const [expandedId, setExpandedId]             = useState(null);
  const [intelLoading, setIntelLoading]         = useState(false);
  const [intelError, setIntelError]             = useState("");
  const [autoExpandCount, setAutoExpandCount]   = useState(0);
  const autoExpandedIds = useRef(new Set());

  const amazonDomain = analysis.amazonDomain || "amazon.com";
  const intelligence = analysis.intelligence  || null;

  useEffect(() => {
    if (analysis.lastSearchQuery) setSearchQuery(analysis.lastSearchQuery);
    else if (research.genre || research.bookTopic) {
      const q = [research.genre, research.bookTopic, "books"].filter(Boolean).join(" ").trim();
      setSearchQuery(q);
    }
  }, [research.genre, research.bookTopic]);

  // Auto-expand all ASIN books that haven't been enriched yet
  useEffect(() => {
    const pending = analysis.books.filter(
      (b) => b.asin && !b.expandedDetailsLoaded && !autoExpandedIds.current.has(b.id)
    );
    if (pending.length === 0) return;

    // Mark all as in-progress immediately so subsequent renders don't re-trigger
    pending.forEach((b) => autoExpandedIds.current.add(b.id));
    setAutoExpandCount((n) => n + pending.length);

    const BATCH = 3;
    async function runBatches() {
      for (let i = 0; i < pending.length; i += BATCH) {
        const batch = pending.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async (book) => {
            try {
              const res = await fetch("/api/analysis/amazon-product", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ asin: book.asin, title: book.title, amazonDomain }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok || data.needsApiKey) return;
              const d = data.details || {};
              patchBook(book.id, {
                title:               d.title              || book.title,
                subtitle:            d.subtitle           ?? book.subtitle,
                authors:             d.authors            ?? book.authors,
                thumbnail:           d.thumbnail          || book.thumbnail,
                rating:              d.rating             ?? book.rating,
                ratingsTotal:        d.ratingsTotal       ?? book.ratingsTotal,
                reviewCount:         d.reviewCount        ?? book.reviewCount,
                price:               d.price              ?? book.price,
                bestsellersRankFlat: d.bestsellersRankFlat ?? book.bestsellersRankFlat,
                bestsellersRanks:    d.bestsellersRanks   ?? book.bestsellersRanks,
                publicationDate:     d.publicationDate    ?? book.publicationDate,
                dataSource:          d.dataSource         ?? book.dataSource,
                expandedDetailsLoaded: true,
              });
            } catch { /* ignore individual failures */ }
          })
        );
        setAutoExpandCount((n) => Math.max(0, n - batch.length));
      }
    }

    runBatches();
  }, [analysis.books]);

  async function runAmazonSearch(mode) {
    const q = searchQuery.trim();
    if (!q) { setLocalMsg("Enter a search query."); return; }
    setLoadingSearch(true);
    setLocalMsg("");
    try {
      const res  = await fetch("/api/analysis/amazon-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, amazonDomain })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Search failed.");
      if (data.needsApiKey) { setLocalMsg(data.message || "Configure RAINFOREST_API_KEY on the server."); return; }

      const rows = Array.isArray(data.books) ? data.books : [];
      const isFallbackSource = data.source === "google_books" || data.source === "open_library";
      updateAnalysis((prev) => {
        const stamped = rows
          .filter((r) => r.title)
          .map((r) => ({ ...r, id: newBookId(), source: isFallbackSource ? (data.source || "open_library") : "amazon", expandedDetailsLoaded: Boolean(r.expandedDetailsLoaded) }));
        const bookKey = (b) => b.asin || b.googleBooksId || b.url || "";
        let nextBooks;
        if (mode === "replace") {
          const manualsOnly = prev.books.filter((b) => b.source === "manual");
          const manualKeys = new Set(manualsOnly.map(bookKey).filter(Boolean));
          nextBooks = [...manualsOnly, ...stamped.filter((s) => !manualKeys.has(bookKey(s)))];
        } else {
          const existingKeys = new Set(prev.books.map(bookKey).filter(Boolean));
          nextBooks = [...prev.books, ...stamped.filter((s) => !existingKeys.has(bookKey(s)))];
        }
        return { ...prev, books: nextBooks, lastSearchQuery: q };
      });
      const sourceLabel = data.source === "open_library" ? "Open Library" : data.source === "google_books" ? "Google Books" : "Amazon";
      setLocalMsg(`${rows.length} ${sourceLabel} result(s) loaded.${isFallbackSource ? " Add RAINFOREST_API_KEY or SCALE_SERP_API_KEY to search Amazon directly." : ""}`);
    } catch (e) {
      setLocalMsg(e.message || "Something went wrong.");
    } finally {
      setLoadingSearch(false);
    }
  }

  async function expandBook(book) {
    if (!book.asin) { setLocalMsg("Expand details need an Amazon ASIN."); return; }
    if (expandedId === book.id) { setExpandedId(null); return; }
    setExpandedId(book.id);
    if (book.expandedDetailsLoaded && book.bestsellersRankFlat != null) return;
    setLoadingProductId(book.id);
    setLocalMsg("");
    try {
      const res  = await fetch("/api/analysis/amazon-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin: book.asin, title: book.title, amazonDomain })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load product details.");
      if (data.needsApiKey) { setLocalMsg(data.message || "Add RAINFOREST_API_KEY to load full details."); return; }
      const d = data.details || {};
      patchBook(book.id, {
        title:               d.title              || book.title,
        subtitle:            d.subtitle           ?? book.subtitle,
        authors:             d.authors            ?? book.authors,
        thumbnail:           d.thumbnail          || book.thumbnail,
        rating:              d.rating             ?? book.rating,
        ratingsTotal:        d.ratingsTotal       ?? book.ratingsTotal,
        reviewCount:         d.reviewCount        ?? book.reviewCount,
        price:               d.price              ?? book.price,
        bestsellersRankFlat: d.bestsellersRankFlat ?? book.bestsellersRankFlat,
        bestsellersRanks:    d.bestsellersRanks   ?? book.bestsellersRanks,
        publicationDate:     d.publicationDate    ?? book.publicationDate,
        dataSource:          d.dataSource         ?? book.dataSource,
        expandedDetailsLoaded: true,
      });
    } catch (e) {
      setLocalMsg(e.message || "Expand failed.");
    } finally {
      setLoadingProductId(null);
    }
  }

  function addManualReference() {
    const url = manualUrl.trim();
    if (!url) { setLocalMsg("Paste an Amazon URL."); return; }
    const asin      = extractAsinFromAmazonUrl(url);
    const titleTrim = manualTitle.trim() || "Reference book";
    const d         = amazonDomain.replace(/^www\./, "");
    updateAnalysis((prev) => {
      const list = [...prev.books];
      const dup  = list.some((b) => (asin && b.asin === asin) || (!asin && b.url === url && b.source === "manual"));
      if (dup) return prev;
      list.push({
        id: newBookId(), source: "manual", asin,
        title: titleTrim,
        url: asin ? `https://www.${d}/dp/${asin}` : url,
        thumbnail: null, rating: null, ratingsTotal: null,
        bestsellersRankFlat: null, bestsellersRanks: null, expandedDetailsLoaded: false
      });
      return { ...prev, books: list };
    });
    setManualUrl(""); setManualTitle("");
    setLocalMsg("Reference added.");
  }

  async function generateIntelligence() {
    if (analysis.books.length === 0) {
      setIntelError("Add at least one competitor or reference book first, then generate intelligence.");
      return;
    }
    setIntelLoading(true);
    setIntelError("");
    try {
      const res = await fetch("/api/ai/competitive-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche:     research.mainNicheLabel || research.genre || "",
          subNiche:  research.subNicheLabel  || "",
          deepNiche: research.deepNicheLabel || "",
          bookTopic: research.bookTopic      || "",
          books: analysis.books.map((b) => ({
            title:        b.title,
            authors:      b.authors,
            subtitle:     b.subtitle,
            rating:       b.rating,
            ratingsTotal: b.ratingsTotal
          }))
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Intelligence generation failed.");
      updateAnalysis((prev) => ({ ...prev, intelligence: data }));
      setLocalMsg("Market intelligence extracted — these signals will auto-fill your author tone, audience, and positioning throughout the book builder.");
    } catch (e) {
      setIntelError(e.message || "Failed to generate intelligence. Try again.");
    } finally {
      setIntelLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">

      {/* ── Header ── */}
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700/90">Step 2 — Competitive intelligence</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-slate-900 md:text-3xl">Competitive landscape</h2>
        <p className="mt-2 text-sm text-slate-600">
          Find competitor books in your niche, then let the AI extract your target audience, reader psychology, tone
          strategy, and positioning — automatically.
        </p>
      </header>

      {errors?.form && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{errors.form}</p>
      )}

      {/* ── Amazon search ── */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="text-sm font-medium text-slate-700">Amazon search query</label>
        <input
          className="input-light mt-1.5"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`e.g. ${research.genre || "business"} books ${research.bookTopic || ""}`.trim()}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loadingSearch}
            onClick={() => runAmazonSearch("replace")}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loadingSearch ? "Searching…" : "Search bestsellers"}
          </button>
          <button
            type="button"
            disabled={loadingSearch}
            onClick={() => runAmazonSearch("append")}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Append results
          </button>
          <p className="w-full text-xs text-slate-500">
            Replace swaps Amazon results but keeps manuals. Append merges without duplicating. Requires optional{" "}
            <span className="font-mono">RAINFOREST_API_KEY</span>.
          </p>
        </div>
      </div>

      {localMsg && (
        <p className={`mt-4 text-sm ${localMsg.includes("intelligence extracted") ? "font-medium text-emerald-700" : "text-slate-600"}`}>
          {localMsg}
        </p>
      )}

      {autoExpandCount > 0 && (
        <p className="mt-2 text-xs text-sky-600 animate-pulse">
          ⟳ Fetching ratings for {autoExpandCount} book{autoExpandCount !== 1 ? "s" : ""}…
        </p>
      )}

      {/* ── Book list ── */}
      <ul className="mt-6 space-y-3">
        {analysis.books.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-500">
            No references yet — search above or paste a URL below.
          </li>
        )}
        {analysis.books.map((book) => {
          const isOpen       = expandedId === book.id;
          const ratingLabel  = typeof book.rating === "number" ? `${book.rating.toFixed(1)} ★` : null;
          const reviewsLabel = typeof (book.ratingsTotal ?? book.reviewCount) === "number"
            ? `${(book.ratingsTotal ?? book.reviewCount).toLocaleString()} ratings`
            : null;

          // Data source badge config
          const ds = book.source === "manual" ? "manual"
            : book.dataSource === "rainforest" ? "rainforest"
            : book.dataSource === "merged" ? "merged"
            : book.source_provider === "open_library" || book.source === "open_library" ? "open_library"
            : "scale_serp";

          const dsBadge = {
            manual:      { label: "Your reference",        cls: "bg-amber-100 text-amber-900" },
            rainforest:  { label: "✓ Rainforest",          cls: "bg-emerald-100 text-emerald-800" },
            merged:      { label: "✓ Rainforest + OL",     cls: "bg-sky-100 text-sky-800" },
            open_library:{ label: "Open Library",          cls: "bg-teal-100 text-teal-800" },
            scale_serp:  { label: "Scale SERP Fallback",   cls: "bg-slate-100 text-slate-700" },
          }[ds];

          return (
            <li key={book.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex gap-4 p-4">
                {book.thumbnail ? (
                  <img src={book.thumbnail} alt="" className="h-28 w-[4.85rem] shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-28 w-[4.85rem] shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                    No cover
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${dsBadge.cls}`}>
                      {dsBadge.label}
                    </span>
                    {book.price && (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                        {book.price}
                      </span>
                    )}
                    {book.bestsellerBadge && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        Bestseller
                      </span>
                    )}
                  </div>

                  <p className="mt-1 font-semibold leading-snug text-slate-900">{book.title}</p>
                  {book.subtitle && (
                    <p className="text-[11px] italic text-slate-500 leading-snug">{book.subtitle}</p>
                  )}
                  {book.authors && <p className="mt-0.5 text-xs text-slate-600">{book.authors}</p>}

                  {/* Rating + date row */}
                  {(ratingLabel || reviewsLabel || book.publicationDate) && (
                    <p className="mt-1 text-xs text-slate-500">
                      {[ratingLabel, reviewsLabel, book.publicationDate && `Published ${book.publicationDate}`]
                        .filter(Boolean).join(" · ")}
                    </p>
                  )}

                  <a href={book.url} target="_blank" rel="noreferrer"
                    className="mt-1.5 inline-block max-w-full truncate text-[11px] text-sky-700 hover:underline">
                    {book.url}
                  </a>

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => expandBook(book)}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
                    >
                      {loadingProductId === book.id ? "Loading…" : isOpen ? "Collapse" : "Expand details"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBook(book.id)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-4 space-y-3 text-sm text-slate-700">

                  {/* Data source indicator */}
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${
                      ds === "rainforest" || ds === "merged"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {ds === "rainforest" || ds === "merged" ? "✓" : "○"} Rainforest
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${
                      ds === "scale_serp" || ds === "merged"
                        ? "bg-sky-50 text-sky-700 border border-sky-200"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {ds === "scale_serp" || ds === "merged" ? "✓" : "○"} Scale SERP Fallback
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${
                      ds === "open_library" || ds === "merged"
                        ? "bg-teal-50 text-teal-700 border border-teal-200"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {ds === "open_library" || ds === "merged" ? "✓" : "○"} Open Library
                    </span>
                  </div>

                  {/* Detail fields */}
                  <div className="grid gap-1.5 text-xs sm:grid-cols-2">
                    <div><span className="font-medium text-slate-800">Rating:</span>{" "}
                      {ratingLabel ?? <span className="text-slate-400">Unavailable</span>}</div>
                    <div><span className="font-medium text-slate-800">Ratings:</span>{" "}
                      {reviewsLabel ?? <span className="text-slate-400">Unavailable</span>}</div>
                    {book.price && (
                      <div><span className="font-medium text-slate-800">Price:</span> {book.price}</div>
                    )}
                    {book.publicationDate && (
                      <div><span className="font-medium text-slate-800">Published:</span> {book.publicationDate}</div>
                    )}
                  </div>

                  {/* Bestseller rank */}
                  <div>
                    <p className="text-xs font-medium text-slate-800 mb-1">Bestseller rank</p>
                    {book.bestsellersRankFlat ? (
                      <p className="text-xs text-slate-700">{book.bestsellersRankFlat}</p>
                    ) : (
                      <p className="text-xs text-slate-400">
                        {ds === "rainforest" ? "No rank data returned." : "Requires Rainforest API — add RAINFOREST_API_KEY."}
                      </p>
                    )}
                    {Array.isArray(book.bestsellersRanks) && book.bestsellersRanks.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 text-xs">
                        {book.bestsellersRanks.map((row, i) => (
                          <li key={i} className="text-slate-700">
                            <span className="font-semibold">#{row.rank}</span> in {row.category}
                            {row.link && (
                              <a className="ml-2 text-sky-600 hover:underline" href={row.link} target="_blank" rel="noreferrer">
                                View
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* ── Add manual reference ── */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-lg font-semibold text-slate-900">Add your reference copy</h3>
        <p className="mt-1 text-xs text-slate-600">
          Paste any Amazon paperback or Kindle listing URL. Optionally name it.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            className="input-light"
            placeholder="https://www.amazon.com/dp/…"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
          />
          <input
            className="input-light"
            placeholder="Optional display title"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
          />
          <button
            type="button"
            onClick={addManualReference}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Add URL
          </button>
        </div>
      </div>

      {/* ── Intelligence Engine ── */}
      <div className="mt-10 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/40 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
              Competitive Intelligence Engine
            </p>
            <h3 className="mt-1 font-serif text-xl font-semibold text-slate-900">
              AI Market Analysis
            </h3>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-600">
              Once your competitor books are loaded, the AI analyzes them to extract your target audience, reader pain profile, ideal tone, positioning strategy, and more.
              These signals auto-fill your author persona, outline, and all downstream steps.
            </p>
          </div>
          <button
            type="button"
            onClick={generateIntelligence}
            disabled={intelLoading || analysis.books.length === 0}
            className="shrink-0 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {intelLoading ? "Analyzing…" : intelligence ? "Re-analyze" : "Analyze Competitors"}
          </button>
        </div>

        {intelLoading && (
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
            <p className="text-sm font-semibold text-indigo-700 animate-pulse">
              AI extracting market intelligence from {analysis.books.length} competitor book{analysis.books.length !== 1 ? "s" : ""}…
            </p>
          </div>
        )}

        {intelError && (
          <p className="mt-3 text-sm font-medium text-rose-700">{intelError}</p>
        )}

        {intelligence && !intelLoading && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Intelligence extracted — auto-filling all downstream steps
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <IntelChip label="Target Audience"       value={intelligence.targetAudience} />
              <IntelChip label="Energy Style"          value={intelligence.energyStyle} />
              <IntelChip label="Reader Pain Profile"   value={intelligence.readerPainProfile} />
              <IntelChip label="Transformation Promise" value={intelligence.transformationPromise} />
            </div>

            <IntelTags
              label="Recommended Author Tones"
              values={intelligence.authorTones}
              colorClass="bg-sky-100 text-sky-800"
            />

            <IntelTags
              label="Emotional Triggers"
              values={intelligence.emotionalTriggers}
              colorClass="bg-violet-100 text-violet-800"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <IntelChip label="Tone Recommendation"    value={intelligence.toneRecommendation} />
              <IntelChip label="Writing Style"          value={intelligence.writingStyleFingerprint} />
              <IntelChip label="Positioning Strategy"   value={intelligence.positioningStrategy} />
              <IntelChip label="Market Gap"             value={intelligence.marketGapAnalysis} />
            </div>

            {intelligence.bestsellerDNA && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">Bestseller DNA</p>
                <p className="text-sm text-slate-800 leading-snug">{intelligence.bestsellerDNA}</p>
              </div>
            )}
          </div>
        )}

        {!intelligence && !intelLoading && analysis.books.length === 0 && (
          <p className="mt-4 rounded-xl border border-dashed border-indigo-200 bg-white/60 px-4 py-3 text-sm text-slate-500">
            Add competitor books above, then click <span className="font-semibold">Analyze Competitors</span> to generate your publishing intelligence profile.
          </p>
        )}

        {!intelligence && !intelLoading && analysis.books.length > 0 && (
          <p className="mt-4 rounded-xl border border-indigo-100 bg-white/70 px-4 py-3 text-sm text-slate-600">
            {analysis.books.length} book{analysis.books.length !== 1 ? "s" : ""} ready — click{" "}
            <span className="font-semibold text-indigo-700">Analyze Competitors</span> to extract your market intelligence.
          </p>
        )}
      </div>

    </div>
  );
}
