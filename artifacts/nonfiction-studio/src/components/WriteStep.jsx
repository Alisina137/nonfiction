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
  { id: "sharpen",    label: "Sharpen clarity" },
  { id: "shorten",   label: "Tighten length" },
  { id: "expand",    label: "Add depth" },
  { id: "add_example", label: "Add example" }
];

function writingTone(fullProject) {
  const d = fullProject?.bookDetails || {};
  const r = fullProject?.research || {};
  if (d.tone?.trim()) return d.tone.trim();
  if (Array.isArray(r.authorTones) && r.authorTones.length) return r.authorTones.join("; ");
  return fullProject?.tone || "Direct & practical";
}

function writingAudience(fullProject) {
  const d = fullProject?.bookDetails || {};
  const r = fullProject?.research || {};
  return d.audience?.trim() || r.targetAudience?.trim() || fullProject?.audience || "";
}

function bookStructureVal(fullProject) {
  return fullProject?.bookDetails?.structure || fullProject?.research?.structure || "";
}

function groupBlocksBySection(blocks) {
  const groups = [];
  const seen = new Map();
  for (const block of blocks) {
    const key = block.sectionTitle || block.id;
    if (!seen.has(key)) {
      const g = { sectionTitle: block.sectionTitle || block.label, blocks: [block] };
      groups.push(g);
      seen.set(key, g);
    } else {
      seen.get(key).blocks.push(block);
    }
  }
  return groups;
}

// ─── Block content row ─────────────────────────────────────────────────────────

