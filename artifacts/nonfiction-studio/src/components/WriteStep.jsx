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

function FieldLabel({ children, hint }) {
  return (
    <label className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-slate-800">
      {children}
      {hint && (
        <span
          className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300/90 bg-white text-[10px] font-bold text-sky-600 shadow-sm"
          title={hint}
        >
          i
        </span>
      )}
    </label>
  );
}

function StatusDot({ done, active, busy }) {
  if (busy) {
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <span className="h-3 w-3 animate-spin rounded-full border border-slate-300 border-t-sky-500" />
      </span>
    );
  }
  return (
    <span
      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
        done
          ? "bg-emerald-500 text-white"
          : active
            ? "border border-sky-500 bg-white text-sky-600"
            : "border border-slate-300 bg-white text-slate-400"
      }`}
    >
      {done ? "✓" : ""}
    </span>
  );
}

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
  const [activeId, setActiveId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [chapterStrategies, setChapterStrategies] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});
  const [expandedSections, setExpandedSections] = useState({});

  const progress = useMemo(() => countDraftedBlocks(blocks, lessons), [blocks, lessons]);
  const activeBlock = blocks.find((b) => b.id === activeId) || blocks[0] || null;
  const activeIndex = activeBlock ? blocks.findIndex((b) => b.id === activeBlock.id) : -1;
  const activeLesson = activeBlock ? lessons?.[activeBlock.id] : null;
  const activeProse = activeLesson?.prose ?? "";

  const introBlock = useMemo(() => blocks.find((b) => b.kind === "introduction") || null, [blocks]);
  const conclusionBlock = useMemo(() => blocks.find((b) => b.kind === "conclusion") || null, [blocks]);

  useEffect(() => {
    if (currentStep !== writeStepIndex) return;
    if (!blocks.length) {
      setActiveId(null);
      return;
    }
    if (activeId && blocks.some((b) => b.id === activeId)) return;
    const firstOpen = blocks.find((b) => !blockHasContent(lessons, b.id));
    setActiveId((firstOpen || blocks[0]).id);
  }, [activeId, blocks, currentStep, lessons, writeStepIndex]);

  function toggleChapter(chId) {
    setExpandedChapters((p) => ({ ...p, [chId]: p[chId] === false ? true : false }));
  }

  function toggleSection(secId) {
    setExpandedSections((p) => ({ ...p, [secId]: p[secId] === false ? true : false }));
  }

  function patchLesson(blockId, patch) {
    setLessons((prev) => {
      const base = prev && typeof prev === "object" ? prev : {};
      const cur = base[blockId] && typeof base[blockId] === "object" ? base[blockId] : {};
      return {
        ...base,
        [blockId]: { ...cur, ...patch, updatedAt: new Date().toISOString() }
      };
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
    } catch {
      return null;
    }
  }

  async function generateBlock(block, index, lessonsSnapshot = lessons, strategyCache = chapterStrategies) {
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
      });
      const lesson = data.lesson || data;
      const prose = lessonToProse(lesson);
      const entry = { lesson, prose, generatedAt: new Date().toISOString() };
      patchLesson(block.id, entry);
      setStatus(`Drafted "${block.label}".`);
      const newSnapshot = { ...lessonsSnapshot, [block.id]: { ...entry, updatedAt: new Date().toISOString() } };
      return { snapshot: newSnapshot, strategyCache: updatedCache };
    } catch (e) {
      if (e instanceof GenerationCanceledError) setStatus("Generation canceled — Grok approval declined.");
      else setStatus(e.message || "Could not generate this section.");
      return { snapshot: lessonsSnapshot, strategyCache };
    } finally {
      setBusyId(null);
    }
  }

  async function improveActive(action) {
    if (!activeBlock || !activeProse.trim()) return;
    setBusyId(activeBlock.id);
    setStatus("");
    try {
      const data = await aiFetch("/api/ai/improve", {
        action,
        currentText:     activeProse,
        tone:            writingTone(fullProject),
        audience:        writingAudience(fullProject),
        bookStructure:   bookStructureVal(fullProject),
        subsectionTitle: activeBlock?.label || "",
        bookContext:     buildBookContext(fullProject)
      });
      setProse(activeBlock.id, data.text || "");
      setStatus("Applied AI refinement.");
    } catch (e) {
      if (e instanceof GenerationCanceledError) setStatus("Refinement canceled — Grok approval declined.");
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
    try {
      for (let i = 0; i < blocks.length; i += 1) {
        const block = blocks[i];
        if (blockHasContent(snapshot, block.id)) continue;
        setActiveId(block.id);
        const result = await generateBlock(block, i, snapshot, strategyCache);
        snapshot = result.snapshot || snapshot;
        strategyCache = result.strategyCache || strategyCache;
      }
      setStatus("Batch generation finished.");
    } finally {
      setBatchBusy(false);
    }
  }

  function goNextBlock() {
    if (activeIndex < 0 || activeIndex >= blocks.length - 1) return;
    setActiveId(blocks[activeIndex + 1].id);
  }

  function goPrevBlock() {
    if (activeIndex <= 0) return;
    setActiveId(blocks[activeIndex - 1].id);
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
  const activeKeyTakeaway = activeLesson?.lesson?.keyTakeaway;
  const activeStructureUsed = activeLesson?.lesson?.structureUsed;
  const chapters = Array.isArray(bookOutline?.chapters) ? bookOutline.chapters : [];

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm leading-relaxed text-slate-600">
        Draft each block in order—earlier lessons feed context so the model avoids repeating frameworks. Generate one
        section at a time, refine with AI actions, or run <span className="font-semibold">Generate rest of book</span>{" "}
        to fill everything that is still empty.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="h-2 min-w-[200px] flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs font-medium text-slate-600">
          {progress.done} / {progress.total} sections drafted ({pct}%)
        </p>
      </div>

      {errors?.form && <p className="mt-4 text-center text-sm text-red-600">{errors.form}</p>}
      {status && <p className="mt-3 text-center text-sm text-slate-600">{status}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,300px)_1fr]">

        {/* ── Hierarchical sidebar ── */}
        <nav className="book-panel max-h-[min(80vh,700px)] overflow-y-auto p-3">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Manuscript</p>

          <ul className="mt-2 space-y-0.5">

            {/* Introduction */}
            {introBlock && (
              <li>
                <button
                  type="button"
                  onClick={() => setActiveId(introBlock.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition ${
                    introBlock.id === activeBlock?.id
                      ? "bg-sky-50 ring-1 ring-inset ring-sky-200/80 text-sky-900"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <StatusDot
                    done={blockHasContent(lessons, introBlock.id)}
                    active={introBlock.id === activeBlock?.id}
                    busy={busyId === introBlock.id}
                  />
                  <span className="truncate">Introduction</span>
                </button>
              </li>
            )}

            {/* Chapters */}
            {chapters.map((ch, ci) => {
              const secs = Array.isArray(ch.sections) ? ch.sections : [];
              const chExpanded = expandedChapters[ch.id] !== false;

              return (
                <li key={ch.id} className="pt-1">
                  {/* Chapter header */}
                  <button
                    type="button"
                    onClick={() => toggleChapter(ch.id)}
                    className="flex w-full items-center gap-1.5 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50"
                  >
                    <span className="shrink-0 text-[9px] text-slate-400 w-2.5">
                      {chExpanded ? "▼" : "▶"}
                    </span>
                    <span className="min-w-0 truncate text-[11px] font-bold text-slate-800">
                      {ci + 1}. {ch.title}
                    </span>
                  </button>

                  {/* Sections */}
                  {chExpanded && secs.length > 0 && (
                    <ul className="ml-3 border-l border-slate-100 pl-2 space-y-0.5 pb-1">
                      {secs.map((sec, si) => {
                        const subs = Array.isArray(sec.subsections) ? sec.subsections : [];
                        const secExpanded = expandedSections[sec.id] !== false;

                        if (subs.length === 0) {
                          const done = blockHasContent(lessons, sec.id);
                          const active = activeBlock?.id === sec.id;
                          return (
                            <li key={sec.id}>
                              <button
                                type="button"
                                onClick={() => setActiveId(sec.id)}
                                className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition ${
                                  active
                                    ? "bg-sky-50 ring-1 ring-inset ring-sky-200/80"
                                    : "hover:bg-slate-50"
                                }`}
                              >
                                <StatusDot done={done} active={active} busy={busyId === sec.id} />
                                <span className={`min-w-0 truncate text-[11px] ${active ? "font-semibold text-sky-900" : "text-slate-600"}`}>
                                  {ci + 1}.{si + 1} {sec.title}
                                </span>
                              </button>
                            </li>
                          );
                        }

                        return (
                          <li key={sec.id} className="pt-0.5">
                            {/* Section header */}
                            <button
                              type="button"
                              onClick={() => toggleSection(sec.id)}
                              className="flex w-full items-center gap-1.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-50"
                            >
                              <span className="shrink-0 text-[9px] text-slate-400 w-2.5">
                                {secExpanded ? "▼" : "▶"}
                              </span>
                              <span className="min-w-0 truncate text-[11px] font-semibold text-slate-600">
                                {ci + 1}.{si + 1} {sec.title}
                              </span>
                            </button>

                            {/* Subsections */}
                            {secExpanded && (
                              <ul className="ml-3 border-l border-slate-100 pl-2 space-y-0.5 pb-1">
                                {subs.map((sub, qi) => {
                                  const done = blockHasContent(lessons, sub.id);
                                  const active = activeBlock?.id === sub.id;
                                  return (
                                    <li key={sub.id}>
                                      <button
                                        type="button"
                                        onClick={() => setActiveId(sub.id)}
                                        className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition ${
                                          active
                                            ? "bg-sky-50 ring-1 ring-inset ring-sky-200/80"
                                            : "hover:bg-slate-50"
                                        }`}
                                      >
                                        <StatusDot done={done} active={active} busy={busyId === sub.id} />
                                        <span className={`min-w-0 truncate text-[11px] ${active ? "font-semibold text-sky-900" : "text-slate-500"}`}>
                                          {ci + 1}.{si + 1}.{qi + 1} {sub.title}
                                        </span>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {chExpanded && secs.length === 0 && (
                    <p className="ml-6 mt-1 pb-1 text-[10px] text-slate-400 italic">No sections</p>
                  )}
                </li>
              );
            })}

            {/* Conclusion */}
            {conclusionBlock && (
              <li className="pt-1">
                <button
                  type="button"
                  onClick={() => setActiveId(conclusionBlock.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition ${
                    conclusionBlock.id === activeBlock?.id
                      ? "bg-sky-50 ring-1 ring-inset ring-sky-200/80 text-sky-900"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <StatusDot
                    done={blockHasContent(lessons, conclusionBlock.id)}
                    active={conclusionBlock.id === activeBlock?.id}
                    busy={busyId === conclusionBlock.id}
                  />
                  <span className="truncate">Conclusion</span>
                </button>
              </li>
            )}
          </ul>
        </nav>

        {/* ── Draft editor panel ── */}
        <div className="book-panel flex flex-col gap-4">
          {activeBlock && (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-700/90">{activeBlock.breadcrumb}</p>
                <h2 className="mt-1 font-serif text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
                  {activeBlock.label}
                </h2>
                {activeStructureUsed && (
                  <p className="mt-1 text-xs text-slate-400">
                    Written as: <span className="font-medium text-slate-600">{activeStructureUsed}</span>
                  </p>
                )}
              </div>

              <div>
                <FieldLabel hint="Edit freely—this is what flows into export and later steps.">Draft</FieldLabel>
                <textarea
                  className="input-light mt-1.5 min-h-[280px] w-full resize-y font-[inherit] leading-relaxed"
                  value={activeProse}
                  onChange={(e) => setProse(activeBlock.id, e.target.value)}
                  placeholder="Generate this section or paste your own draft…"
                  disabled={isBusy && busyId === activeBlock.id}
                />
                {activeKeyTakeaway && (
                  <p className="mt-2 text-xs text-slate-500">
                    Key takeaway:{" "}
                    <span className="font-medium text-slate-700">{activeKeyTakeaway}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => generateBlock(activeBlock, activeIndex)}
                  className="rounded-full bg-gradient-to-r from-sky-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-600/25 transition hover:from-sky-700 hover:to-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyId === activeBlock.id ? "Generating…" : activeProse.trim() ? "Regenerate" : "Generate section"}
                </button>
                <button
                  type="button"
                  disabled={isBusy || !activeProse.trim()}
                  onClick={() => improveActive("sharpen")}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/60 disabled:opacity-50"
                >
                  Sharpen
                </button>
                {IMPROVE_ACTIONS.filter((a) => a.id !== "sharpen").map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    disabled={isBusy || !activeProse.trim()}
                    onClick={() => improveActive(action.id)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/60 disabled:opacity-50"
                  >
                    {action.label}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={generateRemaining}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/50 disabled:opacity-50"
                >
                  {batchBusy ? "Batch running…" : "Generate rest of book"}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={goPrevBlock}
                  disabled={activeIndex <= 0}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
                >
                  ← Previous
                </button>
                <span className="text-xs text-slate-400">
                  {activeIndex + 1} / {blocks.length}
                </span>
                <button
                  type="button"
                  onClick={goNextBlock}
                  disabled={activeIndex < 0 || activeIndex >= blocks.length - 1}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
