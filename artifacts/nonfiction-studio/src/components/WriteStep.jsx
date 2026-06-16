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
  { id: "sharpen", label: "Sharpen clarity" },
  { id: "shorten", label: "Tighten length" },
  { id: "expand", label: "Add depth" },
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

export default function WriteStep({
  bookOutline,
  lessons,
  setLessons,
  fullProject,
  currentStep,
  writeStepIndex,
  errors
}) {
  const blocks = useMemo(() => enumerateWriteBlocks(bookOutline), [bookOutline]);
  const [activeChapterKey, setActiveChapterKey] = useState(null);
  const [expandedChapters, setExpandedChapters] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [chapterStrategies, setChapterStrategies] = useState({});
  const [focusedBlockId, setFocusedBlockId] = useState(null);

  const progress = useMemo(() => countDraftedBlocks(blocks, lessons), [blocks, lessons]);
  const chapters = Array.isArray(bookOutline?.chapters) ? bookOutline.chapters : [];
  const introBlock = useMemo(() => blocks.find((b) => b.kind === "introduction") || null, [blocks]);
  const conclusionBlock = useMemo(() => blocks.find((b) => b.kind === "conclusion") || null, [blocks]);

  useEffect(() => {
    if (currentStep !== writeStepIndex) return;
    if (!blocks.length) { setActiveChapterKey(null); return; }
    if (activeChapterKey) return;
    const firstEmptyBlock = blocks.find((b) => !blockHasContent(lessons, b.id));
    const key = firstEmptyBlock?.chapterKey || blocks[0]?.chapterKey || null;
    setActiveChapterKey(key);
  }, [activeChapterKey, blocks, currentStep, lessons, writeStepIndex]);

  const activeBlocks = useMemo(() => {
    if (!activeChapterKey) return [];
    return blocks.filter((b) => b.chapterKey === activeChapterKey);
  }, [activeChapterKey, blocks]);

  function patchLesson(blockId, patch) {
    setLessons((prev) => {
      const base = prev && typeof prev === "object" ? prev : {};
      const cur = base[blockId] && typeof base[blockId] === "object" ? base[blockId] : {};
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
      const updatedCache = chapterStrategy && block.chapterKey
        ? { ...strategyCache, [block.chapterKey]: chapterStrategy }
        : strategyCache;
      const data = await aiFetch("/api/ai/lesson", {
        subsection: block.subsection,
        chapterContext: block.chapterContext,
        previousConcepts: collectPreviousConcepts(blocks, lessonsSnapshot, index),
        audience: writingAudience(fullProject),
        tone: writingTone(fullProject),
        resources: fullProject?.resources ?? null,
        bookContext: buildBookContext(fullProject),
        bookStructure: bookStructureVal(fullProject),
        sectionTitle: block.sectionTitle || null,
        chapterStrategy: chapterStrategy || null
      }, { noCache: true });
      const lesson = data.lesson || data;
      const prose = lessonToProse(lesson);
      const entry = { lesson, prose, generatedAt: new Date().toISOString() };
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

  async function generateRemaining() {
    if (!blocks.length) return;
    setBatchBusy(true);
    setStatus("Generating remaining sections…");
    let snapshot = lessons && typeof lessons === "object" ? { ...lessons } : {};
    let strategyCache = { ...chapterStrategies };
    const failed = [];
    try {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (blockHasContent(snapshot, block.id)) continue;
        setActiveChapterKey(block.chapterKey);
        const before = snapshot;
        const result = await generateBlock(block, snapshot, strategyCache);
        snapshot = result.snapshot || snapshot;
        strategyCache = result.strategyCache || strategyCache;
        if (snapshot === before || !blockHasContent(snapshot, block.id)) failed.push(block.label);
      }
      setStatus(failed.length
        ? `Batch done — ${failed.length} section${failed.length > 1 ? "s" : ""} failed: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""}`
        : "Batch generation finished — all sections drafted.");
    } finally {
      setBatchBusy(false);
    }
  }

  if (!blocks.length) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <div className="book-panel">
          <p className="text-sm text-slate-600">
            Your outline has no draft targets yet. Go back to <span className="font-semibold">Outline</span> and add
            chapters with sections before writing.
          </p>
        </div>
      </div>
    );
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const isBusy = Boolean(busyId) || batchBusy;
  const bookTitle = fullProject?.bookDetails?.title || fullProject?.title || fullProject?.proposedBook?.title || "Your Book";
  const sectionGroups = groupBlocksBySection(activeBlocks);
  const activeChapterBlock = activeBlocks[0];
  const chapterLabel = activeChapterBlock?.chapterContext?.title || (activeChapterKey === "__intro__" ? "Introduction" : activeChapterKey === "__conclusion__" ? "Conclusion" : "");

  return (
    <div className="flex h-[calc(100vh-160px)] min-h-[520px] gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* ── Left TOC sidebar ── */}
      <div className="flex w-[280px] shrink-0 flex-col border-r border-slate-100 bg-slate-50/60">
        {/* Book header */}
        <div className="border-b border-slate-100 px-4 py-4">
          <p className="truncate text-sm font-bold text-slate-900">{bookTitle}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-600 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold tabular-nums text-slate-500">{pct}%</span>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">{progress.done}/{progress.total} sections drafted</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {/* Introduction */}
          {introBlock && (
            <button
              type="button"
              onClick={() => setActiveChapterKey("__intro__")}
              className={`mb-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                activeChapterKey === "__intro__"
                  ? "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: blockHasContent(lessons, introBlock.id) ? "#10b981" : "#cbd5e1" }} />
              Introduction
            </button>
          )}

          {/* Chapters */}
          {chapters.map((ch, ci) => {
            const chKey = ch.id || `ch-${ci}`;
            const isActive = activeChapterKey === chKey;
            const isExpanded = expandedChapters[chKey] !== false;
            const chBlocks = blocks.filter((b) => b.chapterKey === chKey);
            const chDone = chBlocks.filter((b) => blockHasContent(lessons, b.id)).length;
            const chTotal = chBlocks.length;
            const secs = Array.isArray(ch.sections) ? ch.sections : [];

            return (
              <div key={chKey} className="mb-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveChapterKey(chKey);
                    setExpandedChapters((p) => ({ ...p, [chKey]: p[chKey] === false ? true : !isExpanded }));
                  }}
                  className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition ${
                    isActive
                      ? "bg-sky-50 ring-1 ring-inset ring-sky-200"
                      : "hover:bg-slate-100"
                  }`}
                >
                  <span className="mt-0.5 shrink-0 text-[9px] text-slate-400">{isExpanded ? "▼" : "▶"}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[11px] font-bold leading-snug ${isActive ? "text-sky-800" : "text-slate-800"}`}>
                      {ci + 1}. {ch.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{chDone}/{chTotal} sections</p>
                  </div>
                </button>

                {isExpanded && secs.map((sec, si) => {
                  const subs = Array.isArray(sec.subsections) ? sec.subsections : [];
                  return (
                    <div key={sec.id || si} className="ml-4 mt-0.5 border-l border-slate-200 pl-2">
                      <p className="px-1 py-1 text-[10px] font-semibold text-slate-500">
                        {ci + 1}.{si + 1} {sec.title}
                      </p>
                      {subs.map((sub, qi) => {
                        const done = blockHasContent(lessons, sub.id);
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => { setActiveChapterKey(chKey); setFocusedBlockId(sub.id); }}
                            className="block w-full rounded-lg px-1 py-1 text-left transition hover:bg-slate-100"
                          >
                            <p className={`text-[10px] font-medium leading-snug ${done ? "text-emerald-600" : "text-sky-600"}`}>
                              {ci + 1}.{si + 1}.{qi + 1} {sub.title}
                            </p>
                            {sub.explanation && (
                              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-400">
                                {sub.explanation}
                              </p>
                            )}
                          </button>
                        );
                      })}
                      {subs.length === 0 && (
                        <button
                          type="button"
                          onClick={() => { setActiveChapterKey(chKey); setFocusedBlockId(sec.id); }}
                          className="block w-full rounded-lg px-1 py-1 text-left transition hover:bg-slate-100"
                        >
                          <p className={`text-[10px] font-medium leading-snug ${blockHasContent(lessons, sec.id) ? "text-emerald-600" : "text-sky-600"}`}>
                            {sec.title}
                          </p>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Conclusion */}
          {conclusionBlock && (
            <button
              type="button"
              onClick={() => setActiveChapterKey("__conclusion__")}
              className={`mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                activeChapterKey === "__conclusion__"
                  ? "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: blockHasContent(lessons, conclusionBlock.id) ? "#10b981" : "#cbd5e1" }} />
              Conclusion
            </button>
          )}
        </nav>

        {/* Bottom status */}
        {status && (
          <div className="border-t border-slate-100 px-3 py-2">
            <p className="text-[10px] text-slate-500 leading-relaxed">{status}</p>
          </div>
        )}
      </div>

      {/* ── Right content panel ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Chapter heading bar */}
        <div className="border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {activeChapterKey === "__intro__" ? "Front matter" : activeChapterKey === "__conclusion__" ? "Back matter" : `Chapter ${(chapters.findIndex((c) => (c.id || `ch-${chapters.indexOf(c)}`) === activeChapterKey) + 1) || ""}`}
              </p>
              <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-900">{chapterLabel}</h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {errors?.form && <p className="text-sm text-red-600">{errors.form}</p>}
              <button
                type="button"
                disabled={isBusy}
                onClick={generateRemaining}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                {batchBusy ? "Generating…" : "Generate rest of book"}
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable section cards */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {sectionGroups.map((group) => (
            <div key={group.sectionTitle || group.blocks[0]?.id} className="space-y-4">
              {/* Section heading */}
              {group.sectionTitle && (
                <h3 className="text-base font-bold text-slate-800">
                  {group.sectionTitle}
                </h3>
              )}

              {/* Blocks within section */}
              {group.blocks.map((block) => {
                const prose = String(lessons?.[block.id]?.prose || "").trim();
                const hasContent = blockHasContent(lessons, block.id);
                const isBlockBusy = busyId === block.id;
                const isFocused = focusedBlockId === block.id;
                const lesson = lessons?.[block.id]?.lesson;

                return (
                  <div
                    key={block.id}
                    id={`block-${block.id}`}
                    className={`rounded-2xl border transition ${
                      isFocused
                        ? "border-sky-200 bg-sky-50/30"
                        : "border-slate-200 bg-white"
                    }`}
                    onClick={() => setFocusedBlockId(block.id)}
                  >
                    {/* Block header */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-5 py-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {block.breadcrumb}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-800">{block.label}</p>
                      </div>
                      {hasContent && (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Drafted
                        </span>
                      )}
                    </div>

                    {/* Content area */}
                    <div className="px-5 py-4">
                      {hasContent ? (
                        <>
                          <textarea
                            className="input-light min-h-[200px] w-full resize-y font-[inherit] text-sm leading-relaxed"
                            value={prose}
                            onChange={(e) => setProse(block.id, e.target.value)}
                            disabled={isBlockBusy}
                          />
                          {lesson?.keyTakeaway && (
                            <p className="mt-2 text-xs text-slate-400">
                              Key takeaway: <span className="font-medium text-slate-600">{lesson.keyTakeaway}</span>
                            </p>
                          )}
                          {/* Improve actions */}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {IMPROVE_ACTIONS.map((action) => (
                              <button
                                key={action.id}
                                type="button"
                                disabled={isBusy}
                                onClick={(e) => { e.stopPropagation(); improveBlock(block.id, action.id); }}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/60 disabled:opacity-50"
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          {isBlockBusy ? (
                            <div className="flex flex-col items-center gap-3">
                              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
                              <p className="text-sm text-slate-500">Writing this section…</p>
                            </div>
                          ) : (
                            <>
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                                </svg>
                              </div>
                              <p className="mt-3 text-sm font-semibold text-slate-700">No content yet</p>
                              <p className="mt-1 text-xs text-slate-400">
                                Click &lsquo;Generate Section&rsquo; to write this section with AI
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action bar */}
                    <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={(e) => { e.stopPropagation(); generateBlock(block); }}
                        className="flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                        {isBlockBusy ? "Generating…" : hasContent ? "Regenerate" : "Generate Section"}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={(e) => { e.stopPropagation(); generateRemaining(); }}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Generate Rest of Book
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {activeBlocks.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-400">Select a chapter from the left to start writing.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
