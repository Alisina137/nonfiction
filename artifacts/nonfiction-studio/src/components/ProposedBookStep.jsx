import { useId, useState } from "react";
import { buildSyntheticProposedBookContent } from "@/lib/proposedBook";
import { aiFetch } from "@/lib/ai/aiFetch";

// ─── Constants ────────────────────────────────────────────────────────────────

const CHAPTER_COMPONENTS_ALL = [
  "Key Takeaways", "Action Plan", "Checklist", "Exercises",
  "Reflection Questions", "Templates", "Case Studies", "Examples",
  "Research Highlights", "Resources", "Summary"
];

const LEGACY_SECTIONS = [
  { key: "title",                  label: "Title",                  multiline: false },
  { key: "uniqueSellingProposition", label: "Unique Selling Proposition", multiline: true },
  { key: "differentiation",        label: "Differentiation",        multiline: true },
  { key: "keySellingPoints",       label: "Key Selling Points",     multiline: true },
  { key: "proposedAudience",       label: "Proposed Audience",      multiline: true },
  { key: "proposedTone",           label: "Proposed Tone",          multiline: true },
  { key: "proposedAuthorPersona",  label: "Proposed Author Persona", multiline: true }
];

const AI_PHASES = [
  "Analyzing book data…",
  "Evaluating market gaps…",
  "Building strategic framework…",
  "Scoring book concept…"
];

const REGEN_LABELS = {
  recommendedStructure:    "Recommended Structure",
  structureExplanation:    "Structure Explanation",
  signatureFramework:      "Signature Framework",
  chapterComponents:       "Chapter Components",
  bookFlowPreview:         "Book Flow Preview",
  competitiveDifferentiation: "Competitive Differentiation",
  bookPitch:               "Book Pitch",
  bookConceptScore:        "Book Concept Score"
};

