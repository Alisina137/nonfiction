import { useState, useMemo } from "react";
import { aiFetch, GenerationCanceledError } from "@/lib/ai/aiFetch";

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_STYLES = [
  "All","SEO","Emotional","Authority","Minimalist","Modern","Premium",
  "Educational","Beginner","Business","Transformation","Problem-Solution",
  "Framework","Blueprint","Number-Based","How-To",
];

const SORT_OPTIONS = [
  { value: "overallScore",    label: "Highest Score"   },
  { value: "seoStrength",     label: "Best SEO"        },
  { value: "originality",     label: "Most Original"   },
  { value: "emotionalImpact", label: "Most Emotional"  },
  { value: "amazonCTR",       label: "Most Clickable"  },
  { value: "len_asc",         label: "Shortest Title"  },
  { value: "len_desc",        label: "Longest Title"   },
  { value: "alpha",           label: "Alphabetical"    },
];

const REC_CONFIG = {
  bestOverall:      { label: "Best Overall",  icon: "⭐", cls: "bg-amber-500"  },
  bestSEO:          { label: "Best SEO",      icon: "🔍", cls: "bg-sky-500"    },
  bestBranding:     { label: "Best Branding", icon: "✨", cls: "bg-purple-500" },
  bestAmazon:       { label: "Best Amazon",   icon: "📦", cls: "bg-orange-500" },
  bestProfessional: { label: "Best Pro",      icon: "💼", cls: "bg-slate-600"  },
  bestEmotional:    { label: "Best Emotional",icon: "❤️", cls: "bg-rose-500"   },
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function scoreColor(v) {
  if (v == null) return "text-slate-400";
  return v >= 85 ? "text-emerald-600" : v >= 70 ? "text-sky-600" : "text-amber-600";
}

function barColor(v) {
  if (v == null) return "bg-slate-200";
  return v >= 85 ? "bg-emerald-400" : v >= 70 ? "bg-sky-400" : "bg-amber-400";
}

// ─── ScoreMini ────────────────────────────────────────────────────────────────

function ScoreMini({ value, label }) {
  if (value == null) return null;
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className="text-center">
      <div className={`text-xs font-bold leading-none ${scoreColor(v)}`}>{v}</div>
      <div className="text-[9px] text-slate-400 mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

// ─── ScoreBar ─────────────────────────────────────────────────────────────────

function ScoreBar({ label, value }) {
  if (value == null) return null;
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 text-[10px] text-slate-500 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${barColor(v)}`} style={{ width: `${v}%` }} />
      </div>
      <span className="w-6 text-right text-[10px] font-bold text-slate-600">{v}</span>
    </div>
  );
}

// ─── OverallRing ──────────────────────────────────────────────────────────────

function OverallRing({ score }) {
  const v = Math.min(100, Math.max(0, score || 0));
  const ringCls = v >= 85
    ? "border-emerald-300 bg-emerald-50"
    : v >= 70 ? "border-sky-300 bg-sky-50" : "border-amber-300 bg-amber-50";
  return (
    <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-full border-2 ${ringCls} shrink-0`}>
      <span className={`text-lg font-bold leading-none ${scoreColor(v)}`}>{v}</span>
      <span className="text-[8px] text-slate-400 mt-0.5">Score</span>
    </div>
  );
}

// ─── TitleCard ────────────────────────────────────────────────────────────────