function BlockRow({ block, lessons, busyId, isBusy, onGenerate, onImprove, onSetProse }) {
  const prose        = String(lessons?.[block.id]?.prose || "").trim();
  const hasContent   = blockHasContent(lessons, block.id);
  const isBlockBusy  = busyId === block.id;
  const lesson       = lessons?.[block.id]?.lesson;

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      {/* Block header row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 md:flex-nowrap">
        <span className="shrink-0 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sky-800">
          {block.breadcrumb}
        </span>
        <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-slate-800">
          {block.label}
        </p>
        {hasContent && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            Drafted
          </span>
        )}
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onGenerate(block)}
          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBlockBusy ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
              Writing…
            </>
          ) : hasContent ? "Regenerate" : "✦ Generate"}
        </button>
      </div>

      {/* Content area */}
      {isBlockBusy && !hasContent && (
        <div className="flex items-center gap-2 pb-4 pl-6">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
          <p className="text-xs text-slate-500">Writing this section…</p>
        </div>
      )}

      {hasContent && (
        <div className="px-4 pb-4 pl-6">
          <textarea
            className="input-light min-h-[160px] w-full resize-y font-[inherit] text-sm leading-relaxed"
            value={prose}
            onChange={(e) => onSetProse(block.id, e.target.value)}
            disabled={isBlockBusy}
          />
          {lesson?.keyTakeaway && (
            <p className="mt-1.5 text-xs text-slate-400">
              Key takeaway: <span className="font-medium text-slate-600">{lesson.keyTakeaway}</span>
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {IMPROVE_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={isBusy}
                onClick={() => onImprove(block.id, action.id)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/60 disabled:opacity-50"
              >
                {busyId === block.id ? "…" : action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Simple single-block card (intro / conclusion) ────────────────────────────

function SingleBlockCard({ block, label, lessons, busyId, isBusy, expandedChapters, setExpandedChapters, chKey, onGenerate, onImprove, onSetProse }) {
  const isExpanded = expandedChapters[chKey] !== false;
  const hasContent = blockHasContent(lessons, block.id);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/95 bg-white/95 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 md:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: hasContent ? "#10b981" : "#cbd5e1" }}
          />
          <p className="text-sm font-semibold text-slate-800">{label}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpandedChapters((p) => ({ ...p, [chKey]: p[chKey] === false ? true : !isExpanded }))}
          className="rounded-lg px-2 py-1.5 text-slate-500 transition hover:bg-slate-100"
          aria-expanded={isExpanded}
        >
          {isExpanded ? "▲" : "▼"}
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100">
          <BlockRow
            block={block}
            lessons={lessons}
            busyId={busyId}
            isBusy={isBusy}
            onGenerate={onGenerate}
            onImprove={onImprove}
            onSetProse={onSetProse}
          />
        </div>
      )}
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
  const blocks     = useMemo(() => enumerateWriteBlocks(bookOutline), [bookOutline]);
  const [expandedChapters, setExpandedChapters] = useState({});
  const [busyId,       setBusyId]       = useState(null);
  const [batchBusy,    setBatchBusy]    = useState(false);
  const [status,       setStatus]       = useState("");
  const [chapterStrategies, setChapterStrategies] = useState({});

  const progress = useMemo(() => countDraftedBlocks(blocks, lessons), [blocks, lessons]);
  const chapters = Array.isArray(bookOutline?.chapters) ? bookOutline.chapters : [];
  const introBlock     = useMemo(() => blocks.find((b) => b.kind === "introduction") || null, [blocks]);
  const conclusionBlock = useMemo(() => blocks.find((b) => b.kind === "conclusion") || null, [blocks]);

  // Auto-expand first chapter with empty blocks when entering this step
  useEffect(() => {
    if (currentStep !== writeStepIndex) return;
    if (!blocks.length) return;
    const firstEmpty = blocks.find((b) => !blockHasContent(lessons, b.id));
    if (!firstEmpty) return;
    setExpandedChapters((prev) => {
      const key = firstEmpty.chapterKey;
      if (key && prev[key] !== undefined) return prev;
      return key ? { ...prev, [key]: true } : prev;
    });
  }, [currentStep, writeStepIndex, blocks, lessons]);

  function setAllExpanded(expanded) {
    const next = {};
    chapters.forEach((ch, ci) => { next[ch.id || `ch-${ci}`] = expanded; });
    if (introBlock)      next["__intro__"]      = expanded;
    if (conclusionBlock) next["__conclusion__"]  = expanded;
    setExpandedChapters(next);
  }

  function patchLesson(blockId, patch) {
    setLessons((prev) => {
      const base = prev && typeof prev === "object" ? prev : {};
      const cur  = base[blockId] && typeof base[blockId] === "object" ? base[blockId] : {};
      return { ...base, [blockId]: { ...cur, ...patch, updatedAt: new Date().toISOString() } };
    });
  }

  function setProse(blockId, prose) {
    patchLesson(blockId, { prose });
  }

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
    const block = blocks.find((b) => b.id === blockId);
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
        subsectionTitle: block?.label || "",
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

  async function generateChapter(chapterKey) {
    const chBlocks = blocks.filter((b) => b.chapterKey === chapterKey);
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
    const failed = [];
    try {
      for (let i = 0; i < blocks.length; i++) {
        const block  = blocks[i];
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
          : "Batch generation finished — all sections drafted."
      );
    } finally {
      setBatchBusy(false);
    }
  }

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

  const pct    = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const isBusy = Boolean(busyId) || batchBusy;

  const rowShell =
    "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200/95 bg-white/95 px-4 py-3.5 shadow-sm md:flex-nowrap";

  return (
    <div className="mx-auto max-w-5xl pb-24">

      {/* ── Toolbar ── */}
      <section className="flex flex-wrap items-center gap-3">
        {/* Progress */}
        <div className="flex min-w-[180px] flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-600 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-slate-500">{pct}%</span>
          </div>
          <p className="text-[10px] text-slate-400">{progress.done}/{progress.total} sections drafted</p>
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
          {batchBusy ? (
            <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />Generating…</>
          ) : (
            "✦ Generate rest of book"
          )}
        </button>

        {errors?.form && <p className="text-sm text-red-600">{errors.form}</p>}
      </section>

      {/* Status message */}
      {status && (
        <p className="mt-3 rounded-lg bg-slate-50 px-4 py-2 text-xs text-slate-600 border border-slate-100">
          {status}
        </p>
      )}

      <div className="mt-6 space-y-3">

        {/* ── Introduction ── */}
        {introBlock && (
          <SingleBlockCard
            block={introBlock}
            label="Introduction"
            chKey="__intro__"
            lessons={lessons}
            busyId={busyId}
            isBusy={isBusy}
            expandedChapters={expandedChapters}
            setExpandedChapters={setExpandedChapters}
            onGenerate={generateBlock}
            onImprove={improveBlock}
            onSetProse={setProse}
          />
        )}

        {/* ── Chapters ── */}
        {chapters.map((ch, ci) => {
          const chKey      = ch.id || `ch-${ci}`;
          const chBlocks   = blocks.filter((b) => b.chapterKey === chKey);
          const chDone     = chBlocks.filter((b) => blockHasContent(lessons, b.id)).length;
          const isExpanded = expandedChapters[chKey] !== false;
          const sectionGroups = groupBlocksBySection(chBlocks);
          const chBusy     = batchBusy && chBlocks.some((b) => b.id === busyId);

          return (
            <div key={chKey} className="overflow-hidden rounded-xl border border-slate-200/95 bg-white/95 shadow-sm">

              {/* Chapter header row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 md:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Chapter {ci + 1}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{ch.title}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {chDone}/{chBlocks.length}
                  </span>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => generateChapter(chKey)}
                    className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                  >
                    {chBusy
                      ? <><span className="h-2.5 w-2.5 animate-spin rounded-full border border-violet-300 border-t-violet-600" />Gen…</>
                      : "✦ Generate chapter"
                    }
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpandedChapters((p) => ({ ...p, [chKey]: p[chKey] === false ? true : !isExpanded }))}
                    className="rounded-lg px-2 py-1.5 text-slate-500 transition hover:bg-slate-100"
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>
              </div>

              {/* Expanded: sections + blocks */}
              {isExpanded && (
                <div className="border-t border-slate-100">
                  {chBlocks.length === 0 ? (
                    <p className="px-6 py-6 text-center text-sm text-slate-500">
                      No blocks in this chapter. Add sections and subsections in the Outline step first.
                    </p>
                  ) : (
                    sectionGroups.map((group) => (
                      <div key={group.sectionTitle || group.blocks[0]?.id}>
                        {/* Section heading */}
                        {group.sectionTitle && (
                          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {group.sectionTitle}
                            </p>
                          </div>
                        )}

                        {/* Blocks in this section */}
                        <div className="ml-4 border-l border-sky-100 pl-2">
                          {group.blocks.map((block) => (
                            <BlockRow
                              key={block.id}
                              block={block}
                              lessons={lessons}
                              busyId={busyId}
                              isBusy={isBusy}
                              onGenerate={generateBlock}
                              onImprove={improveBlock}
                              onSetProse={setProse}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Conclusion ── */}
        {conclusionBlock && (
          <div className="mt-6">
            <SingleBlockCard
              block={conclusionBlock}
              label="Conclusion"
              chKey="__conclusion__"
              lessons={lessons}
              busyId={busyId}
              isBusy={isBusy}
              expandedChapters={expandedChapters}
              setExpandedChapters={setExpandedChapters}
              onGenerate={generateBlock}
              onImprove={improveBlock}
              onSetProse={setProse}
            />
          </div>
        )}

      </div>
    </div>
  );
}
