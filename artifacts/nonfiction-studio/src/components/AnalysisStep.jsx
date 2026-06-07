import { useEffect, useRef, useState } from "react";
import { extractAsinFromAmazonUrl } from "@/lib/analysis/asin";

// ─── Utilities ────────────────────────────────────────────────────────────────

function newBookId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `bk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeTitle(t = "") {
  return t.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(revised|edition|workbook|journal|updated|expanded|new|the|a|an|2nd|3rd|4th|5th|6th)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

function sourcePriority(book) {
  if (book.dataSource === "rainforest" || book.dataSource === "merged") return 3;
  if (book.dataSource === "scale_serp") return 2;
  return 1;
}

function deduplicateBooks(books) {
  const byAsin  = new Map();
  const byTitle = new Map();
  const order   = [];

  for (const book of books) {
    if (book.asin) {
      const existing = byAsin.get(book.asin);
      if (!existing) { byAsin.set(book.asin, book); order.push("a:" + book.asin); }
      else if (sourcePriority(book) > sourcePriority(existing)) byAsin.set(book.asin, book);
    } else {
      const key = normalizeTitle(book.title);
      const existing = byTitle.get(key);
      if (!existing) { byTitle.set(key, book); order.push("t:" + key); }
      else if (sourcePriority(book) > sourcePriority(existing)) byTitle.set(key, book);
    }
  }

  const seen = new Set();
  const result = [];
  for (const k of order) {
    if (seen.has(k)) continue;
    seen.add(k);
    if (k.startsWith("a:")) result.push(byAsin.get(k.slice(2)));
    else result.push(byTitle.get(k.slice(2)));
  }
  return result.filter(Boolean);
}

function extractBsrNumber(book) {
  if (Array.isArray(book.bestsellersRanks) && book.bestsellersRanks.length) {
    const nums = book.bestsellersRanks.map((r) => r.rank).filter((n) => n > 0);
    if (nums.length) return Math.min(...nums);
  }
  if (typeof book.bestsellersRankFlat === "string") {
    const m = book.bestsellersRankFlat.match(/#([\d,]+)/);
    if (m) return parseInt(m[1].replace(/,/g, ""), 10);
  }
  return null;
}

function computeScores(book) {
  const rating      = typeof book.rating === "number" ? book.rating : 0;
  const ratingCount = book.ratingsTotal ?? book.reviewCount ?? 0;
  const bsr         = extractBsrNumber(book);

  let pop = 0;
  if (rating > 0)       pop += (rating / 5) * 35;
  if (ratingCount > 0)  pop += Math.min(40, Math.log10(ratingCount + 1) * 13);
  if (bsr && bsr < 100000) pop += (1 - Math.min(bsr, 100000) / 100000) * 25;
  pop = Math.round(Math.min(100, pop));

  let comp = 0;
  if (ratingCount > 0)   comp += Math.min(60, Math.log10(ratingCount + 1) * 20);
  if (rating >= 4.3)     comp += 20;
  if (bsr && bsr < 10000) comp += 20;
  comp = Math.round(Math.min(100, comp));

  const opp = Math.round(Math.max(0, 100 - comp * 0.75));

  return { popularity: pop, competition: comp, opportunity: opp };
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function PlaceholderCover({ title = "", size = "normal" }) {
  const h = size === "large" ? "h-44 w-[7.5rem]" : "h-28 w-[4.85rem]";
  const words = (title || "Book").split(" ").slice(0, 3);
  const init  = words.map((w) => w[0] || "").join("").toUpperCase().slice(0, 3);
  const hue   = Math.abs(title.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;
  return (
    <div
      className={`${h} shrink-0 flex flex-col items-center justify-center rounded-lg select-none`}
      style={{ background: `hsl(${hue},30%,82%)`, color: `hsl(${hue},40%,35%)` }}
    >
      <span className="text-sm font-bold">{init}</span>
      <span className="mt-1 px-1 text-center text-[8px] leading-tight opacity-75 line-clamp-3">
        {words.join(" ")}
      </span>
    </div>
  );
}

function CoverImage({ src, title, size = "normal" }) {
  const [failed, setFailed] = useState(!src);
  const h = size === "large" ? "h-44 w-[7.5rem]" : "h-28 w-[4.85rem]";
  if (failed || !src) return <PlaceholderCover title={title} size={size} />;
  return (
    <img
      src={src}
      alt={title || ""}
      onError={() => setFailed(true)}
      className={`${h} shrink-0 rounded-lg object-cover`}
    />
  );
}

function SkeletonCard() {
  return (
    <li className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm animate-pulse">
      <div className="flex gap-4 p-4">
        <div className="h-28 w-[4.85rem] shrink-0 rounded-lg bg-slate-200" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-2.5 w-16 rounded bg-slate-200" />
          <div className="h-4 w-3/4 rounded bg-slate-200" />
          <div className="h-3 w-1/2 rounded bg-slate-200" />
          <div className="h-3 w-1/3 rounded bg-slate-200" />
          <div className="mt-3 flex gap-2">
            <div className="h-6 w-20 rounded-full bg-slate-200" />
            <div className="h-6 w-14 rounded-full bg-slate-200" />
          </div>
        </div>
      </div>
    </li>
  );
}

function SearchProgress({ step }) {
  const steps = [
    "Finding Amazon bestsellers…",
    "Analyzing competition…",
    "Fetching metadata…",
    "Removing duplicates…",
  ];
  return (
    <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="inline-block h-3.5 w-3.5 rounded-full border-[2.5px] border-sky-500 border-t-transparent animate-spin shrink-0" />
        <p className="text-sm font-medium text-sky-700">{steps[step % steps.length]}</p>
      </div>
      <div className="mt-2.5 flex gap-1">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-700 ${i <= step ? "bg-sky-500" : "bg-slate-200"}`}
          />
        ))}
      </div>
    </div>
  );
}

