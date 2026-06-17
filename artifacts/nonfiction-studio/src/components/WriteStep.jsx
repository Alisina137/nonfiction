import { useEffect, useMemo, useState } from "react";
import {
  blockHasContent,
  collectPreviousConcepts,
  countDraftedBlocks,
  enumerateWriteBlocks,
  lessonToProse
} from "@/lib/writeBlocks";
import { aiFetch, GenerationCanceledError } from "@/lib/ai/aiFetch";
import { buildBookContext } from "@/lib/bookContext";

const IMPROVE_ACTIONS = [
  { id: "sharpen",     label: "Sharpen clarity" },
  { id: "shorten",     label: "Tighten length" },
  { id: "expand",      label: "Add depth" },
  { id: "add_example", label: "Add example" }
];

function writingTone(fp) {
  const d = fp?.bookDetails || {};
  const r = fp?.research || {};
  if (d.tone?.trim()) return d.tone.trim();
  if (Array.isArray(r.authorTones) && r.authorTones.length) return r.authorTones.join("; ");
  return fp?.tone || "Direct & practical";
}
function writingAudience(fp) {
  const d = fp?.bookDetails || {};
  const r = fp?.research || {};
  return d.audience?.trim() || r.targetAudience?.trim() || fp?.audience || "";
}
function bookStructureVal(fp) {
  return fp?.bookDetails?.structure || fp?.research?.structure || "";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GenerateBtn({ busy, hasContent, disabled, onClick, small }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        small
          ? "flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
          : "flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 shadow-sm transition hover:bg-violet-100 disabled:opacity-50"
      }
    >
      {busy
        ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />Writing…</>
        : hasContent ? "↻ Regenerate" : "✦ Generate"
      }
    </button>
  );
}

