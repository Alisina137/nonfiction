import { useEffect, useMemo, useRef, useState } from "react";
import {
  AUTHOR_TONE_OPTIONS,
  BOOK_CHAPTER_OPTIONS,
  BOOK_STRUCTURE_OPTIONS,
  BOOK_WORD_COUNT_RANGES,
  GENERAL_AUDIENCE_OPTIONS,
  GENRE_OPTIONS
} from "@/lib/constants";
import { effectiveBookTitle } from "@/lib/proposedBook";
import { getActivePersona } from "@/lib/bookContext";

const CREATE_NEW_PERSONA = "__create_new__";

// ─── Persona notes builder ────────────────────────────────────────────────────

function buildPersonaNotes(authorPersona) {
  if (!authorPersona) return "";
  const id = authorPersona.selectedId;
  const saved = Array.isArray(authorPersona.savedPersonas) ? authorPersona.savedPersonas : [];
  const p = id && id !== CREATE_NEW_PERSONA ? saved.find((x) => x.id === id) : null;
  if (!p) return "";
  const g = p.generated;
  const parts = [];
  if (g?.summary) parts.push(g.summary);
  if (g?.voice?.tone || g?.voice?.mood) parts.push([g.voice.tone, g.voice.mood].filter(Boolean).join(" • "));
  if (g?.style) {
    const styleBits = [g.style.pacing, g.style.vocabulary || g.style.vocabularyLevel, g.style.sentenceStructure].filter(Boolean).join(" ");
    if (styleBits) parts.push(styleBits);
  }
  if (!parts.length && p.authorDescription?.trim()) parts.push(p.authorDescription.trim());
  return parts.join("\n\n");
}

// ─── Suggestion helpers ───────────────────────────────────────────────────────

function matchGenre(niche) {
  if (!niche) return null;
  const n = niche.toLowerCase();
  const direct = GENRE_OPTIONS.find((g) => g.toLowerCase() === n);
  if (direct) return direct;
  const MAP = {
    "personal development": "Self-help", "self-help": "Self-help", "self help": "Self-help",
    "business": "Business", "finance": "Business", "business & finance": "Business",
    "entrepreneurship": "Entrepreneurship", "productivity": "Productivity",
    "health": "Health & wellness", "wellness": "Health & wellness", "fitness": "Health & wellness",
    "health & wellness": "Health & wellness", "parenting": "Parenting & family",
    "relationships": "Parenting & family", "leadership": "Leadership", "investing": "Investing",
    "technology": "Technology", "philosophy": "Philosophy / ideas", "spirituality": "Spirituality",
    "cooking": "Cookbooks & food writing", "food": "Cookbooks & food writing",
    "career": "Career development", "marketing": "Marketing",
    "memoir": "Memoir / narrative nonfiction"
  };
  for (const [k, v] of Object.entries(MAP)) { if (n.includes(k)) return v; }
  return GENRE_OPTIONS.find((g) => n.includes(g.toLowerCase()) || g.toLowerCase().includes(n)) || null;
}

function matchAudience(audience) {
  if (!audience) return null;
  const a = audience.toLowerCase();
  if (a.includes("young adult") || a.includes("ya ") || a.includes("teen")) return "Young adult";
  if (a.includes("adult") || a.includes("professional") || a.includes("entrepreneur") || a.includes("reader")) return "Adult";
  if (a.includes("child") || a.includes("kid")) return "Child";
  if (a.includes("senior") || a.includes("elder")) return "Senior";
  return null;
}

function matchTone(tone) {
  if (!tone) return null;
  const t = tone.toLowerCase();
  return AUTHOR_TONE_OPTIONS.find((o) => o.toLowerCase() === t)
    || AUTHOR_TONE_OPTIONS.find((o) => t.includes(o.toLowerCase()) || o.toLowerCase().includes(t.split(" ")[0]))
    || null;
}

function mapStructureType(structureType) {
  const MAP = {
    chronological: "Chronological", "narrative-arc": "Chronological", "hero-journey": "Chronological",
    "romance-arc": "Chronological", "suspense-escalation": "Chronological", "mystery-procedural": "Chronological",
    "problem-solution": "Problem-solution", "how-to": "How-to", "list-based": "List-based",
    workbook: "Workbook", modular: "Modular", thematic: "Thematic",
    "q-and-a": "Question and answer", comparative: "Comparative",
    "romantasy-hybrid": "Hybrid / mixed", hybrid: "Hybrid / mixed"
  };
  return MAP[(structureType || "").toLowerCase().replace(/_/g, "-")] || null;
}

