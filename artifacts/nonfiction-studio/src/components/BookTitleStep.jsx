import { useState, useMemo } from "react";
import { aiFetch, GenerationCanceledError } from "@/lib/ai/aiFetch";

const MODES = [
  { id: "kdp-positioning",     label: "KDP Positioning"    },
  { id: "bestseller",          label: "Bestseller"         },
  { id: "masculine-authority", label: "Masculine Authority"},
  { id: "emotional-transform", label: "Emotional"          },
  { id: "scientific",          label: "Scientific"         },
  { id: "minimalist-premium",  label: "Minimalist"         },
  { id: "bold-controversial",  label: "Bold / Edgy"        },
  { id: "philosophical",       label: "Philosophical"      },
  { id: "viral-modern",        label: "Viral Modern"       },
];

const CATEGORY_COLORS = {
  "Masculine Authority":      "bg-slate-100  text-slate-700  border-slate-200",
  "Emotional Transformation": "bg-rose-50    text-rose-700   border-rose-200",
  "Premium Minimalist":       "bg-indigo-50  text-indigo-700 border-indigo-200",
  "Scientific Authority":     "bg-sky-50     text-sky-700    border-sky-200",
  "Viral Modern":             "bg-amber-50   text-amber-700  border-amber-200",
  "Philosophical Wisdom":     "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Bold Challenger":          "bg-orange-50  text-orange-700 border-orange-200",
  "Outcome-Focused":          "bg-teal-50    text-teal-700   border-teal-200",
  "Problem-Solution Focused": "bg-violet-50  text-violet-700 border-violet-200",
  "Audience-Focused":         "bg-cyan-50    text-cyan-700   border-cyan-200",
};

const CATEGORY_HEADER_COLORS = {
  "Masculine Authority":      "border-slate-300   text-slate-600",
  "Emotional Transformation": "border-rose-300    text-rose-600",
  "Premium Minimalist":       "border-indigo-300  text-indigo-600",
  "Scientific Authority":     "border-sky-300     text-sky-600",
  "Viral Modern":             "border-amber-300   text-amber-600",
  "Philosophical Wisdom":     "border-emerald-300 text-emerald-600",
  "Bold Challenger":          "border-orange-300  text-orange-600",
  "Outcome-Focused":          "border-teal-300    text-teal-600",
  "Problem-Solution Focused": "border-violet-300  text-violet-600",
  "Audience-Focused":         "border-cyan-300    text-cyan-600",
};

