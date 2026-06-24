import { useEffect, useMemo, useState } from "react";
import {
  blockHasContent,
  buildChapterSummaries,
  collectPreviousConcepts,
  collectUpcomingTopics,
  countDraftedBlocks,
  enumerateWriteBlocks,
  lessonToProse
} from "@/lib/writeBlocks";
import { aiFetch, GenerationCanceledError } from "@/lib/ai/aiFetch";
import { buildBookContext } from "@/lib/bookContext";

const IMPROVE_ACTIONS = [
  { id: "edit_format",     label: "Edit & Format"    },
  { id: "elaborate",       label: "Elaborate"        },
  { id: "cta",             label: "Call to Action"   },
  { id: "historical_fact", label: "Historical Fact"  },
  { id: "quote",           label: "Add Quote"        },
  { id: "add_source",      label: "Add Source"       },
  { id: "strengthen_data", label: "Add Data"         },
  { id: "generate_image",  label: "Image Prompt"     },
  { id: "custom",          label: "Custom…"          },
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
function BlockContent({ blockId, lessons, busyId, isBusy, onGenerate, onImprove, onSetProse, imagePrompt }) {
  const prose      = String(lessons?.[blockId]?.prose || "").trim();
  const hasContent = blockHasContent(lessons, blockId);
  const isThisBusy = busyId === blockId;
  const lesson     = lessons?.[blockId]?.lesson;

  const [customText,    setCustomText]    = useState("");
  const [showCustom,    setShowCustom]    = useState(false);
  const [showImagePanel, setShowImagePanel] = useState(false);

  // Auto-show image panel when a new result arrives
  const prevImagePrompt = useState(imagePrompt)[0];
  useEffect(() => {
    if (imagePrompt && imagePrompt !== prevImagePrompt) setShowImagePanel(true);
  }, [imagePrompt]);

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
        <GenerateBtn busy={isThisBusy} hasContent={false} disabled={isBusy} onClick={onGenerate} small={false} />
      </div>
    );
  }

  function handleActionClick(actionId) {
    if (actionId === "custom") {
      setShowCustom((p) => !p);
    } else {
      if (actionId === "generate_image") setShowImagePanel(true);
      onImprove(blockId, actionId);
    }
  }

  function submitCustom() {
    if (!customText.trim()) return;
    onImprove(blockId, "custom", customText.trim());
    setShowCustom(false);
    setCustomText("");
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

      {/* Action bar */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <GenerateBtn busy={isThisBusy} hasContent disabled={isBusy} onClick={onGenerate} small />
        <span className="text-slate-200 select-none">|</span>
        {IMPROVE_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={isBusy}
            onClick={() => handleActionClick(action.id)}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
              action.id === "custom" && showCustom
                ? "border-violet-300 bg-violet-50 text-violet-700"
                : action.id === "generate_image"
                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50/60"
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Custom instruction input */}
      {showCustom && (
        <div className="mt-2 flex items-start gap-2">
          <textarea
            className="flex-1 resize-none rounded-lg border border-violet-200 bg-white px-3 py-2 text-[13px] text-slate-700 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            rows={2}
            placeholder="Describe what you want to change or add…"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitCustom(); }}
            disabled={isBusy}
            autoFocus
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              disabled={isBusy || !customText.trim()}
              onClick={submitCustom}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => { setShowCustom(false); setCustomText(""); }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Image prompt panel */}
      {imagePrompt && showImagePanel && (
        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Image Prompt</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(imagePrompt)}
                className="rounded-full border border-amber-200 bg-white px-2.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-50"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => setShowImagePanel(false)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-50"
              >
                Dismiss
              </button>
            </div>
          </div>
          <p className="text-[13px] text-slate-700 leading-relaxed">{imagePrompt}</p>
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
  // Flat block list — used ONLY for AI generation logic and progress counting
  const blocks = useMemo(() => enumerateWriteBlocks(bookOutline), [bookOutline]);

  // Fast lookup: subsection/section/intro/conclusion ID → block object
  const blockById = useMemo(() => {
    const map = new Map();
    for (const b of blocks) map.set(b.id, b);
    return map;
  }, [blocks]);

  const [expandedChapters,   setExpandedChapters]   = useState({});
  const [collapsedSections,  setCollapsedSections]  = useState({});
  const [busyId,             setBusyId]             = useState(null);
  const [batchBusy,          setBatchBusy]          = useState(false);
  const [status,             setStatus]             = useState("");
  const [chapterStrategies,  setChapterStrategies]  = useState({});
  const [openBriefId,        setOpenBriefId]        = useState(null);
  const [briefTexts,         setBriefTexts]         = useState({});
  const [imagePrompts,       setImagePrompts]       = useState({});

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

  async function generateBrief(secKey, { chapterTitle, chapterDesc, sectionTitle, sectionDesc, subsections }) {
    setBriefTexts((p) => ({ ...p, [secKey]: { status: "loading", text: "" } }));
    try {
      const fp  = fullProject || {};
      const bd  = fp.bookDetails || {};
      const res = fp.research   || {};
      const pb  = fp.proposedBook?.content || {};
      const data = await aiFetch("/api/ai/section-brief", {
        bookTitle:    bd.title    || res.bookTitle    || "",
        bookSubtitle: bd.subtitle || res.bookSubtitle || "",
        niche:        [res.mainNicheLabel, res.subNicheLabel, res.deepNicheLabel].filter(Boolean).join(" › "),
        audience:     writingAudience(fp),
        tone:         writingTone(fp),
        objectives:   bd.corePromise || pb.proposedTransformation || "",
        chapterTitle: chapterTitle || "",
        chapterDesc:  chapterDesc  || "",
        sectionTitle: sectionTitle || "",
        sectionDesc:  sectionDesc  || "",
        subsections:  subsections  || []
      }, { noCache: true });
      setBriefTexts((p) => ({ ...p, [secKey]: { status: "done", text: data.brief || "" } }));
    } catch (e) {
      setBriefTexts((p) => ({ ...p, [secKey]: { status: "error", text: "" } }));
    }
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
        subsection:          block.subsection,
        chapterContext:      block.chapterContext,
        previousConcepts:    collectPreviousConcepts(blocks, lessonsSnapshot, index),
        upcomingTopics:      collectUpcomingTopics(blocks, index),
        chapterSummaries:    buildChapterSummaries(blocks, lessonsSnapshot),
        subsectionPurpose:   block.subsection?.objective || block.subsection?.description || null,
        audience:            writingAudience(fullProject),
        tone:                writingTone(fullProject),
        resources:           fullProject?.resources ?? null,
        bookContext:         buildBookContext(fullProject),
        bookStructure:       bookStructureVal(fullProject),
        sectionTitle:        block.sectionTitle || null,
        chapterStrategy:     chapterStrategy || null,
        blueprintComponents: Array.isArray(block.blueprintComponents) && block.blueprintComponents.length
          ? block.blueprintComponents
          : undefined
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

  async function improveBlock(blockId, action, customInstruction) {
    const block = blockById.get(blockId);
    const prose = String(lessons?.[blockId]?.prose || "").trim();
    if (!block || !prose) return;
    setBusyId(blockId);
    setStatus("");
    try {
      const data = await aiFetch("/api/ai/improve", {
        action,
        customInstruction:  customInstruction || "",
        currentText:        prose,
        tone:               writingTone(fullProject),
        audience:           writingAudience(fullProject),
        bookStructure:      bookStructureVal(fullProject),
        subsectionTitle:    block.label || "",
        chapterTitle:       block.chapterContext?.title   || "",
        sectionTitle:       block.sectionTitle            || "",
        bookContext:        buildBookContext(fullProject)
      });
      if (action === "generate_image") {
        if (data.text) {
          setImagePrompts((p) => ({ ...p, [blockId]: data.text }));
          setStatus("Image prompt generated.");
        }
      } else {
        if (data.text) { setProse(blockId, data.text); setStatus("Enhancement applied."); }
        else setStatus("Enhancement returned empty text — your draft was kept.");
      }
    } catch (e) {
      if (e instanceof GenerationCanceledError) setStatus("Enhancement canceled.");
      else setStatus(e.message || "Could not enhance text.");
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
              imagePrompt={imagePrompts[node.id]}
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

                      const secKey     = sec.id || `s-${ci}-${si}`;
                      const briefOpen  = openBriefId === secKey;
                      const secCollapsed = collapsedSections[secKey] === true;
                      const secBlueprintComponents = Array.isArray(sec.blueprintComponents) ? sec.blueprintComponents : [];
                      const secSubTopics = subs.map((s) => s.title).filter(Boolean);
                      const briefEntry = briefTexts[secKey] || { status: "idle", text: "" };

                      return (
                        /* ── Section ── 32px top margin */
                        <div key={sec.id || si} className="mt-8 first:mt-6">
                          {/* Section heading */}
                          <div className="flex items-baseline gap-2">
                            <h3 className="text-[18px] font-medium text-slate-800">
                              <span className="mr-2 text-sky-600">{secNum}</span>
                              {sec.title || `Section ${secNum}`}
                            </h3>
                            <button
                              type="button"
                              title="Section brief"
                              onClick={() => {
                                if (briefOpen) {
                                  setOpenBriefId(null);
                                } else {
                                  setOpenBriefId(secKey);
                                  if (briefEntry.status === "idle") {
                                    generateBrief(secKey, {
                                      chapterTitle: ch.title       || "",
                                      chapterDesc:  ch.description || "",
                                      sectionTitle: sec.title      || "",
                                      sectionDesc:  sec.objective  || sec.description || "",
                                      subsections:  subs.map((s) => ({ title: s.title || "", description: s.description || s.objective || "" }))
                                    });
                                  }
                                }
                              }}
                              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                                briefOpen
                                  ? "border-sky-300 bg-sky-50 text-sky-700"
                                  : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"
                              }`}
                            >
                              {briefOpen ? "✕ close" : "ⓘ brief"}
                            </button>
                            {hasSubs && (
                              <button
                                type="button"
                                title={secCollapsed ? "Show subsections" : "Hide subsections"}
                                onClick={() => setCollapsedSections((p) => ({ ...p, [secKey]: !secCollapsed }))}
                                className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-medium text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
                              >
                                {secCollapsed ? "▼ show" : "▲ hide"}
                              </button>
                            )}
                          </div>

                          {/* Section brief panel */}
                          {briefOpen && (
                            <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/60 p-5 text-[13px]">
                              {briefEntry.status === "loading" && (
                                <div className="flex items-center gap-2 text-sky-600">
                                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-500" />
                                  <span className="text-[12px] font-medium">Generating section brief…</span>
                                </div>
                              )}
                              {briefEntry.status === "error" && (
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[12px] text-red-500">Failed to generate brief.</p>
                                  <button
                                    type="button"
                                    onClick={() => generateBrief(secKey, {
                                      chapterTitle: ch.title       || "",
                                      chapterDesc:  ch.description || "",
                                      sectionTitle: sec.title      || "",
                                      sectionDesc:  sec.objective  || sec.description || "",
                                      subsections:  subs.map((s) => ({ title: s.title || "", description: s.description || s.objective || "" }))
                                    })}
                                    className="rounded-full border border-red-200 bg-white px-3 py-0.5 text-[11px] font-medium text-red-500 hover:bg-red-50"
                                  >
                                    Retry
                                  </button>
                                </div>
                              )}
                              {briefEntry.status === "done" && (
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600 mb-3">Section Brief</p>
                                  <p className="text-slate-700 leading-relaxed whitespace-pre-line">{briefEntry.text}</p>
                                  <button
                                    type="button"
                                    onClick={() => generateBrief(secKey, {
                                      chapterTitle: ch.title       || "",
                                      chapterDesc:  ch.description || "",
                                      sectionTitle: sec.title      || "",
                                      sectionDesc:  sec.objective  || sec.description || "",
                                      subsections:  subs.map((s) => ({ title: s.title || "", description: s.description || s.objective || "" }))
                                    })}
                                    className="mt-3 rounded-full border border-slate-200 bg-white px-3 py-0.5 text-[11px] font-medium text-slate-400 hover:border-slate-300 hover:text-slate-600"
                                  >
                                    ↺ Regenerate
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {!secCollapsed && hasSubs ? (
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
                                      imagePrompt={imagePrompts[sub.id]}
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
                          ) : !secCollapsed && !hasSubs ? (
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
                                    imagePrompt={imagePrompts[sec.id]}
                                  />
                                  <div className="mt-6" />
                                </div>
                              ) : null;
                            })()
                          ) : null}
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