function TitleCard({
  card, isSelected, isFavorite, isInCompare, compareCount,
  activeSubIdx, onSelect, onFavorite, onCompare, onSubChange, onPreview,
  onRegenerate, isRegenerating,
}) {
  const [expanded, setExpanded] = useState(false);
  const subtitle = card.subtitleOptions?.[activeSubIdx]?.text || card.subtitle || "";

  return (
    <div className={`relative rounded-2xl border-2 bg-white transition-all duration-200 ${
      isSelected
        ? "border-sky-500 shadow-lg shadow-sky-500/15"
        : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
    }`}>
      {isSelected && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-400 to-indigo-400 rounded-t-2xl" />
      )}

      <div className="p-4">
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {(card._recKeys || []).map(k => {
            const cfg = REC_CONFIG[k];
            if (!cfg) return null;
            return (
              <span key={k} className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-white px-2 py-0.5 rounded-full ${cfg.cls}`}>
                {cfg.icon} {cfg.label}
              </span>
            );
          })}
          {card.style && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 font-medium">{card.style}</span>
          )}
          {card.pattern && (
            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-400">{card.pattern}</span>
          )}
        </div>

        {/* Title + ring */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-[15px] font-bold leading-snug text-slate-900">{card.title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 italic">{subtitle}</p>
            )}
          </div>
          <OverallRing score={card.overallScore} />
        </div>

        {/* Score mini row */}
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          <ScoreMini value={card.seoStrength}     label="SEO"      />
          <ScoreMini value={card.emotionalImpact} label="Emotion"  />
          <ScoreMini value={card.amazonCTR}       label="CTR"      />
          <ScoreMini value={card.originality}     label="Original" />
        </div>

        {/* Keywords */}
        {Array.isArray(card.keywords) && card.keywords.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {card.keywords.slice(0, 4).map((kw) => (
              <span key={kw} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{kw}</span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => onSelect(card, subtitle)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              isSelected
                ? "bg-sky-600 text-white shadow-sm"
                : "border border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700"
            }`}
          >
            {isSelected ? "✓ Selected" : "Select"}
          </button>
          <button
            type="button"
            onClick={() => onFavorite(card.title)}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            className={`rounded-full w-8 h-8 flex items-center justify-center text-sm transition ${
              isFavorite ? "text-amber-400 hover:text-amber-500" : "text-slate-300 hover:text-amber-400"
            }`}
          >
            {isFavorite ? "★" : "☆"}
          </button>
          <button
            type="button"
            onClick={() => onCompare(card.title)}
            disabled={!isInCompare && compareCount >= 4}
            title={isInCompare ? "Remove from compare" : "Add to compare"}
            className={`rounded-full w-8 h-8 flex items-center justify-center text-sm transition disabled:opacity-30 ${
              isInCompare ? "text-indigo-500 hover:text-indigo-600" : "text-slate-300 hover:text-indigo-400"
            }`}
          >
            ⊞
          </button>
          <button
            type="button"
            onClick={() => onPreview(card, subtitle)}
            title="Preview"
            className="rounded-full w-8 h-8 flex items-center justify-center text-sm text-slate-300 hover:text-slate-600 transition"
          >
            👁
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(card.title)}
            title="Copy title"
            className="rounded-full w-8 h-8 flex items-center justify-center text-sm text-slate-300 hover:text-slate-600 transition"
          >
            ⧉
          </button>
          <button
            type="button"
            onClick={() => onRegenerate?.(card)}
            disabled={isRegenerating}
            title="Regenerate this title"
            className={`rounded-full w-8 h-8 flex items-center justify-center text-sm transition ${
              isRegenerating
                ? "text-sky-400 animate-spin cursor-not-allowed"
                : "text-slate-300 hover:text-sky-500"
            }`}
          >
            ↻
          </button>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="ml-auto rounded-full border border-slate-200 px-3 py-1.5 text-[10px] text-slate-500 hover:bg-slate-50 transition"
          >
            {expanded ? "Less ▲" : "Details ▾"}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 space-y-4">
          {/* All 12 score bars */}
          <div className="space-y-1.5">
            <ScoreBar label="SEO Strength"      value={card.seoStrength}     />
            <ScoreBar label="Keyword Match"     value={card.keywordMatch}    />
            <ScoreBar label="Market Relevance"  value={card.marketRelevance} />
            <ScoreBar label="Reader Appeal"     value={card.readerAppeal}    />
            <ScoreBar label="Curiosity"         value={card.curiosity}       />
            <ScoreBar label="Emotional Impact"  value={card.emotionalImpact} />
            <ScoreBar label="Clarity"           value={card.clarity}         />
            <ScoreBar label="Professionalism"   value={card.professionalism} />
            <ScoreBar label="Originality"       value={card.originality}     />
            <ScoreBar label="Memorability"      value={card.memorability}    />
            <ScoreBar label="Amazon CTR"        value={card.amazonCTR}       />
          </div>

          {/* Why it works */}
          {Array.isArray(card.whyItWorks) && card.whyItWorks.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Why this title works</p>
              <ul className="space-y-1">
                {card.whyItWorks.map((w, i) => (
                  <li key={i} className="flex gap-2 text-[11px] text-slate-600 leading-relaxed">
                    <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Subtitle options */}
          {Array.isArray(card.subtitleOptions) && card.subtitleOptions.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Subtitle options</p>
              <div className="space-y-1.5">
                {card.subtitleOptions.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onSubChange(card.title, i);
                      if (isSelected) onSelect(card, opt.text);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-[11px] transition ${
                      activeSubIdx === i
                        ? "border-sky-400 bg-sky-50 text-sky-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-semibold">{opt.style}:</span> {opt.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Primary keyword + hook */}
          <div className="grid grid-cols-2 gap-3">
            {card.primaryKeyword && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Primary Keyword</p>
                <span className="rounded-full bg-sky-100 text-sky-800 px-2.5 py-0.5 text-[11px] font-semibold">{card.primaryKeyword}</span>
              </div>
            )}
            {card.hook && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Hook</p>
                <p className="text-[11px] italic text-slate-600 leading-relaxed">"{card.hook}"</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PreviewModal ─────────────────────────────────────────────────────────────

function PreviewModal({ card, subtitle, onClose }) {
  if (!card) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Title Preview</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Cover mockup */}
          <div className="flex justify-center">
            <div
              className="w-32 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg shadow-xl flex flex-col justify-between p-4"
              style={{ aspectRatio: "6/9" }}
            >
              <div className="w-8 h-0.5 bg-slate-500 rounded" />
              <div className="space-y-1.5">
                <p className="text-white font-serif font-bold text-sm leading-tight">{card.title}</p>
                {subtitle && <p className="text-slate-400 text-[9px] leading-tight italic">{subtitle}</p>}
              </div>
              <p className="text-slate-500 text-[8px] uppercase tracking-widest">Author Name</p>
            </div>
          </div>

          {/* Amazon listing preview */}
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/70">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">Amazon Listing Preview</p>
            <div className="flex gap-4">
              <div className="w-14 bg-gradient-to-br from-slate-700 to-slate-900 rounded flex items-center justify-center p-2 shrink-0" style={{ aspectRatio: "6/9" }}>
                <p className="text-white text-[7px] font-bold text-center leading-tight">{card.title}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-blue-700 leading-tight">{card.title}{subtitle ? `: ${subtitle}` : ""}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">by Author Name | Paperback</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-amber-400 text-[11px]">★★★★☆</span>
                  <span className="text-[10px] text-blue-600">1,284 ratings</span>
                </div>
                <p className="text-[13px] font-bold text-slate-800 mt-1">$14.99</p>
                <p className="text-[9px] text-slate-500 mt-0.5">Free delivery on orders over $35</p>
              </div>
            </div>
          </div>

          {/* Score highlights */}
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Overall",  v: card.overallScore   },
              { label: "SEO",      v: card.seoStrength    },
              { label: "CTR",      v: card.amazonCTR      },
              { label: "Emotion",  v: card.emotionalImpact},
            ].map(({ label, v }) => (
              <div key={label} className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
                <p className={`text-lg font-bold ${scoreColor(v)}`}>{v ?? "—"}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ComparePanel ─────────────────────────────────────────────────────────────

function ComparePanel({ cards, compareList, onRemove, onSelect }) {
  const compareCards = compareList.map(t => cards.find(c => c.title === t)).filter(Boolean);

  if (!compareCards.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-3xl mb-3">⊞</p>
        <p className="text-sm text-slate-500">Click the <strong>⊞</strong> button on any title card to add it here</p>
        <p className="text-xs text-slate-400 mt-1">Compare up to 4 titles side by side</p>
      </div>
    );
  }

  const ROWS = [
    ["Overall Score",    c => c.overallScore],
    ["SEO Strength",     c => c.seoStrength],
    ["Emotional Impact", c => c.emotionalImpact],
    ["Amazon CTR",       c => c.amazonCTR],
    ["Originality",      c => c.originality],
    ["Clarity",          c => c.clarity],
    ["Memorability",     c => c.memorability],
    ["Reader Appeal",    c => c.readerAppeal],
    ["Market Relevance", c => c.marketRelevance],
    ["Keyword Match",    c => c.keywordMatch],
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-[11px]">
        <thead>
          <tr>
            <th className="text-left text-[10px] font-semibold text-slate-400 py-2 pr-3 w-28">Metric</th>
            {compareCards.map(card => (
              <th key={card.title} className="py-2 px-2 text-left">
                <div className="flex items-start gap-1">
                  <span className="font-serif text-xs font-bold text-slate-900 leading-tight">{card.title}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(card.title)}
                    className="text-slate-300 hover:text-rose-400 shrink-0 mt-0.5 leading-none"
                  >×</button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, getter]) => {
            const vals = compareCards.map(c => getter(c) || 0);
            const maxVal = Math.max(...vals);
            return (
              <tr key={label} className="border-t border-slate-100">
                <td className="py-2 pr-3 text-slate-500">{label}</td>
                {compareCards.map(card => {
                  const v = getter(card) || 0;
                  const isBest = v === maxVal && vals.filter(x => x === maxVal).length === 1;
                  return (
                    <td key={card.title} className="py-2 px-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${barColor(v)}`} style={{ width: `${v}%` }} />
                        </div>
                        <span className={`font-bold ${isBest ? scoreColor(v) : "text-slate-500"}`}>{v || "—"}</span>
                        {isBest && <span className="text-emerald-500 text-[9px]">▲</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className="border-t-2 border-slate-200">
            <td className="py-3 pr-3 font-semibold text-slate-600">Keywords</td>
            {compareCards.map(card => (
              <td key={card.title} className="py-3 px-2">
                <div className="flex flex-wrap gap-1">
                  {(card.keywords || []).slice(0, 2).map(k => (
                    <span key={k} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px]">{k}</span>
                  ))}
                </div>
              </td>
            ))}
          </tr>
          <tr className="border-t border-slate-100">
            <td className="py-3 pr-3" />
            {compareCards.map(card => (
              <td key={card.title} className="py-3 px-2">
                <button
                  type="button"
                  onClick={() => onSelect(card, card.subtitleOptions?.[0]?.text || "")}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 transition"
                >
                  Select
                </button>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookTitleStep({ research, analysis, bookTitle, errors, setBookTitleBlock }) {
  const [loading, setLoading]           = useState(false);
  const [apiError, setApiError]         = useState("");
  const [activeTab, setActiveTab]       = useState("browse");
  const [search, setSearch]             = useState("");
  const [filterStyle, setFilterStyle]   = useState("All");
  const [sortBy, setSortBy]             = useState("overallScore");
  const [previewCard, setPreviewCard]   = useState(null);
  const [previewSub, setPreviewSub]     = useState("");
  const [regenLoading, setRegenLoading] = useState({});

  const cards           = Array.isArray(bookTitle.cards) ? bookTitle.cards : [];
  const recommendations = bookTitle.recommendations || {};
  const favorites       = Array.isArray(bookTitle.favorites) ? bookTitle.favorites : [];
  const compareList     = Array.isArray(bookTitle.compareList) ? bookTitle.compareList : [];
  const subChoices      = bookTitle.subtitleChoices || {};
  const intelligence    = analysis?.intelligence || null;

  function chosen() {
    return (bookTitle.customTitle || "").trim() || (bookTitle.pickedFromAi || "").trim();
  }

  // Attach _recKeys to each card
  const cardsWithRec = useMemo(() => {
    const map = {};
    Object.entries(recommendations).forEach(([key, title]) => {
      if (!map[title]) map[title] = [];
      map[title].push(key);
    });
    return cards.map(c => ({ ...c, _recKeys: map[c.title] || [] }));
  }, [cards, recommendations]);

  // Filter + sort
  const displayCards = useMemo(() => {
    let src = activeTab === "favorites"
      ? cardsWithRec.filter(c => favorites.includes(c.title))
      : cardsWithRec;

    if (search.trim()) {
      const q = search.toLowerCase();
      src = src.filter(c =>
        c.title.toLowerCase().includes(q) ||
        (c.keywords || []).some(k => k.toLowerCase().includes(q)) ||
        (c.style || "").toLowerCase().includes(q) ||
        (c.primaryKeyword || "").toLowerCase().includes(q)
      );
    }

    if (filterStyle !== "All") {
      src = src.filter(c => c.style === filterStyle);
    }

    if (sortBy === "len_asc")  return [...src].sort((a, b) => a.title.length - b.title.length);
    if (sortBy === "len_desc") return [...src].sort((a, b) => b.title.length - a.title.length);
    if (sortBy === "alpha")    return [...src].sort((a, b) => a.title.localeCompare(b.title));
    return [...src].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
  }, [cardsWithRec, activeTab, favorites, search, filterStyle, sortBy]);

  // ── Actions ──
  async function generate() {
    setLoading(true);
    setApiError("");
    try {
      const data = await aiFetch("/api/book/contextual-titles", {
        research,
        analysis,
        mode: "bestseller",
        intelligence,
      });
      const newCards = Array.isArray(data.cards) ? data.cards : [];
      const recs     = (data.recommendations && typeof data.recommendations === "object") ? data.recommendations : {};
      const bestTitle = recs.bestOverall || newCards.find(c => c.isRecommended)?.title || newCards[0]?.title || "";
      const bestCard  = newCards.find(c => c.title === bestTitle) || newCards[0] || null;
      setBookTitleBlock({
        ...bookTitle,
        cards:           newCards,
        recommendations: recs,
        pickedFromAi:    bestTitle,
        selectedCard:    bestCard ? { ...bestCard, activeSubtitle: bestCard.subtitleOptions?.[0]?.text || "" } : (bookTitle.selectedCard || null),
        customTitle:     bookTitle.customTitle || "",
        subtitleChoices: {},
        favorites:       bookTitle.favorites || [],
        compareList:     bookTitle.compareList || [],
      });
      if (!newCards.length) setApiError("No titles returned — try again.");
    } catch (e) {
      setApiError(
        e instanceof GenerationCanceledError ? "Generation canceled." : e?.message || "Generation failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function regenCard(card) {
    const oldTitle = card.title;
    setRegenLoading(prev => ({ ...prev, [oldTitle]: true }));
    try {
      const data = await aiFetch("/api/book/regenerate-card", {
        research,
        analysis,
        intelligence,
        avoidTitles: cards.map(c => c.title),
        style: card.style,
      });
      const newCard = data?.card;
      if (newCard?.title) {
        const updatedCards = bookTitle.cards.map(c =>
          c.title === oldTitle ? { ...newCard, _recKeys: [] } : c
        );
        setBookTitleBlock({ ...bookTitle, cards: updatedCards });
      }
    } catch {
      /* card stays unchanged on error */
    } finally {
      setRegenLoading(prev => {
        const next = { ...prev };
        delete next[oldTitle];
        return next;
      });
    }
  }

  function selectCard(card, subtitle) {
    setBookTitleBlock({
      ...bookTitle,
      pickedFromAi: card.title,
      customTitle:  "",
      selectedCard: { ...card, activeSubtitle: subtitle || card.subtitle || "" },
    });
  }

  function toggleFavorite(title) {
    const next = favorites.includes(title)
      ? favorites.filter(t => t !== title)
      : [...favorites, title];
    setBookTitleBlock({ ...bookTitle, favorites: next });
  }

  function toggleCompare(title) {
    const next = compareList.includes(title)
      ? compareList.filter(t => t !== title)
      : compareList.length < 4 ? [...compareList, title] : compareList;
    setBookTitleBlock({ ...bookTitle, compareList: next });
  }

  function setSubChoice(title, idx) {
    setBookTitleBlock({ ...bookTitle, subtitleChoices: { ...subChoices, [title]: idx } });
  }

  const hasCards = cards.length > 0;
  const hasIntel = !!intelligence;

  return (
    <div className="mx-auto max-w-3xl">

      {/* Header */}
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700/90">Step 3 — Title Generator</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-slate-900 md:text-3xl">Book Title Workspace</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 max-w-2xl">
          {hasIntel
            ? "Your competitor intelligence is active — titles are scored across 12 dimensions including SEO strength, Amazon CTR, emotional impact, and originality."
            : "Generate 15–20 unique, scored title ideas across every publishing style. Add competitor books in Analysis for smarter, data-driven results."}
        </p>
      </header>

      {hasIntel && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Intelligence active — titles powered by competitor analysis
        </div>
      )}

      {errors?.form && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{errors.form}</p>
      )}

      {/* Generate */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={generate}
          className="rounded-full bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-slate-800 hover:to-slate-600 disabled:opacity-60 transition"
        >
          {loading ? "Generating…" : hasCards ? "Regenerate all titles" : "Generate title packages"}
        </button>
        {chosen() && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-semibold text-slate-800 truncate max-w-[220px]">{chosen()}</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0" />
          Analyzing your niche and generating 15–20 unique title packages across all styles…
        </div>
      )}
      {apiError && <p className="mt-3 text-sm font-medium text-rose-700">{apiError}</p>}

      {/* Smart Recommendations */}
      {hasCards && Object.keys(recommendations).length > 0 && (
        <div className="mt-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Smart Recommendations</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(REC_CONFIG).map(([key, cfg]) => {
              const title = recommendations[key];
              if (!title) return null;
              const short = title.length > 30 ? title.slice(0, 30) + "…" : title;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    const card = cards.find(c => c.title === title);
                    if (card) selectCard(card, card.subtitleOptions?.[0]?.text || "");
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full text-white px-3 py-1.5 text-[11px] font-semibold shadow-sm hover:opacity-80 transition ${cfg.cls}`}
                >
                  {cfg.icon} <span>{cfg.label}</span>
                  <span className="opacity-70 font-normal text-[10px]">— {short}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs + toolbar */}
      {hasCards && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-0 border-b border-slate-200">
            {[
              { id: "browse",   label: `Browse (${cards.length})` },
              { id: "favorites",label: `★ Favorites (${favorites.length})` },
              { id: "compare",  label: `⊞ Compare (${compareList.length})` },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition ${
                  activeTab === tab.id
                    ? "border-sky-600 text-sky-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab !== "compare" && (
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Search titles or keywords…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 min-w-[160px] rounded-full border border-slate-200 px-4 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
              />
              <select
                value={filterStyle}
                onChange={e => setFilterStyle(e.target.value)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:border-sky-400"
              >
                {FILTER_STYLES.map(s => <option key={s}>{s}</option>)}
              </select>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:border-sky-400"
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Cards / Compare */}
      {hasCards && (
        <div className="mt-4">
          {activeTab === "compare" ? (
            <ComparePanel
              cards={cardsWithRec}
              compareList={compareList}
              onRemove={toggleCompare}
              onSelect={selectCard}
            />
          ) : displayCards.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No titles match your filters.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {displayCards.map(card => (
                <TitleCard
                  key={card.title}
                  card={card}
                  isSelected={bookTitle.pickedFromAi === card.title && !bookTitle.customTitle?.trim()}
                  isFavorite={favorites.includes(card.title)}
                  isInCompare={compareList.includes(card.title)}
                  compareCount={compareList.length}
                  activeSubIdx={subChoices[card.title] || 0}
                  onSelect={selectCard}
                  onFavorite={toggleFavorite}
                  onCompare={toggleCompare}
                  onSubChange={setSubChoice}
                  onPreview={(c, sub) => { setPreviewCard(c); setPreviewSub(sub); }}
                  onRegenerate={regenCard}
                  isRegenerating={!!regenLoading[card.title]}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected panel */}
      {bookTitle.selectedCard &&
        bookTitle.pickedFromAi === bookTitle.selectedCard.title &&
        !bookTitle.customTitle?.trim() && (
        <div className="mt-8 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50/60 via-white to-indigo-50/40 p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700 mb-2">Selected title</p>
          <p className="font-serif text-xl font-bold text-slate-900">{bookTitle.selectedCard.title}</p>
          {bookTitle.selectedCard.activeSubtitle && (
            <p className="mt-1 text-xs italic text-slate-500">{bookTitle.selectedCard.activeSubtitle}</p>
          )}
          {bookTitle.selectedCard.overallScore != null && (
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
              <span>Overall <span className={`font-bold ${scoreColor(bookTitle.selectedCard.overallScore)}`}>{bookTitle.selectedCard.overallScore}</span></span>
              <span>SEO <span className="font-semibold">{bookTitle.selectedCard.seoStrength ?? "—"}</span></span>
              <span>CTR <span className="font-semibold">{bookTitle.selectedCard.amazonCTR ?? "—"}</span></span>
              <span>Originality <span className="font-semibold">{bookTitle.selectedCard.originality ?? "—"}</span></span>
              <span>Emotion <span className="font-semibold">{bookTitle.selectedCard.emotionalImpact ?? "—"}</span></span>
            </div>
          )}
        </div>
      )}

      {/* Custom title */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-lg font-semibold text-slate-900">Custom title</h3>
        <p className="mt-1 text-xs text-slate-600">
          Overrides any AI selection. Use this when you already know your exact title.
        </p>
        <input
          className="input-light mt-4"
          placeholder="Type your definitive book title…"
          value={bookTitle.customTitle || ""}
          onChange={e => setBookTitleBlock({ ...bookTitle, customTitle: e.target.value })}
        />
        {bookTitle.customTitle?.trim() && (
          <p className="mt-2 text-xs text-emerald-700 font-medium">✓ Custom title active — overrides AI selection above.</p>
        )}
      </div>

      {/* Preview modal */}
      {previewCard && (
        <PreviewModal card={previewCard} subtitle={previewSub} onClose={() => setPreviewCard(null)} />
      )}

    </div>
  );
}
