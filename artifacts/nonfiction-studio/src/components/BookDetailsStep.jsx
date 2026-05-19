import { useEffect, useMemo, useRef } from "react";
import {
  AUTHOR_TONE_OPTIONS,
  BOOK_CHAPTER_OPTIONS,
  BOOK_STRUCTURE_OPTIONS,
  BOOK_WORD_COUNT_RANGES,
  GENERAL_AUDIENCE_OPTIONS,
  GENRE_OPTIONS
} from "@/lib/constants";
import { effectiveBookTitle } from "@/lib/proposedBook";

const CREATE_NEW_PERSONA = "__create_new__";

function buildPersonaNotes(authorPersona) {
  if (!authorPersona) return "";
  const id = authorPersona.selectedId;
  const saved = Array.isArray(authorPersona.savedPersonas) ? authorPersona.savedPersonas : [];
  const p = id && id !== CREATE_NEW_PERSONA ? saved.find((x) => x.id === id) : null;
  if (!p) return "";
  const g = p.generated;
  const parts = [];
  if (g?.summary) parts.push(g.summary);
  if (g?.voice?.tone || g?.voice?.mood) {
    parts.push([g.voice.tone, g.voice.mood].filter(Boolean).join(" • "));
  }
  if (g?.style) {
    const s = g.style;
    const styleBits = [
      s?.pacing,
      s?.vocabulary || s?.vocabularyLevel,
      s?.sentenceStructure
    ]
      .filter(Boolean)
      .join(" ");
    if (styleBits) parts.push(styleBits);
  }
  if (!parts.length && p.authorDescription?.trim()) parts.push(p.authorDescription.trim());
  if (!parts.length && p.name) parts.push(String(p.name));
  return parts.join("\n\n");
}

/** Fill only untouched fields using proposal + prior steps. */
function mergeFromProject(previous, fullProject) {
  const proj = fullProject || {};
  const pb = proj.proposedBook?.content || {};
  const r = proj.research || {};

  const out = { ...(previous || {}) };

  const firstTone =
    Array.isArray(r.authorTones) ? r.authorTones.find((t) => AUTHOR_TONE_OPTIONS.includes(t)) || r.authorTones[0]
    : "";
  const tonePick = typeof firstTone === "string" ? firstTone.trim() : "";
  const proposalTone = pb.proposedTone?.trim?.() || "";

  const empty = (v) => !String(v ?? "").trim();

  if (empty(out.title)) {
    out.title = pb.title?.trim() || effectiveBookTitle(proj.bookTitle) || r.bookTitle?.trim() || "";
  }
  if (empty(out.uniqueSellingProposition)) {
    out.uniqueSellingProposition = pb.uniqueSellingProposition?.trim() || "";
  }
  if (empty(out.genre) && r.genre) out.genre = r.genre.trim();
  if (empty(out.audience) && r.generalAudience) out.audience = r.generalAudience.trim();
  if (empty(out.authorPersonaNotes)) out.authorPersonaNotes = buildPersonaNotes(proj.authorPersona);
  if (empty(out.structure)) out.structure = "Chronological";
  if (out.chapterCount == null || out.chapterCount === "" || Number.isNaN(Number(out.chapterCount))) {
    out.chapterCount = 8;
  } else {
    out.chapterCount = Math.min(15, Math.max(5, Number(out.chapterCount)));
  }
  if (empty(out.tone)) {
    if (tonePick && AUTHOR_TONE_OPTIONS.includes(tonePick)) out.tone = tonePick;
    else if (proposalTone) {
      const hit = AUTHOR_TONE_OPTIONS.find((opt) => proposalTone.toLowerCase().includes(opt.toLowerCase()));
      out.tone = hit || tonePick || AUTHOR_TONE_OPTIONS[0] || "";
    } else {
      out.tone = AUTHOR_TONE_OPTIONS[0] || "";
    }
  }

  return out;
}

function FieldLabel({ children, hint }) {
  return (
    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
      {children}
      {hint && (
        <span
          className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500"
          title={hint}
        >
          i
        </span>
      )}
    </label>
  );
}

