import { useEffect, useId, useRef, useState } from "react";
import {
  ALLOWED_RESOURCE_EXTENSIONS,
  parseResourceUploadFile,
  RESOURCE_FILE_MAX_BYTES
} from "@/lib/resources/fileUpload";
import { aiFetch } from "@/lib/ai/aiFetch";

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTHOR_ARCHETYPES = [
  "Trusted Expert",
  "Friendly Mentor",
  "Inspirational Motivator",
  "Academic Researcher",
  "Investigative Journalist",
  "Business Strategist",
  "Transformation Coach",
  "Storytelling Teacher",
  "Practical Practitioner",
  "Thought Leader"
];

const READER_RELATIONSHIPS = [
  "Mentor", "Coach", "Teacher", "Guide", "Friend", "Consultant", "Professor"
];

const TEACHING_STYLE_OPTIONS = [
  "Framework-Based", "Step-by-Step", "Checklist Driven", "Case Study Driven",
  "Story Driven", "Research Driven", "Exercise Driven", "Blueprint Driven", "Roadmap Driven"
];

const SIGNATURE_ELEMENT_OPTIONS = [
  "Action Plans", "Reflection Questions", "Worksheets", "Templates",
  "Case Studies", "Stories", "Checklists", "Quotes",
  "Research Findings", "Chapter Summaries", "Key Takeaways"
];

const STYLE_SLIDERS = [
  { key: "tone",         left: "Conversational", right: "Formal" },
  { key: "inspiration",  left: "Practical",      right: "Inspirational" },
  { key: "authority",    left: "Peer",            right: "Expert" },
  { key: "storytelling", left: "Minimal",         right: "Heavy" },
  { key: "complexity",   left: "Beginner",        right: "Advanced" }
];

const DEFAULT_CONTROLS = { tone: 30, inspiration: 50, authority: 70, storytelling: 40, complexity: 30 };

const DEFAULT_DRAFT = {
  inspiredBy:             "",
  authorDescription:      "",
  writingSamples:         [{ text: "", source: "" }],
  authorArchetype:        "",
  coreAuthorPromise:      "",
  readerRelationship:     "",
  signatureTeachingStyle: [],
  signatureElements:      [],
  signatureFramework:     "",
  voiceSummary:           "",
  writingStyleControls:   { ...DEFAULT_CONTROLS },
  personaStrength:        null,
  dos:                    [],
  donts:                  [],
  contentGuidelines:      [],
  writingSample:          ""
};

const CREATE_NEW_VALUE = "__create_new__";

function safeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `ap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function previewLine(text, max = 140) {
  if (!text || typeof text !== "string") return "";
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`;
}