function ScoreBar({ label, score, colorClass, bgClass }) {
  return (
    <div className="flex-1 rounded-xl bg-white border border-slate-100 px-3 py-2.5 min-w-[5rem]">
      <div className="flex items-baseline justify-between gap-1">
        <p className={`text-[10px] font-bold ${colorClass}`}>{label}</p>
        <p className={`text-sm font-bold ${colorClass}`}>{score}</p>
      </div>
      <div className={`mt-1.5 h-1.5 rounded-full ${bgClass}`}>
        <div
          className={`h-full rounded-full ${colorClass.replace("text-", "bg-")}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function QualityBadges({ book }) {
  const { popularity, competition, opportunity } = computeScores(book);
  const hasData = book.rating || book.ratingsTotal || book.bestsellersRankFlat;
  if (!hasData) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {book.rating && (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
          popularity >= 70 ? "bg-emerald-100 text-emerald-800" :
          popularity >= 40 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
        }`}>Pop {popularity}</span>
      )}
      {opportunity >= 60 && (
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
          High Opportunity
        </span>
      )}
      {competition >= 75 && (
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
          High Competition
        </span>
      )}
      {book.bestsellerBadge && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
          Bestseller
        </span>
      )}
    </div>
  );
}

function SummaryPanel({ books }) {
  if (books.length === 0) return null;
  const withRating  = books.filter((b) => typeof b.rating === "number");
  const withReviews = books.filter((b) => typeof (b.ratingsTotal ?? b.reviewCount) === "number");
  const bsrNums     = books.map(extractBsrNumber).filter(Boolean);

  const avgRating  = withRating.length
    ? (withRating.reduce((s, b) => s + b.rating, 0) / withRating.length).toFixed(1)
    : null;
  const avgReviews = withReviews.length
    ? Math.round(withReviews.reduce((s, b) => s + (b.ratingsTotal ?? b.reviewCount ?? 0), 0) / withReviews.length)
    : null;
  const minBsr = bsrNums.length ? Math.min(...bsrNums) : null;
  const maxBsr = bsrNums.length ? Math.max(...bsrNums) : null;

  const scores      = books.map(computeScores);
  const avgOpp      = Math.round(scores.reduce((s, sc) => s + sc.opportunity, 0) / books.length);
  const avgComp     = Math.round(scores.reduce((s, sc) => s + sc.competition, 0) / books.length);

  const stats = [
    { label: "Unique Books",  value: books.length },
    avgRating  ? { label: "Avg Rating",   value: `${avgRating} ★` } : null,
    avgReviews ? { label: "Avg Reviews",  value: avgReviews.toLocaleString() } : null,
    minBsr     ? { label: "Best BSR",     value: `#${minBsr.toLocaleString()}` } : null,
    maxBsr && minBsr !== maxBsr ? { label: "Deepest BSR", value: `#${maxBsr.toLocaleString()}` } : null,
  ].filter(Boolean);

  return (
    <div className="mb-6 rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50/80 to-indigo-50/60 p-5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700 mb-3">Bestseller Analysis Summary</p>
      <div className="flex flex-wrap gap-2.5">
        {stats.map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-white px-3.5 py-2.5 text-center shadow-sm min-w-[5rem]">
            <p className="text-xl font-bold text-slate-900 leading-none">{value}</p>
            <p className="text-[10px] text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
      {books.length > 0 && (
        <div className="mt-3.5 flex gap-2.5">
          <ScoreBar label="Avg Opportunity" score={avgOpp}  colorClass="text-violet-700" bgClass="bg-violet-100" />
          <ScoreBar label="Avg Competition" score={avgComp} colorClass="text-rose-700"   bgClass="bg-rose-100" />
        </div>
      )}
    </div>
  );
}

function ExpandPanel({ book, isLoading }) {
  const [descExpanded, setDescExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 animate-pulse space-y-3">
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="grid grid-cols-2 gap-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-8 rounded-lg bg-slate-200" />)}
        </div>
      </div>
    );
  }

  const { popularity, competition, opportunity } = computeScores(book);

  const NA = <span className="text-slate-400 italic">Data unavailable from source</span>;

  function Field({ label, value }) {
    return (
      <div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 text-xs text-slate-800 break-words">{value ?? NA}</p>
      </div>
    );
  }

  const ds = book.source === "manual" ? "manual"
    : book.dataSource === "rainforest" ? "rainforest"
    : book.dataSource === "merged"     ? "merged"
    : book.source_provider === "open_library" || book.source === "open_library" ? "open_library"
    : "scale_serp";

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-5 space-y-6 text-sm">

      {/* Source chips */}
      <div className="flex flex-wrap gap-1.5">
        {[
          ["rainforest",  "Rainforest",   ds === "rainforest" || ds === "merged"],
          ["scale_serp",  "Scale SERP",   ds === "scale_serp"  || ds === "merged"],
          ["open_library","Open Library", ds === "open_library"|| ds === "merged"],
        ].map(([key, lbl, active]) => (
          <span key={key} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
            active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-100 bg-white text-slate-400"
          }`}>
            {active ? "✓" : "○"} {lbl}
          </span>
        ))}
      </div>

      {/* Book Information */}
      <section>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Book Information</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">
          <Field label="Title"            value={book.title} />
          <Field label="Subtitle"         value={book.subtitle} />
          <Field label="Author"           value={book.authors} />
          <Field label="Publisher"        value={book.publisher} />
          <Field label="Publication Date" value={book.publicationDate} />
          <Field label="Language"         value={book.language} />
          <Field label="ASIN"             value={book.asin} />
          <Field label="ISBN"             value={book.isbn} />
          <Field label="Page Count"       value={book.pageCount ? `${book.pageCount} pages` : null} />
          <Field label="Format"           value={book.format} />
        </div>
      </section>

      {/* Amazon Performance */}
      <section>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Amazon Performance</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">
          <Field label="Rating" value={typeof book.rating === "number" ? `${book.rating.toFixed(1)} ★` : null} />
          <Field label="Total Ratings" value={
            (book.ratingsTotal ?? book.reviewCount) != null
              ? (book.ratingsTotal ?? book.reviewCount).toLocaleString()
              : null
          } />
          <Field label="Price" value={book.price} />
          <Field label="Bestseller Badge" value={book.bestsellerBadge ? "Yes" : null} />
        </div>
        <div className="mt-3.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Bestseller Ranks</p>
          {Array.isArray(book.bestsellersRanks) && book.bestsellersRanks.length ? (
            <ul className="mt-1.5 space-y-1">
              {book.bestsellersRanks.map((row, i) => (
                <li key={i} className="text-xs text-slate-700">
                  <span className="font-semibold">#{row.rank.toLocaleString()}</span> in {row.category}
                  {row.link && (
                    <a href={row.link} target="_blank" rel="noreferrer" className="ml-2 text-sky-600 hover:underline">
                      View
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : book.bestsellersRankFlat ? (
            <p className="mt-1 text-xs text-slate-700">{book.bestsellersRankFlat}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-400 italic">
              {ds === "rainforest" || ds === "merged"
                ? "No rank data returned from Rainforest."
                : "Requires Rainforest API — add RAINFOREST_API_KEY for BSR data."}
            </p>
          )}
        </div>
      </section>

      {/* Market Insights */}
      <section>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Market Insights</p>
        <div className="flex gap-2.5">
          <ScoreBar label="Popularity"   score={popularity}   colorClass="text-sky-700"    bgClass="bg-sky-100" />
          <ScoreBar label="Competition"  score={competition}  colorClass="text-rose-700"   bgClass="bg-rose-100" />
          <ScoreBar label="Opportunity"  score={opportunity}  colorClass="text-violet-700" bgClass="bg-violet-100" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {opportunity >= 70 && (
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold text-violet-800">High Opportunity</span>
          )}
          {competition >= 75 && (
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-800">High Competition</span>
          )}
          {book.rating && book.ratingsTotal > 5000 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">Evergreen</span>
          )}
          {book.bestsellerBadge && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">Trending</span>
          )}
        </div>
      </section>

      {/* Description */}
      {book.description ? (
        <section>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Description</p>
          <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
            <p className={`text-xs text-slate-700 leading-relaxed ${descExpanded ? "" : "line-clamp-4"}`}>
              {book.description}
            </p>
            {book.description.length > 220 && (
              <button
                type="button"
                onClick={() => setDescExpanded(!descExpanded)}
                className="mt-2 text-[11px] font-semibold text-sky-600 hover:underline"
              >
                {descExpanded ? "Show less ▲" : "Read more ▼"}
              </button>
            )}
          </div>
        </section>
      ) : null}

      {/* Cover Preview */}
      {book.thumbnail && (
        <section>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Cover Preview</p>
          <CoverImage src={book.thumbnail} title={book.title} size="large" />
        </section>
      )}
    </div>
  );
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnalysisStep({ research, analysis, errors, updateAnalysis, patchBook, removeBook }) {
  const [searchQuery,      setSearchQuery]      = useState(analysis.lastSearchQuery || "");
  const [loadingSearch,    setLoadingSearch]    = useState(false);
  const [searchStep,       setSearchStep]       = useState(0);
  const [loadingProductId, setLoadingProductId] = useState(null);
  const [localMsg,         setLocalMsg]         = useState("");
  const [manualUrl,        setManualUrl]        = useState("");
  const [manualTitle,      setManualTitle]      = useState("");
  const [expandedId,       setExpandedId]       = useState(null);
  const [intelLoading,     setIntelLoading]     = useState(false);
  const [intelError,       setIntelError]       = useState("");
  const [autoExpandCount,  setAutoExpandCount]  = useState(0);

  const autoExpandedIds = useRef(new Set());
  const stepTimerRef    = useRef(null);

  const amazonDomain = analysis.amazonDomain || "amazon.com";
  const intelligence  = analysis.intelligence || null;
  const displayBooks  = deduplicateBooks(analysis.books);

  useEffect(() => {
    if (analysis.lastSearchQuery) setSearchQuery(analysis.lastSearchQuery);
    else if (research.genre || research.bookTopic) {
      const q = [research.genre, research.bookTopic, "books"].filter(Boolean).join(" ").trim();
      setSearchQuery(q);
    }
  }, [research.genre, research.bookTopic]);

  // Auto-expand enrichment for ASIN books
  useEffect(() => {
    const pending = analysis.books.filter(
      (b) => b.asin && !b.expandedDetailsLoaded && !autoExpandedIds.current.has(b.id)
    );
    if (pending.length === 0) return;
    pending.forEach((b) => autoExpandedIds.current.add(b.id));
    setAutoExpandCount((n) => n + pending.length);

    const BATCH = 3;
    async function runBatches() {
      for (let i = 0; i < pending.length; i += BATCH) {
        const batch = pending.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async (book) => {
            try {
              const res  = await fetch("/api/analysis/amazon-product", {
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
                description:         d.description        ?? book.description,
                pageCount:           d.pageCount          ?? book.pageCount,
                language:            d.language           ?? book.language,
                isbn:                d.isbn               ?? book.isbn,
                format:              d.format             ?? book.format,
                publisher:           d.publisher          ?? book.publisher,
                dataSource:          d.dataSource         ?? book.dataSource,
                expandedDetailsLoaded: true,
              });
            } catch { /* ignore */ }
            finally { setAutoExpandCount((n) => Math.max(0, n - 1)); }
          })
        );
      }
    }
    runBatches();
  }, [analysis.books]);

  function startStepTimer() {
    let step = 0;
    setSearchStep(0);
    stepTimerRef.current = setInterval(() => {
      step = Math.min(step + 1, 3);
      setSearchStep(step);
    }, 2200);
  }

  function stopStepTimer() {
    if (stepTimerRef.current) { clearInterval(stepTimerRef.current); stepTimerRef.current = null; }
  }

  async function runAmazonSearch(mode) {
    const q = searchQuery.trim();
    if (!q) { setLocalMsg("Enter a search query."); return; }
    setLoadingSearch(true);
    setLocalMsg("");
    startStepTimer();
    try {
      const res  = await fetch("/api/analysis/amazon-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, amazonDomain })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Search failed.");
      if (data.needsApiKey) {
        setLocalMsg(data.message || "Rainforest unavailable. Using fallback sources.");
        return;
      }

      const rows = Array.isArray(data.books) ? data.books : [];
      const isFallback = data.source === "google_books" || data.source === "open_library";

      updateAnalysis((prev) => {
        const stamped = rows
          .filter((r) => r.title)
          .map((r) => ({
            ...r,
            id: newBookId(),
            source: isFallback ? (data.source || "open_library") : "amazon",
            expandedDetailsLoaded: Boolean(r.expandedDetailsLoaded),
          }));

        const bookKey = (b) => b.asin || b.googleBooksId || b.url || "";
        let nextBooks;
        if (mode === "replace") {
          const manualsOnly = prev.books.filter((b) => b.source === "manual");
          const manualKeys  = new Set(manualsOnly.map(bookKey).filter(Boolean));
          nextBooks = [...manualsOnly, ...stamped.filter((s) => !manualKeys.has(bookKey(s)))];
        } else {
          const existingKeys = new Set(prev.books.map(bookKey).filter(Boolean));
          nextBooks = [...prev.books, ...stamped.filter((s) => !existingKeys.has(bookKey(s)))];
        }

        // Deduplicate on save too
        return { ...prev, books: deduplicateBooks(nextBooks), lastSearchQuery: q };
      });

      const sourceLabel = data.source === "open_library" ? "Open Library"
        : data.source === "google_books" ? "Google Books"
        : "Amazon";
      setLocalMsg(
        `${rows.length} ${sourceLabel} result(s) loaded.${
          isFallback ? " Add RAINFOREST_API_KEY or SCALE_SERP_API_KEY to search Amazon directly." : ""
        }`
      );
    } catch (e) {
      setLocalMsg(e.message || "Something went wrong.");
    } finally {
      stopStepTimer();
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
        description:         d.description        ?? book.description,
        pageCount:           d.pageCount          ?? book.pageCount,
        language:            d.language           ?? book.language,
        isbn:                d.isbn               ?? book.isbn,
        format:              d.format             ?? book.format,
        publisher:           d.publisher          ?? book.publisher,
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
        title: titleTrim, url: asin ? `https://www.${d}/dp/${asin}` : url,
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

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl">

      {/* Header */}
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

      {/* Amazon search */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="text-sm font-medium text-slate-700">Amazon search query</label>
        <input
          className="input-light mt-1.5"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loadingSearch && runAmazonSearch("replace")}
          placeholder={`e.g. ${research.genre || "business"} books ${research.bookTopic || ""}`.trim()}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loadingSearch}
            onClick={() => runAmazonSearch("replace")}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loadingSearch ? "Searching…" : "Search Bestsellers"}
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
            Replace swaps Amazon results but keeps manuals. Append merges without duplicating.{" "}
            Requires optional <span className="font-mono">RAINFOREST_API_KEY</span>.
          </p>
        </div>

        {loadingSearch && <SearchProgress step={searchStep} />}
      </div>

      {localMsg && (
        <p className={`mt-3 text-sm ${localMsg.includes("intelligence extracted") ? "font-medium text-emerald-700" : "text-slate-600"}`}>
          {localMsg}
        </p>
      )}

      {autoExpandCount > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-sky-600">
          <span className="inline-block h-3 w-3 rounded-full border-[2px] border-sky-500 border-t-transparent animate-spin" />
          Fetching ratings for {autoExpandCount} book{autoExpandCount !== 1 ? "s" : ""}…
        </p>
      )}

      {/* Summary panel (above book list) */}
      {displayBooks.length > 0 && (
        <div className="mt-6">
          <SummaryPanel books={displayBooks} />
        </div>
      )}

      {/* Book list */}
      <ul className={displayBooks.length > 0 ? "space-y-3" : "mt-6 space-y-3"}>
        {loadingSearch && displayBooks.length === 0 && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {!loadingSearch && displayBooks.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-500">
            No references yet — search above or paste a URL below.
          </li>
        )}

        {displayBooks.map((book) => {
          const isOpen      = expandedId === book.id;
          const ratingLabel = typeof book.rating === "number" ? `${book.rating.toFixed(1)} ★` : null;
          const reviewsLabel = typeof (book.ratingsTotal ?? book.reviewCount) === "number"
            ? `${(book.ratingsTotal ?? book.reviewCount).toLocaleString()} ratings` : null;
          const bsr = extractBsrNumber(book);

          const ds = book.source === "manual" ? "manual"
            : book.dataSource === "rainforest" ? "rainforest"
            : book.dataSource === "merged"     ? "merged"
            : book.source_provider === "open_library" || book.source === "open_library" ? "open_library"
            : "scale_serp";

          const dsBadge = {
            manual:       { label: "Your reference",      cls: "bg-amber-100 text-amber-900" },
            rainforest:   { label: "✓ Rainforest",        cls: "bg-emerald-100 text-emerald-800" },
            merged:       { label: "✓ Rainforest + OL",   cls: "bg-sky-100 text-sky-800" },
            open_library: { label: "Open Library",        cls: "bg-teal-100 text-teal-800" },
            scale_serp:   { label: "Scale SERP",          cls: "bg-slate-100 text-slate-700" },
          }[ds] || { label: "Unknown", cls: "bg-slate-100 text-slate-600" };

          return (
            <li key={book.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Card body — 3-column layout */}
              <div className="flex gap-3 p-4">
                {/* LEFT: Cover */}
                <CoverImage src={book.thumbnail} title={book.title} />

                {/* CENTER: Meta */}
                <div className="min-w-0 flex-1">
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${dsBadge.cls}`}>
                      {dsBadge.label}
                    </span>
                    {book.price && (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                        {book.price}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 font-semibold leading-snug text-slate-900 line-clamp-2">{book.title}</p>
                  {book.subtitle && (
                    <p className="text-[11px] italic text-slate-500 leading-snug line-clamp-1">{book.subtitle}</p>
                  )}
                  {book.authors && <p className="mt-0.5 text-xs text-slate-600 line-clamp-1">{book.authors}</p>}

                  {/* Rating + date */}
                  {(ratingLabel || reviewsLabel || book.publicationDate) && (
                    <p className="mt-1 text-xs text-slate-500">
                      {[ratingLabel, reviewsLabel, book.publicationDate && `${book.publicationDate}`]
                        .filter(Boolean).join(" · ")}
                    </p>
                  )}

                  {bsr && (
                    <p className="mt-0.5 text-xs font-medium text-amber-700">BSR #{bsr.toLocaleString()}</p>
                  )}

                  {/* Quality badges */}
                  <div className="mt-1.5">
                    <QualityBadges book={book} />
                  </div>
                </div>

                {/* RIGHT: Actions */}
                <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => expandBook(book)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                  >
                    {loadingProductId === book.id ? "Loading…" : isOpen ? "Collapse" : "Expand Details"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (expandedId === book.id) setExpandedId(null); removeBook(book.id); }}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                  >
                    Remove
                  </button>
                  <a
                    href={book.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-sky-600 hover:underline"
                  >
                    View ↗
                  </a>
                </div>
              </div>

              {/* Expand panel */}
              {isOpen && (
                <ExpandPanel
                  book={book}
                  isLoading={loadingProductId === book.id}
                />
              )}
            </li>
          );
        })}
      </ul>

      {/* Add manual reference */}
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

      {/* Intelligence Engine */}
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
              Once your competitor books are loaded, the AI analyzes them to extract your target audience,
              reader pain profile, ideal tone, positioning strategy, and more.
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
              <IntelChip label="Target Audience"        value={intelligence.targetAudience} />
              <IntelChip label="Energy Style"           value={intelligence.energyStyle} />
              <IntelChip label="Reader Pain Profile"    value={intelligence.readerPainProfile} />
              <IntelChip label="Transformation Promise" value={intelligence.transformationPromise} />
            </div>
            <IntelTags label="Recommended Author Tones" values={intelligence.authorTones} colorClass="bg-sky-100 text-sky-800" />
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

        {!intelligence && !intelLoading && analysis.books.length === 0 && (
          <p className="mt-4 rounded-xl border border-dashed border-indigo-200 bg-white/60 px-4 py-3 text-sm text-slate-500">
            Search for and add competitor books above, then click Analyze Competitors to unlock AI market insights.
          </p>
        )}
        {!intelligence && !intelLoading && analysis.books.length > 0 && (
          <p className="mt-4 rounded-xl border border-dashed border-indigo-200 bg-white/60 px-4 py-3 text-sm text-slate-500">
            {analysis.books.length} book{analysis.books.length !== 1 ? "s" : ""} ready — click Analyze Competitors to extract AI market intelligence.
          </p>
        )}
      </div>
    </div>
  );
}
