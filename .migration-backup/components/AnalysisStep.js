import { useEffect, useState } from "react";
import { extractAsinFromAmazonUrl } from "@/lib/analysis/asin";

function newBookId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `bk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function AnalysisStep({ research, analysis, errors, updateAnalysis, patchBook, removeBook }) {
  const [searchQuery, setSearchQuery] = useState(analysis.lastSearchQuery || "");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingProductId, setLoadingProductId] = useState(null);
  const [localMsg, setLocalMsg] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const amazonDomain = analysis.amazonDomain || "amazon.com";

  useEffect(() => {
    if (analysis.lastSearchQuery) setSearchQuery(analysis.lastSearchQuery);
    else if (research.genre || research.bookTopic) {
      const q = [research.genre, research.bookTopic, "books"].filter(Boolean).join(" ").trim();
      setSearchQuery(q);
    }
  }, [research.genre, research.bookTopic]);

  async function runAmazonSearch(mode) {
    const q = searchQuery.trim();
    if (!q) {
      setLocalMsg("Enter a search query.");
      return;
    }
    setLoadingSearch(true);
    setLocalMsg("");
    try {
      const res = await fetch("/api/analysis/amazon-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, amazonDomain })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Search failed.");

      if (data.needsApiKey) {
        setLocalMsg(data.message || "Configure RAINFOREST_API_KEY on the server.");
        return;
      }

      const rows = Array.isArray(data.books) ? data.books : [];
      updateAnalysis((prev) => {
        const stamped = rows
          .filter((r) => r.asin)
          .map((r) => ({
            ...r,
            id: newBookId(),
            source: "amazon",
            expandedDetailsLoaded: Boolean(r.expandedDetailsLoaded)
          }));

        let nextBooks;
        if (mode === "replace") {
          const manualsOnly = prev.books.filter((b) => b.source === "manual");
          const manualAsins = new Set(manualsOnly.map((b) => b.asin).filter(Boolean));
          const newAmazon = stamped.filter((s) => !manualAsins.has(s.asin));
          nextBooks = [...manualsOnly, ...newAmazon];
        } else {
          const existingAsins = new Set(prev.books.map((b) => b.asin).filter(Boolean));
          const append = stamped.filter((s) => !existingAsins.has(s.asin));
          nextBooks = [...prev.books, ...append];
        }

        return { ...prev, books: nextBooks, lastSearchQuery: q };
      });

      setLocalMsg(`${rows.length} Amazon result(s) loaded. These titles inform how the app studies your niche.`);
    } catch (e) {
      setLocalMsg(e.message || "Something went wrong.");
    } finally {
      setLoadingSearch(false);
    }
  }

  async function expandBook(book) {
    if (!book.asin) {
      setLocalMsg("Expand details need an Amazon ASIN — use an Amazon product link.");
      return;
    }
    if (expandedId === book.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(book.id);

    if (book.expandedDetailsLoaded && book.bestsellersRankFlat != null) return;

    setLoadingProductId(book.id);
    setLocalMsg("");
    try {
      const res = await fetch("/api/analysis/amazon-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin: book.asin, amazonDomain })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load product details.");
      if (data.needsApiKey) {
        setLocalMsg(data.message || "Add RAINFOREST_API_KEY to load ratings and bestseller rank.");
        return;
      }
      const d = data.details || {};
      patchBook(book.id, {
        title: d.title || book.title,
        subtitle: d.subtitle ?? book.subtitle,
        authors: d.authors ?? book.authors,
        thumbnail: d.thumbnail || book.thumbnail,
        rating: d.rating ?? book.rating,
        ratingsTotal: d.ratingsTotal ?? book.ratingsTotal,
        bestsellersRankFlat: d.bestsellersRankFlat ?? book.bestsellersRankFlat,
        bestsellersRanks: d.bestsellersRanks ?? book.bestsellersRanks,
        publicationDate: d.publicationDate ?? book.publicationDate,
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
    if (!url) {
      setLocalMsg("Paste an Amazon URL.");
      return;
    }
    const asin = extractAsinFromAmazonUrl(url);
    const titleTrim = manualTitle.trim() || "Reference book";
    const d = amazonDomain.replace(/^www\./, "");

    updateAnalysis((prev) => {
      const list = [...prev.books];
      const dup = list.some((b) => (asin && b.asin === asin) || (!asin && b.url === url && b.source === "manual"));
      if (dup) return prev;
      list.push({
        id: newBookId(),
        source: "manual",
        asin,
        title: titleTrim,
        url: asin ? `https://www.${d}/dp/${asin}` : url,
        thumbnail: null,
        rating: null,
        ratingsTotal: null,
        bestsellersRankFlat: null,
        bestsellersRanks: null,
        expandedDetailsLoaded: false
      });
      return { ...prev, books: list };
    });
    setManualUrl("");
    setManualTitle("");
    setLocalMsg("Reference added.");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="font-serif text-2xl font-bold text-slate-900 md:text-3xl">Competitive landscape</h2>
      <p className="mt-2 text-sm text-slate-600">
        Discover Amazon books in your niche (sorted toward bestsellers in search). The app learns structure and cues from these
        titles—remove irrelevant ones or add your own exact reference links.
      </p>

      {errors?.form && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{errors.form}</p>
      )}

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
            Replace swaps Amazon-tagged results but keeps manuals. Append merges without duplicating ASINs. Requires optional{" "}
            <span className="font-mono">RAINFOREST_API_KEY</span>.
          </p>
        </div>
      </div>

      {localMsg && <p className="mt-4 text-sm text-slate-600">{localMsg}</p>}

      <ul className="mt-8 space-y-3">
        {analysis.books.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-500">
            No references yet — run Amazon search above or paste a URL at the bottom.
          </li>
        )}
        {analysis.books.map((book) => {
          const isOpen = expandedId === book.id;
          const ratingLabel =
            typeof book.rating === "number" ? `${book.rating.toFixed(1)} ★` : null;
          const reviewsLabel =
            typeof book.ratingsTotal === "number" ? `${book.ratingsTotal.toLocaleString()} reviews` : null;

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
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        book.source === "manual" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {book.source === "manual" ? "Your reference" : "Amazon niche"}
                    </span>
                  </div>
                  <p className="mt-1 font-semibold leading-snug text-slate-900">{book.title}</p>
                  {book.authors && <p className="mt-1 text-xs text-slate-600">{book.authors}</p>}
                  {(ratingLabel || reviewsLabel) && (
                    <p className="mt-1 text-xs text-slate-600">
                      {[ratingLabel, reviewsLabel].filter(Boolean).join(" · ")}
                      {book.bestsellerBadge && typeof book.bestsellerBadge === "object" && book.bestsellerBadge.category && (
                        <span className="ml-2 text-amber-800">· Bestseller badge</span>
                      )}
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
                  {book.publicationDate && (
                    <p>
                      <span className="font-medium text-slate-900">Published:</span> {book.publicationDate}
                    </p>
                  )}
                  {book.subtitle && (
                    <p className="mt-1">
                      <span className="font-medium text-slate-900">Subtitle:</span> {book.subtitle}
                    </p>
                  )}
                  <p className="mt-2">
                    <span className="font-medium text-slate-900">Customer rating:</span>{" "}
                    {ratingLabel ? `${ratingLabel}` : "—"}
                    {reviewsLabel ? ` (${reviewsLabel})` : ""}
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
                          {row.link ? (
                            <a className="ml-2 text-sky-700 hover:underline" href={row.link} target="_blank" rel="noreferrer">
                              View ranking
                            </a>
                          ) : null}
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

      <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-lg font-semibold text-slate-900">Add your reference copy</h3>
        <p className="mt-1 text-xs text-slate-600">
          Paste any Amazon paperback / Kindle listing URL—or any page with ASIN in the URL. Optionally name it.
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
    </div>
  );
}