function normalizeTag(t) {
  return String(t || "").trim().replace(/\s+/g, " ");
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function SectionHeader({ icon, title, children }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
      <div className="flex items-center gap-2">
        <span className="text-slate-400" aria-hidden>{icon}</span>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function RegenButton({ section, loading, onRegen }) {
  return (
    <button
      type="button"
      onClick={() => onRegen(section)}
      disabled={loading}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
    >
      {loading ? (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
      ) : (
        <span aria-hidden>↺</span>
      )}
      Regenerate
    </button>
  );
}

function EditableBlock({ label, value, multiline, onChange }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-900">{label}</h3>
        <button type="button" aria-label={`Edit ${label}`} onClick={() => setEditing(v => !v)}
          className="shrink-0 rounded-lg border border-transparent p-2 text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800">
          <span aria-hidden className="text-base">✎</span>
        </button>
      </div>
      <div className="mt-4">
        {editing && multiline
          ? <textarea className="input-light min-h-[140px] w-full resize-y" value={value} onChange={e => onChange(e.target.value)} />
          : editing
          ? <input className="input-light w-full" value={value} onChange={e => onChange(e.target.value)} />
          : <p className={`whitespace-pre-wrap text-sm leading-relaxed text-slate-700 ${!value.trim() ? "italic text-slate-400" : ""}`}>
              {value.trim() ? value : `No ${label.toLowerCase()} yet.`}
            </p>}
      </div>
    </div>
  );
}

function ScoreBadge({ score, max = 100, color }) {
  const pct = Math.round((score / max) * 100);
  const c = color || (pct >= 80 ? "emerald" : pct >= 60 ? "amber" : "rose");
  return (
    <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-2 border-${c}-300 bg-${c}-50`}>
      <span className={`text-lg font-black text-${c}-700`}>{score}</span>
      <span className="text-[9px] font-medium text-slate-500">/ {max}</span>
    </div>
  );
}

// ─── Section Cards ────────────────────────────────────────────────────────────

function ConceptScoreCard({ score, onRegen, loading }) {
  if (!score?.overall) return null;
  const overall = score.overall;
  const pct = overall;
  const c = pct >= 80 ? "emerald" : pct >= 60 ? "amber" : "rose";
  const bar = `h-1.5 rounded-full bg-${c}-400`;

  const labels = {
    marketDemand: "Market Demand", differentiation: "Differentiation",
    transformationStrength: "Transformation", readerClarity: "Reader Clarity",
    commercialPotential: "Commercial Potential", outlineReadiness: "Outline Readiness"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <SectionHeader icon="◈" title="Book Concept Score">
        <RegenButton section="bookConceptScore" loading={loading} onRegen={onRegen} />
      </SectionHeader>
      <div className="mt-4 flex items-center gap-4">
        <div className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-2 border-${c}-300 bg-${c}-50`}>
          <span className={`text-xl font-black text-${c}-700`}>{overall}</span>
          <span className="text-[10px] font-medium text-slate-500">/ 100</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">Overall Concept Strength</p>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full transition-all bg-${c}-500`} style={{ width: `${overall}%` }} />
          </div>
        </div>
      </div>

      {score.breakdown && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {Object.entries(score.breakdown).map(([k, v]) => (
            <div key={k}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-slate-600">{labels[k] || k}</span>
                <span className="text-xs font-semibold text-slate-900">{v} / 10</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sky-400" style={{ width: `${(v / 10) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {(score.strengths?.length > 0 || score.suggestions?.length > 0) && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {score.strengths?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Strengths</p>
              <ul className="mt-2 space-y-1">
                {score.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                    <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {score.suggestions?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Suggestions</p>
              <ul className="mt-2 space-y-1">
                {score.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                    <span className="mt-0.5 shrink-0 text-amber-500">→</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecommendedStructureCard({ rs, onRegen, loading, onEdit }) {
  const [editing, setEditing] = useState(false);
  if (!rs?.structureName && !rs?.reasoning) return null;
  const conf = rs.confidenceScore ?? 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <SectionHeader icon="◉" title="Recommended Book Structure">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setEditing(e => !e)}
            className="rounded-lg border border-transparent p-1.5 text-slate-500 hover:border-slate-200 hover:bg-slate-50">
            <span aria-hidden>✎</span>
          </button>
          <RegenButton section="recommendedStructure" loading={loading} onRegen={onRegen} />
        </div>
      </SectionHeader>

      <div className="mt-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-sky-50 border border-sky-200">
            <span className="text-lg font-black text-sky-700">{conf}</span>
            <span className="text-[9px] font-medium text-slate-500">/ 10</span>
          </div>
          <div className="min-w-0 flex-1">
            {editing ? (
              <input className="input-light w-full text-base font-bold" value={rs.structureName || ""}
                onChange={e => onEdit("recommendedStructure", { ...rs, structureName: e.target.value })} />
            ) : (
              <p className="text-base font-bold text-slate-900">{rs.structureName}</p>
            )}
            {editing ? (
              <input className="input-light mt-1 w-full text-sm" value={rs.structureType || ""}
                onChange={e => onEdit("recommendedStructure", { ...rs, structureType: e.target.value })} />
            ) : rs.structureType ? (
              <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{rs.structureType}</span>
            ) : null}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reasoning</p>
          {editing ? (
            <textarea className="input-light mt-1 min-h-[80px] w-full resize-y text-sm"
              value={rs.reasoning || ""}
              onChange={e => onEdit("recommendedStructure", { ...rs, reasoning: e.target.value })} />
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{rs.reasoning}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StructureExplanationCard({ text, onRegen, loading, onEdit }) {
  const [editing, setEditing] = useState(false);
  if (!text) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <SectionHeader icon="◎" title="Why This Structure Works">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setEditing(e => !e)}
            className="rounded-lg border border-transparent p-1.5 text-slate-500 hover:border-slate-200 hover:bg-slate-50">
            <span aria-hidden>✎</span>
          </button>
          <RegenButton section="structureExplanation" loading={loading} onRegen={onRegen} />
        </div>
      </SectionHeader>
      <div className="mt-4">
        {editing
          ? <textarea className="input-light min-h-[120px] w-full resize-y text-sm" value={text}
              onChange={e => onEdit("structureExplanation", e.target.value)} />
          : <p className="text-sm leading-relaxed text-slate-700">{text}</p>}
      </div>
    </div>
  );
}

function SignatureFrameworkCard({ sf, onRegen, loading, onEdit }) {
  const [editingName, setEditingName] = useState(false);
  if (!sf?.name && (!sf?.stages || sf.stages.length === 0)) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <SectionHeader icon="▣" title="Signature Framework">
        <RegenButton section="signatureFramework" loading={loading} onRegen={onRegen} />
      </SectionHeader>
      <div className="mt-4 space-y-4">
        <div className="flex items-center gap-3">
          {editingName
            ? <input className="input-light flex-1 text-lg font-black"
                value={sf.name || ""}
                onChange={e => onEdit("signatureFramework", { ...sf, name: e.target.value })}
                onBlur={() => setEditingName(false)} autoFocus />
            : <button type="button" onClick={() => setEditingName(true)}
                className="group flex items-center gap-2">
                <span className="text-xl font-black text-slate-900">{sf.name || "Framework Name"}</span>
                <span className="text-slate-300 group-hover:text-slate-500" aria-hidden>✎</span>
              </button>}
        </div>

        {sf.stages?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sf.stages.map((s, i) => (
              <div key={i} className="flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5">
                <span className="text-xs font-semibold text-sky-500">{s.stage}</span>
                <span className="text-xs text-slate-500">·</span>
                <input
                  className="min-w-0 bg-transparent text-xs font-medium text-slate-800 outline-none"
                  value={s.label}
                  onChange={e => {
                    const next = sf.stages.map((st, si) => si === i ? { ...st, label: e.target.value } : st);
                    onEdit("signatureFramework", { ...sf, stages: next });
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChapterComponentsCard({ cc, onRegen, loading, onEdit }) {
  if (!cc?.recommended?.length && !cc?.selected?.length) return null;
  const selected = Array.isArray(cc.selected) ? cc.selected : (cc.recommended || []);

  function toggle(opt) {
    const next = selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt];
    onEdit("chapterComponents", { ...cc, selected: next });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <SectionHeader icon="☰" title="Chapter Blueprint Components">
        <RegenButton section="chapterComponents" loading={loading} onRegen={onRegen} />
      </SectionHeader>
      {cc.recommended?.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          AI recommended: {cc.recommended.join(", ")}. Check or uncheck to customize.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {CHAPTER_COMPONENTS_ALL.map(opt => {
          const isSelected = selected.includes(opt);
          const isRec = (cc.recommended || []).includes(opt);
          return (
            <button key={opt} type="button" onClick={() => toggle(opt)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isSelected
                  ? "border-sky-400 bg-sky-100 text-sky-800"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}>
              <span>{isSelected ? "✓" : "○"}</span>
              {opt}
              {isRec && !isSelected && <span className="text-[10px] text-amber-500">★</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BookFlowCard({ bfp, onRegen, loading }) {
  if (!bfp?.parts?.length) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <SectionHeader icon="◇" title="Book Flow Preview">
        <RegenButton section="bookFlowPreview" loading={loading} onRegen={onRegen} />
      </SectionHeader>
      <div className="mt-5 flex flex-col items-center gap-0">
        {bfp.parts.map((p, i) => (
          <div key={i} className="flex w-full flex-col items-center">
            <div className="flex w-full max-w-xs items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
              <span className="text-xs font-semibold text-sky-600">{p.title}</span>
              <span className="text-sm font-bold text-slate-900">{p.subtitle}</span>
            </div>
            {i < bfp.parts.length - 1 && (
              <div className="flex flex-col items-center py-1">
                <div className="h-3 w-px bg-slate-200" />
                <span className="text-sm text-slate-400">↓</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitiveDiffCard({ cd, onRegen, loading, onEdit }) {
  const [editing, setEditing] = useState(false);
  if (!cd?.points?.length) return null;
  const score = cd.score ?? 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <SectionHeader icon="◆" title="Competitive Differentiation">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setEditing(e => !e)}
            className="rounded-lg border border-transparent p-1.5 text-slate-500 hover:border-slate-200 hover:bg-slate-50">
            <span aria-hidden>✎</span>
          </button>
          <RegenButton section="competitiveDifferentiation" loading={loading} onRegen={onRegen} />
        </div>
      </SectionHeader>
      <div className="mt-4 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50">
          <span className="text-lg font-black text-emerald-700">{score}</span>
          <span className="text-[9px] font-medium text-slate-500">/ 10</span>
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <textarea
              className="input-light min-h-[120px] w-full resize-y text-sm"
              value={cd.points.map(p => `• ${p}`).join("\n")}
              onChange={e => {
                const lines = e.target.value.split("\n").map(l => l.replace(/^[•\-\*]\s*/, "").trim()).filter(Boolean);
                onEdit("competitiveDifferentiation", { ...cd, points: lines });
              }}
            />
          ) : (
            <ul className="space-y-1.5">
              {cd.points.map((pt, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 shrink-0 text-emerald-500 text-xs">✓</span>{pt}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function BookPitchCard({ pitch, onRegen, loading, onEdit }) {
  const [editing, setEditing] = useState(false);
  if (!pitch) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <SectionHeader icon="◐" title="One-Sentence Book Pitch">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setEditing(e => !e)}
            className="rounded-lg border border-transparent p-1.5 text-slate-500 hover:border-slate-200 hover:bg-slate-50">
            <span aria-hidden>✎</span>
          </button>
          <RegenButton section="bookPitch" loading={loading} onRegen={onRegen} />
        </div>
      </SectionHeader>
      <div className="mt-4">
        {editing
          ? <textarea className="input-light min-h-[80px] w-full resize-y"
              value={pitch} onChange={e => onEdit("bookPitch", e.target.value)} />
          : <p className="text-base font-medium italic leading-relaxed text-slate-800">"{pitch}"</p>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProposedBookStep({ proposedBook, setProposedBook, fullProject }) {
  const uid = useId();
  const [customInput, setCustomInput] = useState("");

  const [aiGenerating,  setAiGenerating]  = useState(false);
  const [aiPhase,       setAiPhase]       = useState("");
  const [aiError,       setAiError]       = useState("");
  const [regenLoading,  setRegenLoading]  = useState({});
  const [sectionErrors, setSectionErrors] = useState({});

  const [suggestLoading,   setSuggestLoading]   = useState(false);
  const [suggestError,     setSuggestError]     = useState("");
  const [aiSuggestions,    setAiSuggestions]    = useState([]);

  const pb        = proposedBook || {};
  const focusTags = Array.isArray(pb.focusTags) ? pb.focusTags.map(normalizeTag).filter(Boolean) : [];
  const content   = pb.content && typeof pb.content === "object" ? pb.content : {};

  const hasStrategicPlan = !!(
    content.recommendedStructure?.structureName ||
    content.signatureFramework?.name ||
    content.bookPitch
  );

  // ── Helpers ────────────────────────────────────────────────────────────────

  function merge(patch) {
    setProposedBook(prev => {
      const base = prev || {};
      const resolved = typeof patch === "function" ? patch(base) : patch;
      return { ...base, ...resolved };
    });
  }

  function mergeContent(contentPatch) {
    setProposedBook(prev => {
      const base = prev || {};
      const prevContent = base.content && typeof base.content === "object" ? base.content : {};
      const resolved = typeof contentPatch === "function" ? contentPatch(prevContent) : contentPatch;
      return { ...base, content: { ...prevContent, ...resolved } };
    });
  }

  function commitTags(tags) {
    const seen = new Set();
    const unique = [];
    tags.forEach(t => {
      const n = normalizeTag(t);
      if (!n) return;
      const low = n.toLowerCase();
      if (seen.has(low)) return;
      seen.add(low);
      unique.push(n);
    });
    merge({ focusTags: unique });
  }

  function addTag(one) {
    const n = normalizeTag(one);
    if (!n) return;
    if (focusTags.some(t => t.toLowerCase() === n.toLowerCase())) return;
    commitTags([...focusTags, n]);
  }

  function removeTag(remove) {
    commitTags(focusTags.filter(t => t.toLowerCase() !== remove.toLowerCase()));
  }

  // ── AI Generate — focus area suggestions ──────────────────────────────────

  async function handleGenerateFocusAreas() {
    if (suggestLoading) return;
    setSuggestLoading(true);
    setSuggestError("");
    setAiSuggestions([]);
    try {
      const data = await aiFetch(
        "/api/ai/generate-focus-areas",
        { project: fullProject },
        { noCache: true }
      );
      const suggestions = Array.isArray(data.focusAreas) ? data.focusAreas : [];
      setAiSuggestions(suggestions);
    } catch (e) {
      setSuggestError(e.message || "Failed to generate suggestions. Try again.");
    } finally {
      setSuggestLoading(false);
    }
  }

  function addSuggestion(tag) {
    addTag(tag);
    setAiSuggestions(prev => prev.filter(t => t.toLowerCase() !== tag.toLowerCase()));
  }

  // ── AI Generate — full plan ────────────────────────────────────────────────

  async function handleGenerateFullPlan() {
    if (aiGenerating) return;
    setAiGenerating(true);
    setAiError("");

    const phaseTimers = AI_PHASES.map((phase, i) =>
      setTimeout(() => setAiPhase(phase), i * 1600)
    );

    try {
      // Synthetic fill (old fields, local — always works)
      const synth = buildSyntheticProposedBookContent(fullProject || {}, focusTags);

      // AI call — new strategic fields
      const plan = await aiFetch(
        "/api/ai/generate-strategic-book-plan",
        { project: fullProject },
        { noCache: true }
      );

      merge({
        focusTags,
        content: {
          ...content,
          ...synth,
          recommendedStructure:      plan.recommendedStructure,
          structureExplanation:      plan.structureExplanation,
          signatureFramework:        plan.signatureFramework,
          chapterComponents:         plan.chapterComponents,
          bookFlowPreview:           plan.bookFlowPreview,
          competitiveDifferentiation: plan.competitiveDifferentiation,
          bookPitch:                 plan.bookPitch,
          bookConceptScore:          plan.bookConceptScore
        },
        generatedAt: new Date().toISOString()
      });
    } catch (e) {
      setAiError(e.message || "Generation failed. Please try again.");
    } finally {
      phaseTimers.forEach(clearTimeout);
      setAiGenerating(false);
      setAiPhase("");
    }
  }

  // ── AI — synthetic fallback (no AI needed) ─────────────────────────────────

  function handleGenerateSynthetic() {
    const synth = buildSyntheticProposedBookContent(fullProject || {}, focusTags);
    merge({
      focusTags,
      content: synth,
      generatedAt: new Date().toISOString()
    });
  }

  // ── AI Regenerate — single section ────────────────────────────────────────

  async function handleRegen(section) {
    if (regenLoading[section]) return;
    setRegenLoading(prev => ({ ...prev, [section]: true }));
    setSectionErrors(prev => ({ ...prev, [section]: "" }));

    try {
      const result = await aiFetch(
        "/api/ai/regenerate-book-section",
        { project: fullProject, section },
        { noCache: true }
      );
      mergeContent({ [result.section]: result.data });
    } catch (e) {
      setSectionErrors(prev => ({ ...prev, [section]: e.message || "Regeneration failed." }));
    } finally {
      setRegenLoading(prev => ({ ...prev, [section]: false }));
    }
  }

  // ── Content field helpers ──────────────────────────────────────────────────

  function editContentField(key, value) {
    mergeContent({ [key]: value });
  }

  const MIN_FOCUS = 5;
  const meetsSoftMin = focusTags.length >= MIN_FOCUS;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-6">

      {/* ── Book Focus Selector ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Book Focus</h2>
            <p className="mt-1 text-sm text-slate-600">
              Select the main focus areas to guide strategy and drafts.{" "}
              <span className="font-medium text-slate-800">Aim for at least {MIN_FOCUS}.</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateFocusAreas}
            disabled={suggestLoading}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-violet-100 disabled:opacity-60"
          >
            {suggestLoading ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                Generating…
              </>
            ) : (
              <>✨ Suggest Focus Areas</>
            )}
          </button>
        </div>

        {!meetsSoftMin && focusTags.length > 0 && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950">
            {focusTags.length} selected — aim for at least {MIN_FOCUS} pillars.
          </p>
        )}

        {/* Selected tags */}
        <div className="mt-5">
          <div role="group" aria-label="Selected focus tags"
            className="flex min-h-[56px] flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            {focusTags.length === 0 && (
              <span className="flex items-center text-sm text-slate-400">
                Click "Suggest Focus Areas" or add custom tags below…
              </span>
            )}
            {focusTags.map(tag => (
              <button key={tag.toLowerCase()} type="button" title="Remove"
                onClick={() => removeTag(tag)}
                className="group inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition-colors">
                <span className="truncate">{tag}</span>
                <span aria-hidden className="shrink-0 text-[10px] text-slate-400 group-hover:text-rose-500">×</span>
              </button>
            ))}
          </div>
          {focusTags.length > 0 && (
            <button type="button" onClick={() => commitTags([])}
              className="mt-1.5 text-xs text-slate-400 hover:text-rose-500 transition-colors">
              Clear all
            </button>
          )}
        </div>

        {/* AI suggestions panel */}
        {suggestError && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {suggestError}
          </p>
        )}

        {aiSuggestions.length > 0 && (
          <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-600">
              ✨ AI Suggestions — click to add
            </p>
            <div className="flex flex-wrap gap-2">
              {aiSuggestions.map(tag => {
                const alreadyAdded = focusTags.some(t => t.toLowerCase() === tag.toLowerCase());
                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => addSuggestion(tag)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      alreadyAdded
                        ? "border-slate-200 bg-white text-slate-400 cursor-default"
                        : "border-violet-200 bg-white text-violet-800 shadow-sm hover:border-violet-400 hover:bg-violet-100"
                    }`}
                  >
                    {alreadyAdded ? <span className="text-emerald-500">✓</span> : <span>+</span>}
                    {tag}
                  </button>
                );
              })}
            </div>
            <button type="button"
              onClick={() => {
                aiSuggestions
                  .filter(t => !focusTags.some(f => f.toLowerCase() === t.toLowerCase()))
                  .forEach(t => addTag(t));
                setAiSuggestions([]);
              }}
              className="mt-3 text-xs font-medium text-violet-600 hover:text-violet-800 underline-offset-2 hover:underline transition-colors">
              Add all suggestions
            </button>
          </div>
        )}

        {/* Custom tag input */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input id={`${uid}-custom-tag`} className="input-light min-w-[min(260px,calc(100%-6rem))] flex-1"
            placeholder="Add custom focus area (press Enter)" value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(customInput); setCustomInput(""); } }} />
          <button type="button" onClick={() => { addTag(customInput); setCustomInput(""); }}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Add
          </button>
        </div>
      </section>

      {/* ── Generate Strategic Book Plan (primary) ── */}
      <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900">✨ Generate Strategic Book Plan</p>
            <p className="mt-0.5 text-xs text-slate-500">
              AI analyzes all project data — research, competitors, market gaps, persona, focus topics — and builds
              structure, framework, flow, differentiation, pitch, and concept score.
            </p>
          </div>
          <button type="button" onClick={handleGenerateFullPlan} disabled={aiGenerating}
            className="shrink-0 rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60 transition-colors">
            {aiGenerating ? "Generating…" : "Generate"}
          </button>
        </div>

        {aiGenerating && aiPhase && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            <span className="text-xs font-medium text-sky-700">{aiPhase}</span>
          </div>
        )}
        {!aiGenerating && aiError && (
          <p className="mt-3 text-xs text-rose-600">{aiError}</p>
        )}

        <div className="mt-4 border-t border-sky-100 pt-3">
          <button type="button" onClick={handleGenerateSynthetic}
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline">
            Generate without AI (instant, uses your project data)
          </button>
        </div>
      </div>

      {/* ── Strategic Sections (shown after plan is generated) ── */}
      {hasStrategicPlan && (
        <>
          <ConceptScoreCard score={content.bookConceptScore} onRegen={handleRegen}
            loading={regenLoading.bookConceptScore} />

          <BookPitchCard pitch={content.bookPitch} onRegen={handleRegen}
            loading={regenLoading.bookPitch} onEdit={editContentField} />

          <RecommendedStructureCard rs={content.recommendedStructure} onRegen={handleRegen}
            loading={regenLoading.recommendedStructure} onEdit={editContentField} />

          <StructureExplanationCard text={content.structureExplanation} onRegen={handleRegen}
            loading={regenLoading.structureExplanation} onEdit={editContentField} />

          <SignatureFrameworkCard sf={content.signatureFramework} onRegen={handleRegen}
            loading={regenLoading.signatureFramework} onEdit={editContentField} />

          <ChapterComponentsCard cc={content.chapterComponents} onRegen={handleRegen}
            loading={regenLoading.chapterComponents} onEdit={editContentField} />

          <BookFlowCard bfp={content.bookFlowPreview} onRegen={handleRegen}
            loading={regenLoading.bookFlowPreview} />

          <CompetitiveDiffCard cd={content.competitiveDifferentiation} onRegen={handleRegen}
            loading={regenLoading.competitiveDifferentiation} onEdit={editContentField} />

          {/* Section-level errors */}
          {Object.entries(sectionErrors).some(([, v]) => v) && (
            <div className="space-y-1">
              {Object.entries(sectionErrors).map(([section, err]) =>
                err ? (
                  <p key={section} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {REGEN_LABELS[section]}: {err}
                  </p>
                ) : null
              )}
            </div>
          )}
        </>
      )}

      {/* ── Legacy Proposed Book Sections ── */}
      {pb.generatedAt && (
        <section className="space-y-4 pb-16">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proposed Book</h2>
          {LEGACY_SECTIONS.map(({ key, label, multiline }) => (
            <EditableBlock key={key} label={label}
              value={content[key] != null ? String(content[key]) : ""}
              multiline={multiline}
              onChange={v => mergeContent({ [key]: v })} />
          ))}
        </section>
      )}
    </div>
  );
}