/** Renders the content area for one write block. */
function BlockContent({ blockId, lessons, busyId, isBusy, onGenerate, onImprove, onSetProse }) {
  const prose      = String(lessons?.[blockId]?.prose || "").trim();
  const hasContent = blockHasContent(lessons, blockId);
  const isThisBusy = busyId === blockId;
  const lesson     = lessons?.[blockId]?.lesson;

  if (isThisBusy && !hasContent) {
    return (
      <div className="mt-3 flex items-center gap-2 text-slate-400">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
        <span className="text-sm">Writing this section…</span>
      </div>
    );
  }

  if (!hasContent) {
    return (
      <div className="mt-3">
        <GenerateBtn
          busy={isThisBusy}
          hasContent={false}
          disabled={isBusy}
          onClick={onGenerate}
          small={false}
        />
      </div>
    );
  }

  return (
    <div className="mt-3">
      <textarea
        className="w-full resize-y rounded-xl border border-slate-200 bg-white/70 px-4 py-3 font-[inherit] text-[15px] leading-[1.8] text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
        style={{ minHeight: 280 }}
        value={prose}
        onChange={(e) => onSetProse(blockId, e.target.value)}
        disabled={isThisBusy}
      />
      {lesson?.keyTakeaway && (
        <p className="mt-1.5 text-xs text-slate-400">
          Key takeaway: <span className="font-medium text-slate-600">{lesson.keyTakeaway}</span>
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <GenerateBtn busy={isThisBusy} hasContent disabled={isBusy} onClick={onGenerate} small />
        <span className="text-slate-200">|</span>
        {IMPROVE_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={isBusy}
            onClick={() => onImprove(blockId, action.id)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-sky-200 hover:bg-sky-50/60 disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WriteStep({
  bookOutline,
  lessons,
  setLessons,
  fullProject,
  currentStep,
  writeStepIndex,
  errors
}) {
  // Flat block list — used ONLY for AI generation logic and progress counting
  const blocks = useMemo(() => enumerateWriteBlocks(bookOutline), [bookOutline]);

  // Fast lookup: subsection/section/intro/conclusion ID → block object
  const blockById = useMemo(() => {
    const map = new Map();
    for (const b of blocks) map.set(b.id, b);
    return map;
  }, [blocks]);

  const [expandedChapters, setExpandedChapters] = useState({});
  const [busyId,           setBusyId]           = useState(null);
  const [batchBusy,        setBatchBusy]        = useState(false);
  const [status,           setStatus]           = useState("");
  const [chapterStrategies, setChapterStrategies] = useState({});

  const progress = useMemo(() => countDraftedBlocks(blocks, lessons), [blocks, lessons]);

  // Outline nodes
  const outline     = bookOutline && typeof bookOutline === "object" ? bookOutline : {};
  const intro       = outline.introduction;
  const conclusion  = outline.conclusion;
  const chapters    = Array.isArray(outline.chapters) ? outline.chapters : [];

  // Auto-expand first chapter that has empty blocks on entering Write step
  useEffect(() => {
    if (currentStep !== writeStepIndex) return;
    if (!blocks.length) return;
    const firstEmpty = blocks.find((b) => !blockHasContent(lessons, b.id));
    if (!firstEmpty?.chapterKey) return;
    setExpandedChapters((prev) => {
      if (prev[firstEmpty.chapterKey] !== undefined) return prev;
      return { ...prev, [firstEmpty.chapterKey]: true };
    });
  }, [currentStep, writeStepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  function setAllExpanded(expanded) {
    const next = {};
    chapters.forEach((ch, ci) => { next[ch.id || `ch-${ci}`] = expanded; });
    if (intro?.id)      next["__intro__"]      = expanded;
    if (conclusion?.id) next["__conclusion__"] = expanded;
    setExpandedChapters(next);
  }

  // ─── Lesson helpers ────────────────────────────────────────────────────────

  function patchLesson(blockId, patch) {
    setLessons((prev) => {
      const base = prev && typeof prev === "object" ? prev : {};
      const cur  = base[blockId] && typeof base[blockId] === "object" ? base[blockId] : {};
      return { ...base, [blockId]: { ...cur, ...patch, updatedAt: new Date().toISOString() } };
    });
  }

  function setProse(blockId, prose) { patchLesson(blockId, { prose }); }

  // ─── Generation helpers ────────────────────────────────────────────────────

  async function fetchChapterStrategy(block, strategyCache) {
    const key = block.chapterKey;
    if (!key || key === "__intro__" || key === "__conclusion__") return null;
    if (strategyCache[key]) return strategyCache[key];
    try {
      setStatus(`Building writing strategy for "${block.chapterContext?.title}"…`);
      const data = await aiFetch("/api/ai/chapter-strategy", {
        chapterTitle:   block.chapterContext?.title   || "",
        chapterNumber:  block.chapterContext?.number  || "",
        chapterPurpose: block.chapterContext?.summary || "",
        sectionTitles:  block.chapterContext?.sectionTitles || [],
        bookStructure:  bookStructureVal(fullProject),
        bookTone:       writingTone(fullProject),
        bookContext:    buildBookContext(fullProject)
      });
      const strategy = data.strategy || null;
      if (strategy) setChapterStrategies((prev) => ({ ...prev, [key]: strategy }));
      return strategy;
    } catch { return null; }
  }

  async function generateBlock(block, lessonsSnapshot = lessons, strategyCache = chapterStrategies) {
    const index = blocks.findIndex((b) => b.id === block.id);
    setBusyId(block.id);
    setStatus("");
    try {
      const chapterStrategy = await fetchChapterStrategy(block, strategyCache);
      const updatedCache    = chapterStrategy && block.chapterKey
        ? { ...strategyCache, [block.chapterKey]: chapterStrategy }
        : strategyCache;
      const data = await aiFetch("/api/ai/lesson", {
        subsection:       block.subsection,
        chapterContext:   block.chapterContext,
        previousConcepts: collectPreviousConcepts(blocks, lessonsSnapshot, index),
        audience:         writingAudience(fullProject),
        tone:             writingTone(fullProject),
        resources:        fullProject?.resources ?? null,
        bookContext:      buildBookContext(fullProject),
        bookStructure:    bookStructureVal(fullProject),
        sectionTitle:     block.sectionTitle || null,
        chapterStrategy:  chapterStrategy || null
      }, { noCache: true });
      const lesson = data.lesson || data;
      const prose  = lessonToProse(lesson);
      const entry  = { lesson, prose, generatedAt: new Date().toISOString() };
      patchLesson(block.id, entry);
      setStatus(`Drafted "${block.label}".`);
      const newSnapshot = { ...lessonsSnapshot, [block.id]: { ...entry, updatedAt: new Date().toISOString() } };
      return { snapshot: newSnapshot, strategyCache: updatedCache };
    } catch (e) {
      if (e instanceof GenerationCanceledError) setStatus("Generation canceled.");
      else setStatus(e.message || "Could not generate this section.");
      return { snapshot: lessonsSnapshot, strategyCache };
    } finally {
      setBusyId(null);
    }
  }

  async function improveBlock(blockId, action) {
    const block = blockById.get(blockId);
    const prose = String(lessons?.[blockId]?.prose || "").trim();
    if (!block || !prose) return;
    setBusyId(blockId);
    setStatus("");
    try {
      const data = await aiFetch("/api/ai/improve", {
        action,
        currentText:     prose,
        tone:            writingTone(fullProject),
        audience:        writingAudience(fullProject),
        bookStructure:   bookStructureVal(fullProject),
        subsectionTitle: block.label || "",
        bookContext:     buildBookContext(fullProject)
      });
      if (data.text) setProse(blockId, data.text);
      else setStatus("Refinement returned empty text — your draft was kept.");
      if (data.text) setStatus("Applied AI refinement.");
    } catch (e) {
      if (e instanceof GenerationCanceledError) setStatus("Refinement canceled.");
      else setStatus(e.message || "Could not refine text.");
    } finally {
      setBusyId(null);
    }
  }

  async function generateChapter(chKey) {
    const chBlocks = blocks.filter((b) => b.chapterKey === chKey);
    if (!chBlocks.length) return;
    setBatchBusy(true);
    setStatus("Generating chapter sections…");
    let snapshot      = lessons && typeof lessons === "object" ? { ...lessons } : {};
    let strategyCache = { ...chapterStrategies };
    try {
      for (const block of chBlocks) {
        if (blockHasContent(snapshot, block.id)) continue;
        const result  = await generateBlock(block, snapshot, strategyCache);
        snapshot      = result.snapshot      || snapshot;
        strategyCache = result.strategyCache || strategyCache;
      }
      setStatus("Chapter sections drafted.");
    } finally {
      setBatchBusy(false);
    }
  }

  async function generateRemaining() {
    if (!blocks.length) return;
    setBatchBusy(true);
    setStatus("Generating remaining sections…");
    let snapshot      = lessons && typeof lessons === "object" ? { ...lessons } : {};
    let strategyCache = { ...chapterStrategies };
    const failed      = [];
    try {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (blockHasContent(snapshot, block.id)) continue;
        setExpandedChapters((p) => ({ ...p, [block.chapterKey]: true }));
        const before = snapshot;
        const result = await generateBlock(block, snapshot, strategyCache);
        snapshot      = result.snapshot      || snapshot;
        strategyCache = result.strategyCache || strategyCache;
        if (snapshot === before || !blockHasContent(snapshot, block.id)) failed.push(block.label);
      }
      setStatus(
        failed.length
          ? `Batch done — ${failed.length} section${failed.length > 1 ? "s" : ""} failed: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""}`
          : "All sections drafted."
      );
    } finally {
      setBatchBusy(false);
    }
  }

  // ─── Empty state ───────────────────────────────────────────────────────────

  if (!blocks.length) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <div className="book-panel">
          <p className="text-sm text-slate-600">
            Your outline has no draft targets yet. Go back to{" "}
            <span className="font-semibold">Outline</span> and add chapters with sections before writing.
          </p>
        </div>
      </div>
    );
  }

  // ─── Derived values ────────────────────────────────────────────────────────

  const pct    = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const isBusy = Boolean(busyId) || batchBusy;

  // ─── Render helpers ────────────────────────────────────────────────────────

  /** Renders intro or conclusion as a standalone manuscript section. */
  function renderFrontBackMatter(node, chKey, label) {
    if (!node?.id) return null;
    const block      = blockById.get(node.id);
    if (!block) return null;
    const isExpanded = expandedChapters[chKey] !== false;
    const hasContent = blockHasContent(lessons, node.id);

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-8 py-5">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[1px] text-slate-400">{label}</p>
            <h2 className="mt-1 text-[20px] font-semibold leading-snug text-slate-900">{node.title || label}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasContent && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                Drafted
              </span>
            )}
            <button
              type="button"
              onClick={() => setExpandedChapters((p) => ({ ...p, [chKey]: p[chKey] === false ? true : !isExpanded }))}
              className="rounded-lg px-2 py-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-expanded={isExpanded}
            >
              {isExpanded ? "▲" : "▼"}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="px-8 pb-8 pt-5">
            <BlockContent
              blockId={node.id}
              lessons={lessons}
              busyId={busyId}
              isBusy={isBusy}
              onGenerate={() => generateBlock(block)}
              onImprove={improveBlock}
              onSetProse={setProse}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl pb-32">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <section className="flex flex-wrap items-center gap-3">
        {/* Progress */}
        <div className="flex min-w-[160px] flex-1 flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-600 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-slate-500">{pct}%</span>
          </div>
          <p className="text-[10px] text-slate-400">{progress.done} / {progress.total} sections drafted</p>
        </div>

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

        <div className="h-5 w-px bg-slate-200" />

        <button
          type="button"
          disabled={isBusy}
          onClick={generateRemaining}
          className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {batchBusy
            ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />Generating…</>
            : "✦ Generate rest of book"
          }
        </button>

        {errors?.form && <p className="ml-2 text-sm text-red-600">{errors.form}</p>}
      </section>

      {/* Status message */}
      {status && (
        <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          {status}
        </p>
      )}

      {/* ── Manuscript ──────────────────────────────────────────────────── */}
      <div className="mt-8 space-y-6">

        {/* Introduction */}
        {renderFrontBackMatter(intro, "__intro__", "Introduction")}

        {/* Chapters */}
        {chapters.map((ch, ci) => {
          const chKey      = ch.id || `ch-${ci}`;
          const chBlocks   = blocks.filter((b) => b.chapterKey === chKey);
          const chDone     = chBlocks.filter((b) => blockHasContent(lessons, b.id)).length;
          const isExpanded = expandedChapters[chKey] !== false;
          const sections   = Array.isArray(ch.sections) ? ch.sections : [];

          return (
            <div
              key={chKey}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              {/* Chapter header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-8 py-6">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-[1px] text-slate-400">
                    Chapter {ci + 1}
                  </p>
                  <h2 className="mt-1.5 text-[20px] font-semibold leading-tight tracking-tight text-slate-900">
                    {ch.title || `Chapter ${ci + 1}`}
                  </h2>
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {chDone}/{chBlocks.length}
                  </span>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => generateChapter(chKey)}
                    className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                  >
                    {batchBusy && chBlocks.some((b) => b.id === busyId)
                      ? <><span className="h-2.5 w-2.5 animate-spin rounded-full border border-violet-300 border-t-violet-600" />Writing…</>
                      : "✦ Generate chapter"
                    }
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedChapters((p) => ({ ...p, [chKey]: p[chKey] === false ? true : !isExpanded }))}
                    className="rounded-lg px-2 py-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>
              </div>

              {/* Expanded chapter body */}
              {isExpanded && (
                <div className="px-8 pb-10">
                  {sections.length === 0 ? (
                    <p className="pt-6 text-center text-sm text-slate-400">
                      No sections yet — add sections in the Outline step.
                    </p>
                  ) : (
                    sections.map((sec, si) => {
                      const subs      = Array.isArray(sec.subsections) ? sec.subsections : [];
                      const secNum    = `${ci + 1}.${si + 1}`;
                      const hasSubs   = subs.length > 0;

                      return (
                        /* ── Section ── 32px top margin */
                        <div key={sec.id || si} className="mt-8 first:mt-6">
                          {/* Section heading */}
                          <h3 className="text-[18px] font-medium text-slate-800">
                            <span className="mr-2 text-sky-600">{secNum}</span>
                            {sec.title || `Section ${secNum}`}
                          </h3>

                          {hasSubs ? (
                            /* Subsections */
                            subs.map((sub, qi) => {
                              const subNum  = `${secNum}.${qi + 1}`;
                              const block   = blockById.get(sub.id);
                              const hasContent = block ? blockHasContent(lessons, sub.id) : false;

                              return (
                                /* ── Subsection ── 16px top margin */
                                <div key={sub.id || qi} className="mt-4 pl-4 border-l-2 border-slate-100">
                                  {/* Subsection heading */}
                                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                    <h4 className="text-[16px] font-medium text-slate-700">
                                      <span className="mr-1.5 text-[13px] font-bold text-sky-500">{subNum}</span>
                                      {sub.title || `Subsection ${subNum}`}
                                    </h4>
                                    {hasContent && (
                                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                        Drafted
                                      </span>
                                    )}
                                  </div>

                                  {/* Content */}
                                  {block ? (
                                    <BlockContent
                                      blockId={sub.id}
                                      lessons={lessons}
                                      busyId={busyId}
                                      isBusy={isBusy}
                                      onGenerate={() => generateBlock(block)}
                                      onImprove={improveBlock}
                                      onSetProse={setProse}
                                    />
                                  ) : (
                                    <p className="mt-2 text-xs text-slate-400 italic">
                                      This subsection has no ID — save the outline again.
                                    </p>
                                  )}

                                  {/* 24px after content */}
                                  <div className="mt-6" />
                                </div>
                              );
                            })
                          ) : (
                            /* Section-level block (no subsections) */
                            (() => {
                              const block = blockById.get(sec.id);
                              return block ? (
                                <div className="mt-3 pl-4 border-l-2 border-slate-100">
                                  <BlockContent
                                    blockId={sec.id}
                                    lessons={lessons}
                                    busyId={busyId}
                                    isBusy={isBusy}
                                    onGenerate={() => generateBlock(block)}
                                    onImprove={improveBlock}
                                    onSetProse={setProse}
                                  />
                                  <div className="mt-6" />
                                </div>
                              ) : null;
                            })()
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Conclusion */}
        {renderFrontBackMatter(conclusion, "__conclusion__", "Conclusion")}

      </div>
    </div>
  );
}
