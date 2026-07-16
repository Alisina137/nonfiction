import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { countManuscriptWords, buildPublishingBundle } from "@/lib/manuscript";
import { resolveAuthorName, resolveBookTitle } from "@/lib/projectMeta";
import { DEFAULT_EXPORT_SETTINGS } from "@/lib/exportSettings";
import ExportSettingsPanel from "@/components/ExportSettingsPanel";
import { aiFetch, GenerationCanceledError } from "@/lib/ai/aiFetch";
import { buildBookContext } from "@/lib/bookContext";
import { lessonToProse } from "@/lib/writeBlocks";
import { buildManuscriptDigest } from "@/lib/manuscriptDigest";
import { buildKnowledgeGraphSummary } from "@/lib/knowledgeGraph";

const FM_STORAGE_KEY = "nonfiction-ai-front-matter";
const DEV_EDIT_KEY   = "nonfiction-ai-dev-edit";

function loadFrontMatter() {
  try {
    const raw = window.localStorage.getItem(FM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveFrontMatter(data) {
  try { window.localStorage.setItem(FM_STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function loadDevEdit() {
  try { return JSON.parse(window.localStorage.getItem(DEV_EDIT_KEY) || "null"); } catch { return null; }
}

function saveDevEdit(data) {
  try { window.localStorage.setItem(DEV_EDIT_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

const SCORECARD_LABELS = {
  overallPublishingScore:       "Overall Publishing Score",
  commercialPotential:          "Commercial Potential",
  educationalValue:             "Educational Value",
  practicalValue:               "Practical Value",
  originality:                  "Originality",
  readerEngagement:             "Reader Engagement",
  transformation:               "Transformation",
  implementation:               "Implementation",
  storytelling:                 "Storytelling",
  frameworkQuality:             "Framework Quality",
  evidenceQuality:              "Evidence Quality",
  readerSatisfactionPrediction: "Reader Satisfaction",
  marketCompetitiveness:        "Market Competitiveness",
};

function ScoreBar({ score }) {
  const pct = Math.min(100, Math.max(0, (score / 10) * 100));
  const color = score >= 8 ? "bg-emerald-500" : score >= 6.5 ? "bg-sky-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-7 text-right text-xs font-semibold tabular-nums text-slate-700">{score.toFixed(1)}</span>
    </div>
  );
}

function PublishingReadinessPanel({ devEdit, devEditBusy, devEditError, onRetry }) {
  const [showDetails, setShowDetails] = useState(false);

  if (devEditBusy) {
    return (
      <section className="book-panel space-y-3">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-violet-500" />
          <div>
            <p className="text-sm font-bold text-slate-900">Analyzing manuscript quality…</p>
            <p className="text-xs text-slate-500">Running developmental edit — evaluating all chapters, value density, and publishing readiness.</p>
          </div>
        </div>
      </section>
    );
  }

  if (devEditError && !devEdit) {
    return (
      <section className="book-panel space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900">Publishing Readiness</p>
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Retry
          </button>
        </div>
        <p className="text-xs text-red-600">{devEditError}</p>
      </section>
    );
  }

  if (!devEdit) return null;

  const sc   = devEdit.bookScorecard  || {};
  const ap   = devEdit.bookApproval   || {};
  const weak = Array.isArray(devEdit.weakAreas) ? devEdit.weakAreas : [];
  const overall = sc.overallPublishingScore ?? 0;
  const approved = ap.approved;
  const highPriority = weak.filter(w => w.priority === "high");

  const gateKeys = ["bookDNAAlignment","blueprintAlignment","knowledgeGraphConsistency","commercialReadiness","educationalQuality","transformationComplete","consistency","readerExperience"];
  const gateLabels = {
    bookDNAAlignment:          "Book DNA Alignment",
    blueprintAlignment:        "Blueprint Alignment",
    knowledgeGraphConsistency: "Knowledge Consistency",
    commercialReadiness:       "Commercial Readiness",
    educationalQuality:        "Educational Quality",
    transformationComplete:    "Transformation",
    consistency:               "Consistency",
    readerExperience:          "Reader Experience",
  };

  return (
    <section className="book-panel space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Publishing Readiness</h3>
          <p className="mt-0.5 text-xs text-slate-500">Developmental edit complete — manuscript evaluated across 13 quality dimensions.</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 text-xs font-semibold text-slate-400 hover:text-slate-600"
          title="Re-run developmental edit"
        >
          ↻ Re-analyse
        </button>
      </div>

      {/* Score + approval badge */}
      <div className="flex items-center gap-5">
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3">
          <span className={`text-3xl font-extrabold tabular-nums ${overall >= 8 ? "text-emerald-600" : overall >= 6.5 ? "text-sky-600" : "text-amber-600"}`}>
            {overall.toFixed(1)}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">out of 10</span>
        </div>
        <div className="flex-1 space-y-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${approved ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"}`}>
            {approved ? "✓ Approved for publication" : "⚠ Improvements recommended"}
          </span>
          {ap.approvalNotes && (
            <p className="text-xs leading-relaxed text-slate-600">{ap.approvalNotes}</p>
          )}
        </div>
      </div>

      {/* Quality gates */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {gateKeys.map(key => (
          <div key={key} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium ${ap[key] ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
            <span>{ap[key] ? "✓" : "○"}</span>
            <span>{gateLabels[key]}</span>
          </div>
        ))}
      </div>

      {/* High priority weak areas */}
      {highPriority.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Priority improvements</p>
          {highPriority.slice(0, 4).map((w, i) => (
            <div key={i} className="flex gap-2 text-xs text-amber-900">
              <span className="mt-0.5 shrink-0 font-bold">→</span>
              <span><span className="font-semibold">{w.location}:</span> {w.issue} <span className="text-amber-700">({w.action})</span></span>
            </div>
          ))}
        </div>
      )}

      {/* Expand/collapse detailed scorecard */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
      >
        {showDetails ? "Hide detailed scores ↑" : "Show detailed scores ↓"}
      </button>

      {showDetails && (
        <div className="space-y-2.5 pt-1">
          {/* 13-dimension scorecard */}
          <div className="space-y-2">
            {Object.entries(SCORECARD_LABELS).map(([key, label]) => (
              <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5">
                <span className="text-xs text-slate-600">{label}</span>
                <div className="w-40">
                  <ScoreBar score={sc[key] ?? 0} />
                </div>
              </div>
            ))}
          </div>

          {/* Chapter reviews */}
          {Array.isArray(devEdit.chapterReviews) && devEdit.chapterReviews.length > 0 && (
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Chapter Reviews</p>
              {devEdit.chapterReviews.map((cr, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs ${cr.score >= 8 ? "bg-emerald-50" : cr.score >= 6.5 ? "bg-slate-50" : "bg-amber-50/60"}`}>
                  <span className={`mt-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] font-bold tabular-nums ${cr.score >= 8 ? "bg-emerald-100 text-emerald-700" : cr.score >= 6.5 ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>{(cr.score ?? 0).toFixed(1)}</span>
                  <div>
                    <p className="font-semibold text-slate-800">Ch {cr.chapterNumber}: {cr.chapterTitle}</p>
                    {cr.recommendation && cr.recommendation !== "No changes needed." && (
                      <p className="mt-0.5 text-slate-600">{cr.recommendation}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Unanswered reader questions */}
          {Array.isArray(devEdit.unansweredQuestions) && devEdit.unansweredQuestions.length > 0 && (
            <div className="space-y-1 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Unanswered Reader Questions</p>
              {devEdit.unansweredQuestions.slice(0, 5).map((q, i) => (
                <p key={i} className="flex gap-1.5 text-xs text-slate-600"><span className="shrink-0 text-amber-500">?</span>{q}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

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

// Simple front-matter fields with their own AI prompt roles. Each renders as a
// freely-editable textarea and is always included in exports when filled in.
const SIMPLE_FRONT_MATTER = [
  { kind: "dedication",       label: "Dedication",           hint: "Explain the best way readers should approach this book’s dedication…" },
  { kind: "preface",          label: "Preface",              hint: "Share the personal story behind why you wrote this book…" },
  { kind: "howToUseThisBook", label: "How to Use This Book", hint: "Explain how readers should approach the book and its exercises…" },
  { kind: "whatYouWillLearn", label: "What You Will Learn",  hint: "Summarize the key knowledge and outcomes readers will gain…" },
  { kind: "whoThisBookIsFor", label: "Who This Book Is For", hint: "Describe the intended audience and who benefits most from this book…" }
];

function syntheticFrontMatterSubsection(title, role) {
  return {
    title,
    strategy: role,
    explanation: `Write the ${title} for this book.`,
    application: ""
  };
}

export default function FinishStep({ project, onMarkComplete, bookOutline, lessons, setLessons, fullProject }) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [docxBusy, setDocxBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [settings, setSettings] = useState(DEFAULT_EXPORT_SETTINGS);
  const [dedication, setDedication] = useState(() => loadFrontMatter().dedication || "");
  const [preface, setPreface] = useState(() => loadFrontMatter().preface || "");
  const [howToUseThisBook, setHowToUseThisBook] = useState(() => loadFrontMatter().howToUseThisBook || "");
  const [whatYouWillLearn, setWhatYouWillLearn] = useState(() => loadFrontMatter().whatYouWillLearn || "");
  const [whoThisBookIsFor, setWhoThisBookIsFor] = useState(() => loadFrontMatter().whoThisBookIsFor || "");
  const [showOptional, setShowOptional] = useState(() => {
    const fm = loadFrontMatter();
    return Object.values(fm).some((v) => typeof v === "string" && v.trim().length > 0);
  });
  const [busyId, setBusyId] = useState(null);
  const [fmStatus, setFmStatus] = useState("");
  const [generatingAll, setGeneratingAll] = useState(false);

  // ── Developmental Edit state ─────────────────────────────────────────────
  const [devEdit, setDevEdit] = useState(() => loadDevEdit());
  const [devEditBusy, setDevEditBusy] = useState(false);
  const [devEditError, setDevEditError] = useState("");
  const devEditTriggered = useRef(false);

  // Persist front matter to localStorage whenever any field changes
  useEffect(() => {
    saveFrontMatter({ dedication, preface, howToUseThisBook, whatYouWillLearn, whoThisBookIsFor });
  }, [dedication, preface, howToUseThisBook, whatYouWillLearn, whoThisBookIsFor]);

  // Auto-trigger developmental edit when FinishStep first mounts (if no cached result)
  useEffect(() => {
    if (devEdit || devEditTriggered.current) return;
    devEditTriggered.current = true;
    runDevelopmentalEdit();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runDevelopmentalEdit() {
    setDevEditBusy(true);
    setDevEditError("");
    try {
      const digest = buildManuscriptDigest(fullProject);
      const kg     = buildKnowledgeGraphSummary(fullProject);
      const ctx    = buildBookContext(fullProject);
      const res = await fetch("/api/ai/developmental-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookContext: ctx, manuscriptDigest: digest, knowledgeGraph: kg })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Developmental edit failed.");
      }
      const data = await res.json();
      setDevEdit(data);
      saveDevEdit(data);
    } catch (e) {
      setDevEditError(e.message || "Could not complete the developmental edit.");
    } finally {
      setDevEditBusy(false);
    }
  }

  const title = resolveBookTitle(project);
  const author = resolveAuthorName(project);
  const words = countManuscriptWords(project);
  const bundle = buildPublishingBundle(project);
  const slug = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "book";

  const exportPayload = {
    project, settings,
    dedication, preface,
    howToUseThisBook, whatYouWillLearn, whoThisBookIsFor
  };

  const SIMPLE_FIELD_STATE = {
    dedication:       [dedication, setDedication],
    preface:          [preface, setPreface],
    howToUseThisBook: [howToUseThisBook, setHowToUseThisBook],
    whatYouWillLearn: [whatYouWillLearn, setWhatYouWillLearn],
    whoThisBookIsFor: [whoThisBookIsFor, setWhoThisBookIsFor]
  };

  async function generateSimpleFrontMatter(kind, label) {
    const [, setValue] = SIMPLE_FIELD_STATE[kind];
    setBusyId(kind);
    setFmStatus("");
    try {
      const data = await aiFetch("/api/ai/lesson", {
        subsection:        syntheticFrontMatterSubsection(label, kind),
        chapterContext:    { title: label, role: kind },
        previousConcepts:  [],
        upcomingTopics:    [],
        chapterSummaries:  [],
        subsectionPurpose: null,
        audience:          writingAudience(fullProject),
        tone:              writingTone(fullProject),
        resources:         fullProject?.resources ?? null,
        bookContext:       buildBookContext(fullProject),
        bookStructure:     fullProject?.bookDetails?.structure || fullProject?.research?.structure || "",
        sectionTitle:      null
      }, { noCache: true });
      const lesson = data.lesson || data;
      const prose  = lessonToProse(lesson);
      setValue(prose);
      setFmStatus(`Drafted "${label}".`);
    } catch (e) {
      if (e instanceof GenerationCanceledError) setFmStatus("Generation canceled.");
      else setFmStatus(e.message || `Could not generate ${label}.`);
    } finally {
      setBusyId(null);
    }
  }

  async function generateAllFrontMatter() {
    setGeneratingAll(true);
    setShowOptional(true);
    setFmStatus("Generating all 5 front-matter sections…");
    try {
      for (const { kind, label } of SIMPLE_FRONT_MATTER) {
        setFmStatus(`Generating "${label}"…`);
        await generateSimpleFrontMatter(kind, label);
      }
      setFmStatus("All 5 front-matter sections drafted.");
    } finally {
      setGeneratingAll(false);
      setBusyId(null);
    }
  }

  async function downloadFromApi(endpoint, filename, mimeType, setBusy, label) {
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportPayload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `${label} export failed`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`${label} downloaded.`);
    } catch (e) {
      setStatus(e.message || `Could not export ${label}.`);
    } finally {
      setBusy(false);
    }
  }

  function exportPdf() {
    downloadFromApi("/api/export/book", `${slug}.pdf`, "application/pdf", setPdfBusy, "PDF");
  }

  function exportDocx() {
    downloadFromApi("/api/export/docx", `${slug}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", setDocxBusy, "Word document");
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">

      {/* Hero banner */}
      <section className="rounded-[1.35rem] border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-sky-50/40 px-6 py-10 text-center shadow-soft-card md:px-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Ready to publish</p>
        <h2 className="mt-3 font-serif text-2xl font-bold tracking-tight text-emerald-950 md:text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-emerald-900/80">by {author}</p>
        <p className="mt-5 text-sm leading-relaxed text-slate-600">
          Your manuscript, marketing copy, and cover brief are saved in this browser. Choose an export format and download below.
        </p>
      </section>

      {/* Stats */}
      <section className="book-panel grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{words.toLocaleString()}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">Manuscript words</p>
        </article>
        <article className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{bundle.sectionCount}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">Sections drafted</p>
        </article>
        <article className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{bundle.description ? "✓" : "—"}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">Listing description</p>
        </article>
      </section>

      {/* Publishing Readiness — Developmental Edit */}
      <PublishingReadinessPanel
        devEdit={devEdit}
        devEditBusy={devEditBusy}
        devEditError={devEditError}
        onRetry={() => { devEditTriggered.current = false; runDevelopmentalEdit(); }}
      />

      {/* Export settings */}
      <section className="book-panel space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Manuscript layout</h3>
          <p className="mt-1 text-xs text-slate-500">Configure a KDP-ready layout — trim size, margins, typography, and page elements. The preview updates live.</p>
        </div>

        <ExportSettingsPanel settings={settings} onChange={setSettings} />
      </section>

      {/* Optional front matter */}
      <section className="book-panel space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Front Matter (optional)</h3>
            <p className="text-xs text-slate-500">Added before the table of contents in the exported file.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            {showOptional ? "Hide" : "Add front matter"}
          </button>
        </div>

        {showOptional && (
          <div className="space-y-4 pt-1">
            <div className="flex flex-col gap-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold text-violet-900">Generate all 5 front-matter sections</p>
                <p className="mt-0.5 text-[11px] text-violet-700">
                  Drafts Dedication, Preface, How to Use This Book, What You Will Learn, and Who This Book Is For using your outline and manuscript content.
                </p>
              </div>
              <button
                type="button"
                disabled={generatingAll || Boolean(busyId)}
                onClick={generateAllFrontMatter}
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:from-violet-700 disabled:opacity-50"
              >
                {generatingAll ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                    Generating…
                  </>
                ) : (
                  <>✦ Generate all front matter</>
                )}
              </button>
            </div>

            {fmStatus && (
              <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
                {fmStatus}
              </p>
            )}

            {SIMPLE_FRONT_MATTER.map(({ kind, label, hint }) => {
              const [value, setValue] = SIMPLE_FIELD_STATE[kind];
              const isThisBusy = busyId === kind;
              return (
                <div key={kind}>
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-semibold text-slate-700">{label}</label>
                    <button
                      type="button"
                      disabled={Boolean(busyId) || generatingAll}
                      onClick={() => generateSimpleFrontMatter(kind, label)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isThisBusy ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                          Writing…
                        </>
                      ) : value.trim() ? (
                        <>↻ Regenerate</>
                      ) : (
                        <>✦ Generate</>
                      )}
                    </button>
                  </div>
                  <textarea
                    className="input-light mt-1 min-h-[80px] w-full resize-y text-sm"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={hint}
                    disabled={isThisBusy}
                  />
                </div>
              );
            })}

            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] text-slate-600">
              <span className="font-semibold">Front matter page order:</span> Cover → Abstract → Dedication → Table of Contents → Preface → How to Use This Book → What You Will Learn → Who This Book Is For → Chapter 1…
            </div>
          </div>
        )}
      </section>

      {/* What's included summary */}
      <section className="book-panel">
        <h3 className="text-sm font-bold text-slate-900 mb-3">What's included in every export</h3>
        <div className="grid gap-x-6 gap-y-1.5 text-xs text-slate-600 sm:grid-cols-2">
          {[
            "Cover page (title, subtitle, author)",
            "Abstract (from your book description)",
            "Table of contents (auto-generated)",
            "Thesis-style chapter numbering: 1 / 1.1 / 1.1.1",
            "Each chapter starts on a new page",
            "KDP-compliant margins with gutter",
            settings.headers && "Running headers",
            settings.pageNumbers && "Page numbers in footer",
            "Professional typography",
            dedication && "Dedication page",
            preface && "Preface page",
            howToUseThisBook && "How to Use This Book page",
            whatYouWillLearn && "What You Will Learn page",
            whoThisBookIsFor && "Who This Book Is For page"
          ].filter(Boolean).map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-500">✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Download buttons */}
      <section className="book-panel">
        <h3 className="text-sm font-bold text-slate-900">Download</h3>
        <p className="mt-1 text-xs text-slate-500">
          PDF is print-ready. DOCX opens in Word or Google Docs — update the table of contents after opening.
        </p>

        {status && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${status.includes("fail") || status.includes("error") || status.includes("Could not") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
            {status}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pdfBusy}
            onClick={exportPdf}
            className="rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-600/25 hover:from-sky-700 disabled:opacity-50"
          >
            {pdfBusy ? "Building PDF…" : "Download PDF"}
          </button>
          <button
            type="button"
            disabled={docxBusy}
            onClick={exportDocx}
            className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-semibold text-sky-800 shadow-sm hover:bg-sky-100 disabled:opacity-50"
          >
            {docxBusy ? "Building Word file…" : "Download Word (.docx)"}
          </button>
        </div>

        <p className="mt-3 text-[10px] text-slate-400">
          In Word: click inside the table of contents and press F9 (or right-click → Update Field) to populate page numbers.
        </p>
      </section>

      {/* Listing preview */}
      {bundle.description && (
        <section className="book-panel">
          <h3 className="text-sm font-bold text-slate-900">Listing preview</h3>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{bundle.description}</p>
          {bundle.shortHook && (
            <p className="mt-4 border-t border-slate-100 pt-4 text-sm font-medium text-sky-800">{bundle.shortHook}</p>
          )}
        </section>
      )}

      {/* Complete / exit */}
      <section className="flex flex-col items-center gap-4 pb-8 sm:flex-row sm:justify-center">
        {!project.finishedAt && (
          <button
            type="button"
            onClick={onMarkComplete}
            className="rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 px-8 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 hover:from-emerald-700"
          >
            Mark project complete
          </button>
        )}
        {project.finishedAt && (
          <p className="text-sm font-medium text-emerald-700">
            Completed {new Date(project.finishedAt).toLocaleString()}
          </p>
        )}
        <Link
          href="/"
          className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:border-sky-200 hover:text-sky-900"
        >
          Exit to home
        </Link>
      </section>
    </section>
  );
}