export default function BookDetailsStep({ bookDetails, setBookDetails, fullProject, currentStep, detailsStepIndex }) {
  const bd = bookDetails || {};
  const detailsVisitRef = useRef(false);

  useEffect(() => {
    if (currentStep !== detailsStepIndex) {
      detailsVisitRef.current = false;
      return;
    }
    if (detailsVisitRef.current) return;
    detailsVisitRef.current = true;
    setBookDetails((prev) => mergeFromProject(prev || {}, fullProject));
  }, [currentStep, detailsStepIndex, fullProject, setBookDetails]);

  const genreOptions = useMemo(() => {
    const set = new Set(GENRE_OPTIONS);
    const g = (bd.genre || "").trim();
    if (g && !set.has(g)) return [g, ...GENRE_OPTIONS];
    return [...GENRE_OPTIONS];
  }, [bd.genre]);

  const toneOptions = useMemo(() => {
    const set = new Set(AUTHOR_TONE_OPTIONS);
    const t = (bd.tone || "").trim();
    if (t && !set.has(t)) return [t, ...AUTHOR_TONE_OPTIONS];
    return [...AUTHOR_TONE_OPTIONS];
  }, [bd.tone]);

  const audienceOptions = useMemo(() => {
    const set = new Set(GENERAL_AUDIENCE_OPTIONS);
    const a = (bd.audience || "").trim();
    if (a && !set.has(a)) return [a, ...GENERAL_AUDIENCE_OPTIONS];
    return [...GENERAL_AUDIENCE_OPTIONS];
  }, [bd.audience]);

  function patch(partial) {
    setBookDetails(typeof partial === "function" ? partial : { ...bd, ...partial });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm text-slate-600">
        Let&apos;s iron out some details for your book. Your changes are saved automatically.
      </p>

      <div className="mt-8 space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div>
          <FieldLabel hint="Pick the band that best matches your deliverable; you can refine during outline.">
            Select the word count range of your book
          </FieldLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            {BOOK_WORD_COUNT_RANGES.map((range) => {
              const on = bd.wordCountRange === range;
              return (
                <button
                  key={range}
                  type="button"
                  onClick={() => patch({ wordCountRange: range })}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    on
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {range}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <FieldLabel hint="How many scaffolded chapters to plan for—you can reshuffle later in Outline.">
            Select the number of chapters
          </FieldLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            {BOOK_CHAPTER_OPTIONS.map((n) => {
              const on = Number(bd.chapterCount) === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => patch({ chapterCount: n })}
                  aria-pressed={on}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition ${
                    on
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <FieldLabel hint="Synced from Proposed Book by default—but you can rewrite before publishing.">
            Title
          </FieldLabel>
          <input
            className="input-light mt-1.5"
            value={bd.title ?? ""}
            placeholder="Working title"
            onChange={(e) => patch({ title: e.target.value })}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel hint="Architectural blueprint for pacing and transitions.">
              Structure
            </FieldLabel>
            <select
              className="input-light mt-1.5"
              value={bd.structure ?? ""}
              onChange={(e) => patch({ structure: e.target.value })}
            >
              <option value="">Select structure</option>
              {BOOK_STRUCTURE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel hint="Pulled forward from Research; adjust if positioning shifted during proposal.">
              Genre
            </FieldLabel>
            <select
              className="input-light mt-1.5"
              value={bd.genre ?? ""}
              onChange={(e) => patch({ genre: e.target.value })}
            >
              <option value="">Select genre</option>
              {genreOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel hint="Dominant tonal register for narration and headings.">
              Tone
            </FieldLabel>
            <select
              className="input-light mt-1.5"
              value={bd.tone ?? ""}
              onChange={(e) => patch({ tone: e.target.value })}
            >
              <option value="">Select tone</option>
              {toneOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel hint="Age band + reading level guardrails.">Audience</FieldLabel>
            <select
              className="input-light mt-1.5"
              value={bd.audience ?? ""}
              onChange={(e) => patch({ audience: e.target.value })}
            >
              <option value="">Select audience</option>
              {audienceOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <FieldLabel hint="Hook for listings; inherited from proposal when blank.">
            Unique Selling Proposition
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[140px] resize-y"
            value={bd.uniqueSellingProposition ?? ""}
            onChange={(e) => patch({ uniqueSellingProposition: e.target.value })}
          />
        </div>

        <div>
          <FieldLabel hint="Echoes Author Persona (generated profile + cues). Rewrite freely—this anchors ghostwriting prompts later.">
            Author persona snapshot
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[140px] resize-y"
            placeholder="Summary of voice, background, cadence..."
            value={bd.authorPersonaNotes ?? ""}
            onChange={(e) => patch({ authorPersonaNotes: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
