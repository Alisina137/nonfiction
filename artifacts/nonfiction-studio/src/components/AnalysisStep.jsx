import { useEffect, useState } from "react";
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
        {values.map((v, i) => (
          <span key={`${i}-${v}`} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>{v}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * Build a short, Amazon-optimised search query from the research niche data.
 * Priority: deepNicheLabel → subNicheLabel → mainNicheLabel → cleaned bookTopic → genre
 * Produces 3-6 word phrases optimized for Amazon bestseller discovery.
 */
function buildAmazonQuery(research) {
  // Prefer the most specific niche label — already short and Amazon-friendly
  const niche = research.deepNicheLabel || research.subNicheLabel || research.mainNicheLabel;
  if (niche) return niche.toLowerCase().trim();

  // Fall back to first 4 words of bookTopic, stripping filler
  const topic = (research.bookTopic || "").trim();
  if (topic) {
    const words = topic
      .replace(/\b(for|and|with|the|a|an|to|of|in|on|by|about|how|that|this|are|is)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 5);
    if (words.length >= 2) return words.join(" ").toLowerCase();
  }

  return (research.genre || "").toLowerCase().trim();
}

export default function AnalysisStep({ research, analysis, errors, updateAnalysis, patchBook, removeBook, updateResearch }) {
  const [searchQuery, setSearchQuery]         = useState(analysis.lastSearchQuery || "");
  const [loadingSearch, setLoadingSearch]     = useState(false);
  const [loadingProductId, setLoadingProductId] = useState(null);
  const [localMsg, setLocalMsg]               = useState("");
  const [manualUrl, setManualUrl]             = useState("");
  const [manualTitle, setManualTitle]         = useState("");
  const [expandedId, setExpandedId]           = useState(null);
  const [intelLoading, setIntelLoading]       = useState(false);
  const [intelError, setIntelError]           = useState("");
  const [posLoading, setPosLoading]           = useState(false);
  const [posError, setPosError]               = useState("");
  const [posResult, setPosResult]             = useState(null);

  const amazonDomain = analysis.amazonDomain || "amazon.com";
  const intelligence = analysis.intelligence  || null;
  const isNewIntel   = intelligence && typeof intelligence.targetAudience === "object" && !Array.isArray(intelligence.targetAudience);

  useEffect(() => {
    if (analysis.lastSearchQuery) { setSearchQuery(analysis.lastSearchQuery); return; }
    const q = buildAmazonQuery(research);
    if (q) setSearchQuery(q);
  }, [research.deepNicheLabel, research.subNicheLabel, research.mainNicheLabel, research.bookTopic, research.genre]);

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
      // scale_serp and amazon are real live sources; ai_research and open_library are fallbacks
      const isFallbackSource = data.source === "google_books" || data.source === "open_library" || data.source === "ai_research";
      const bookSource = isFallbackSource ? (data.source || "open_library")
        : data.source === "scale_serp" ? "scale_serp"
        : "amazon";
      updateAnalysis((prev) => {
        const stamped = rows
          .filter((r) => r.title)
          .map((r) => ({ ...r, id: newBookId(), source: bookSource, expandedDetailsLoaded: Boolean(r.expandedDetailsLoaded) }));
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
      const sourceLabel = data.source === "open_library" ? "Open Library"
        : data.source === "google_books" ? "Google Books"
        : data.source === "ai_research" ? "AI Research"
        : data.source === "scale_serp" ? "Scale SERP"
        : "Amazon";
      // Show server-provided notice when available, otherwise show fallback hint only if keys are missing
      const fallbackNote = data.notice ? ` ${data.notice}` : "";
      setLocalMsg(`${rows.length} ${sourceLabel} result(s) loaded.${fallbackNote}`);
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
    if (book.expandedDetailsLoaded) return;
    setLoadingProductId(book.id);
    setLocalMsg("");
    try {
      const res  = await fetch("/api/analysis/amazon-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin: book.asin, amazonDomain })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load product details.");
      if (data.needsApiKey) { setLocalMsg(data.message || "Add RAINFOREST_API_KEY to load details."); return; }
      const d = data.details || {};
      patchBook(book.id, {
        title:               d.title              || book.title,
        subtitle:            d.subtitle           ?? book.subtitle,
        authors:             d.authors            ?? book.authors,
        thumbnail:           d.thumbnail          || book.thumbnail,
        rating:              d.rating             ?? book.rating,
        ratingsTotal:        d.ratingsTotal       ?? book.ratingsTotal,
        bestsellersRankFlat: d.bestsellersRankFlat ?? book.bestsellersRankFlat,
        bestsellersRanks:    d.bestsellersRanks   ?? book.bestsellersRanks,
        publicationDate:     d.publicationDate    ?? book.publicationDate,
        expandedDetailsLoaded: true
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

      // Validate new rich format (objects/arrays) or legacy flat format
      const hasNew = data.readerPainPoints?.length > 0 || data.desiredOutcomes?.length > 0 || Object.keys(data.targetAudience || {}).length > 0;
      const hasLegacy = !!(data.readerPainProfile || data.targetAudience);
      if (!hasNew && !hasLegacy) throw new Error("AI returned an empty intelligence profile. Please try again.");

      updateAnalysis((prev) => ({ ...prev, intelligence: data }));

      if (data._partial && Array.isArray(data._missingFields) && data._missingFields.length) {
        setLocalMsg(`Intelligence extracted but incomplete — missing: ${data._missingFields.join(", ")}. Re-analyze for a full profile.`);
      } else {
        setLocalMsg("Market intelligence extracted — these signals will auto-fill your author tone, audience, and positioning throughout the book builder.");
      }
    } catch (e) {
      setIntelError(e.message || "Failed to generate intelligence. Try again.");
    } finally {
      setIntelLoading(false);
    }
  }

  async function finalizePositioning() {
    if (!intelligence || posLoading) return;
    setPosLoading(true);
    setPosError("");
    setPosResult(null);

    const arrStr = (v) => Array.isArray(v) ? v.slice(0, 8).map(String).join("; ") : "";
    const objStr = (v) => v && typeof v === "object" ? Object.values(v).filter(Boolean).join("; ") : (v || "");

    const targetAudienceStr    = isNewIntel ? objStr(intelligence.targetAudience)         : (intelligence.targetAudience        || "");
    const painPointsStr        = isNewIntel ? arrStr(intelligence.readerPainPoints)        : (intelligence.readerPainProfile     || "");
    const desiredOutcomesStr   = isNewIntel ? arrStr(intelligence.desiredOutcomes)         : (intelligence.transformationPromise || "");
    const buyerIntentStr       = isNewIntel ? objStr(intelligence.buyerIntent)             : (intelligence.positioningStrategy   || "");
    const marketOpportunityStr = isNewIntel ? arrStr(intelligence.marketGaps)              : (intelligence.marketGapAnalysis     || "");
    const compInsightsStr      = isNewIntel ? objStr(intelligence.competitorAnalysis)      : (intelligence.bestsellerDNA         || "");
    const readerMotivationStr  = isNewIntel ? objStr(intelligence.readerPsychology)        : ((intelligence.emotionalTriggers || []).join(", "));
    const toneStr              = isNewIntel ? objStr(intelligence.authorPersonaGuidance)   : (intelligence.toneRecommendation    || "");

    try {
      const res = await fetch("/api/ai/final-positioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mainNiche:           research.mainNicheLabel || "",
          subNiche:            research.subNicheLabel  || "",
          deepNiche:           research.deepNicheLabel || "",
          researchTitle:       research.bookTitle      || "",
          researchSubtitle:    research.bookSubtitle   || "",
          researchTopic:       research.bookTopic      || "",
          targetAudience:      targetAudienceStr,
          painPoints:          painPointsStr,
          desiredOutcomes:     desiredOutcomesStr,
          buyerIntent:         buyerIntentStr,
          marketOpportunity:   marketOpportunityStr,
          competitiveInsights: compInsightsStr,
          readerMotivation:    readerMotivationStr,
          tone:                toneStr,
          analysisSummary:     analysis.books.map((b) => `${b.title}${b.authors?.length ? ` by ${b.authors.join(", ")}` : ""}`).join("; "),
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Positioning generation failed.");
      setPosResult(data);
    } catch (e) {
      setPosError(e.message || "Failed to finalize positioning. Try again.");
    } finally {
      setPosLoading(false);
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

      {/* ── Book list ── */}
      <ul className="mt-6 space-y-3">
        {analysis.books.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-500">
            No references yet — search above or paste a URL below.
          </li>
        )}
        {analysis.books.map((book) => {
          const isOpen        = expandedId === book.id;
          const ratingLabel   = typeof book.rating       === "number" ? `${book.rating.toFixed(1)} ★` : null;
          const reviewsLabel  = typeof book.ratingsTotal === "number" ? `${book.ratingsTotal.toLocaleString()} reviews` : null;
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
                  <div className="flex flex-wrap items-start gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      book.source === "manual"       ? "bg-amber-100 text-amber-900"
                      : book.source === "open_library" ? "bg-emerald-100 text-emerald-800"
                      : book.source === "google_books" ? "bg-blue-100 text-blue-800"
                      : book.source === "ai_research"  ? "bg-violet-100 text-violet-800"
                      : book.source === "scale_serp"   ? "bg-sky-100 text-sky-800"
                      : "bg-slate-100 text-slate-700"
                    }`}>
                      {book.source === "manual"       ? "Your reference"
                        : book.source === "open_library" ? "Open Library"
                        : book.source === "google_books" ? "Google Books"
                        : book.source === "ai_research"  ? "AI Research"
                        : book.source === "scale_serp"   ? "Amazon"
                        : "Amazon"}
                    </span>
                  </div>
                  <p className="mt-1 font-semibold leading-snug text-slate-900">{book.title}</p>
                  {book.authors && <p className="mt-1 text-xs text-slate-600">{book.authors}</p>}
                  {(ratingLabel || reviewsLabel) && (
                    <p className="mt-1 text-xs text-slate-600">
                      {[ratingLabel, reviewsLabel].filter(Boolean).join(" · ")}
                      {book.bestsellerBadge?.category && <span className="ml-2 text-amber-800">· Bestseller badge</span>}
                    </p>
                  )}
                  <a href={book.url} target="_blank" rel="noreferrer" className="mt-2 inline-block truncate text-xs text-sky-700 hover:underline">
                    {book.url}
                  </a>
                  <div className="mt-3 flex flex-wrap gap-2">
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
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  {book.publicationDate && <p><span className="font-medium text-slate-900">Published:</span> {book.publicationDate}</p>}
                  {book.subtitle && <p className="mt-1"><span className="font-medium text-slate-900">Subtitle:</span> {book.subtitle}</p>}
                  <p className="mt-2">
                    <span className="font-medium text-slate-900">Rating:</span>{" "}
                    {ratingLabel ? ratingLabel : "—"}{reviewsLabel ? ` (${reviewsLabel})` : ""}
                  </p>
                  <p className="mt-2 font-medium text-slate-900">Bestseller rank</p>
                  {book.bestsellersRankFlat ? (
                    <p className="text-slate-700">{book.bestsellersRankFlat}</p>
                  ) : (
                    <p className="text-slate-500">Expand pulls rank when API key is set.</p>
                  )}
                  {Array.isArray(book.bestsellersRanks) && book.bestsellersRanks.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs">
                      {book.bestsellersRanks.map((row, i) => (
                        <li key={i}>
                          #{row.rank} in {row.category}
                          {row.link && <a className="ml-2 text-sky-700 hover:underline" href={row.link} target="_blank" rel="noreferrer">View ranking</a>}
                        </li>
                      ))}
                    </ul>
                  )}
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

            {isNewIntel ? (() => {
              const ta    = intelligence.targetAudience             || {};
              const ppts  = intelligence.readerPainPoints           || [];
              const outs  = intelligence.desiredOutcomes            || [];
              const gaps  = intelligence.marketGaps                 || [];
              const strats= intelligence.positioningStrategies      || [];
              const usps  = intelligence.uniqueSellingPropositions  || [];
              const ti    = intelligence.titleInsights              || {};
              const apg   = intelligence.authorPersonaGuidance      || {};
              const brief = intelligence.outlineGenerationBrief     || {};
              const strVal = (v) => typeof v === "string" ? v : (Array.isArray(v) ? v.join("; ") : (v && typeof v === "object" ? Object.values(v).filter(Boolean).join(" · ") : ""));
              return (
                <div className="space-y-4">
                  {/* Target Audience */}
                  {Object.keys(ta).length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Target Audience</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ta.primary         && <div><p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Primary</p><p className="text-sm text-slate-800 leading-snug">{ta.primary}</p></div>}
                        {ta.secondary       && <div><p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Secondary</p><p className="text-sm text-slate-800 leading-snug">{ta.secondary}</p></div>}
                        {ta.experienceLevel && <div><p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Experience</p><p className="text-sm text-slate-800 leading-snug">{ta.experienceLevel}</p></div>}
                        {ta.demographics    && <div><p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Demographics</p><p className="text-sm text-slate-800 leading-snug">{ta.demographics}</p></div>}
                      </div>
                      {ta.motivations && <div className="mt-2 border-t border-slate-100 pt-2"><p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Motivations</p><p className="text-sm text-slate-700 leading-snug">{ta.motivations}</p></div>}
                    </div>
                  )}

                  {/* Pain Points & Desired Outcomes */}
                  {(ppts.length > 0 || outs.length > 0) && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ppts.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Reader Pain Points</p>
                          <ul className="space-y-1">
                            {ppts.slice(0, 7).map((p, i) => (
                              <li key={i} className="flex gap-1.5 text-sm text-slate-700"><span className="text-rose-400 shrink-0 mt-0.5">•</span><span>{String(p)}</span></li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {outs.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Desired Outcomes</p>
                          <ul className="space-y-1">
                            {outs.slice(0, 7).map((o, i) => (
                              <li key={i} className="flex gap-1.5 text-sm text-slate-700"><span className="text-emerald-400 shrink-0 mt-0.5">•</span><span>{String(o)}</span></li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Market Gaps */}
                  {gaps.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-2">Market Gaps</p>
                      <ul className="space-y-1">
                        {gaps.slice(0, 5).map((g, i) => (
                          <li key={i} className="flex gap-1.5 text-sm text-amber-900"><span className="text-amber-500 shrink-0 mt-0.5">◆</span><span>{String(g)}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Positioning Strategies */}
                  {strats.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Positioning Strategies</p>
                      <div className="flex flex-wrap gap-2">
                        {strats.map((s, i) => {
                          const label = typeof s === "string" ? s : (s.angle || s.name || s.strategy || Object.values(s)[0] || "");
                          return <span key={i} className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">{String(label)}</span>;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Unique Selling Propositions */}
                  {usps.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Unique Selling Propositions</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {usps.slice(0, 4).map((u, i) => {
                          const statement = typeof u === "string" ? u : (u.statement || u.usp || Object.values(u)[0] || "");
                          const why = typeof u === "object" ? (u.whyItStandsOut || u.whyReadersCare || u.why || "") : "";
                          return (
                            <div key={i} className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
                              <p className="text-sm font-semibold text-violet-900 leading-snug">{String(statement)}</p>
                              {why && <p className="mt-1 text-xs text-violet-700 leading-snug">{why}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Title Insights & Author Persona */}
                  {(Object.keys(ti).length > 0 || Object.keys(apg).length > 0) && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ti.bestTitleStyle                       && <IntelChip label="Best Title Style"         value={strVal(ti.bestTitleStyle)} />}
                      {ti.bestSubtitleStyle                    && <IntelChip label="Best Subtitle Style"       value={strVal(ti.bestSubtitleStyle)} />}
                      {ti.recommendedTransformationPromise     && <IntelChip label="Transformation Promise"    value={strVal(ti.recommendedTransformationPromise)} />}
                      {ti.bestPositioningApproach              && <IntelChip label="Positioning Approach"      value={strVal(ti.bestPositioningApproach)} />}
                      {apg.tone                                && <IntelChip label="Recommended Tone"          value={strVal(apg.tone)} />}
                      {apg.authorVoice                         && <IntelChip label="Author Voice"              value={strVal(apg.authorVoice)} />}
                      {apg.credibilityStyle                    && <IntelChip label="Credibility Style"         value={strVal(apg.credibilityStyle)} />}
                      {apg.writingApproach                     && <IntelChip label="Writing Approach"          value={strVal(apg.writingApproach)} />}
                    </div>
                  )}

                  {/* Outline Generation Brief */}
                  {Object.keys(brief).length > 0 && (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 mb-2">Outline Generation Brief</p>
                      <p className="text-sm text-slate-800 leading-relaxed">{strVal(brief)}</p>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <IntelChip label="Target Audience"        value={intelligence.targetAudience} />
                  <IntelChip label="Energy Style"           value={intelligence.energyStyle} />
                  <IntelChip label="Reader Pain Profile"    value={intelligence.readerPainProfile} />
                  <IntelChip label="Transformation Promise" value={intelligence.transformationPromise} />
                </div>
                <IntelTags label="Recommended Author Tones" values={intelligence.authorTones}      colorClass="bg-sky-100 text-sky-800" />
                <IntelTags label="Emotional Triggers"       values={intelligence.emotionalTriggers} colorClass="bg-violet-100 text-violet-800" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <IntelChip label="Tone Recommendation"  value={intelligence.toneRecommendation} />
                  <IntelChip label="Writing Style"        value={intelligence.writingStyleFingerprint} />
                  <IntelChip label="Positioning Strategy" value={intelligence.positioningStrategy} />
                  <IntelChip label="Market Gap"           value={intelligence.marketGapAnalysis} />
                </div>
                {intelligence.bestsellerDNA && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">Bestseller DNA</p>
                    <p className="text-sm text-slate-800 leading-snug">{intelligence.bestsellerDNA}</p>
                  </div>
                )}
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

      {/* ── Final Book Positioning ── */}
      <div className="mt-10 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/40 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Final Positioning Engine
            </p>
            <h3 className="mt-1 font-serif text-xl font-semibold text-slate-900">
              Optimized Book Positioning
            </h3>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-600">
              Combines your Research inputs with competitor intelligence to generate the strongest possible Amazon KDP title, subtitle, and topic.
            </p>
          </div>
          <button
            type="button"
            onClick={finalizePositioning}
            disabled={!intelligence || posLoading}
            className="shrink-0 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {posLoading ? "Optimizing…" : posResult ? "Re-optimize" : "Optimize Positioning"}
          </button>
        </div>

        {!intelligence && !posLoading && (
          <p className="mt-4 rounded-xl border border-dashed border-emerald-200 bg-white/60 px-4 py-3 text-sm text-slate-500">
            Run <span className="font-semibold">Analyze Competitors</span> first to generate intelligence, then optimize your final positioning.
          </p>
        )}

        {posLoading && (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-700 animate-pulse">
              AI synthesizing research and intelligence into your optimal book positioning…
            </p>
          </div>
        )}

        {posError && <p className="mt-3 text-sm font-medium text-rose-700">{posError}</p>}

        {posResult && !posLoading && (
          <div className="mt-5 space-y-6">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Positioning generated — click any option to apply it to your Research
              </p>
            </div>

            {posResult.finalTitle && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Optimized Title</p>
                <button
                  type="button"
                  onClick={() => updateResearch?.({ bookTitle: posResult.finalTitle })}
                  className={`w-full rounded-xl border px-4 py-3.5 text-left shadow-sm transition ${
                    research.bookTitle === posResult.finalTitle
                      ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                      : "border-slate-200 bg-white text-slate-900 hover:border-emerald-400 hover:bg-emerald-50/60"
                  }`}
                >
                  <p className="font-serif text-base font-semibold leading-snug">{posResult.finalTitle}</p>
                  {posResult.titleReason && (
                    <p className={`mt-1.5 text-[11px] italic leading-snug ${research.bookTitle === posResult.finalTitle ? "text-emerald-100" : "text-slate-400"}`}>
                      {posResult.titleReason}
                    </p>
                  )}
                </button>
              </div>
            )}

            {Array.isArray(posResult.subtitleOptions) && posResult.subtitleOptions.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Subtitle Options</p>
                <ul className="space-y-2">
                  {posResult.subtitleOptions.map((opt, i) => {
                    if (!opt?.subtitle) return null;
                    const active = research.bookSubtitle === opt.subtitle;
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => updateResearch?.({ bookSubtitle: opt.subtitle })}
                          className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                            active ? "border-emerald-500 bg-emerald-500 text-white font-semibold shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/60"
                          }`}
                        >
                          {opt.subtitle}
                          {opt.reason && <span className={`block mt-1 text-[10px] italic ${active ? "text-emerald-100" : "text-slate-400"}`}>{opt.reason}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {Array.isArray(posResult.topicOptions) && posResult.topicOptions.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Topic Options</p>
                <ul className="space-y-2">
                  {posResult.topicOptions.map((opt, i) => {
                    if (!opt?.topic) return null;
                    const active = research.bookTopic === opt.topic;
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => updateResearch?.({ bookTopic: opt.topic })}
                          className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                            active ? "border-emerald-500 bg-emerald-500 text-white font-semibold shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/60"
                          }`}
                        >
                          {opt.style && (
                            <span className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${active ? "text-emerald-200" : "text-slate-400"}`}>
                              {opt.style}
                            </span>
                          )}
                          {opt.topic}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
