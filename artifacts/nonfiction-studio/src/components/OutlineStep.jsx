import { useEffect, useRef, useState } from "react";
import { BOOK_WORD_COUNT_RANGES } from "@/lib/constants";
import { applyNicheOutlineToBookOutline, applyDynamicOutlineToBookOutline } from "@/lib/niche/outlineApply";
import { loadNicheRegistry, resolveArchitecture } from "@/lib/niche/registry";
import { resolveBookTitle } from "@/lib/projectMeta";
import { aiFetch, GenerationCanceledError } from "@/lib/ai/aiFetch";
import { buildBookContext } from "@/lib/bookContext";

function safeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return `o-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function midpointTargetWords(wordCountRange) {
  const s = String(wordCountRange || "").trim();
  if (!BOOK_WORD_COUNT_RANGES.includes(s)) return 45000;
  const parts = s.split(/\s*[–—-]\s*/).map((p) => p.trim().replace(/k/i, ""));
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (Number.isFinite(a) && Number.isFinite(b)) return ((a + b) / 2) * 1000;
  return 45000;
}

function newSubsection() {
  return { id: safeId(), title: "New subsection", words: 200 };
}

export function seedBookOutline(previous, chapterCountFromDetails, wordCountRangeBand) {
  const prev =
    previous && typeof previous === "object"
      ? previous
      : { introduction: undefined, chapters: [], conclusion: undefined };

  if (Array.isArray(prev.chapters) && prev.chapters.length > 0) {
    return {
      introduction: normalizeIntro(prev.introduction),
      chapters: prev.chapters.map(normalizeChapter),
      conclusion: normalizeConclusion(prev.conclusion),
    };
  }

  const n = Math.min(40, Math.max(1, Math.round(Number(chapterCountFromDetails) || 8)));
  const budget = midpointTargetWords(wordCountRangeBand);
  const reserve = Math.max(700, Math.round(budget * 0.035));
  const introW = reserve;
  const outroW = reserve;
  const rest = Math.max(200 * n, budget - introW - outroW);
  const perCh = Math.max(450, Math.round(rest / n));

  const chapters = Array.from({ length: n }, (_, ci) => {
    let ch = makeChapter(ci, perCh);
    ch = resizeChapterSections(ch, 3);
    const sc = Array.isArray(ch.sections) ? ch.sections : [];
    const sw = Math.max(100, Math.round(perCh / Math.max(sc.length, 1)));
    ch.sections = sc.map((sec) => {
      let next = resizeSectionSubs(sec, 3);
      const subWs = Math.max(80, Math.round(sw / Math.max(next.subsections?.length || 1, 1)));
      next.words = sw;
      next.subsections = (next.subsections || []).map((su) => ({ ...su, words: subWs }));
      return next;
    });
    return ch;
  });

  return {
    introduction: {
      ...(prev.introduction && typeof prev.introduction === "object" ? prev.introduction : {}),
      id: (prev.introduction && prev.introduction.id) || "intro",
      title: (prev.introduction && prev.introduction.title) || "Introduction",
      words: introW,
    },
    chapters,
    conclusion: {
      ...(prev.conclusion && typeof prev.conclusion === "object" ? prev.conclusion : {}),
      id: (prev.conclusion && prev.conclusion.id) || "concl",
      title: (prev.conclusion && prev.conclusion.title) || "Conclusion",
      words: outroW,
    },
  };
}

function normalizeIntro(i) {
  const x = i && typeof i === "object" ? i : {};
  return { id: x.id || "intro", title: x.title || "Introduction", words: Number(x.words) || 0, expanded: x.expanded };
}

function normalizeConclusion(c) {
  const x = c && typeof c === "object" ? c : {};
  return { id: x.id || "concl", title: x.title || "Conclusion", words: Number(x.words) || 0 };
}

function normalizeChapter(ch) {
  if (!ch || typeof ch !== "object") return makeChapter(0, 1200);
  return {
    id: ch.id || safeId(),
    title: ch.title || "Chapter",
    words: Number(ch.words) || 0,
    expanded: ch.expanded !== false,
    sections: Array.isArray(ch.sections) ? ch.sections.map(normalizeSection) : [],
  };
}

/** "Label: The Real Title" → "The Real Title". Leaves titles without a colon unchanged. */
function stripAfterColon(title) {
  const s = String(title || "").trim();
  const idx = s.indexOf(":");
  if (idx === -1) return s;
  const right = s.slice(idx + 1).trim();
  return right.length > 0 ? right : s;
}

const BLUEPRINT_COMPONENTS = [
  "Key Takeaways",
  "Action Plan",
  "Checklist",
  "Exercises",
  "Reflection Questions",
  "Templates",
  "Case Studies",
  "Examples",
  "Research Highlights",
  "Resources",
  "Summary",
];

function normalizeSection(s) {
  if (!s || typeof s !== "object") return newSectionSkeleton(650);
  return {
    id: s.id || safeId(),
    title: stripAfterColon(s.title || "Section"),
    objective: typeof s.objective === "string" ? s.objective : "",
    words: Number(s.words) || 0,
    expanded: s.expanded !== false,
    subsections: Array.isArray(s.subsections) ? s.subsections.map(normalizeSub) : [],
    blueprintComponents: Array.isArray(s.blueprintComponents) ? s.blueprintComponents : [],
  };
}

function normalizeSub(su) {
  if (!su || typeof su !== "object") return newSubsection();
  return {
    id: su.id || safeId(),
    title: stripAfterColon(su.title || "Subsection"),
    purpose: typeof su.purpose === "string" ? su.purpose : "",
    words: Number(su.words) || 0
  };
}

function normalizedBookOutline(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    introduction: normalizeIntro(r.introduction),
    chapters: Array.isArray(r.chapters) ? r.chapters.map(normalizeChapter) : [],
    conclusion: normalizeConclusion(r.conclusion),
  };
}

function makeChapter(ci, words) {
  return { id: safeId(), title: `Chapter ${ci + 1}`, words, expanded: true, sections: [] };
}

function newSectionSkeleton(baseWords) {
  const sec = {
    id: safeId(),
    title: "New section",
    words: Math.max(100, Math.round(Number(baseWords) || 600)),
    expanded: true,
    subsections: [],
  };
  sec.subsections = resizeSectionSubs(sec, 0);
  return sec;
}

function resizeChapterSections(chapter, target) {
  const n = Math.min(15, Math.max(0, Math.round(Number(target))));
  let next = [...(chapter.sections || [])];
  const avg =
    Number(chapter.words) > 0 && n > 0
      ? Math.max(120, Math.round(Number(chapter.words) / Math.max(n, 1)))
      : 650;
  while (next.length < n) next.push(newSectionSkeleton(avg));
  if (next.length > n) next = next.slice(0, n);
  return { ...chapter, sections: next };
}

function resizeSectionSubs(section, target) {
  const n = Math.min(15, Math.max(0, Math.round(Number(target))));
  let next = Array.isArray(section.subsections) ? [...section.subsections] : [];
  while (next.length < n) next.push(newSubsection());
  if (next.length > n) next = next.slice(0, n);
  return { ...section, subsections: next };
}

// ─── Editable title component ─────────────────────────────────────────────────

function EditableTitle({ value, onCommit, dense }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(value || "");

  useEffect(() => {
    if (!edit) setDraft(value || "");
  }, [value, edit]);

  if (edit) {
    return (
      <span className="inline-flex max-w-full min-w-0 flex-1 items-center gap-2">
        <input
          className={`input-light min-w-0 font-semibold ${dense ? "text-sm py-1.5" : "text-[15px]"}`}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { onCommit(draft.trim() || ""); setEdit(false); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEdit(false);
            if (e.key === "Enter") { onCommit(draft.trim() || ""); setEdit(false); }
          }}
        />
      </span>
    );
  }

  return (
    <div className="flex min-w-0 max-w-full items-start gap-1.5">
      <button
        type="button"
        title="Rename"
        aria-label="Edit title"
        onClick={() => setEdit(true)}
        className={`shrink-0 rounded-lg p-1 text-sky-700 transition hover:bg-sky-100 ${dense ? "-mt-0.5" : ""}`}
      >
        ✎
      </button>
      <span
        className={`min-w-0 break-words font-semibold text-slate-900 ${dense ? "text-[13px] leading-snug" : "text-sm md:text-[15px]"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Regenerate button ────────────────────────────────────────────────────────

function RegenBtn({ busy, onClick, title = "Regenerate title" }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      title={title}
      aria-label={title}
      className="shrink-0 rounded-lg px-1.5 py-1 text-[11px] font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-40"
    >
      {busy ? (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
      ) : (
        "↻"
      )}
    </button>
  );
}

