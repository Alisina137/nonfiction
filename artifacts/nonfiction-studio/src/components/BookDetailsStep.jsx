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
import { aiFetch } from "@/lib/ai/aiFetch";

const CREATE_NEW_PERSONA = "__create_new__";

const RESEARCH_INTENSITY_OPTIONS = ["Light", "Moderate", "Heavy"];

const FIELD_LABELS = {
  genre: "Genre", structure: "Structure", tone: "Tone", audience: "Audience",
  chapterCount: "Chapters", wordCountRange: "Word count",
  uniqueSellingProposition: "USP", readerPainPoints: "Pain points",
  focusTopics: "Focus topics", subtitle: "Subtitle",
  corePromise: "Core promise", coreThesis: "Core thesis",
  uniqueMechanism: "Unique mechanism", readerTransformationBefore: "Transformation before",
  readerTransformationAfter: "Transformation after", readerObjections: "Reader objections",
  desiredEmotionalOutcome: "Emotional outcome", positioningStatement: "Positioning statement",
  researchIntensity: "Research intensity"
};

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

function computeSuggestions(project) {
  if (!project) return {};
  const r    = project.research || {};
  const intel = project.analysis?.intelligence || {};
  const pb   = project.proposedBook?.content || {};
  const bt   = project.bookTitle || {};
  const arch = r.architectureSnapshot || {};
  const persona = getActivePersona(project);

  const s = {};

  const titleVal = effectiveBookTitle(bt) || pb.title?.trim() || r.bookTitle?.trim();
  if (titleVal) s.title = { value: titleVal, source: "Book Title step", confidence: 0.95 };

  const subVal = r.bookSubtitle?.trim() || bt?.selectedCard?.subtitle?.trim();
  if (subVal) s.subtitle = { value: subVal, source: r.bookSubtitle ? "Research step" : "Book Title step", confidence: r.bookSubtitle ? 0.90 : 0.80 };

  const genreMatch = matchGenre(r.mainNicheLabel);
  if (genreMatch) s.genre = { value: genreMatch, source: "Research niche", confidence: 0.85 };

  const rawAudience = intel.targetAudience?.trim() || r.targetAudience?.trim();
  if (rawAudience) {
    const matched = matchAudience(rawAudience);
    s.audience = { value: matched || rawAudience, source: intel.targetAudience ? "Competitor Analysis" : "Research step", confidence: intel.targetAudience ? 0.85 : 0.72 };
  } else if (r.generalAudience?.trim()) {
    s.audience = { value: r.generalAudience.trim(), source: "Research step", confidence: 0.70 };
  }

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

  if (arch.structureType) {
    const st = mapStructureType(arch.structureType);
    if (st) s.structure = { value: st, source: "Niche Blueprint", confidence: 0.72 };
  }
  if (arch.wordCountRange && BOOK_WORD_COUNT_RANGES.includes(arch.wordCountRange)) {
    s.wordCountRange = { value: arch.wordCountRange, source: "Niche Blueprint", confidence: 0.72 };
  }
  if (arch.recommendedChapters?.default) {
    const cc = Math.min(15, Math.max(5, Math.round(Number(arch.recommendedChapters.default))));
    if (!Number.isNaN(cc)) s.chapterCount = { value: cc, source: "Niche Blueprint", confidence: 0.72 };
  }

  if (pb.uniqueSellingProposition?.trim())
    s.uniqueSellingProposition = { value: pb.uniqueSellingProposition.trim(), source: "Proposed Book step", confidence: 0.90 };

  const personaNotes = buildPersonaNotes(project.authorPersona);
  if (personaNotes?.trim())
    s.authorPersonaNotes = { value: personaNotes.trim(), source: "Author Persona step", confidence: 0.85 };

  if (intel.readerPainProfile?.trim())
    s.readerPainPoints = { value: intel.readerPainProfile.trim(), source: "Competitor Analysis", confidence: 0.92 };

  const kwParts = [r.mainNicheLabel, r.subNicheLabel, r.deepNicheLabel, ...(r.bookTopic || "").split(" ").slice(0, 6)]
    .filter(Boolean).slice(0, 8);
  if (kwParts.length >= 2)
    s.focusTopics = { value: kwParts.join(", "), source: "Research step", confidence: 0.55 };

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

function SuggestionBanner({ suggestion, onAccept, onDismiss, onRegen }) {
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

function SectionTitle({ children }) {
  return <p className="mt-8 mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">{children}</p>;
}

function AiGeneratedBadge() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
      ✦ AI Generated
    </span>
  );
}

function SmartRecommendationCard({ icon, label, value, reason, onApply, onDismiss }) {
  if (!value || !reason) return null;
  return (
    <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">{label}</p>
          <p className="mt-0.5 text-sm font-bold text-violet-900">{value}</p>
          <p className="mt-1 text-xs leading-relaxed text-violet-800">{reason}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 mt-0.5">
          <button type="button" onClick={onApply} className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-violet-700 shadow-sm hover:bg-violet-50 transition">Apply ✓</button>
          <button type="button" onClick={onDismiss} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 transition">Dismiss</button>
        </div>
      </div>
    </div>
  );
}