/** Compute all suggestions from the project's cumulative workflow memory. */
function computeSuggestions(project) {
  if (!project) return {};
  const r    = project.research || {};
  const intel = project.analysis?.intelligence || {};
  const pb   = project.proposedBook?.content || {};
  const bt   = project.bookTitle || {};
  const arch = r.architectureSnapshot || {};
  const persona = getActivePersona(project);

  const s = {};

  // Title (highest confidence — user explicitly chose this)
  const titleVal = effectiveBookTitle(bt) || pb.title?.trim() || r.bookTitle?.trim();
  if (titleVal) s.title = { value: titleVal, source: "Book Title step", confidence: 0.95 };

  // Subtitle
  const subVal = r.bookSubtitle?.trim() || bt?.selectedCard?.subtitle?.trim();
  if (subVal) s.subtitle = { value: subVal, source: r.bookSubtitle ? "Research step" : "Book Title step", confidence: r.bookSubtitle ? 0.90 : 0.80 };

  // Genre
  const genreMatch = matchGenre(r.mainNicheLabel);
  if (genreMatch) s.genre = { value: genreMatch, source: "Research niche", confidence: 0.85 };

  // Audience
  const rawAudience = intel.targetAudience?.trim() || r.targetAudience?.trim();
  if (rawAudience) {
    const matched = matchAudience(rawAudience);
    s.audience = {
      value: matched || rawAudience,
      source: intel.targetAudience ? "Competitor Analysis" : "Research step",
      confidence: intel.targetAudience ? 0.85 : 0.72
    };
  } else if (r.generalAudience?.trim()) {
    s.audience = { value: r.generalAudience.trim(), source: "Research step", confidence: 0.70 };
  }

  // Tone
  let tone = null;
  if (persona?.generated?.voice?.tone) {
    const t = matchTone(persona.generated.voice.tone);
    if (t) tone = { value: t, source: "Author Persona", confidence: 0.90 };
  }
  if (!tone && Array.isArray(r.authorTones) && r.authorTones.length) {
    const t = r.authorTones.find((x) => AUTHOR_TONE_OPTIONS.includes(x)) || matchTone(r.authorTones[0]);
    if (t) tone = { value: t, source: "Research step", confidence: 0.75 };
  }
  if (!tone && intel.energyStyle) {
    const t = matchTone(intel.energyStyle);
    if (t) tone = { value: t, source: "Competitor Analysis", confidence: 0.70 };
  }
  if (tone) s.tone = tone;

  // Structure
  if (arch.structureType) {
    const st = mapStructureType(arch.structureType);
    if (st) s.structure = { value: st, source: "Niche Blueprint", confidence: 0.72 };
  }

  // Word count range
  if (arch.wordCountRange && BOOK_WORD_COUNT_RANGES.includes(arch.wordCountRange)) {
    s.wordCountRange = { value: arch.wordCountRange, source: "Niche Blueprint", confidence: 0.72 };
  }

  // Chapter count
  if (arch.recommendedChapters?.default) {
    const cc = Math.min(15, Math.max(5, Math.round(Number(arch.recommendedChapters.default))));
    if (!Number.isNaN(cc)) s.chapterCount = { value: cc, source: "Niche Blueprint", confidence: 0.72 };
  }

  // USP
  if (pb.uniqueSellingProposition?.trim())
    s.uniqueSellingProposition = { value: pb.uniqueSellingProposition.trim(), source: "Proposed Book step", confidence: 0.90 };

  // Author persona notes
  const personaNotes = buildPersonaNotes(project.authorPersona);
  if (personaNotes?.trim())
    s.authorPersonaNotes = { value: personaNotes.trim(), source: "Author Persona step", confidence: 0.85 };

  // Reader pain points (from intelligence)
  if (intel.readerPainProfile?.trim())
    s.readerPainPoints = { value: intel.readerPainProfile.trim(), source: "Competitor Analysis", confidence: 0.92 };

  // Keywords (low-confidence local derivation)
  const kwParts = [r.mainNicheLabel, r.subNicheLabel, r.deepNicheLabel, ...(r.bookTopic || "").split(" ").slice(0, 6)]
    .filter(Boolean).slice(0, 8);
  if (kwParts.length >= 2)
    s.keywords = { value: kwParts.join(", "), source: "Research step", confidence: 0.55 };

  // Stamp all as pending
  Object.keys(s).forEach((k) => { s[k] = { ...s[k], status: "pending" }; });
  return s;
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────

function FieldLabel({ children, hint }) {
  return (
    <label className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-slate-800">
      {children}
      {hint && (
        <span className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300/90 bg-white text-[10px] font-bold text-sky-600 shadow-sm" title={hint}>
          i
        </span>
      )}
    </label>
  );
}

function confidenceStyle(conf) {
  if (conf >= 0.85) return { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-900", badge: "bg-emerald-100 text-emerald-700", label: "Inherited" };
  if (conf >= 0.65) return { border: "border-sky-200", bg: "bg-sky-50", text: "text-sky-900", badge: "bg-sky-100 text-sky-700", label: "AI Suggested" };
  return { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-900", badge: "bg-amber-100 text-amber-700", label: "Low confidence" };
}

/** Inline banner for text/textarea fields. */
function SuggestionBanner({ fieldKey, suggestion, onAccept, onDismiss, onRegen }) {
  if (!suggestion || suggestion.status !== "pending") return null;
  const cs = confidenceStyle(suggestion.confidence);
  return (
    <div className={`mt-2 rounded-xl border ${cs.border} ${cs.bg} px-3 py-2.5`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cs.badge}`}>{cs.label}</span>
            <span className={`text-[11px] ${cs.text} opacity-75`}>from {suggestion.source}</span>
            <button type="button" onClick={onRegen} className="ml-auto text-[10px] text-slate-400 hover:text-slate-600 underline">Refresh</button>
          </div>
          <p className={`text-xs leading-relaxed ${cs.text} line-clamp-4 whitespace-pre-wrap`}>{suggestion.value}</p>
        </div>
        <div className="mt-0.5 flex shrink-0 flex-col gap-1">
          <button type="button" onClick={onAccept} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50 transition">Accept ✓</button>
          <button type="button" onClick={onDismiss} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 transition">Clear ✗</button>
        </div>
      </div>
    </div>
  );
}

/** Inline chip for dropdown fields. */
function DropdownSuggestion({ suggestion, onAccept, onDismiss }) {
  if (!suggestion || suggestion.status !== "pending") return null;
  const cs = confidenceStyle(suggestion.confidence);
  return (
    <div className={`mt-2 rounded-lg border ${cs.border} ${cs.bg} flex items-center gap-2 px-3 py-2 text-xs`}>
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cs.badge}`}>{cs.label}</span>
      <span className={`font-medium truncate ${cs.text}`}>{suggestion.value}</span>
      <span className={`shrink-0 text-[11px] ${cs.text} opacity-60`}>from {suggestion.source}</span>
      <div className="ml-auto flex shrink-0 gap-2">
        <button type="button" onClick={onAccept} className="font-semibold text-emerald-700 hover:underline">Apply</button>
        <span className="text-slate-300">·</span>
        <button type="button" onClick={onDismiss} className="text-slate-400 hover:text-slate-600">Dismiss</button>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <p className="mt-8 mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">{children}</p>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BookDetailsStep({ bookDetails, setBookDetails, fullProject, currentStep, detailsStepIndex }) {
  const bd = bookDetails || {};
  const [suggestions, setSuggestions] = useState({});
  const visitedRef = useRef(false);

  // Compute suggestions once on first step visit
  useEffect(() => {
    if (currentStep !== detailsStepIndex) {
      visitedRef.current = false;
      return;
    }
    if (visitedRef.current) return;
    visitedRef.current = true;
    setSuggestions(computeSuggestions(fullProject));
  }, [currentStep, detailsStepIndex, fullProject]);

  function patch(partial) {
    setBookDetails((prev) => {
      const base = prev || {};
      return typeof partial === "function" ? partial(base) : { ...base, ...partial };
    });
  }

  function accept(key, value) {
    patch({ [key]: value });
    setSuggestions((prev) => ({ ...prev, [key]: { ...prev[key], status: "accepted" } }));
  }

  function dismiss(key) {
    setSuggestions((prev) => ({ ...prev, [key]: { ...prev[key], status: "dismissed" } }));
  }

  function regen(key) {
    const fresh = computeSuggestions(fullProject);
    if (fresh[key]) setSuggestions((prev) => ({ ...prev, [key]: { ...fresh[key], status: "pending" } }));
  }

  /** Is the suggestion active? (pending + field currently empty) */
  function isActive(key) {
    const s = suggestions[key];
    return s?.status === "pending" && !String(bd[key] ?? "").trim();
  }

  // Count pending suggestions for empty fields
  const pendingCount = Object.keys(suggestions).filter((k) => isActive(k)).length;

  function acceptAll() {
    const updates = {};
    Object.entries(suggestions).forEach(([k, s]) => {
      if (s?.status === "pending" && !String(bd[k] ?? "").trim()) updates[k] = s.value;
    });
    if (!Object.keys(updates).length) return;
    patch(updates);
    setSuggestions((prev) => {
      const next = { ...prev };
      Object.keys(updates).forEach((k) => { next[k] = { ...next[k], status: "accepted" }; });
      return next;
    });
  }

  // Dynamic option lists (add custom values so they appear in dropdowns)
  const genreOptions = useMemo(() => {
    const set = new Set(GENRE_OPTIONS);
    const g = (bd.genre || "").trim();
    return g && !set.has(g) ? [g, ...GENRE_OPTIONS] : [...GENRE_OPTIONS];
  }, [bd.genre]);

  const toneOptions = useMemo(() => {
    const set = new Set(AUTHOR_TONE_OPTIONS);
    const t = (bd.tone || "").trim();
    return t && !set.has(t) ? [t, ...AUTHOR_TONE_OPTIONS] : [...AUTHOR_TONE_OPTIONS];
  }, [bd.tone]);

  const audienceOptions = useMemo(() => {
    const set = new Set(GENERAL_AUDIENCE_OPTIONS);
    const a = (bd.audience || "").trim();
    return a && !set.has(a) ? [a, ...GENERAL_AUDIENCE_OPTIONS] : [...GENERAL_AUDIENCE_OPTIONS];
  }, [bd.audience]);

  const suggestedWordCount = suggestions.wordCountRange?.status === "pending" ? suggestions.wordCountRange.value : null;
  const suggestedChapters  = suggestions.chapterCount?.status  === "pending" ? suggestions.chapterCount.value  : null;

  return (
    <div className="mx-auto max-w-2xl">

      {/* ── Header ── */}
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700/90">Step 7 — Book details</p>
        <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Strategic synthesis</h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Your workflow data has been analyzed. Accept the AI suggestions or override any field manually — your edits are always final.
        </p>
      </header>

      {/* ── Accept all banner ── */}
      {pendingCount > 0 && (
        <div className="mt-5 flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-sky-900">
              {pendingCount} suggestion{pendingCount !== 1 ? "s" : ""} ready
            </p>
            <p className="text-xs text-sky-700/80">Inherited from your completed steps</p>
          </div>
          <button type="button" onClick={acceptAll} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 transition">
            Accept all
          </button>
        </div>
      )}

      <div className="mt-6 space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">

        {/* ── Word count range ── */}
        <div>
          <FieldLabel hint="Estimated manuscript length. Niche Blueprint recommends a band based on your sub-niche.">
            Target word count
            {suggestedWordCount && (
              <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">Niche Recommended</span>
            )}
          </FieldLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            {BOOK_WORD_COUNT_RANGES.map((range) => {
              const on  = bd.wordCountRange === range;
              const rec = suggestedWordCount === range;
              return (
                <button
                  key={range}
                  type="button"
                  onClick={() => {
                    patch({ wordCountRange: range });
                    setSuggestions((prev) => ({ ...prev, wordCountRange: { ...prev.wordCountRange, status: "accepted" } }));
                  }}
                  className={`relative rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    on ? "border-slate-900 bg-slate-900 text-white"
                    : rec ? "border-sky-400 bg-sky-50 text-sky-800 ring-1 ring-sky-300"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {range}
                  {rec && !on && <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3"><span className="h-3 w-3 rounded-full bg-sky-500 text-[7px] text-white flex items-center justify-center">✦</span></span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Chapter count ── */}
        <div>
          <FieldLabel hint="Chapters planned. Niche Blueprint recommends based on sub-niche pacing.">
            Number of chapters
            {suggestedChapters && (
              <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">Niche Recommended</span>
            )}
          </FieldLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            {BOOK_CHAPTER_OPTIONS.map((n) => {
              const on  = Number(bd.chapterCount) === n;
              const rec = suggestedChapters === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    patch({ chapterCount: n });
                    setSuggestions((prev) => ({ ...prev, chapterCount: { ...prev.chapterCount, status: "accepted" } }));
                  }}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition ${
                    on ? "border-slate-900 bg-slate-900 text-white"
                    : rec ? "border-sky-400 bg-sky-50 text-sky-800 ring-1 ring-sky-300"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {n}
                  {rec && !on && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-sky-500 border border-white" />}
                </button>
              );
            })}
          </div>
        </div>

        <SectionTitle>Book Identity</SectionTitle>

        {/* ── Title ── */}
        <div>
          <FieldLabel hint="Working title — inherited from the Book Title step.">Title</FieldLabel>
          <input
            className="input-light mt-1.5"
            value={bd.title ?? ""}
            placeholder="Working title"
            onChange={(e) => patch({ title: e.target.value })}
          />
          {isActive("title") && (
            <SuggestionBanner
              fieldKey="title"
              suggestion={suggestions.title}
              onAccept={() => accept("title", suggestions.title.value)}
              onDismiss={() => dismiss("title")}
              onRegen={() => regen("title")}
            />
          )}
        </div>

        {/* ── Subtitle ── */}
        <div>
          <FieldLabel hint="Clarifies the book's promise — inherited from Research if set.">
            Subtitle <span className="font-normal text-slate-400">(optional)</span>
          </FieldLabel>
          <input
            className="input-light mt-1.5"
            value={bd.subtitle ?? ""}
            placeholder="e.g. The Entrepreneur's System for Unbreakable Daily Habits"
            onChange={(e) => patch({ subtitle: e.target.value })}
          />
          {isActive("subtitle") && (
            <SuggestionBanner
              fieldKey="subtitle"
              suggestion={suggestions.subtitle}
              onAccept={() => accept("subtitle", suggestions.subtitle.value)}
              onDismiss={() => dismiss("subtitle")}
              onRegen={() => regen("subtitle")}
            />
          )}
        </div>

        <SectionTitle>Positioning</SectionTitle>

        {/* ── Genre + Structure ── */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel hint="Market category — inherited from your Research niche.">Genre</FieldLabel>
            <select className="input-light mt-1.5" value={bd.genre ?? ""} onChange={(e) => patch({ genre: e.target.value })}>
              <option value="">Select genre</option>
              {genreOptions.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            {isActive("genre") && (
              <DropdownSuggestion
                suggestion={suggestions.genre}
                onAccept={() => accept("genre", suggestions.genre.value)}
                onDismiss={() => dismiss("genre")}
              />
            )}
          </div>
          <div>
            <FieldLabel hint="Architectural blueprint — inferred from your niche's structural fingerprint.">Structure</FieldLabel>
            <select className="input-light mt-1.5" value={bd.structure ?? ""} onChange={(e) => patch({ structure: e.target.value })}>
              <option value="">Select structure</option>
              {BOOK_STRUCTURE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {isActive("structure") && (
              <DropdownSuggestion
                suggestion={suggestions.structure}
                onAccept={() => accept("structure", suggestions.structure.value)}
                onDismiss={() => dismiss("structure")}
              />
            )}
          </div>
          <div>
            <FieldLabel hint="Dominant tonal register — inherited from Author Persona or Research.">Tone</FieldLabel>
            <select className="input-light mt-1.5" value={bd.tone ?? ""} onChange={(e) => patch({ tone: e.target.value })}>
              <option value="">Select tone</option>
              {toneOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {isActive("tone") && (
              <DropdownSuggestion
                suggestion={suggestions.tone}
                onAccept={() => accept("tone", suggestions.tone.value)}
                onDismiss={() => dismiss("tone")}
              />
            )}
          </div>
          <div>
            <FieldLabel hint="Reader demographic — inherited from Competitor Analysis or Research.">Audience</FieldLabel>
            <select className="input-light mt-1.5" value={bd.audience ?? ""} onChange={(e) => patch({ audience: e.target.value })}>
              <option value="">Select audience</option>
              {audienceOptions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {isActive("audience") && (
              <DropdownSuggestion
                suggestion={suggestions.audience}
                onAccept={() => accept("audience", suggestions.audience.value)}
                onDismiss={() => dismiss("audience")}
              />
            )}
          </div>
        </div>

        <SectionTitle>Content Strategy</SectionTitle>

        {/* ── USP ── */}
        <div>
          <FieldLabel hint="Hook for listings — inherited from Proposed Book step.">Unique Selling Proposition</FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[110px] resize-y"
            value={bd.uniqueSellingProposition ?? ""}
            placeholder="What makes this book uniquely valuable to your reader?"
            onChange={(e) => patch({ uniqueSellingProposition: e.target.value })}
          />
          {isActive("uniqueSellingProposition") && (
            <SuggestionBanner
              fieldKey="uniqueSellingProposition"
              suggestion={suggestions.uniqueSellingProposition}
              onAccept={() => accept("uniqueSellingProposition", suggestions.uniqueSellingProposition.value)}
              onDismiss={() => dismiss("uniqueSellingProposition")}
              onRegen={() => regen("uniqueSellingProposition")}
            />
          )}
        </div>

        {/* ── Reader Pain Points (NEW) ── */}
        <div>
          <FieldLabel hint="The reader's core frustrations — inherited from Competitor Analysis intelligence.">
            Reader pain points
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[90px] resize-y"
            value={bd.readerPainPoints ?? ""}
            placeholder="What frustrations, failures, or gaps drive your reader to pick up this book?"
            onChange={(e) => patch({ readerPainPoints: e.target.value })}
          />
          {isActive("readerPainPoints") && (
            <SuggestionBanner
              fieldKey="readerPainPoints"
              suggestion={suggestions.readerPainPoints}
              onAccept={() => accept("readerPainPoints", suggestions.readerPainPoints.value)}
              onDismiss={() => dismiss("readerPainPoints")}
              onRegen={() => regen("readerPainPoints")}
            />
          )}
        </div>

        {/* ── Keywords (NEW) ── */}
        <div>
          <FieldLabel hint="SEO/Amazon keywords — low-confidence derivation from your niche and topic. Edit freely.">
            Keywords <span className="font-normal text-slate-400">(optional)</span>
          </FieldLabel>
          <input
            className="input-light mt-1.5"
            value={bd.keywords ?? ""}
            placeholder="e.g. self-discipline, entrepreneur habits, productivity systems"
            onChange={(e) => patch({ keywords: e.target.value })}
          />
          {isActive("keywords") && (
            <SuggestionBanner
              fieldKey="keywords"
              suggestion={suggestions.keywords}
              onAccept={() => accept("keywords", suggestions.keywords.value)}
              onDismiss={() => dismiss("keywords")}
              onRegen={() => regen("keywords")}
            />
          )}
        </div>

        <SectionTitle>Author Voice</SectionTitle>

        {/* ── Author persona notes ── */}
        <div>
          <FieldLabel hint="Writing voice snapshot — inherited from your Author Persona. Edit to fine-tune how AI writes each chapter.">
            Author persona snapshot
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[120px] resize-y"
            placeholder="Voice, background, cadence, sentence style…"
            value={bd.authorPersonaNotes ?? ""}
            onChange={(e) => patch({ authorPersonaNotes: e.target.value })}
          />
          {isActive("authorPersonaNotes") && (
            <SuggestionBanner
              fieldKey="authorPersonaNotes"
              suggestion={suggestions.authorPersonaNotes}
              onAccept={() => accept("authorPersonaNotes", suggestions.authorPersonaNotes.value)}
              onDismiss={() => dismiss("authorPersonaNotes")}
              onRegen={() => regen("authorPersonaNotes")}
            />
          )}
        </div>

      </div>
    </div>
  );
}