// ─── Blueprint Picker ─────────────────────────────────────────────────────────

function BlueprintPicker({ selected, onChange }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
        Section Blueprint Components
      </p>
      <p className="mb-3 text-[10px] text-violet-600/80">
        Selected components will be included in the AI-generated content for this section.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {BLUEPRINT_COMPONENTS.map((c) => {
          const checked = Array.isArray(selected) && selected.includes(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() =>
                onChange(
                  checked
                    ? selected.filter((x) => x !== c)
                    : [...(Array.isArray(selected) ? selected : []), c]
                )
              }
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                checked
                  ? "border-violet-500 bg-violet-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
              }`}
            >
              {checked ? "✓ " : ""}{c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COUNT_OPTS = Array.from({ length: 15 }, (_, i) => i + 1);

// ─── Main component ───────────────────────────────────────────────────────────

export default function OutlineStep({
  bookOutline,
  setBookOutline,
  bookDetails,
  fullProject,
  currentStep,
  outlineStepIndex,
}) {
  const [regenBusy, setRegenBusy]             = useState({});
  const [genSubsBusy, setGenSubsBusy]         = useState({});
  const [genSecsBusy, setGenSecsBusy]         = useState({});
  const [genChaptersBusy, setGenChaptersBusy] = useState(false);
  const [genPhase, setGenPhase]               = useState("");
  const [blueprintOpenMap, setBlueprintOpenMap] = useState({});

  const boRaw = bookOutline && typeof bookOutline === "object" ? bookOutline : {};
  const intro = normalizeIntro(boRaw.introduction);
  const conclusion = normalizeConclusion(boRaw.conclusion);
  const chapters = Array.isArray(boRaw.chapters) ? boRaw.chapters.map(normalizeChapter) : [];
  const seededRef = useRef(false);

  const arch =
    fullProject?.research?.architectureSnapshot ||
    resolveArchitecture(
      loadNicheRegistry(),
      fullProject?.research?.mainNicheId,
      fullProject?.research?.subNicheId
    );

  // ─── Outline state helpers ─────────────────────────────────────────────────

  function commit(patcher) {
    setBookOutline((prevRaw) => {
      const base = normalizedBookOutline(prevRaw);
      return patcher(base);
    });
  }

  useEffect(() => {
    if (currentStep !== outlineStepIndex) { seededRef.current = false; return; }
    if (seededRef.current) return;
    seededRef.current = true;
    setBookOutline((prev) =>
      seedBookOutline(prev, bookDetails?.chapterCount, bookDetails?.wordCountRange || "")
    );
  }, [bookDetails?.chapterCount, bookDetails?.wordCountRange, currentStep, outlineStepIndex, setBookOutline]);

  function patchIntro(patch) {
    commit((draft) => ({ ...draft, introduction: { ...intro, ...patch } }));
  }

  function patchConclusion(patch) {
    commit((draft) => ({ ...draft, conclusion: { ...conclusion, ...patch } }));
  }

  function patchChaptersUpdater(fn) {
    commit((draft) => {
      const cs = [...(draft.chapters || [])];
      return { ...draft, chapters: fn(cs) };
    });
  }

  function updateChapterById(cid, updater) {
    patchChaptersUpdater((cs) =>
      cs.map((c) => c.id === cid ? normalizeChapter(updater({ ...normalizeChapter(c) })) : c)
    );
  }

  function updateSectionById(cid, sid, updater) {
    patchChaptersUpdater((cs) =>
      cs.map((ch) =>
        ch.id !== cid ? ch : {
          ...ch,
          sections: (ch.sections || []).map((s) =>
            s.id !== sid ? s : normalizeSection(updater({ ...normalizeSection(s) }))
          ),
        }
      )
    );
  }

  function addChapterRow() {
    patchChaptersUpdater((cs) => {
      const per = cs.length
        ? Math.max(450, Math.round(cs.reduce((a, ch) => a + Number(ch.words || 0), 0) / Math.max(cs.length, 1)))
        : 1400;
      const next = [...cs, normalizeChapter(makeChapter(cs.length, per))];
      return next.map((ch, ii) => ii === next.length - 1 ? resizeChapterSections({ ...ch }, 0) : ch);
    });
  }

  function deleteChapter(cid) {
    patchChaptersUpdater((cs) => cs.filter((c) => c.id !== cid));
  }

  function addSectionToChapter(cid, ciAbs) {
    patchChaptersUpdater((cs) =>
      cs.map((ch) =>
        ch.id !== cid ? ch : (() => {
          const secs = [...(ch.sections || [])];
          const bw = Math.max(150, Math.round(Number(ch.words || 1200) / Math.max(secs.length + 1, 1)));
          secs.push(normalizeSection(newSectionSkeleton(bw)));
          secs[secs.length - 1].title = `${ciAbs + 1}.${secs.length}: New section`;
          return normalizeChapter({ ...ch, sections: secs });
        })()
      )
    );
  }

  function addSubsection(cid, sid) {
    updateSectionById(cid, sid, (sec) => ({
      ...sec,
      subsections: [...(sec.subsections || []), newSubsection()],
      expanded: true,
    }));
  }

  // ─── Expand / collapse all ─────────────────────────────────────────────────

  function setAllExpanded(expanded) {
    commit((draft) => ({
      ...draft,
      chapters: (draft.chapters || []).map((ch) => ({
        ...ch,
        expanded,
        sections: (ch.sections || []).map((sec) => ({ ...sec, expanded })),
      })),
    }));
  }

  // ─── Generate chapters — dynamic section + word assignment ──────────────────

  async function generateChapters() {
    if (!arch) return;
    setGenChaptersBusy(true);
    setGenPhase("Analyzing book data…");

    const phaseTimers = [
      setTimeout(() => setGenPhase("Building reader-retention arc…"), 1800),
      setTimeout(() => setGenPhase("Scoring chapters by depth and importance…"), 4200),
      setTimeout(() => setGenPhase("Assigning sections and distributing words…"), 7000),
    ];

    try {
      const bd = fullProject?.bookDetails || {};
      const targetWords = midpointTargetWords(bd.wordCountRange || "");

      const data = await aiFetch("/api/ai/niche-outline", {
        architecture: arch,
        title:        resolveBookTitle(fullProject),
        description:  bd.description || bd.positioningStatement || "",
        research:     fullProject?.research,
        bookContext:  buildBookContext(fullProject),
      });

      const result = applyDynamicOutlineToBookOutline(data, arch, targetWords);
      if (!Array.isArray(result?.chapters) || result.chapters.length === 0) return;

      const reserveWords = result.introWords ?? Math.max(700, Math.round(targetWords * 0.035));

      commit((draft) => ({
        ...draft,
        introduction: { ...normalizeIntro(draft.introduction), words: reserveWords },
        conclusion:   { ...normalizeConclusion(draft.conclusion), words: reserveWords },
        chapters:     result.chapters.map(normalizeChapter),
      }));
    } catch (e) {
      console.error("[generate-chapters]", e?.message);
    } finally {
      phaseTimers.forEach(clearTimeout);
      setGenChaptersBusy(false);
      setGenPhase("");
    }
  }

  // ─── Generate all sections for a chapter ──────────────────────────────────

  async function generateSections(chId, chapterTitle, sectionCount) {
    setGenSecsBusy((p) => ({ ...p, [chId]: true }));
    try {
      const bd = fullProject?.bookDetails || {};
      const ch = chapters.find((c) => c.id === chId);
      const data = await aiFetch("/api/ai/generate-sections", {
        bookTitle:      resolveBookTitle(fullProject),
        chapterTitle,
        sectionCount:   Math.max(1, sectionCount),
        corePromise:    bd.corePromise    || "",
        coreThesis:     bd.coreThesis     || "",
        chapterPurpose: ch?.objective     || ch?.summary || "",
        research:       fullProject?.research,
      });

      // Prefer rich objects (new format); fall back to title strings (legacy)
      const richSections = Array.isArray(data.sections) ? data.sections : [];
      const fallbackTitles = Array.isArray(data.titles) ? data.titles : [];
      const raw = richSections.length > 0
        ? richSections
        : fallbackTitles.map((t) => ({ title: t, objective: "" }));

      // Enforce exact count — never let the AI add more sections than the chapter has
      const items = raw.slice(0, Math.max(1, sectionCount));

      if (items.length === 0) return;

      updateChapterById(chId, (chapter) => {
        const chWords = Number(chapter.words) || 1200;
        const secWords = Math.max(150, Math.round(chWords / Math.max(items.length, 1)));
        return normalizeChapter({
          ...chapter,
          expanded: true,
          sections: items.map((item) => normalizeSection({
            ...newSectionSkeleton(secWords),
            title:               item.title               || "New section",
            objective:           item.objective           || "",
            blueprintComponents: Array.isArray(item.blueprintComponents) ? item.blueprintComponents : [],
          })),
        });
      });
    } catch (e) {
      console.error("[generate-sections]", e?.message);
    } finally {
      setGenSecsBusy((p) => { const n = { ...p }; delete n[chId]; return n; });
    }
  }

  // ─── Generate all subsections for a section ───────────────────────────────

  async function generateSubsections(chId, secId, chapterTitle, sectionTitle, subsectionCount) {
    const key = `${chId}::${secId}`;
    setGenSubsBusy((p) => ({ ...p, [key]: true }));
    try {
      const data = await aiFetch("/api/ai/generate-subsections", {
        chapterTitle,
        sectionTitle,
        subsectionCount: Math.max(1, subsectionCount),
        research: fullProject?.research,
      });

      // Prefer rich objects (new format); fall back to title strings (legacy)
      const richSubs = Array.isArray(data.subsections) ? data.subsections : [];
      const fallbackTitles = Array.isArray(data.titles) ? data.titles : [];
      const items = richSubs.length > 0
        ? richSubs
        : fallbackTitles.map((t) => ({ title: t, purpose: "" }));

      if (items.length === 0) return;

      updateSectionById(chId, secId, (s) => ({
        ...s,
        expanded: true,
        subsections: items.map((item) => ({
          id:      safeId(),
          title:   item.title   || "New subsection",
          purpose: item.purpose || "",
          words:   Math.max(80, Math.round(Number(s.words || 400) / Math.max(items.length, 1))),
        })),
      }));
    } catch (e) {
      console.error("[generate-subsections]", e?.message);
    } finally {
      setGenSubsBusy((p) => { const n = { ...p }; delete n[key]; return n; });
    }
  }

  // ─── Regenerate a single title ────────────────────────────────────────────

  async function regenTitle({ level, id, currentTitle, parentChapterId, parentSectionId }) {
    setRegenBusy((prev) => ({ ...prev, [id]: true }));
    try {
      const parentChapter = parentChapterId
        ? chapters.find((c) => c.id === parentChapterId)?.title
        : undefined;
      const parentSection = parentSectionId
        ? chapters
            .find((c) => c.id === parentChapterId)
            ?.sections?.find((s) => s.id === parentSectionId)?.title
        : undefined;

      let data;
      try {
        data = await aiFetch("/api/ai/regenerate-title", {
          level,
          currentTitle,
          parentChapter,
          parentSection,
          architecture: arch,
          research: fullProject?.research,
        });
      } catch (err) {
        if (err instanceof GenerationCanceledError) return;
        throw err;
      }
      const newTitle = data.title || currentTitle;

      if (level === "chapter") {
        updateChapterById(id, (c) => ({ ...c, title: newTitle }));
      } else if (level === "section") {
        updateSectionById(parentChapterId, id, (s) => ({ ...s, title: newTitle }));
      } else {
        // subsection
        updateSectionById(parentChapterId, parentSectionId, (s) => ({
          ...s,
          subsections: (s.subsections || []).map((su) =>
            su.id === id ? { ...su, title: newTitle } : su
          ),
        }));
      }
    } catch (e) {
      // silently ignore — title stays unchanged
    } finally {
      setRegenBusy((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const rowShell =
    "flex flex-wrap items-start gap-x-5 gap-y-3 rounded-xl border border-slate-200/95 bg-white/95 px-3 py-3 shadow-sm md:flex-nowrap md:px-4 md:py-3.5";

  return (
    <div className="mx-auto max-w-5xl pb-24">
      <p className="text-sm leading-relaxed text-slate-600">
        Structure follows your Research niche architecture — beats, pacing, and escalation are sub-niche specific.
      </p>

      {arch && (
        <aside className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-xs text-indigo-950">
          <span className="font-semibold">{arch.mainNicheLabel} › {arch.subNicheLabel}</span>
          <span className="text-indigo-800"> · {arch.pacingType} · {arch.structureType}</span>
        </aside>
      )}

      {/* Toolbar */}
      <section className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={genChaptersBusy || !arch}
            onClick={generateChapters}
            title={arch ? "Generate chapters with dynamic sections and word counts" : "Complete the Research step first to enable chapter generation"}
            className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {genChaptersBusy ? (
              <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />Generating…</>
            ) : (
              "✦ Generate Chapters"
            )}
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <button
            type="button"
            onClick={() => setAllExpanded(true)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setAllExpanded(false)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Collapse all
          </button>
        </div>

        {genChaptersBusy && genPhase && (
          <div className="flex items-center gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2.5">
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-indigo-400 border-t-indigo-700" />
            <span className="text-xs font-medium text-indigo-800">{genPhase}</span>
          </div>
        )}
      </section>

      <div className="mt-8 space-y-4">

        {/* Introduction */}
        <div className={rowShell}>
          <div className="flex min-w-0 flex-[2] gap-3">
            <EditableTitle dense value={intro.title} onCommit={(t) => patchIntro({ title: t || "Introduction" })} />
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-slate-600">
            Words
            <input
              type="number" min={0}
              className="input-light w-[6.25rem] py-2 text-xs"
              value={Number(intro.words) || 0}
              onChange={(e) => patchIntro({ words: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        </div>

        {/* Chapters */}
        {chapters.map((ch, ci) => {
          const secs = Array.isArray(ch.sections) ? ch.sections : [];
          return (
            <div key={ch.id} className="space-y-2">
              {/* Chapter row */}
              <div className={rowShell}>
                <div className="min-w-0 flex-[2] md:max-w-xl">
                  <div className="flex items-start gap-1">
                    <EditableTitle
                      dense
                      value={ch.title}
                      onCommit={(t) => updateChapterById(ch.id, () => ({ ...ch, title: t || `Chapter ${ci + 1}` }))}
                    />
                    <RegenBtn
                      busy={!!regenBusy[ch.id]}
                      onClick={() => regenTitle({ level: "chapter", id: ch.id, currentTitle: ch.title })}
                      title="Regenerate chapter title"
                    />
                  </div>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-3 md:justify-end lg:gap-5">
                  <label className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-slate-700">
                    Sections
                    <select
                      className="input-light w-[4.75rem] py-2 text-xs font-medium"
                      value={Math.min(secs.length, 15)}
                      onChange={(e) => updateChapterById(ch.id, (c) => resizeChapterSections(c, Number(e.target.value)))}
                    >
                      {[0, ...COUNT_OPTS].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  {(() => {
                    const secBusy  = !!genSecsBusy[ch.id];
                    const secCount = Math.max(1, Math.min(secs.length, 15)) || 3;
                    return (
                      <button
                        type="button"
                        disabled={secBusy || secCount === 0}
                        title={`Generate ${secCount} section title${secCount !== 1 ? "s" : ""} for this chapter using the AI engine`}
                        onClick={() => generateSections(ch.id, ch.title, secCount)}
                        className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                      >
                        {secBusy
                          ? <><span className="h-2.5 w-2.5 animate-spin rounded-full border border-violet-300 border-t-violet-600" />Gen…</>
                          : "✦ Sections"
                        }
                      </button>
                    );
                  })()}
                  <label className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-slate-700">
                    Words
                    <input
                      type="number" min={0}
                      className="input-light w-[6.75rem] py-2 text-xs"
                      value={Number(ch.words) || 0}
                      onChange={(e) => updateChapterById(ch.id, () => ({ ...ch, words: Math.max(0, Number(e.target.value) || 0) }))}
                    />
                  </label>
                  <div className="flex items-center gap-1">
                    <button type="button" title="Remove chapter" onClick={() => deleteChapter(ch.id)}
                      className="rounded-lg px-2 py-1.5 text-lg text-red-600 transition hover:bg-red-50">🗑</button>
                    <button
                      type="button"
                      aria-expanded={ch.expanded !== false}
                      onClick={() => updateChapterById(ch.id, (c) => ({ ...c, expanded: !(c.expanded !== false) }))}
                      className="rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-slate-100"
                    >
                      {ch.expanded === false ? "▼" : "▲"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sections */}
              {ch.expanded !== false && (
                secs.length === 0 ? (
                  <div className="ml-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/85 px-4 py-8 text-center text-sm text-slate-600 md:ml-10">
                    No sections yet. Increase the Sections count above, tap{" "}
                    <span className="font-semibold text-slate-800">+ Add section</span>, or pick a nonzero count.
                  </div>
                ) : (
                  secs.map((sec, si) => {
                    const subs = Array.isArray(sec.subsections) ? sec.subsections : [];
                    const displaySec = `${ci + 1}.${si + 1}`;
                    return (
                      <div key={sec.id} className="ml-4 border-l border-sky-100 pl-4 md:ml-8 md:pl-6">
                        {/* Section row */}
                        <div className={rowShell}>
                          <div className="min-w-0 flex-[2]">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 shrink-0 text-[11px] font-bold uppercase tracking-wide text-sky-700">{displaySec}</span>
                              <div className="min-w-0 flex-1 flex items-start gap-1">
                                <EditableTitle
                                  dense
                                  key={`${sec.id}-t`}
                                  value={sec.title}
                                  onCommit={(t) => updateSectionById(ch.id, sec.id, () => ({ ...sec, title: t || displaySec }))}
                                />
                                <RegenBtn
                                  busy={!!regenBusy[sec.id]}
                                  onClick={() => regenTitle({
                                    level: "section",
                                    id: sec.id,
                                    currentTitle: sec.title,
                                    parentChapterId: ch.id,
                                  })}
                                  title="Regenerate section title"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-1 flex-wrap items-center gap-3 md:justify-end lg:gap-5">
                            <label className="flex items-center gap-2 whitespace-nowrap text-[11px] font-semibold text-slate-700">
                              Subsections
                              <select
                                className="input-light w-[4.75rem] py-2 text-[11px] font-medium"
                                value={Math.min(subs.length, 15)}
                                onChange={(e) => updateSectionById(ch.id, sec.id, (s) => resizeSectionSubs(s, Number(e.target.value)))}
                              >
                                {[0, ...COUNT_OPTS].map((v) => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </label>
                            {(() => {
                              const subKey = `${ch.id}::${sec.id}`;
                              const busy   = !!genSubsBusy[subKey];
                              const count  = Math.max(1, Math.min(subs.length, 15)) || 3;
                              return (
                                <button
                                  type="button"
                                  disabled={busy || count === 0}
                                  title={`Generate ${count} subsection title${count !== 1 ? "s" : ""} using the AI engine`}
                                  onClick={() => generateSubsections(ch.id, sec.id, ch.title, sec.title, count)}
                                  className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                                >
                                  {busy
                                    ? <><span className="h-2.5 w-2.5 animate-spin rounded-full border border-violet-300 border-t-violet-600" />Gen…</>
                                    : "✦ Gen"
                                  }
                                </button>
                              );
                            })()}
                            <label className="flex items-center gap-2 whitespace-nowrap text-[11px] font-semibold text-slate-700">
                              Words
                              <input
                                type="number" min={0}
                                className="input-light w-[6.5rem] py-2 text-[11px]"
                                value={Number(sec.words) || 0}
                                onChange={(e) => updateSectionById(ch.id, sec.id, () => ({ ...sec, words: Math.max(0, Number(e.target.value) || 0) }))}
                              />
                            </label>
                            <div className="flex items-center gap-1">
                              {(() => {
                                const bc = Array.isArray(sec.blueprintComponents) ? sec.blueprintComponents : [];
                                const isOpen = !!blueprintOpenMap[sec.id];
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setBlueprintOpenMap((p) => ({ ...p, [sec.id]: !p[sec.id] }))}
                                    title="Set section blueprint components"
                                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition ${
                                      bc.length > 0
                                        ? "border-violet-300 bg-violet-100 text-violet-700 hover:bg-violet-200"
                                        : "border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600"
                                    }`}
                                  >
                                    ◆ {bc.length > 0 ? `${bc.length}` : "Blueprint"}
                                  </button>
                                );
                              })()}
                              <button type="button" aria-label="Delete section"
                                onClick={() => patchChaptersUpdater((cs) =>
                                  cs.map((cx) => cx.id !== ch.id ? cx : { ...cx, sections: (cx.sections || []).filter((s) => s.id !== sec.id) })
                                )}
                                className="rounded-lg px-2 py-1.5 text-base text-red-600 transition hover:bg-red-50">🗑</button>
                              <button
                                type="button"
                                aria-expanded={sec.expanded !== false}
                                onClick={() => updateSectionById(ch.id, sec.id, (s) => ({ ...s, expanded: !(s.expanded !== false) }))}
                                className="rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-slate-100"
                              >
                                {sec.expanded === false ? "▼" : "▲"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Blueprint Picker */}
                        {blueprintOpenMap[sec.id] && (
                          <div className="mt-1 ml-0">
                            <BlueprintPicker
                              selected={sec.blueprintComponents || []}
                              onChange={(next) =>
                                updateSectionById(ch.id, sec.id, (s) => ({ ...s, blueprintComponents: next }))
                              }
                            />
                          </div>
                        )}

                        {/* Subsections */}
                        {sec.expanded !== false && (
                          subs.length === 0 ? (
                            <div className="relative mt-2 ml-6 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-600 md:ml-8">
                              No subsections yet.
                              <button type="button" onClick={() => addSubsection(ch.id, sec.id)}
                                className="mt-2 block w-full rounded-lg bg-gradient-to-r from-sky-600 to-sky-500 py-2.5 text-xs font-semibold text-white md:inline md:w-auto md:px-6">
                                + Add subsection
                              </button>
                            </div>
                          ) : (
                            <>
                              {subs.map((su, qi) => {
                                const slug = `${ci + 1}.${si + 1}.${qi + 1}`;
                                return (
                                  <div key={su.id} className="relative mt-2 ml-8 md:ml-12">
                                    <div className={`${rowShell} border-sky-100/85 py-3`}>
                                      <div className="min-w-0 flex-[2]">
                                        <div className="flex items-start gap-2">
                                          <span className="mt-0.5 shrink-0 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sky-800">{slug}</span>
                                          <div className="min-w-0 flex-1 flex items-start gap-1">
                                            <EditableTitle
                                              dense
                                              key={`${su.id}-t`}
                                              value={su.title}
                                              onCommit={(t) =>
                                                updateSectionById(ch.id, sec.id, (s0) => ({
                                                  ...s0,
                                                  subsections: subs.map((x) => x.id === su.id ? { ...x, title: t || slug } : x),
                                                }))
                                              }
                                            />
                                            <RegenBtn
                                              busy={!!regenBusy[su.id]}
                                              onClick={() => regenTitle({
                                                level: "subsection",
                                                id: su.id,
                                                currentTitle: su.title,
                                                parentChapterId: ch.id,
                                                parentSectionId: sec.id,
                                              })}
                                              title="Regenerate subsection title"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                      <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[11px] font-semibold text-slate-700">
                                        Words
                                        <input
                                          type="number" min={0}
                                          className="input-light w-[6rem] py-2 text-[11px]"
                                          value={Number(su.words) || 0}
                                          onChange={(e) =>
                                            updateSectionById(ch.id, sec.id, (s0) => ({
                                              ...s0,
                                              subsections: (s0.subsections || []).map((x) =>
                                                x.id === su.id ? { ...x, words: Math.max(0, Number(e.target.value) || 0) } : x
                                              ),
                                            }))
                                          }
                                        />
                                      </label>
                                      <button type="button" aria-label="Delete subsection"
                                        onClick={() =>
                                          updateSectionById(ch.id, sec.id, () => ({
                                            ...sec,
                                            subsections: subs.filter((x) => x.id !== su.id),
                                          }))
                                        }
                                        className="rounded-lg px-2 py-1.5 text-sm text-red-600 transition hover:bg-red-50">🗑</button>
                                    </div>
                                  </div>
                                );
                              })}
                              <button type="button" onClick={() => addSubsection(ch.id, sec.id)}
                                className="mb-4 ml-8 mt-2 rounded-xl border border-sky-200 bg-gradient-to-r from-sky-600 to-sky-500 px-5 py-2 text-[11px] font-semibold text-white shadow-md transition hover:from-sky-700 hover:to-sky-600 md:ml-12">
                                + Add subsection
                              </button>
                            </>
                          )
                        )}
                      </div>
                    );
                  })
                )
              )}

              {ch.expanded !== false && secs.length > 0 && (
                <button type="button" onClick={() => addSectionToChapter(ch.id, ci)}
                  className="mb-6 ml-4 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:from-sky-700 hover:to-sky-600 md:ml-8">
                  + Add section
                </button>
              )}
            </div>
          );
        })}

        {/* Conclusion */}
        <div className={`${rowShell} mt-10`}>
          <div className="flex min-w-0 flex-[2] gap-3">
            <EditableTitle dense value={conclusion.title} onCommit={(t) => patchConclusion({ title: t || "Conclusion" })} />
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-slate-600">
            Words
            <input
              type="number" min={0}
              className="input-light w-[6.25rem] py-2 text-xs"
              value={Number(conclusion.words) || 0}
              onChange={(e) => patchConclusion({ words: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        </div>
      </div>

      <div className="mt-12 flex justify-center">
        <button type="button" onClick={addChapterRow}
          className="rounded-xl border-2 border-slate-900/85 bg-white px-10 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">
          + Add chapter
        </button>
      </div>
    </div>
  );
}