// ─── AI Suggestion Chips (radio-style) ────────────────────────────────────────

function SuggestionChips({ suggestions, value, onChange, reasons }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {suggestions.map((opt, i) => {
        const selected = value === opt;
        const reason = reasons?.[i];
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
              selected
                ? "border-violet-400 bg-violet-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
              selected ? "border-violet-500 bg-violet-500" : "border-slate-300 bg-white"
            }`}>
              {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`text-sm font-semibold ${selected ? "text-violet-900" : "text-slate-700"}`}>{opt}</span>
              {reason && <span className={`ml-2 text-xs ${selected ? "text-violet-600" : "text-slate-400"}`}>{reason}</span>}
            </span>
            {selected && <span className="flex-shrink-0 text-[10px] font-bold text-violet-500 uppercase tracking-wider mt-0.5">Selected</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Alt Suggestions for text fields ─────────────────────────────────────────

function AltSuggestions({ suggestions, value, onSelect }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-500">✦ AI Alternatives — click to use</p>
      <div className="space-y-2">
        {suggestions.map((s, i) => {
          const active = value === s;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(s)}
              className={`w-full rounded-lg border px-3 py-2.5 text-left text-xs leading-relaxed transition ${
                active
                  ? "border-violet-300 bg-violet-50 text-violet-900 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="whitespace-pre-wrap">{s}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mechanism Suggestions ────────────────────────────────────────────────────

function MechanismSuggestions({ suggestions, value, onSelect }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-500">✦ AI Framework Alternatives — click to use</p>
      <div className="space-y-2">
        {suggestions.map((m, i) => {
          const formatted = `${m.name}\n\n${m.description}`;
          const active = value === formatted;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(formatted)}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                active
                  ? "border-violet-300 bg-violet-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <p className={`text-sm font-bold ${active ? "text-violet-800" : "text-slate-700"}`}>{m.name}</p>
              <p className={`mt-1 text-xs leading-relaxed ${active ? "text-violet-700" : "text-slate-500"}`}>{m.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Chips + Custom input (for dropdowns) ─────────────────────────────────────

function ChipsWithCustom({ suggestions, value, onChange, reasons, options, placeholder }) {
  const [showCustom, setShowCustom] = useState(false);
  const isCustom = value && !suggestions.includes(value);

  return (
    <div>
      {suggestions.length > 0 ? (
        <SuggestionChips suggestions={suggestions} value={value} onChange={onChange} reasons={reasons} />
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {suggestions.length === 0 && options && options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              value === opt
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {opt}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className="text-[11px] text-slate-400 hover:text-slate-600 underline"
        >
          {isCustom ? `Custom: "${value}"` : "Enter custom…"}
        </button>
      </div>

      {(showCustom || isCustom) && (
        <input
          className="input-light mt-2 text-sm"
          placeholder={placeholder || "Type custom value…"}
          value={isCustom ? value : ""}
          onChange={(e) => { onChange(e.target.value); if (!e.target.value) setShowCustom(false); }}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BookDetailsStep({ bookDetails, setBookDetails, fullProject, currentStep, detailsStepIndex }) {
  const bd = bookDetails || {};
  const [suggestions, setSuggestions] = useState({});
  const visitedRef = useRef(false);

  const [aiGenerating, setAiGenerating]   = useState(false);
  const [aiError, setAiError]             = useState("");
  const [aiGenFields, setAiGenFields]     = useState(new Set());
  const [aiGenPhase, setAiGenPhase]       = useState("");
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [replaceExisting, setReplaceExisting] = useState(false);

  const [wordCountRec, setWordCountRec]   = useState(null);
  const [chapterCountRec, setChapterCountRec] = useState(null);

  const [exporting, setExporting]         = useState(false);
  const [exportError, setExportError]     = useState("");
  const [exportDone, setExportDone]       = useState(false);

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

  function isActive(key) {
    const s = suggestions[key];
    return s?.status === "pending" && !String(bd[key] ?? "").trim();
  }

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

  // ── AI Generate Details ────────────────────────────────────────────────────

  async function handleGenerateDetails() {
    if (aiGenerating) return;
    setAiGenerating(true);
    setAiError("");
    setAiGenFields(new Set());
    setAiSuggestions({});
    setWordCountRec(null);
    setChapterCountRec(null);

    const phases = [
      "Reading your research…",
      "Analyzing competitor data…",
      "Reviewing author persona…",
      "Building book strategy…",
      "Generating alternatives…",
      "Finalizing recommendations…"
    ];
    let phaseIdx = 0;
    setAiGenPhase(phases[0]);
    const phaseTimer = setInterval(() => {
      phaseIdx = Math.min(phaseIdx + 1, phases.length - 1);
      setAiGenPhase(phases[phaseIdx]);
    }, 3000);

    try {
      const data = await aiFetch(
        "/api/ai/generate-details",
        { project: fullProject },
        { noCache: true }
      );

      // ── Populate suggestion chip arrays ──────────────────────────────────
      setAiSuggestions({
        genreSuggestions:               data.genreSuggestions               || [],
        structureSuggestions:           data.structureSuggestions           || [],
        structureReasons:               data.structureReasons               || [],
        toneSuggestions:                data.toneSuggestions                || [],
        audienceSuggestions:            data.audienceSuggestions            || [],
        researchIntensitySuggestions:   data.researchIntensitySuggestions   || [],
        positioningStatementSuggestions: data.positioningStatementSuggestions || [],
        corePromiseSuggestions:          data.corePromiseSuggestions         || [],
        coreThesisSuggestions:           data.coreThesisSuggestions          || [],
        uniqueMechanismSuggestions:      data.uniqueMechanismSuggestions     || [],
        beforeStateSuggestions:          data.beforeStateSuggestions         || [],
        afterStateSuggestions:           data.afterStateSuggestions          || [],
        desiredEmotionalOutcomeSuggestions: data.desiredEmotionalOutcomeSuggestions || [],
        uspSuggestions:                  data.uspSuggestions                 || [],
        focusTopicsList:                 data.focusTopicsList                || [],
        readerObjectionsList:            data.readerObjectionsList           || [],
      });

      // ── Auto-fill single values ──────────────────────────────────────────
      const updates = {};
      const filled = new Set();

      // When replaceExisting=false, only fill fields currently empty
      const shouldFill = (key) => replaceExisting || !String(bd[key] ?? "").trim();

      const textFields = {
        genre:                    data.genre,
        tone:                     data.tone,
        audience:                 data.audience,
        researchIntensity:        data.researchIntensity,
        uniqueSellingProposition: data.uniqueSellingProposition,
        readerPainPoints:         data.readerPainPoints,
        focusTopics:              data.focusTopics,
        subtitle:                 data.subtitle,
        corePromise:              data.corePromise,
        coreThesis:               data.coreThesis,
        uniqueMechanism:          data.uniqueMechanism,
        readerTransformationBefore: data.readerTransformationBefore,
        readerTransformationAfter:  data.readerTransformationAfter,
        readerObjections:           data.readerObjections,
        desiredEmotionalOutcome:    data.desiredEmotionalOutcome,
        positioningStatement:       data.positioningStatement,
      };

      for (const [key, val] of Object.entries(textFields)) {
        if (val && String(val).trim() && shouldFill(key)) {
          updates[key] = String(val).trim();
          filled.add(key);
        }
      }

      if (data.chapterCount && Number.isFinite(data.chapterCount) && shouldFill("chapterCount")) {
        updates.chapterCount = data.chapterCount;
        filled.add("chapterCount");
      }
      if (data.wordCountRange && BOOK_WORD_COUNT_RANGES.includes(data.wordCountRange) && shouldFill("wordCountRange")) {
        updates.wordCountRange = data.wordCountRange;
        filled.add("wordCountRange");
      }
      if (data.structure && BOOK_STRUCTURE_OPTIONS.includes(data.structure) && shouldFill("structure")) {
        updates.structure = data.structure;
        filled.add("structure");
      }

      if (data.wordCountRange && data.wordCountReason) {
        setWordCountRec({ range: data.wordCountRange, reason: data.wordCountReason });
      }
      if (data.chapterCount && data.chapterCountReason) {
        setChapterCountRec({ count: data.chapterCount, reason: data.chapterCountReason });
      }

      patch(updates);
      setAiGenFields(filled);

      if (filled.size > 0) {
        setSuggestions((prev) => {
          const next = { ...prev };
          for (const k of filled) {
            if (next[k]) next[k] = { ...next[k], status: "accepted" };
          }
          return next;
        });
      }
    } catch (e) {
      setAiError(e?.message || "Generation failed. Please try again.");
    } finally {
      clearInterval(phaseTimer);
      setAiGenPhase("");
      setAiGenerating(false);
    }
  }

  // ── Export Blueprint ───────────────────────────────────────────────────────

  async function handleExportBlueprint() {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    setExportDone(false);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const resp = await fetch(`${base}/api/export/blueprint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: fullProject })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Export failed (${resp.status})`);
      }

      // Save AI-generated architecture to project state (carried in a base64 header)
      try {
        const archHeader = resp.headers.get("X-Chapter-Architecture");
        if (archHeader) {
          const architecture = JSON.parse(atob(archHeader));
          if (architecture?.chapters?.length) {
            patch({ chapterArchitecture: architecture });
          }
        }
      } catch {}

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project-blueprint.docx";
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 6000);
    } catch (e) {
      setExportError(e?.message || "Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  // ── Dynamic option lists ──────────────────────────────────────────────────

  const suggestedWordCount = suggestions.wordCountRange?.status === "pending" ? suggestions.wordCountRange.value : null;
  const suggestedChapters  = suggestions.chapterCount?.status  === "pending" ? suggestions.chapterCount.value  : null;

  const activePersona = getActivePersona(fullProject);
  const personaNotes = buildPersonaNotes(fullProject?.authorPersona);

  const hasAiSuggestions = aiGenFields.size > 0;

  return (
    <div className="mx-auto max-w-2xl">

      {/* ── Header ── */}
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700/90">Step 7 — Book details</p>
        <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Strategic blueprint</h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Your complete book strategy in one place. Use <strong>✦ Generate Details</strong> below to have AI fill everything with 3 alternatives per field, or accept the suggestions below manually.
        </p>
      </header>

      {/* ── Accept all banner (static suggestions) ── */}
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
          <FieldLabel hint="Estimated manuscript length. AI recommends based on genre, audience, and research intensity.">
            Target word count
            {suggestedWordCount && (
              <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">Niche Recommended</span>
            )}
            {aiGenFields.has("wordCountRange") && <AiGeneratedBadge />}
          </FieldLabel>

          {wordCountRec && (
            <SmartRecommendationCard
              icon="📊"
              label="Recommended Word Count"
              value={`Recommended: ${wordCountRec.range}`}
              reason={wordCountRec.reason}
              onApply={() => {
                patch({ wordCountRange: wordCountRec.range });
                setWordCountRec(null);
              }}
              onDismiss={() => setWordCountRec(null)}
            />
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {BOOK_WORD_COUNT_RANGES.map((range) => {
              const on  = bd.wordCountRange === range;
              const rec = suggestedWordCount === range;
              const aiRec = aiGenFields.has("wordCountRange") && bd.wordCountRange === range;
              return (
                <button
                  key={range}
                  type="button"
                  onClick={() => {
                    patch({ wordCountRange: range });
                    setSuggestions((prev) => ({ ...prev, wordCountRange: { ...prev.wordCountRange, status: "accepted" } }));
                  }}
                  className={`relative rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    on && aiRec ? "border-violet-600 bg-violet-600 text-white"
                    : on ? "border-slate-900 bg-slate-900 text-white"
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
          <FieldLabel hint="Number of planned chapters. AI recommends based on structure and genre.">
            Number of chapters
            {suggestedChapters && (
              <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">Niche Recommended</span>
            )}
            {aiGenFields.has("chapterCount") && <AiGeneratedBadge />}
          </FieldLabel>

          {chapterCountRec && (
            <SmartRecommendationCard
              icon="📚"
              label="Recommended Chapters"
              value={`${chapterCountRec.count} Chapters`}
              reason={chapterCountRec.reason}
              onApply={() => {
                patch({ chapterCount: chapterCountRec.count });
                setChapterCountRec(null);
              }}
              onDismiss={() => setChapterCountRec(null)}
            />
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {BOOK_CHAPTER_OPTIONS.map((n) => {
              const on  = Number(bd.chapterCount) === n;
              const rec = suggestedChapters === n;
              const aiRec = aiGenFields.has("chapterCount") && Number(bd.chapterCount) === n;
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
                    on && aiRec ? "border-violet-600 bg-violet-600 text-white"
                    : on ? "border-slate-900 bg-slate-900 text-white"
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
            {aiGenFields.has("subtitle") && <AiGeneratedBadge />}
          </FieldLabel>
          <input
            className="input-light mt-1.5"
            value={bd.subtitle ?? ""}
            placeholder="e.g. The Entrepreneur's System for Unbreakable Daily Habits"
            onChange={(e) => patch({ subtitle: e.target.value })}
          />
          {isActive("subtitle") && (
            <SuggestionBanner
              suggestion={suggestions.subtitle}
              onAccept={() => accept("subtitle", suggestions.subtitle.value)}
              onDismiss={() => dismiss("subtitle")}
              onRegen={() => regen("subtitle")}
            />
          )}
        </div>

        <SectionTitle>Positioning</SectionTitle>

        {/* ── Genre + Structure ── */}
        <div className="grid gap-6 sm:grid-cols-2">

          {/* Genre */}
          <div>
            <FieldLabel hint="Market category — inherited from your Research niche.">
              Genre
              {aiGenFields.has("genre") && <AiGeneratedBadge />}
            </FieldLabel>
            {aiSuggestions.genreSuggestions?.length > 0 ? (
              <ChipsWithCustom
                suggestions={aiSuggestions.genreSuggestions}
                value={bd.genre ?? ""}
                onChange={(v) => { patch({ genre: v }); setSuggestions((p) => ({ ...p, genre: { ...(p.genre || {}), status: "accepted" } })); }}
                placeholder="Custom genre…"
              />
            ) : (
              <>
                <select className="input-light mt-1.5" value={bd.genre ?? ""} onChange={(e) => patch({ genre: e.target.value })}>
                  <option value="">Select genre</option>
                  {GENRE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                {isActive("genre") && (
                  <div className={`mt-2 rounded-lg border border-sky-200 bg-sky-50 flex items-center gap-2 px-3 py-2 text-xs`}>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-700">AI Suggested</span>
                    <span className="font-medium truncate text-sky-900">{suggestions.genre?.value}</span>
                    <div className="ml-auto flex shrink-0 gap-2">
                      <button type="button" onClick={() => accept("genre", suggestions.genre.value)} className="font-semibold text-emerald-700 hover:underline">Apply</button>
                      <span className="text-slate-300">·</span>
                      <button type="button" onClick={() => dismiss("genre")} className="text-slate-400 hover:text-slate-600">Dismiss</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Structure */}
          <div>
            <FieldLabel hint="Architectural blueprint — AI analyzes your concept to recommend the best fit.">
              Structure
              {aiGenFields.has("structure") && <AiGeneratedBadge />}
            </FieldLabel>
            {aiSuggestions.structureSuggestions?.length > 0 ? (
              <ChipsWithCustom
                suggestions={aiSuggestions.structureSuggestions}
                value={bd.structure ?? ""}
                onChange={(v) => { patch({ structure: v }); setSuggestions((p) => ({ ...p, structure: { ...(p.structure || {}), status: "accepted" } })); }}
                reasons={aiSuggestions.structureReasons}
                placeholder="Custom structure…"
              />
            ) : (
              <>
                <select className="input-light mt-1.5" value={bd.structure ?? ""} onChange={(e) => patch({ structure: e.target.value })}>
                  <option value="">Select structure</option>
                  {BOOK_STRUCTURE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {isActive("structure") && (
                  <div className={`mt-2 rounded-lg border border-sky-200 bg-sky-50 flex items-center gap-2 px-3 py-2 text-xs`}>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-700">Suggested</span>
                    <span className="font-medium truncate text-sky-900">{suggestions.structure?.value}</span>
                    <div className="ml-auto flex shrink-0 gap-2">
                      <button type="button" onClick={() => accept("structure", suggestions.structure.value)} className="font-semibold text-emerald-700 hover:underline">Apply</button>
                      <span className="text-slate-300">·</span>
                      <button type="button" onClick={() => dismiss("structure")} className="text-slate-400 hover:text-slate-600">Dismiss</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Tone */}
          <div>
            <FieldLabel hint="Dominant tonal register — inherited from Author Persona or Research.">
              Tone
              {aiGenFields.has("tone") && <AiGeneratedBadge />}
            </FieldLabel>
            {aiSuggestions.toneSuggestions?.length > 0 ? (
              <ChipsWithCustom
                suggestions={aiSuggestions.toneSuggestions}
                value={bd.tone ?? ""}
                onChange={(v) => { patch({ tone: v }); setSuggestions((p) => ({ ...p, tone: { ...(p.tone || {}), status: "accepted" } })); }}
                placeholder="Custom tone…"
              />
            ) : (
              <>
                <select className="input-light mt-1.5" value={bd.tone ?? ""} onChange={(e) => patch({ tone: e.target.value })}>
                  <option value="">Select tone</option>
                  {AUTHOR_TONE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {isActive("tone") && (
                  <div className={`mt-2 rounded-lg border border-sky-200 bg-sky-50 flex items-center gap-2 px-3 py-2 text-xs`}>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-700">Suggested</span>
                    <span className="font-medium truncate text-sky-900">{suggestions.tone?.value}</span>
                    <div className="ml-auto flex shrink-0 gap-2">
                      <button type="button" onClick={() => accept("tone", suggestions.tone.value)} className="font-semibold text-emerald-700 hover:underline">Apply</button>
                      <span className="text-slate-300">·</span>
                      <button type="button" onClick={() => dismiss("tone")} className="text-slate-400 hover:text-slate-600">Dismiss</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Audience */}
          <div>
            <FieldLabel hint="Primary reader demographic.">
              Audience
              {aiGenFields.has("audience") && <AiGeneratedBadge />}
            </FieldLabel>
            {aiSuggestions.audienceSuggestions?.length > 0 ? (
              <ChipsWithCustom
                suggestions={aiSuggestions.audienceSuggestions}
                value={bd.audience ?? ""}
                onChange={(v) => { patch({ audience: v }); setSuggestions((p) => ({ ...p, audience: { ...(p.audience || {}), status: "accepted" } })); }}
                placeholder="Custom audience…"
              />
            ) : (
              <>
                <select className="input-light mt-1.5" value={bd.audience ?? ""} onChange={(e) => patch({ audience: e.target.value })}>
                  <option value="">Select audience</option>
                  {GENERAL_AUDIENCE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                {isActive("audience") && (
                  <div className={`mt-2 rounded-lg border border-sky-200 bg-sky-50 flex items-center gap-2 px-3 py-2 text-xs`}>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-700">Suggested</span>
                    <span className="font-medium truncate text-sky-900">{suggestions.audience?.value}</span>
                    <div className="ml-auto flex shrink-0 gap-2">
                      <button type="button" onClick={() => accept("audience", suggestions.audience.value)} className="font-semibold text-emerald-700 hover:underline">Apply</button>
                      <span className="text-slate-300">·</span>
                      <button type="button" onClick={() => dismiss("audience")} className="text-slate-400 hover:text-slate-600">Dismiss</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Positioning Statement ── */}
        <div>
          <FieldLabel hint='Complete the template: "This book helps [audience] achieve [outcome] without [obstacle]."'>
            Positioning statement
            {aiGenFields.has("positioningStatement") && <AiGeneratedBadge />}
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[70px] resize-y"
            value={bd.positioningStatement ?? ""}
            placeholder="This book helps adults with ADHD achieve reliable productivity without relying on willpower."
            onChange={(e) => patch({ positioningStatement: e.target.value })}
          />
          <AltSuggestions
            suggestions={aiSuggestions.positioningStatementSuggestions}
            value={bd.positioningStatement}
            onSelect={(v) => patch({ positioningStatement: v })}
          />
        </div>

        <SectionTitle>Strategic Foundation</SectionTitle>

        {/* ── Core Promise ── */}
        <div>
          <FieldLabel hint="The specific, measurable outcome readers can expect after finishing this book.">
            Core promise
            {aiGenFields.has("corePromise") && <AiGeneratedBadge />}
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[80px] resize-y"
            value={bd.corePromise ?? ""}
            placeholder="e.g. Build an ADHD-friendly productivity system that consistently turns intentions into completed work."
            onChange={(e) => patch({ corePromise: e.target.value })}
          />
          <AltSuggestions
            suggestions={aiSuggestions.corePromiseSuggestions}
            value={bd.corePromise}
            onSelect={(v) => patch({ corePromise: v })}
          />
        </div>

        {/* ── Core Thesis ── */}
        <div>
          <FieldLabel hint="The central argument or conviction that anchors the entire book.">
            Core thesis
            {aiGenFields.has("coreThesis") && <AiGeneratedBadge />}
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[80px] resize-y"
            value={bd.coreThesis ?? ""}
            placeholder="e.g. Adults with ADHD become more productive when they rely on systems rather than motivation."
            onChange={(e) => patch({ coreThesis: e.target.value })}
          />
          <AltSuggestions
            suggestions={aiSuggestions.coreThesisSuggestions}
            value={bd.coreThesis}
            onSelect={(v) => patch({ coreThesis: v })}
          />
        </div>

        {/* ── Unique Mechanism ── */}
        <div>
          <FieldLabel hint="The proprietary framework or method used throughout the book — give it a marketable name.">
            Unique mechanism
            {aiGenFields.has("uniqueMechanism") && <AiGeneratedBadge />}
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[90px] resize-y"
            value={bd.uniqueMechanism ?? ""}
            placeholder={"e.g. The Momentum Loop Framework\n\nA three-phase system designed to break task paralysis by building on micro-completions."}
            onChange={(e) => patch({ uniqueMechanism: e.target.value })}
          />
          <MechanismSuggestions
            suggestions={aiSuggestions.uniqueMechanismSuggestions}
            value={bd.uniqueMechanism}
            onSelect={(v) => patch({ uniqueMechanism: v })}
          />
        </div>

        <SectionTitle>Reader Psychology</SectionTitle>

        {/* ── Reader Transformation ── */}
        <div>
          <FieldLabel hint="Concrete states readers experience before and after reading this book.">
            Reader transformation
            {(aiGenFields.has("readerTransformationBefore") || aiGenFields.has("readerTransformationAfter")) && <AiGeneratedBadge />}
          </FieldLabel>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Before reading</p>
              <textarea
                className="input-light min-h-[120px] resize-y text-sm"
                value={bd.readerTransformationBefore ?? ""}
                placeholder={"Overwhelmed\nInconsistent\nMissing deadlines\nDisorganized"}
                onChange={(e) => patch({ readerTransformationBefore: e.target.value })}
              />
              <AltSuggestions
                suggestions={aiSuggestions.beforeStateSuggestions}
                value={bd.readerTransformationBefore}
                onSelect={(v) => patch({ readerTransformationBefore: v })}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-emerald-600 uppercase tracking-wider">After reading</p>
              <textarea
                className="input-light min-h-[120px] resize-y text-sm border-emerald-200 focus:border-emerald-400"
                value={bd.readerTransformationAfter ?? ""}
                placeholder={"Focused\nOrganized\nProductive\nIn control"}
                onChange={(e) => patch({ readerTransformationAfter: e.target.value })}
              />
              <AltSuggestions
                suggestions={aiSuggestions.afterStateSuggestions}
                value={bd.readerTransformationAfter}
                onSelect={(v) => patch({ readerTransformationAfter: v })}
              />
            </div>
          </div>
        </div>

        {/* ── Reader Objections ── */}
        <div>
          <FieldLabel hint="Beliefs or frustrations that may prevent readers from accepting the book's message. One per line.">
            Reader objections
            {aiGenFields.has("readerObjections") && <AiGeneratedBadge />}
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[120px] resize-y"
            value={bd.readerObjections ?? ""}
            placeholder={"Nothing works for my ADHD\nI've already tried productivity systems\nI lack discipline\nI'm too scattered to build habits"}
            onChange={(e) => patch({ readerObjections: e.target.value })}
          />
          {aiSuggestions.readerObjectionsList?.length > 0 && !bd.readerObjections?.trim() && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => patch({ readerObjections: aiSuggestions.readerObjectionsList.join("\n") })}
                className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 underline"
              >
                ✦ Use {aiSuggestions.readerObjectionsList.length} AI-generated objections
              </button>
            </div>
          )}
        </div>

        {/* ── Desired Emotional Outcome ── */}
        <div>
          <FieldLabel hint="How should readers feel after finishing this book?">
            Desired emotional outcome
            {aiGenFields.has("desiredEmotionalOutcome") && <AiGeneratedBadge />}
          </FieldLabel>
          <input
            className="input-light mt-1.5"
            value={bd.desiredEmotionalOutcome ?? ""}
            placeholder="e.g. Empowered, Hopeful, Confident, In control"
            onChange={(e) => patch({ desiredEmotionalOutcome: e.target.value })}
          />
          <AltSuggestions
            suggestions={aiSuggestions.desiredEmotionalOutcomeSuggestions}
            value={bd.desiredEmotionalOutcome}
            onSelect={(v) => patch({ desiredEmotionalOutcome: v })}
          />
        </div>

        <SectionTitle>Content Strategy</SectionTitle>

        {/* ── USP ── */}
        <div>
          <FieldLabel hint="The commercial hook — why this book is the best choice in its niche.">
            Unique selling proposition
            {aiGenFields.has("uniqueSellingProposition") && <AiGeneratedBadge />}
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[100px] resize-y"
            value={bd.uniqueSellingProposition ?? ""}
            placeholder="What makes this book uniquely valuable to the reader — the commercial hook that wins the sale."
            onChange={(e) => patch({ uniqueSellingProposition: e.target.value })}
          />
          {!hasAiSuggestions && isActive("uniqueSellingProposition") && (
            <SuggestionBanner
              suggestion={suggestions.uniqueSellingProposition}
              onAccept={() => accept("uniqueSellingProposition", suggestions.uniqueSellingProposition.value)}
              onDismiss={() => dismiss("uniqueSellingProposition")}
              onRegen={() => regen("uniqueSellingProposition")}
            />
          )}
          <AltSuggestions
            suggestions={aiSuggestions.uspSuggestions}
            value={bd.uniqueSellingProposition}
            onSelect={(v) => patch({ uniqueSellingProposition: v })}
          />
        </div>

        {/* ── Reader Pain Points ── */}
        <div>
          <FieldLabel hint="The core frustrations your reader has before picking up this book.">
            Reader pain points
            {aiGenFields.has("readerPainPoints") && <AiGeneratedBadge />}
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[100px] resize-y"
            value={bd.readerPainPoints ?? ""}
            placeholder="The real-world failures and frustrations that drive your reader to seek this book."
            onChange={(e) => patch({ readerPainPoints: e.target.value })}
          />
          {!hasAiSuggestions && isActive("readerPainPoints") && (
            <SuggestionBanner
              suggestion={suggestions.readerPainPoints}
              onAccept={() => accept("readerPainPoints", suggestions.readerPainPoints.value)}
              onDismiss={() => dismiss("readerPainPoints")}
              onRegen={() => regen("readerPainPoints")}
            />
          )}
        </div>

        {/* ── Focus Topics ── */}
        <div>
          <FieldLabel hint="Key topic areas that will guide outline and chapter generation. Comma-separated or one per line.">
            Focus topics
            {aiGenFields.has("focusTopics") && <AiGeneratedBadge />}
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[100px] resize-y"
            value={bd.focusTopics ?? ""}
            placeholder={"Executive Function Systems, Time Blindness Solutions, Task Initiation Methods, Dopamine Motivation, Focus Recovery Protocols"}
            onChange={(e) => patch({ focusTopics: e.target.value })}
          />
          {aiSuggestions.focusTopicsList?.length > 0 && !bd.focusTopics?.trim() && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => patch({ focusTopics: aiSuggestions.focusTopicsList.join(", ") })}
                className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 underline"
              >
                ✦ Use {aiSuggestions.focusTopicsList.length} AI-suggested focus topics
              </button>
            </div>
          )}
          {!hasAiSuggestions && isActive("focusTopics") && (
            <SuggestionBanner
              suggestion={suggestions.focusTopics}
              onAccept={() => accept("focusTopics", suggestions.focusTopics.value)}
              onDismiss={() => dismiss("focusTopics")}
              onRegen={() => regen("focusTopics")}
            />
          )}
        </div>

        {/* ── Research Intensity ── */}
        <div>
          <FieldLabel hint="Determines citation density and evidence requirements during chapter generation.">
            Research intensity
            {aiGenFields.has("researchIntensity") && <AiGeneratedBadge />}
          </FieldLabel>

          {aiSuggestions.researchIntensitySuggestions?.length > 0 ? (
            <div className="mt-2 space-y-2">
              {aiSuggestions.researchIntensitySuggestions.map((opt) => {
                const on = bd.researchIntensity === opt;
                const desc = { Light: "Minimal citations, anecdote-driven", Moderate: "Mix of evidence and narrative", Heavy: "Data-heavy, academic rigor" }[opt] || "";
                const aiFirst = aiSuggestions.researchIntensitySuggestions[0] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => patch({ researchIntensity: opt })}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      on
                        ? "border-violet-400 bg-violet-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      on ? "border-violet-500 bg-violet-500" : "border-slate-300 bg-white"
                    }`}>
                      {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <span className="flex-1">
                      <span className={`text-sm font-semibold ${on ? "text-violet-900" : "text-slate-700"}`}>{opt}</span>
                      {aiFirst && <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">✦ Recommended</span>}
                      <span className={`ml-2 text-xs ${on ? "text-violet-600" : "text-slate-400"}`}>{desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 flex gap-3">
              {RESEARCH_INTENSITY_OPTIONS.map((opt) => {
                const on = bd.researchIntensity === opt;
                const desc = { Light: "Minimal citations, anecdote-driven", Moderate: "Mix of evidence and narrative", Heavy: "Data-heavy, academic rigor" }[opt];
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => patch({ researchIntensity: opt })}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-center transition ${
                      on
                        ? "border-violet-500 bg-violet-50 text-violet-800 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-sm font-semibold">{opt}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500 leading-tight">{desc}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <SectionTitle>Author Voice</SectionTitle>

        {/* ── Author persona (read-only display) ── */}
        <div>
          <FieldLabel>Author persona</FieldLabel>
          {activePersona ? (
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              {activePersona.authorName && (
                <p className="text-sm font-semibold text-slate-800">{activePersona.authorName}</p>
              )}
              {personaNotes ? (
                <p className="mt-1 text-xs leading-relaxed text-slate-600 whitespace-pre-wrap line-clamp-5">{personaNotes}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400 italic">No generated persona content yet.</p>
              )}
            </div>
          ) : (
            <div className="mt-2 rounded-xl border border-dashed border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-400 italic">No author persona selected. Set one in the Author Persona step.</p>
            </div>
          )}
        </div>

      </div>

      {/* ── AI Generation success banner ── */}
      {!aiGenerating && aiGenFields.size > 0 && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="text-emerald-500 text-lg">✦</span>
            <div>
              <p className="text-sm font-bold text-emerald-800">Strategic Details Generated Successfully</p>
              <p className="mt-0.5 text-xs text-emerald-700">
                {aiGenFields.size} field{aiGenFields.size !== 1 ? "s" : ""} filled with AI recommendations. Each field with 3 alternatives was populated with the best-fit suggestion — click any chip above to switch.
              </p>
              <p className="mt-1 text-[11px] text-emerald-600">
                {[...aiGenFields].map((k) => FIELD_LABELS[k] || k).filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {aiError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {aiError}
        </div>
      )}

      {/* ── Bottom action buttons ── */}
      <div className="mt-5 space-y-3">

        {/* Generate Details */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleGenerateDetails}
            disabled={aiGenerating}
            className={`w-full flex items-center justify-center gap-2.5 rounded-xl border px-5 py-3.5 text-sm font-semibold shadow-sm transition ${
              aiGenerating
                ? "border-violet-200 bg-violet-50 text-violet-400 cursor-not-allowed"
                : "border-violet-300 bg-white text-violet-700 hover:bg-violet-50 hover:border-violet-400"
            }`}
          >
            {aiGenerating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
                <span>{aiGenPhase || "Generating…"}</span>
              </>
            ) : (
              <>
                <span>✦</span>
                <span>{hasAiSuggestions ? "Regenerate Details" : "Generate Details"}</span>
                <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">3 alternatives per field</span>
              </>
            )}
          </button>

          {hasAiSuggestions && !aiGenerating && (
            <label className="flex cursor-pointer items-center gap-2 justify-center">
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                replaceExisting ? "border-amber-400 bg-amber-400" : "border-slate-300 bg-white"
              }`}>
                {replaceExisting && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
              />
              <span className={`text-xs font-medium ${replaceExisting ? "text-amber-700" : "text-slate-500"}`}>
                Replace existing content
                {!replaceExisting && <span className="ml-1 text-slate-400">(unchecked = only fill empty fields)</span>}
              </span>
            </label>
          )}
        </div>

        {/* Export Blueprint */}
        <button
          type="button"
          onClick={handleExportBlueprint}
          disabled={exporting}
          className={`w-full flex items-center justify-center gap-2.5 rounded-xl border px-5 py-3.5 text-sm font-semibold shadow-sm transition ${
            exporting
              ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400"
          }`}
        >
          {exporting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              <span>Generating chapter architecture…</span>
            </>
          ) : exportDone ? (
            <>
              <span>✓</span>
              <span>Blueprint downloaded!</span>
            </>
          ) : (
            <>
              <span>📄</span>
              <span>Export Chapter Architecture</span>
              <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">DOCX</span>
            </>
          )}
        </button>

        {exportError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {exportError}
          </div>
        )}

        {exportDone && (
          <p className="text-center text-xs text-slate-500">
            Your project blueprint has been downloaded as a Word document.
          </p>
        )}
      </div>

    </div>
  );
}