function ScorePill({ label, value, color }) {
  if (value == null) return null;
  const colors = {
    sky:     "bg-sky-100    text-sky-800",
    violet:  "bg-violet-100 text-violet-800",
    emerald: "bg-emerald-100 text-emerald-800",
    amber:   "bg-amber-100  text-amber-800",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors[color] || colors.sky}`}>
      {label} <span className="font-bold">{value}</span>
    </span>
  );
}

function ScoreBar({ label, value, color }) {
  if (value == null) return null;
  const barColors = {
    sky:     "bg-sky-400",
    violet:  "bg-violet-400",
    emerald: "bg-emerald-400",
    amber:   "bg-amber-400",
  };
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-20 font-semibold text-slate-500 shrink-0">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColors[color] || barColors.sky}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="w-7 text-right font-bold text-slate-600">{value}</span>
    </div>
  );
}

function TitleCard({ card, isSelected, onSelect, onSelectWithSubtitle }) {
  const [expanded, setExpanded] = useState(false);
  const [activeSubtitle, setActiveSubtitle] = useState(0);

  const catColor     = CATEGORY_COLORS[card.category]     || "bg-slate-100 text-slate-700 border-slate-200";
  const displaySubtitle = card.subtitleOptions?.[activeSubtitle]?.text || card.subtitle || "";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-200 ${
        isSelected
          ? "border-sky-500 shadow-lg shadow-sky-500/15 bg-white"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      {card.isRecommended && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-orange-400" />
      )}

      <div className="p-4">
        {/* Top badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          {card.isRecommended && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              ⭐ AI Pick
            </span>
          )}
          {card.category && (
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${catColor}`}>
              {card.category}
            </span>
          )}
          {card.pattern && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
              {card.pattern}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-serif text-lg font-bold leading-snug text-slate-900">
          {card.title}
        </h3>

        {/* Subtitle */}
        {displaySubtitle && (
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 italic">
            {displaySubtitle}
          </p>
        )}

        {/* Score pills */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <ScorePill label="SEO"       value={card.seoScore}         color="sky"     />
          <ScorePill label="Emotional" value={card.emotionalScore}   color="violet"  />
          <ScorePill label="CTR"       value={card.clickabilityScore} color="emerald" />
          <ScorePill label="Audience"  value={card.audienceMatch}    color="amber"   />
        </div>

        {/* Keywords */}
        {Array.isArray(card.keywords) && card.keywords.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {card.keywords.slice(0, 5).map((kw) => (
              <span key={kw} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{kw}</span>
            ))}
          </div>
        )}

        {/* Action row */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectWithSubtitle(card, displaySubtitle)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              isSelected
                ? "bg-sky-600 text-white shadow-sm shadow-sky-600/30"
                : "border border-slate-300 bg-white text-slate-800 hover:border-sky-400 hover:text-sky-700"
            }`}
          >
            {isSelected ? "✓ Selected" : "Select"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {expanded ? "Less ▲" : "Details ▾"}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4 space-y-4">
          {/* Score bars */}
          <div className="space-y-1.5">
            <ScoreBar label="SEO"         value={card.seoScore}          color="sky"     />
            <ScoreBar label="Emotional"   value={card.emotionalScore}    color="violet"  />
            <ScoreBar label="CTR"         value={card.clickabilityScore} color="emerald" />
            <ScoreBar label="Audience"    value={card.audienceMatch}     color="amber"   />
          </div>

          {/* Tone + hook */}
          {Array.isArray(card.toneProfile) && card.toneProfile.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Perceived tone</p>
              <div className="flex flex-wrap gap-1">
                {card.toneProfile.map((t) => (
                  <span key={t} className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] text-slate-700">{t}</span>
                ))}
              </div>
            </div>
          )}

          {card.hook && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Emotional hook</p>
              <p className="text-xs italic text-slate-600 leading-relaxed">"{card.hook}"</p>
            </div>
          )}

          {Array.isArray(card.audienceResonance) && card.audienceResonance.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Resonates with</p>
              <div className="flex flex-wrap gap-1">
                {card.audienceResonance.map((a) => (
                  <span key={a} className="rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] text-sky-800">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Subtitle options */}
          {Array.isArray(card.subtitleOptions) && card.subtitleOptions.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Subtitle options</p>
              <div className="space-y-1.5">
                {card.subtitleOptions.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setActiveSubtitle(i);
                      if (isSelected) onSelectWithSubtitle(card, opt.text);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-[11px] transition ${
                      activeSubtitle === i
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
        </div>
      )}
    </div>
  );
}

function VariationCard({ variation, onUse }) {
  const varColors = {
    "Bolder":       "border-slate-300 bg-slate-50",
    "Premium":      "border-indigo-200 bg-indigo-50/50",
    "SEO":          "border-sky-200 bg-sky-50/50",
    "Emotional":    "border-rose-200 bg-rose-50/50",
    "Modern Viral": "border-amber-200 bg-amber-50/50",
    "Philosophical":"border-emerald-200 bg-emerald-50/50",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${varColors[variation.style] || "border-slate-200 bg-white"}`}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{variation.style}</p>
      <p className="mt-1 font-serif text-sm font-bold leading-snug text-slate-900">{variation.title}</p>
      {variation.subtitle && (
        <p className="mt-0.5 text-[11px] italic text-slate-500 leading-snug">{variation.subtitle}</p>
      )}
      {variation.note && (
        <p className="mt-1 text-[10px] text-slate-500">{variation.note}</p>
      )}
      <button
        type="button"
        onClick={() => onUse(variation)}
        className="mt-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 transition"
      >
        Use this
      </button>
    </div>
  );
}