function displayPersonaTitle(p) {
  const by = (p.inspiredBy || "").split(",")[0]?.trim();
  if (by) return by.length > 48 ? `${by.slice(0, 47)}…` : by;
  const arch = p.authorArchetype?.trim();
  if (arch) return arch;
  const desc = (p.authorDescription || "").trim();
  if (desc) return previewLine(desc, 52) || "Writing persona";
  return "Writing persona";
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function FieldLabel({ children, hint }) {
  return (
    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
      {children}
      {hint && (
        <span className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500" title={hint}>
          i
        </span>
      )}
    </label>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
      <span className="text-slate-400" aria-hidden>{icon}</span>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
    </div>
  );
}

function PillGrid({ options, selected, onSelect, multi = false }) {
  function toggle(opt) {
    if (!multi) {
      onSelect(selected === opt ? "" : opt);
      return;
    }
    const arr = Array.isArray(selected) ? selected : [];
    onSelect(arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt]);
  }
  const isActive = (opt) => multi ? (Array.isArray(selected) && selected.includes(opt)) : selected === opt;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            isActive(opt)
              ? "border-sky-400 bg-sky-100 text-sky-800"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          }`}>
          {isActive(opt) && multi ? "✓ " : ""}{opt}
        </button>
      ))}
    </div>
  );
}

function StyleSlider({ sliderKey, left, right, value, onChange }) {
  const id = `slider-${sliderKey}`;
  const percent = Math.round(value);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{left}</span>
        <span className="text-xs font-semibold text-sky-700">{percent}</span>
        <span className="text-xs font-medium text-slate-500">{right}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-sky-600"
      />
    </div>
  );
}

function PersonaStrengthCard({ strength }) {
  if (!strength || !strength.score) return null;
  const score = strength.score;
  const color = score >= 80 ? "text-emerald-700" : score >= 60 ? "text-amber-700" : "text-rose-700";
  const ringColor = score >= 80 ? "border-emerald-300 bg-emerald-50" : score >= 60 ? "border-amber-300 bg-amber-50" : "border-rose-300 bg-rose-50";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-2 ${ringColor}`}>
          <span className={`text-xl font-black ${color}`}>{score}</span>
          <span className="text-[10px] font-medium text-slate-500">/ 100</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">Persona Strength Score</p>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

      {(strength.strengths?.length > 0 || strength.suggestions?.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {strength.strengths?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Strengths</p>
              <ul className="mt-1.5 space-y-1">
                {strength.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                    <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {strength.suggestions?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Suggestions</p>
              <ul className="mt-1.5 space-y-1">
                {strength.suggestions.map((s, i) => (
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

function WritingSampleCard({ text }) {
  if (!text?.trim()) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Writing Sample (AI Preview)</p>
      <p className="text-sm italic leading-relaxed text-slate-700">"{text}"</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuthorPersonaStep({ authorPersona, setAuthorPersona, fullProject }) {
  const uid       = useId();
  const buttonRef = useRef(null);
  const panelRef  = useRef(null);
  const [open, setOpen] = useState(false);
  const [aiGenerating, setAiGenerating]   = useState(false);
  const [aiError,      setAiError]        = useState("");
  const [aiPhase,      setAiPhase]        = useState("");

  const saved      = Array.isArray(authorPersona.savedPersonas) ? authorPersona.savedPersonas : [];
  const selectedId = authorPersona.selectedId;
  const draft = {
    ...DEFAULT_DRAFT,
    ...(authorPersona.draft || {})
  };

  const samples = Array.isArray(draft.writingSamples) && draft.writingSamples.length
    ? draft.writingSamples
    : [{ text: "", source: "" }];

  const controls = { ...DEFAULT_CONTROLS, ...(draft.writingStyleControls || {}) };

  const selectedPersona = selectedId && selectedId !== CREATE_NEW_VALUE
    ? saved.find(p => p.id === selectedId) || null
    : null;

  // ── Draft helpers ──────────────────────────────────────────────────────────

  function updateDraft(patch) {
    setAuthorPersona({
      ...authorPersona,
      draft: { ...draft, ...(typeof patch === "function" ? patch(draft) : patch) }
    });
  }

  function setSamples(next) { updateDraft({ writingSamples: next }); }

  function patchControls(key, val) {
    updateDraft({ writingStyleControls: { ...controls, [key]: val } });
  }

  // ── Persona selector ───────────────────────────────────────────────────────

  function selectOption(idOrCreate) {
    if (idOrCreate === CREATE_NEW_VALUE) {
      setAuthorPersona({ ...authorPersona, selectedId: CREATE_NEW_VALUE, draft: { ...DEFAULT_DRAFT } });
      setOpen(false);
      return;
    }
    const p = saved.find(x => x.id === idOrCreate);
    if (!p) { setOpen(false); return; }

    setAuthorPersona({
      ...authorPersona,
      selectedId: p.id,
      draft: {
        inspiredBy:             p.inspiredBy            ?? "",
        authorDescription:      p.authorDescription     ?? "",
        writingSamples:         Array.isArray(p.writingSamples) && p.writingSamples.length
          ? p.writingSamples.map(w => ({ text: w.text ?? "", source: w.source ?? "" }))
          : [{ text: "", source: "" }],
        authorArchetype:        p.authorArchetype        ?? "",
        coreAuthorPromise:      p.coreAuthorPromise      ?? "",
        readerRelationship:     p.readerRelationship     ?? "",
        signatureTeachingStyle: p.signatureTeachingStyle ?? [],
        signatureElements:      p.signatureElements      ?? [],
        signatureFramework:     p.signatureFramework     ?? "",
        voiceSummary:           p.voiceSummary           ?? "",
        writingStyleControls:   p.writingStyleControls   ?? { ...DEFAULT_CONTROLS },
        personaStrength:        p.personaStrength        ?? null,
        dos:                    p.dos                    ?? [],
        donts:                  p.donts                  ?? [],
        contentGuidelines:      p.contentGuidelines      ?? [],
        writingSample:          p.writingSample          ?? ""
      }
    });
    setOpen(false);
  }

  // ── AI Generate Author Persona ─────────────────────────────────────────────

  const AI_PHASES = [
    "Analyzing book data…",
    "Evaluating audience fit…",
    "Generating voice strategy…"
  ];

  async function handleAIGenerate() {
    if (aiGenerating) return;
    setAiGenerating(true);
    setAiError("");
    setAiPhase(AI_PHASES[0]);

    const t1 = setTimeout(() => setAiPhase(AI_PHASES[1]), 1800);
    const t2 = setTimeout(() => setAiPhase(AI_PHASES[2]), 3600);

    try {
      const data = await aiFetch(
        "/api/ai/generate-author-persona",
        { project: fullProject },
        { noCache: true }
      );

      updateDraft({
        authorArchetype:        data.authorArchetype        || "",
        authorDescription:      data.authorDescription      || draft.authorDescription || "",
        coreAuthorPromise:      data.coreAuthorPromise      || "",
        readerRelationship:     data.readerRelationship     || "",
        signatureTeachingStyle: Array.isArray(data.signatureTeachingStyle) ? data.signatureTeachingStyle : [],
        signatureElements:      Array.isArray(data.signatureElements)      ? data.signatureElements      : [],
        signatureFramework:     data.signatureFramework     || "",
        voiceSummary:           data.voiceSummary           || "",
        writingStyleControls:   data.writingStyleControls   || { ...DEFAULT_CONTROLS },
        personaStrength:        data.personaStrength        || null,
        dos:                    Array.isArray(data.dos)               ? data.dos               : [],
        donts:                  Array.isArray(data.donts)             ? data.donts             : [],
        contentGuidelines:      Array.isArray(data.contentGuidelines) ? data.contentGuidelines : [],
        writingSample:          data.writingSample          || ""
      });
    } catch (e) {
      setAiError(e.message || "Generation failed. Please try again.");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setAiGenerating(false);
      setAiPhase("");
    }
  }

  // ── Save Persona ───────────────────────────────────────────────────────────

  function handleSavePersona() {
    const name = draft.authorArchetype?.trim()
      || draft.inspiredBy?.split(",")[0]?.trim()
      || previewLine(draft.authorDescription || "Writing persona", 40);

    const entry = {
      id:                     selectedId && selectedId !== CREATE_NEW_VALUE ? selectedId : safeId(),
      name,
      inspiredBy:             draft.inspiredBy,
      authorDescription:      draft.authorDescription,
      writingSamples:         samples.map(s => ({ text: s.text, source: s.source || "" })),
      authorArchetype:        draft.authorArchetype,
      coreAuthorPromise:      draft.coreAuthorPromise,
      readerRelationship:     draft.readerRelationship,
      signatureTeachingStyle: draft.signatureTeachingStyle || [],
      signatureElements:      draft.signatureElements      || [],
      signatureFramework:     draft.signatureFramework,
      voiceSummary:           draft.voiceSummary,
      writingStyleControls:   controls,
      personaStrength:        draft.personaStrength        || null,
      dos:                    draft.dos                    || [],
      donts:                  draft.donts                  || [],
      contentGuidelines:      draft.contentGuidelines      || [],
      writingSample:          draft.writingSample          || "",
      updatedAt:              new Date().toISOString()
    };

    const isExisting = selectedId && selectedId !== CREATE_NEW_VALUE && saved.some(p => p.id === selectedId);
    const nextSaved  = isExisting
      ? saved.map(p => p.id === entry.id ? entry : p)
      : [...saved, entry];

    setAuthorPersona({ ...authorPersona, savedPersonas: nextSaved, selectedId: entry.id });
  }

  // ── Writing sample file upload ─────────────────────────────────────────────

  function addSampleRow()          { setSamples([...samples, { text: "", source: "" }]); }
  function updateSample(idx, p)    { setSamples(samples.map((r, i) => i === idx ? { ...r, ...p } : r)); }
  function removeSample(idx)       {
    if (samples.length <= 1) { setSamples([{ text: "", source: "" }]); return; }
    setSamples(samples.filter((_, i) => i !== idx));
  }

  async function onWritingSampleFilesChosen(event) {
    const picked = event.target.files;
    if (!picked?.length) return;
    try {
      const texts = [];
      for (let i = 0; i < picked.length; i++) {
        const file = picked.item(i);
        if (!file || file.size > RESOURCE_FILE_MAX_BYTES) continue;
        const entry = await parseResourceUploadFile(file);
        if (entry.encoding === "text" && typeof entry.textContent === "string")
          texts.push(entry.textContent.trim());
      }
      if (!texts.length) return;
      const parts = texts.join("\n\n").split(/\n\s*\n+/).map(t => t.trim()).filter(Boolean);
      setSamples(parts.map(t => ({ text: t, source: "" })));
    } finally { event.target.value = ""; }
  }

  // ── Click outside ──────────────────────────────────────────────────────────

  useEffect(() => {
    function onPointerDown(ev) {
      if (!panelRef.current || !buttonRef.current) return;
      if (panelRef.current.contains(ev.target) || buttonRef.current.contains(ev.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  // ── Trigger summary ────────────────────────────────────────────────────────

  function triggerSummary() {
    if (!selectedId) return "Choose a persona or create new…";
    if (selectedId === CREATE_NEW_VALUE) return "Create New Persona";
    const p = selectedPersona;
    if (!p) return "Choose a persona or create new…";
    const title = p.name?.trim() || displayPersonaTitle(p);
    const sub   = previewLine(p.voiceSummary || p.authorDescription || p.generated?.summary || "", 100);
    return { title, sub };
  }

  const trigger = triggerSummary();
  const listboxId = `${uid}-persona-listbox`;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-6">

      {/* ── Saved Personas Selector ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-500" aria-hidden>◉</span>
          <h2 className="text-base font-semibold text-slate-900">Your Saved Personas ({saved.length})</h2>
        </div>

        <div className="relative mt-3">
          <button
            ref={buttonRef}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            onClick={() => setOpen(o => !o)}
            className="input-light flex min-h-[48px] w-full items-start justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="min-w-0 flex-1">
              {typeof trigger === "string" ? (
                <span className="text-sm text-slate-500">{trigger}</span>
              ) : (
                <>
                  <span className="block text-sm font-semibold text-slate-900">{trigger.title}</span>
                  {trigger.sub && <span className="mt-0.5 block text-xs leading-snug text-slate-600">{trigger.sub}</span>}
                </>
              )}
            </span>
            <span className="shrink-0 text-slate-400" aria-hidden>▼</span>
          </button>

          {open && (
            <div
              ref={panelRef}
              id={listboxId}
              role="listbox"
              aria-label="Personas"
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[min(340px,calc(100vh-220px))] overflow-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl"
            >
              <button type="button" role="option" aria-selected={selectedId === CREATE_NEW_VALUE}
                className={`flex w-full flex-col px-4 py-3 text-left hover:bg-slate-50 ${selectedId === CREATE_NEW_VALUE ? "bg-slate-50" : ""}`}
                onClick={() => selectOption(CREATE_NEW_VALUE)}>
                <span className="text-sm font-semibold text-slate-900">Create New Persona</span>
                <span className="mt-0.5 text-xs text-slate-500">Clears fields so you can start fresh</span>
              </button>

              {saved.length > 0 && <div className="my-1 border-t border-slate-100" />}

              {saved.map(p => {
                const title = p.name?.trim() || displayPersonaTitle(p);
                const sub   = previewLine(p.voiceSummary || p.authorDescription || p.generated?.summary || "", 120);
                const isSel = selectedId === p.id;
                return (
                  <button key={p.id} type="button" role="option" aria-selected={isSel}
                    className={`flex w-full flex-col px-4 py-3 text-left hover:bg-slate-50 ${isSel ? "bg-slate-50" : ""}`}
                    onClick={() => selectOption(p.id)}>
                    <span className="text-sm font-semibold text-slate-900">{title}</span>
                    {sub ? (
                      <span className="mt-0.5 text-xs leading-snug text-slate-600">{sub}</span>
                    ) : (
                      <span className="mt-0.5 text-xs italic text-slate-400">No voice summary yet</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── AI Generate Button ── */}
      <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900">✨ Generate Author Persona</p>
            <p className="mt-0.5 text-xs text-slate-500">
              AI analyzes your book data — topic, audience, market gap, competitors — and builds a complete strategic voice profile.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAIGenerate}
            disabled={aiGenerating}
            className="shrink-0 rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60 transition-colors"
          >
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
      </div>

      {/* ── Persona Strength Score (shown after AI generation) ── */}
      {draft.personaStrength?.score > 0 && (
        <PersonaStrengthCard strength={draft.personaStrength} />
      )}

      {/* ── Do's / Don'ts / Content Guidelines (shown after AI generation) ── */}
      {(draft.dos?.length > 0 || draft.donts?.length > 0 || draft.contentGuidelines?.length > 0) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <p className="text-sm font-bold text-slate-900">Voice Rules</p>

          {draft.dos?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 mb-2">Do's</p>
              <ul className="space-y-1.5">
                {draft.dos.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className="mt-0.5 shrink-0 text-emerald-500 font-bold">✓</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {draft.donts?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600 mb-2">Don'ts</p>
              <ul className="space-y-1.5">
                {draft.donts.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className="mt-0.5 shrink-0 text-rose-500 font-bold">✕</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {draft.contentGuidelines?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-600 mb-2">Content Guidelines</p>
              <ul className="space-y-1.5">
                {draft.contentGuidelines.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className="mt-0.5 shrink-0 text-sky-500">◆</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Author Identity ── */}
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionHeader icon="◉" title="Author Identity" />

        <div>
          <FieldLabel hint="The archetypal role this author plays for their readers.">Author Archetype</FieldLabel>
          <div className="mt-2">
            <PillGrid options={AUTHOR_ARCHETYPES} selected={draft.authorArchetype} onSelect={v => updateDraft({ authorArchetype: v })} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel hint="Optional author name displayed in the book.">Author Name (optional)</FieldLabel>
            <input className="input-light mt-1.5" placeholder="e.g. Jane Smith"
              value={draft.authorName ?? ""}
              onChange={e => updateDraft({ authorName: e.target.value })} />
          </div>
          <div>
            <FieldLabel hint="Names of writers whose readability and cadence you want to evoke.">Inspired By (optional)</FieldLabel>
            <input className="input-light mt-1.5" placeholder="e.g. Malcolm Gladwell, Brené Brown…"
              value={draft.inspiredBy ?? ""}
              onChange={e => updateDraft({ inspiredBy: e.target.value })} />
          </div>
        </div>

        <div>
          <FieldLabel hint="Background, expertise, and credentials. Used to shape tone and vocabulary.">Author Description (optional)</FieldLabel>
          <textarea className="input-light mt-1.5 min-h-[110px] resize-y"
            placeholder="Describe the author's background, expertise, and writing approach…"
            value={draft.authorDescription ?? ""}
            onChange={e => updateDraft({ authorDescription: e.target.value })} />
        </div>
      </section>

      {/* ── Promise & Relationship ── */}
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionHeader icon="◎" title="Author Promise & Reader Relationship" />

        <div>
          <FieldLabel hint="The central commitment this author makes to readers. Influences introductions, conclusions, and chapter framing.">
            Core Author Promise
          </FieldLabel>
          <input className="input-light mt-1.5"
            placeholder={`e.g. "I help college students build affiliate income without sacrificing their education."`}
            value={draft.coreAuthorPromise ?? ""}
            onChange={e => updateDraft({ coreAuthorPromise: e.target.value })} />
        </div>

        <div>
          <FieldLabel hint="How the AI will frame the author's relationship with the reader across all content.">Reader Relationship</FieldLabel>
          <div className="mt-2">
            <PillGrid options={READER_RELATIONSHIPS} selected={draft.readerRelationship} onSelect={v => updateDraft({ readerRelationship: v })} />
          </div>
        </div>
      </section>

      {/* ── Teaching Approach ── */}
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionHeader icon="▣" title="Teaching Approach & Signature Elements" />

        <div>
          <FieldLabel hint="Select 2–4 methods that define how this author teaches. Influences chapter organization and explanations.">
            Signature Teaching Style
          </FieldLabel>
          <div className="mt-2">
            <PillGrid options={TEACHING_STYLE_OPTIONS} selected={draft.signatureTeachingStyle || []}
              onSelect={v => updateDraft({ signatureTeachingStyle: v })} multi />
          </div>
        </div>

        <div>
          <FieldLabel hint="Recurring elements that should appear consistently throughout the book.">
            Signature Elements
          </FieldLabel>
          <div className="mt-2">
            <PillGrid options={SIGNATURE_ELEMENT_OPTIONS} selected={draft.signatureElements || []}
              onSelect={v => updateDraft({ signatureElements: v })} multi />
          </div>
        </div>

        <div>
          <FieldLabel hint="A proprietary framework name that becomes the foundation of the book. Use a trademark symbol for authority.">
            Signature Framework
          </FieldLabel>
          <input className="input-light mt-1.5"
            placeholder="e.g. The Student-to-Earner System™"
            value={draft.signatureFramework ?? ""}
            onChange={e => updateDraft({ signatureFramework: e.target.value })} />
        </div>
      </section>

      {/* ── Voice Summary ── */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionHeader icon="◈" title="AI Voice Summary" />
        <p className="text-xs text-slate-500">
          This summary is injected as a master instruction into every AI generation call — outline, chapters, writing, descriptions.
          Be specific and actionable.
        </p>
        <textarea className="input-light min-h-[100px] resize-y"
          placeholder={`e.g. "Write like a supportive mentor who simplifies affiliate marketing for college students using practical frameworks, real-world examples, and action-oriented guidance. Maintain a conversational, encouraging tone while avoiding hype and unrealistic promises."`}
          value={draft.voiceSummary ?? ""}
          onChange={e => updateDraft({ voiceSummary: e.target.value })} />
        {draft.writingSample && <WritingSampleCard text={draft.writingSample} />}
      </section>

      {/* ── Writing Style Controls ── */}
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionHeader icon="◇" title="Writing Style Controls" />
        <div className="space-y-5">
          {STYLE_SLIDERS.map(({ key, left, right }) => (
            <StyleSlider
              key={key}
              sliderKey={key}
              left={left}
              right={right}
              value={controls[key] ?? DEFAULT_CONTROLS[key]}
              onChange={val => patchControls(key, val)}
            />
          ))}
        </div>
      </section>

      {/* ── Writing Samples ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="text-slate-400" aria-hidden>▭</span>
          <h3 className="text-sm font-semibold text-slate-800">Writing Samples</h3>
        </div>

        <div className="mt-4 space-y-4">
          {samples.map((row, idx) => (
            <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <textarea className="input-light min-h-[120px] resize-y bg-white"
                placeholder="Paste your writing sample here (at least 200 words recommended)…"
                value={row.text ?? ""}
                onChange={e => updateSample(idx, { text: e.target.value })} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="min-w-[min(280px,calc(100%-8rem))] flex-1">
                  <input className="input-light" placeholder="Source (optional)"
                    value={row.source ?? ""}
                    onChange={e => updateSample(idx, { source: e.target.value })} />
                </div>
                <button type="button"
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={addSampleRow}>+ Add</button>
                {samples.length > 1 && (
                  <button type="button"
                    className="rounded-xl px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    onClick={() => removeSample(idx)}>Remove</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <input type="file" accept={ALLOWED_RESOURCE_EXTENSIONS.join(",")} multiple className="hidden"
            id={`${uid}-sample-upload`} onChange={onWritingSampleFilesChosen} />
          <label htmlFor={`${uid}-sample-upload`}
            className="input-light inline-flex cursor-pointer items-center justify-center gap-2 font-medium text-slate-700">
            <span aria-hidden>⎙</span> Upload Files ({ALLOWED_RESOURCE_EXTENSIONS.join(", ")})
          </label>
          <p className="mt-2 text-xs text-slate-500">Text is extracted locally when possible (.txt, .md, …). Larger documents may truncate.</p>
        </div>
      </section>

      {/* ── Save Persona Button ── */}
      <div>
        <button type="button" onClick={handleSavePersona}
          className="w-full rounded-2xl bg-slate-900 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800">
          ✦ Save Persona
        </button>
        <p className="mt-2 text-center text-xs text-slate-500">
          Saves all fields above as a named persona. Use the dropdown at the top to switch between personas.
        </p>
      </div>

    </div>
  );
}