export default function BookTitleStep({ research, analysis, bookTitle, errors, setBookTitleBlock }) {
  const [loading, setLoading]             = useState(false);
  const [apiError, setApiError]           = useState("");
  const [varLoading, setVarLoading]       = useState(false);
  const [varError, setVarError]           = useState("");
  const [variations, setVariations]       = useState([]);
  const [showVars, setShowVars]           = useState(false);

  const mode         = bookTitle.mode || "bestseller";
  const cards        = Array.isArray(bookTitle.cards) ? bookTitle.cards : [];
  const intelligence = analysis?.intelligence || null;

  function effectiveChosen() {
    return (bookTitle.customTitle || "").trim() || (bookTitle.pickedFromAi || "").trim();
  }

  function setMode(m) {
    setBookTitleBlock({ ...bookTitle, mode: m });
  }

  async function generateCards() {
    setLoading(true);
    setApiError("");
    setVariations([]);
    setShowVars(false);
    try {
      const data = await aiFetch("/api/book/contextual-titles", {
        research,
        analysis,
        mode,
        intelligence
      });
      const newCards = Array.isArray(data.cards) ? data.cards : [];
      const titles   = newCards.map((c) => c.title).filter(Boolean);
      const rec      = newCards.find((c) => c.isRecommended);
      setBookTitleBlock({
        ...bookTitle,
        cards:       newCards,
        suggestions: titles,
        mode,
        pickedFromAi:  rec ? rec.title : (bookTitle.pickedFromAi || ""),
        selectedCard:  rec || bookTitle.selectedCard || null,
        customTitle:   bookTitle.customTitle || ""
      });
      if (!newCards.length) setApiError("No titles returned — try again.");
    } catch (e) {
      setApiError(
        e instanceof GenerationCanceledError
          ? "Generation canceled — Grok approval declined."
          : e?.message || "Generation failed."
      );
    } finally {
      setLoading(false);
    }
  }

  function selectCard(card, subtitleOverride) {
    const sub = subtitleOverride || card.subtitle || "";
    setBookTitleBlock({
      ...bookTitle,
      pickedFromAi: card.title,
      customTitle:  "",
      selectedCard: { ...card, activeSubtitle: sub }
    });
    setVariations([]);
    setShowVars(false);
  }

  async function generateVariations() {
    const sel = bookTitle.selectedCard;
    if (!sel) return;
    setVarLoading(true);
    setVarError("");
    setShowVars(true);
    try {
      const data = await aiFetch("/api/book/title-variations", {
        title:        sel.title,
        subtitle:     sel.activeSubtitle || sel.subtitle || "",
        research,
        intelligence
      });
      setVariations(Array.isArray(data.variations) ? data.variations : []);
    } catch (e) {
      setVarError(e?.message || "Failed to generate variations.");
    } finally {
      setVarLoading(false);
    }
  }

  function useVariation(variation) {
    setBookTitleBlock({
      ...bookTitle,
      pickedFromAi: variation.title,
      customTitle:  "",
      selectedCard: {
        title:         variation.title,
        subtitle:      variation.subtitle || "",
        activeSubtitle: variation.subtitle || "",
        isRecommended: false,
        category:      variation.style,
        pattern:       variation.style,
        seoScore:      null, emotionalScore: null, clickabilityScore: null, audienceMatch: null
      }
    });
    setShowVars(false);
    setVariations([]);
  }

  const grouped = useMemo(() => {
    const g = {};
    for (const c of cards) {
      const cat = c.category || "Other";
      if (!g[cat]) g[cat] = [];
      g[cat].push(c);
    }
    return g;
  }, [cards]);

  const categoryOrder = ["Masculine Authority","Emotional Transformation","Premium Minimalist","Scientific Authority","Viral Modern","Philosophical Wisdom","Bold Challenger","Other"];
  const sortedGroups = categoryOrder.filter((c) => grouped[c]).map((c) => ({ cat: c, items: grouped[c] }));

  const chosen      = effectiveChosen();
  const selectedCard = bookTitle.selectedCard;
  const hasIntel     = !!intelligence;

  return (
    <div className="mx-auto max-w-3xl">

      {/* ── Header ── */}
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700/90">Step 3 — Title Positioning Engine</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-slate-900 md:text-3xl">Book title</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          {hasIntel
            ? "Generating from your competitor intelligence — titles are scored for SEO, emotional impact, and Amazon clickability."
            : "Pick a style mode and generate SEO-scored, audience-targeted title packages. Add competitor books in Analysis for even smarter results."}
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

      {/* ── Style mode selector ── */}
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Generation style</p>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                mode === m.id
                  ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:text-sky-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Generate button ── */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={generateCards}
          className="rounded-full bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-slate-800 hover:to-slate-600 disabled:opacity-60 transition"
        >
          {loading ? "Generating…" : cards.length ? "Regenerate titles" : "Generate title packages"}
        </button>
        {chosen && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-800">{chosen}</span>
          </div>
        )}
      </div>

      {apiError && <p className="mt-3 text-sm font-medium text-rose-700">{apiError}</p>}

      {/* ── Title cards grouped by category ── */}
      {cards.length > 0 && (
        <div className="mt-8 space-y-8">
          {sortedGroups.map(({ cat, items }) => {
            const headerColor = CATEGORY_HEADER_COLORS[cat] || "border-slate-300 text-slate-600";
            return (
              <section key={cat}>
                <div className={`flex items-center gap-3 mb-3 border-b pb-2 ${headerColor}`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest">{cat}</p>
                  <span className="text-[10px] text-current opacity-50">{items.length} title{items.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((card) => (
                    <TitleCard
                      key={card.title}
                      card={card}
                      isSelected={bookTitle.pickedFromAi === card.title && !bookTitle.customTitle?.trim()}
                      onSelect={selectCard}
                      onSelectWithSubtitle={selectCard}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ── Selected title panel + variations ── */}
      {selectedCard && (bookTitle.pickedFromAi === selectedCard.title) && !bookTitle.customTitle?.trim() && (
        <div className="mt-8 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50/60 via-white to-indigo-50/40 p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700 mb-2">Selected title</p>
          <p className="font-serif text-xl font-bold text-slate-900">{selectedCard.title}</p>
          {(selectedCard.activeSubtitle || selectedCard.subtitle) && (
            <p className="mt-1 text-xs italic text-slate-500">{selectedCard.activeSubtitle || selectedCard.subtitle}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateVariations}
              disabled={varLoading}
              className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              {varLoading ? "Generating variations…" : showVars ? "Regenerate variations" : "Generate variations"}
            </button>
            {showVars && variations.length > 0 && (
              <button
                type="button"
                onClick={() => setShowVars(false)}
                className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
              >
                Hide variations
              </button>
            )}
          </div>

          {varError && <p className="mt-2 text-xs font-medium text-rose-700">{varError}</p>}

          {varLoading && (
            <p className="mt-3 text-xs text-indigo-700 animate-pulse">
              AI generating 6 creative variations…
            </p>
          )}

          {showVars && variations.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                Variations of "{selectedCard.title}"
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {variations.map((v) => (
                  <VariationCard key={v.style} variation={v} onUse={useVariation} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Custom title ── */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-lg font-semibold text-slate-900">Custom title</h3>
        <p className="mt-1 text-xs text-slate-600">
          Overrides any selected card. Use this when you already know your exact title.
        </p>
        <input
          className="input-light mt-4"
          placeholder="Type your definitive book title…"
          value={bookTitle.customTitle || ""}
          onChange={(e) =>
            setBookTitleBlock({ ...bookTitle, customTitle: e.target.value })
          }
        />
        {bookTitle.customTitle?.trim() && (
          <p className="mt-2 text-xs text-emerald-700 font-medium">
            ✓ Custom title active — this overrides any selection above.
          </p>
        )}
      </div>

    </div>
  );
}
