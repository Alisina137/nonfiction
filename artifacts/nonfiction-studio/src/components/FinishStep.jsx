import { useState, useEffect, useMemo, useRef } from "react";
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
import { assessReferenceOverlap } from "@/lib/resources/referenceIntelligence";
import { buildPublishingPreflight } from "@/lib/resources/manuscriptEvidence";
import {
  buildCitationReadyProject,
  buildCitationRegistry,
  buildPrecisionEvidenceAudit,
  buildPublicationConsistencyReport
} from "@/lib/resources/publicationEvidence";
import { intelligenceService } from "@/intelligence";

const FM_STORAGE_KEY = "nonfiction-ai-front-matter";
const DEV_EDIT_KEY       = "nonfiction-ai-dev-edit";
const BENCH_HIST_KEY     = "nonfiction-ai-bench-history";
const MAX_BENCH_HIST     = 5;
const READER_PERSONA_KEY = "nonfiction-ai-reader-personas";
const CITATION_STYLE_KEY = "nonfiction-ai-citation-style";

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

function loadBenchHistory() {
  try { return JSON.parse(window.localStorage.getItem(BENCH_HIST_KEY) || "[]"); } catch { return []; }
}

function saveDevEdit(data) {
  try {
    window.localStorage.setItem(DEV_EDIT_KEY, JSON.stringify(data));
    const history = loadBenchHistory();
    const entry   = { ...data, _runAt: new Date().toISOString() };
    const next    = [entry, ...history].slice(0, MAX_BENCH_HIST);
    window.localStorage.setItem(BENCH_HIST_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

function loadReaderPersonas() {
  try { return JSON.parse(window.localStorage.getItem(READER_PERSONA_KEY) || "null"); } catch { return null; }
}
function saveReaderPersonas(data) {
  try { window.localStorage.setItem(READER_PERSONA_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

const MULTI_FORMAT_KEY = "nonfiction-ai-multi-format";
function loadMultiFormat() {
  try { return JSON.parse(window.localStorage.getItem(MULTI_FORMAT_KEY) || "null"); } catch { return null; }
}
function saveMultiFormat(data) {
  try { window.localStorage.setItem(MULTI_FORMAT_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function getDownloadFilename(response, fallback) {
  const disposition = response.headers.get("content-disposition") || "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded?.[1]) {
    try { return decodeURIComponent(encoded[1].replace(/^["']|["']$/g, "")); } catch { /* use fallback */ }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain?.[1]?.trim() || fallback;
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

const PRIORITY_STYLE = {
  Critical: { bg: "bg-red-50",    border: "border-red-200",    label: "text-red-800",    badge: "bg-red-100 text-red-700" },
  Major:    { bg: "bg-amber-50",  border: "border-amber-200",  label: "text-amber-900",  badge: "bg-amber-100 text-amber-700" },
  Moderate: { bg: "bg-sky-50",    border: "border-sky-200",    label: "text-sky-900",    badge: "bg-sky-100 text-sky-700" },
  Minor:    { bg: "bg-slate-50",  border: "border-slate-200",  label: "text-slate-700",  badge: "bg-slate-100 text-slate-600" },
  Cosmetic: { bg: "bg-white",     border: "border-slate-100",  label: "text-slate-500",  badge: "bg-slate-50 text-slate-400" },
};

const MARKET_POSITION_COLOR = {
  Introductory: "bg-emerald-50 text-emerald-800",
  Intermediate: "bg-sky-50 text-sky-800",
  Advanced:     "bg-violet-50 text-violet-800",
  Professional: "bg-indigo-50 text-indigo-800",
  Executive:    "bg-purple-50 text-purple-800",
  Academic:     "bg-slate-100 text-slate-700",
  Practical:    "bg-teal-50 text-teal-800",
  Reference:    "bg-orange-50 text-orange-800",
};

const READER_EXP_LABELS = {
  clarity:                  "Clarity",
  confidence:               "Reader Confidence",
  motivation:               "Motivation",
  progress:                 "Sense of Progress",
  retention:                "Content Retention",
  satisfaction:             "Overall Satisfaction",
  completionLikelihood:     "Completion Likelihood",
  recommendationLikelihood: "Recommendation Likelihood",
};

function PublishingReadinessPanel({ devEdit, devEditBusy, devEditError, onRetry, benchHistory }) {
  const [showDetails,  setShowDetails]  = useState(false);
  const [showHistory,  setShowHistory]  = useState(false);

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

      {/* Score + approval badge + market position */}
      <div className="flex items-center gap-5">
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3">
          <span className={`text-3xl font-extrabold tabular-nums ${overall >= 8 ? "text-emerald-600" : overall >= 6.5 ? "text-sky-600" : "text-amber-600"}`}>
            {overall.toFixed(1)}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">out of 10</span>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${approved ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"}`}>
              {approved ? "✓ Approved for publication" : "⚠ Improvements recommended"}
            </span>
            {devEdit.marketPosition && (
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${MARKET_POSITION_COLOR[devEdit.marketPosition] || "bg-slate-100 text-slate-600"}`}>
                {devEdit.marketPosition}
              </span>
            )}
          </div>
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

      {/* Revision priorities */}
      {Array.isArray(devEdit.revisionPriorities) && devEdit.revisionPriorities.filter(rp => rp.items?.length > 0).length > 0 ? (
        <div className="space-y-2">
          {devEdit.revisionPriorities.filter(rp => rp.items?.length > 0).slice(0, 3).map((rp, i) => {
            const s = PRIORITY_STYLE[rp.level] || PRIORITY_STYLE.Moderate;
            return (
              <div key={i} className={`rounded-xl border ${s.border} ${s.bg} px-3 py-2.5 space-y-1`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${s.label}`}>
                  <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[9px] ${s.badge}`}>{rp.level}</span>
                </p>
                {rp.items.slice(0, 3).map((item, j) => (
                  <div key={j} className={`flex gap-2 text-xs ${s.label}`}>
                    <span className="mt-0.5 shrink-0 font-bold">→</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : highPriority.length > 0 && (
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

      {/* Strengths — always visible */}
      {Array.isArray(devEdit.strengths) && devEdit.strengths.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Protected Strengths</p>
          {devEdit.strengths.map((s, i) => (
            <div key={i} className="flex gap-2 text-xs text-emerald-900">
              <span className="mt-0.5 shrink-0">★</span>
              <div>
                <span className="font-semibold">{s.area}</span>
                {s.dimension && <span className="ml-1 text-emerald-600">({s.dimension})</span>}
                {s.note && <p className="mt-0.5 text-emerald-800">{s.note}</p>}
                {s.protectionAdvice && <p className="mt-0.5 text-emerald-600 italic">{s.protectionAdvice}</p>}
              </div>
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

          {/* Reader Experience Model */}
          {devEdit.readerExperience && Object.keys(devEdit.readerExperience).length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Reader Experience Model</p>
              {Object.entries(READER_EXP_LABELS).map(([key, label]) => {
                const val = devEdit.readerExperience[key];
                if (val == null) return null;
                return (
                  <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5">
                    <span className="text-xs text-slate-600">{label}</span>
                    <div className="w-40">
                      <ScoreBar score={val} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Category Benchmarks */}
          {devEdit.categoryBenchmarks && Object.keys(devEdit.categoryBenchmarks).length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Category Benchmarks</p>
              {Object.entries(devEdit.categoryBenchmarks).map(([key, val]) => (
                <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5">
                  <span className="text-xs text-slate-600">{key}</span>
                  <div className="w-40">
                    <ScoreBar score={val} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Archetype Benchmarks */}
          {devEdit.archetypeBenchmarks && Object.keys(devEdit.archetypeBenchmarks).length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Archetype Benchmarks</p>
              {Object.entries(devEdit.archetypeBenchmarks).map(([key, val]) => (
                <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5">
                  <span className="text-xs text-slate-600">{key}</span>
                  <div className="w-40">
                    <ScoreBar score={val} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* All revision priorities */}
          {Array.isArray(devEdit.revisionPriorities) && devEdit.revisionPriorities.filter(rp => rp.items?.length > 0).length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">All Revision Priorities</p>
              {devEdit.revisionPriorities.filter(rp => rp.items?.length > 0).map((rp, i) => {
                const s = PRIORITY_STYLE[rp.level] || PRIORITY_STYLE.Moderate;
                return (
                  <div key={i} className={`rounded-xl border ${s.border} ${s.bg} px-3 py-2 space-y-1`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${s.label}`}>{rp.level}</span>
                    {rp.items.map((item, j) => (
                      <p key={j} className={`flex gap-1.5 text-xs ${s.label}`}><span className="shrink-0">→</span>{item}</p>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

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

      {/* Benchmark history */}
      {Array.isArray(benchHistory) && benchHistory.length > 1 && (
        <div className="border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="w-full rounded-lg border border-slate-100 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
          >
            {showHistory ? "Hide benchmark history ↑" : `Benchmark history (${Math.min(benchHistory.length, MAX_BENCH_HIST)} runs) ↓`}
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1.5">
              {benchHistory.map((run, i) => {
                const runScore = run.bookScorecard?.overallPublishingScore ?? 0;
                const runDate  = run._runAt ? new Date(run._runAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : `Run ${benchHistory.length - i}`;
                return (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className="text-slate-500">{i === 0 ? "Latest" : runDate}</span>
                    <span className={`font-bold tabular-nums ${runScore >= 8 ? "text-emerald-600" : runScore >= 6.5 ? "text-sky-600" : "text-amber-600"}`}>{runScore.toFixed(1)}</span>
                    {run.marketPosition && <span className="text-[10px] text-slate-400">{run.marketPosition}</span>}
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${run.bookApproval?.approved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-600"}`}>
                      {run.bookApproval?.approved ? "✓" : "⚠"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const CONFUSION_TYPE_LABEL = {
  undefined_concept:   "Undefined Concept",
  missing_prerequisite:"Missing Prerequisite",
  ambiguous_wording:   "Ambiguous Wording",
  logical_jump:        "Logical Jump",
  overloaded:          "Overloaded",
};
const BOREDOM_TYPE_LABEL = {
  too_basic:         "Too Basic",
  repetitive:        "Repetitive",
  slow_pacing:       "Slow Pacing",
  low_variety:       "Low Variety",
  excessive_theory:  "Excessive Theory",
};
const PERSONA_SCORE_LABELS = {
  attention:         "Attention",
  understanding:     "Understanding",
  motivation:        "Motivation",
  retention:         "Retention",
  practicality:      "Practicality",
  confidence:        "Confidence",
  curiosity:         "Curiosity",
  momentum:          "Momentum",
  overallExperience: "Overall Experience",
};
const ENGAGEMENT_COLOR = {
  high:   "bg-emerald-50 text-emerald-800 ring-emerald-200",
  medium: "bg-sky-50 text-sky-800 ring-sky-200",
  low:    "bg-amber-50 text-amber-800 ring-amber-200",
};
const CONFUSION_RISK_COLOR = {
  low:    "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high:   "bg-red-50 text-red-700",
};

function ReaderPersonaPanel({ rp, rpBusy, rpError, onRetry }) {
  const [showDetails, setShowDetails] = useState(false);

  if (rpBusy) {
    return (
      <section className="book-panel space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-violet-500" />
          <p className="text-xs font-medium text-slate-500">Simulating reader personas…</p>
        </div>
        <p className="text-[11px] text-slate-400">Running the Reader Experience simulation — this takes 30–60 seconds.</p>
      </section>
    );
  }

  if (rpError) {
    return (
      <section className="book-panel space-y-2">
        <p className="text-xs font-semibold text-amber-700">Reader Simulation failed</p>
        <p className="text-xs text-slate-500">{rpError}</p>
        <button type="button" onClick={onRetry} className="text-xs font-semibold text-slate-500 hover:text-slate-800">↻ Retry</button>
      </section>
    );
  }

  if (!rp) return null;

  const be  = rp.bookExperience || {};
  const gm  = rp.globalMemory   || {};
  const pc  = rp.personaComparison || {};
  const overallScore = be.overallReaderExperienceScore ?? 0;

  return (
    <section className="book-panel space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Reader Simulation</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {Array.isArray(rp.selectedPersonas) && rp.selectedPersonas.length > 0
              ? `${rp.selectedPersonas.length} personas simulated — confusion, boredom, and implementation gaps detected.`
              : "Manuscript evaluated from multiple reader perspectives."}
          </p>
        </div>
        <button type="button" onClick={onRetry} className="shrink-0 text-xs font-semibold text-slate-400 hover:text-slate-600" title="Re-run reader simulation">
          ↻ Re-simulate
        </button>
      </div>

      {/* Score row */}
      <div className="flex items-center gap-5">
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3">
          <span className={`text-3xl font-extrabold tabular-nums ${overallScore >= 8 ? "text-emerald-600" : overallScore >= 6.5 ? "text-violet-600" : "text-amber-600"}`}>
            {overallScore.toFixed(1)}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">reader exp.</span>
        </div>
        <div className="flex-1 space-y-1.5">
          {be.completionLikelihood != null && (
            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
              <span className="text-xs text-slate-600">Completion Likelihood</span>
              <div className="w-32"><ScoreBar score={be.completionLikelihood} /></div>
            </div>
          )}
          {be.recommendationLikelihood != null && (
            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
              <span className="text-xs text-slate-600">Recommendation Likelihood</span>
              <div className="w-32"><ScoreBar score={be.recommendationLikelihood} /></div>
            </div>
          )}
          {pc.keyInsight && <p className="text-[11px] italic text-slate-500">{pc.keyInsight}</p>}
        </div>
      </div>

      {/* Persona pills */}
      {Array.isArray(rp.selectedPersonas) && rp.selectedPersonas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rp.selectedPersonas.map((p, i) => (
            <span key={i} className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200">{p}</span>
          ))}
          {pc.strongestFit && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">★ Best fit: {pc.strongestFit}</span>
          )}
        </div>
      )}

      {/* Confusion points */}
      {Array.isArray(rp.confusionPoints) && rp.confusionPoints.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-red-200 bg-red-50/40 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-800">Confusion Risks</p>
          {rp.confusionPoints.slice(0, 4).map((c, i) => (
            <div key={i} className="flex gap-2 text-xs text-red-900">
              <span className="mt-0.5 shrink-0 font-bold">!</span>
              <div>
                <span className="font-semibold">{c.location || `Ch ${c.chapterNumber}`}:</span>{" "}
                <span className="mr-1.5 rounded bg-red-100 px-1 py-0.5 text-[9px] font-bold uppercase text-red-700">{CONFUSION_TYPE_LABEL[c.type] || c.type}</span>
                {c.description}
                {c.recommendation && <p className="mt-0.5 text-red-600 italic">{c.recommendation}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Boredom risks */}
      {Array.isArray(rp.boredomRisks) && rp.boredomRisks.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Engagement Risks</p>
          {rp.boredomRisks.slice(0, 3).map((b, i) => (
            <div key={i} className="flex gap-2 text-xs text-amber-900">
              <span className="mt-0.5 shrink-0">↓</span>
              <div>
                <span className="font-semibold">{b.location || `Ch ${b.chapterNumber}`}:</span>{" "}
                <span className="mr-1.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-700">{BOREDOM_TYPE_LABEL[b.type] || b.type}</span>
                {b.description}
                {b.recommendation && <p className="mt-0.5 text-amber-600 italic">{b.recommendation}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Global memory: top objections + questions */}
      {(gm.topObjections?.length > 0 || gm.topQuestions?.length > 0) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {gm.topObjections?.length > 0 && (
            <div className="space-y-1 rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Top Reader Objections</p>
              {gm.topObjections.map((o, i) => (
                <p key={i} className="flex gap-1.5 text-xs text-slate-600"><span className="shrink-0 text-slate-400">✕</span>{o}</p>
              ))}
            </div>
          )}
          {gm.topQuestions?.length > 0 && (
            <div className="space-y-1 rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Top Reader Questions</p>
              {gm.topQuestions.map((q, i) => (
                <p key={i} className="flex gap-1.5 text-xs text-slate-600"><span className="shrink-0 text-amber-400">?</span>{q}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expand/collapse detailed breakdown */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
      >
        {showDetails ? "Hide persona details ↑" : "Show persona details ↓"}
      </button>

      {showDetails && (
        <div className="space-y-4 pt-1">
          {/* Per-persona engagement scores */}
          {Array.isArray(rp.personas) && rp.personas.map((persona, pi) => (
            <div key={pi} className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">{persona.name}</span>
                {persona.engagementScores?.overallExperience != null && (
                  <span className={`text-xs font-bold tabular-nums ${persona.engagementScores.overallExperience >= 8 ? "text-emerald-600" : persona.engagementScores.overallExperience >= 6.5 ? "text-sky-600" : "text-amber-600"}`}>
                    {persona.engagementScores.overallExperience.toFixed(1)}
                  </span>
                )}
              </div>
              {persona.profile?.motivation && (
                <p className="text-[11px] italic text-slate-500">{persona.profile.motivation}</p>
              )}
              {/* Engagement scores */}
              <div className="space-y-1.5">
                {Object.entries(PERSONA_SCORE_LABELS).map(([key, label]) => {
                  const val = persona.engagementScores?.[key];
                  if (val == null) return null;
                  return (
                    <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-3">
                      <span className="text-[11px] text-slate-500">{label}</span>
                      <div className="w-32"><ScoreBar score={val} /></div>
                    </div>
                  );
                })}
              </div>
              {/* Chapter highlights summary */}
              {Array.isArray(persona.chapterHighlights) && persona.chapterHighlights.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {persona.chapterHighlights.map((ch, ci) => (
                    <span
                      key={ci}
                      title={ch.note || ""}
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ring-1 ${ENGAGEMENT_COLOR[ch.engagementLevel] || ENGAGEMENT_COLOR.medium}`}
                    >
                      Ch {ch.chapterNumber} {ch.wouldContinue ? "" : "✕"}
                    </span>
                  ))}
                </div>
              )}
              {/* Emotional highlights */}
              {(persona.emotionalHighPoints?.length > 0 || persona.emotionalLowPoints?.length > 0) && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {persona.emotionalHighPoints?.slice(0, 2).map((h, i) => (
                    <p key={i} className="flex gap-1 text-[11px] text-emerald-700"><span className="shrink-0">↑</span>{h}</p>
                  ))}
                  {persona.emotionalLowPoints?.slice(0, 2).map((l, i) => (
                    <p key={i} className="flex gap-1 text-[11px] text-amber-700"><span className="shrink-0">↓</span>{l}</p>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Implementation gaps */}
          {Array.isArray(rp.implementationGaps) && rp.implementationGaps.length > 0 && (
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Implementation Gaps</p>
              {rp.implementationGaps.map((g, i) => (
                <div key={i} className="flex gap-2 text-xs text-slate-700">
                  <span className="mt-0.5 shrink-0 text-slate-400">→</span>
                  <div>
                    <span className="font-semibold">{g.location || `Ch ${g.chapterNumber}`}:</span> {g.description}
                    {g.recommendation && <p className="mt-0.5 text-sky-600 italic">{g.recommendation}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Question predictions */}
          {Array.isArray(rp.questionPredictions) && rp.questionPredictions.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Predicted Reader Questions</p>
              {rp.questionPredictions.map((qp, i) => (
                <div key={i} className="space-y-0.5 rounded-lg bg-slate-50 px-2.5 py-2">
                  <p className="text-[11px] font-semibold text-slate-700">Chapter {qp.chapterNumber}</p>
                  {qp.topQuestions.map((q, j) => (
                    <p key={j} className="flex gap-1.5 text-xs text-slate-600">
                      <span className="shrink-0 text-amber-400">?</span>
                      {q}
                      {!qp.answeredLater && j === 0 && <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-600">NOT ANSWERED</span>}
                    </p>
                  ))}
                  {qp.answeredLater && qp.answerLocation && (
                    <p className="text-[10px] text-emerald-600">✓ Answered in {qp.answerLocation}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Persona comparison */}
          {pc.dimensionScores?.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Persona Comparison</p>
              {pc.dimensionScores.map((dim, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-[11px] font-semibold text-slate-600">{dim.dimension}</p>
                  {Object.entries(dim.scores || {}).map(([pname, score]) => (
                    <div key={pname} className="grid grid-cols-[1fr_auto] items-center gap-3">
                      <span className="text-[11px] text-slate-500 truncate">{pname}</span>
                      <div className="w-32"><ScoreBar score={score} /></div>
                    </div>
                  ))}
                </div>
              ))}
              {pc.weakestFit && (
                <p className="text-[11px] text-slate-500">
                  <span className="font-semibold">Least served:</span> {pc.weakestFit}
                  {" — "}consider adding content or examples that speak directly to this reader type.
                </p>
              )}
            </div>
          )}

          {/* Global memory: confusing concepts + strongest sections */}
          {(gm.confusingConcepts?.length > 0 || gm.strongestSections?.length > 0) && (
            <div className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
              {gm.confusingConcepts?.length > 0 && (
                <div className="space-y-1 rounded-xl bg-red-50/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Confusing Concepts</p>
                  {gm.confusingConcepts.map((c, i) => (
                    <p key={i} className="text-xs text-red-800">• {c}</p>
                  ))}
                </div>
              )}
              {gm.strongestSections?.length > 0 && (
                <div className="space-y-1 rounded-xl bg-emerald-50/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Strongest Sections</p>
                  {gm.strongestSections.map((s, i) => (
                    <p key={i} className="text-xs text-emerald-800">★ {s}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Book experience assessment */}
          {(be.overallFlow || be.motivationConsistency || be.implementationReadiness) && (
            <div className="space-y-1 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Book Experience Assessment</p>
              {be.overallFlow && <p className="text-xs text-slate-600"><span className="font-semibold">Flow:</span> {be.overallFlow}</p>}
              {be.motivationConsistency && <p className="text-xs text-slate-600"><span className="font-semibold">Motivation:</span> {be.motivationConsistency}</p>}
              {be.implementationReadiness && <p className="text-xs text-slate-600"><span className="font-semibold">Implementation:</span> {be.implementationReadiness}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const EFFORT_COLOR = {
  low:    "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high:   "bg-red-50 text-red-700",
};
const BIZ_VALUE_COLOR = {
  high:   "bg-emerald-50 text-emerald-700",
  medium: "bg-sky-50 text-sky-700",
  low:    "bg-slate-100 text-slate-600",
};
const READINESS_STYLE = {
  publish_ready:  { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", label: "✓ Ready to publish" },
  needs_revision: { bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-200",   label: "⚠ Needs revision" },
  not_ready:      { bg: "bg-red-50",     text: "text-red-700",     ring: "ring-red-200",      label: "✕ Not ready" },
};
const SOURCE_ICON = { exercises: "✏", frameworks: "⬡", stories: "◈", concepts: "◉", glossary: "§" };
const FORMAT_ICON = {
  companion_workbook: "📓", study_guide: "📚", discussion_guide: "💬", facilitator_guide: "🎓",
  executive_summary: "⚡", quick_reference_guide: "📋", cheat_sheet: "📄",
  course_curriculum: "🎯", lesson_plans: "📐", email_course: "✉",
  blog_article_series: "✍", newsletter_series: "📬",
  podcast_outline: "🎙", audiobook_script: "🔊", video_script: "🎬",
  presentation_deck: "📊", workshop_manual: "🛠", webinar_outline: "💻",
  social_media_series: "📱", faq_guide: "❓", glossary: "§",
};

function AssetCount({ label, count, color }) {
  if (!count) return null;
  return (
    <div className={`flex flex-col items-center rounded-xl border px-3 py-2 ${color}`}>
      <span className="text-lg font-extrabold tabular-nums">{count}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-75">{label}</span>
    </div>
  );
}

function MultiFormatPanel({ mf, mfBusy, mfError, onRetry }) {
  const [showDetails, setShowDetails] = useState(false);
  const [expandedFormat, setExpandedFormat] = useState(null);

  if (mfBusy) {
    return (
      <section className="book-panel space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
          <p className="text-xs font-medium text-slate-500">Building Publishing Content Model…</p>
        </div>
        <p className="text-[11px] text-slate-400">Analysing reusable assets and recommended publishing formats — 30–60 seconds.</p>
      </section>
    );
  }

  if (mfError) {
    return (
      <section className="book-panel space-y-2">
        <p className="text-xs font-semibold text-amber-700">Publishing Model failed</p>
        <p className="text-xs text-slate-500">{mfError}</p>
        <button type="button" onClick={onRetry} className="text-xs font-semibold text-slate-500 hover:text-slate-800">↻ Retry</button>
      </section>
    );
  }

  if (!mf) return null;

  const mcm = mf.masterContentModel || {};
  const cas = mcm.contentAssetSummary || {};
  const pp  = mf.publishingPipeline  || {};
  const cfv = mf.crossFormatValidation || {};
  const rs  = READINESS_STYLE[mf.publishingReadiness] || READINESS_STYLE.needs_revision;

  return (
    <section className="book-panel space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Publishing Formats</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Master Content Model — {Array.isArray(mf.recommendedFormats) ? mf.recommendedFormats.length : 0} secondary formats recommended from your book's reusable assets.
          </p>
        </div>
        <button type="button" onClick={onRetry} className="shrink-0 text-xs font-semibold text-slate-400 hover:text-slate-600">↻ Rebuild</button>
      </div>

      {/* Readiness + pipeline score */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${rs.bg} ${rs.text} ${rs.ring}`}>{rs.label}</span>
        {pp.pipelineScore != null && (
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
            Pipeline {pp.pipelineScore.toFixed(1)}/10
          </span>
        )}
        {cfv.consistencyScore != null && (
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${cfv.consistencyScore >= 8 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : cfv.consistencyScore >= 6.5 ? "bg-sky-50 text-sky-700 ring-sky-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>
            Consistency {cfv.consistencyScore.toFixed(1)}/10
          </span>
        )}
      </div>

      {/* Content Asset Summary */}
      {(cas.frameworks > 0 || cas.stories > 0 || cas.exercises > 0 || cas.concepts > 0) && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Reusable Content Assets</p>
          <div className="flex flex-wrap gap-2">
            <AssetCount label="Frameworks" count={cas.frameworks} color="border-violet-100 bg-violet-50/60 text-violet-800" />
            <AssetCount label="Exercises"  count={cas.exercises}  color="border-emerald-100 bg-emerald-50/60 text-emerald-800" />
            <AssetCount label="Stories"    count={cas.stories}    color="border-amber-100 bg-amber-50/60 text-amber-800" />
            <AssetCount label="Concepts"   count={cas.concepts}   color="border-sky-100 bg-sky-50/60 text-sky-800" />
            <AssetCount label="Glossary"   count={cas.glossaryTerms} color="border-slate-200 bg-slate-50 text-slate-700" />
          </div>
        </div>
      )}

      {/* Recommended formats grid */}
      {Array.isArray(mf.recommendedFormats) && mf.recommendedFormats.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recommended Secondary Formats</p>
          {mf.recommendedFormats.map((fmt, i) => {
            const icon = FORMAT_ICON[fmt.formatId] || "📄";
            const isExpanded = expandedFormat === i;
            return (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{fmt.formatName}</p>
                      {fmt.idealLength && <p className="text-[10px] text-slate-500">{fmt.idealLength}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${EFFORT_COLOR[fmt.estimatedEffort] || EFFORT_COLOR.medium}`}>{fmt.estimatedEffort} effort</span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${BIZ_VALUE_COLOR[fmt.businessValue] || BIZ_VALUE_COLOR.medium}`}>{fmt.businessValue} value</span>
                  </div>
                </div>
                {/* Readiness score bar */}
                <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <span className="text-[11px] text-slate-500">Content readiness</span>
                  <div className="w-32"><ScoreBar score={fmt.readyToPublishScore} /></div>
                </div>
                {/* Sources + reuse ratio */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {fmt.primaryContentSources.map((src, j) => (
                    <span key={j} className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                      {SOURCE_ICON[src] || ""} {src}
                    </span>
                  ))}
                  {fmt.contentReuseRatio > 0 && (
                    <span className="ml-auto text-[10px] text-slate-400">{Math.round(fmt.contentReuseRatio * 100)}% reuse</span>
                  )}
                </div>
                {/* Purpose (always visible) */}
                {fmt.purpose && <p className="text-[11px] italic text-slate-500">{fmt.purpose}</p>}
                {/* Adaptation strategy toggle */}
                {fmt.adaptationStrategy && (
                  <>
                    <button
                      type="button"
                      onClick={() => setExpandedFormat(isExpanded ? null : i)}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      {isExpanded ? "Hide strategy ↑" : "Adaptation strategy ↓"}
                    </button>
                    {isExpanded && (
                      <p className="rounded-lg bg-indigo-50 px-3 py-2 text-[11px] leading-relaxed text-indigo-800">{fmt.adaptationStrategy}</p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Expand/collapse full details */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
      >
        {showDetails ? "Hide content model details ↑" : "Show content model details ↓"}
      </button>

      {showDetails && (
        <div className="space-y-4 pt-1">
          {/* Frameworks */}
          {mcm.frameworks?.length > 0 && (
            <div className="space-y-1 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600">Frameworks ({mcm.frameworks.length})</p>
              {mcm.frameworks.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                  <span className="shrink-0 text-violet-400">⬡</span>
                  <span className="font-medium">{f.name}</span>
                  <span className="text-[10px] text-slate-400">Ch {f.chapters?.join(", ")}</span>
                  <span className={`ml-auto rounded px-1 py-0.5 text-[9px] font-bold ${f.reusability === "high" ? "bg-emerald-50 text-emerald-600" : f.reusability === "low" ? "bg-slate-100 text-slate-500" : "bg-sky-50 text-sky-600"}`}>{f.reusability}</span>
                </div>
              ))}
            </div>
          )}

          {/* Exercises */}
          {mcm.exercises?.length > 0 && (
            <div className="space-y-1 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Exercises ({mcm.exercises.length})</p>
              {mcm.exercises.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                  <span className="shrink-0 text-emerald-400">✏</span>
                  <span className="font-medium">{e.title}</span>
                  <span className="text-[10px] text-slate-400">Ch {e.chapter} · {e.type}</span>
                </div>
              ))}
            </div>
          )}

          {/* Stories */}
          {mcm.stories?.length > 0 && (
            <div className="space-y-1 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Stories & Examples ({mcm.stories.length})</p>
              {mcm.stories.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                  <span className="shrink-0 text-amber-400">◈</span>
                  <span className="font-medium">{s.title}</span>
                  <span className="text-[10px] text-slate-400">Ch {s.chapter} · {s.type}</span>
                </div>
              ))}
            </div>
          )}

          {/* Content Mapping */}
          {Array.isArray(mf.contentMapping) && mf.contentMapping.length > 0 && (
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Content Mapping Rules</p>
              {mf.contentMapping.map((m, i) => (
                <div key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <span>{m.sourceElement}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-indigo-700">{m.targetElement}</span>
                  </div>
                  <p className="mt-0.5 text-slate-600">{m.transformationRule}</p>
                  {m.benefitsFormats?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.benefitsFormats.map((f, j) => (
                        <span key={j} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600">{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Cross-format validation */}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cross-Format Validation</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {[
                { key: "terminologyConsistent",    label: "Terminology" },
                { key: "frameworkNamesConsistent", label: "Framework Names" },
                { key: "conceptOrderConsistent",   label: "Concept Order" },
                { key: "knowledgeGraphIntegrity",  label: "Knowledge Graph" },
                { key: "bookDNAAlignment",         label: "Book DNA" },
              ].map(({ key, label }) => (
                <div key={key} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium ${cfv[key] ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                  <span>{cfv[key] ? "✓" : "○"}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            {cfv.issues?.filter(i => i.description).length > 0 && (
              <div className="space-y-1.5 pt-1">
                {cfv.issues.filter(i => i.description).map((issue, i) => (
                  <div key={i} className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-xs">
                    <p className="font-semibold text-amber-800">{issue.type}</p>
                    <p className="text-amber-700">{issue.description}</p>
                    {issue.recommendation && <p className="mt-0.5 italic text-amber-600">{issue.recommendation}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Key concepts + glossary */}
          {(mcm.keyConcepts?.length > 0 || mcm.glossaryTerms?.length > 0) && (
            <div className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
              {mcm.keyConcepts?.length > 0 && (
                <div className="space-y-1 rounded-xl bg-sky-50/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Key Concepts</p>
                  {mcm.keyConcepts.map((c, i) => (
                    <p key={i} className="text-xs text-sky-800">◉ {c}</p>
                  ))}
                </div>
              )}
              {mcm.glossaryTerms?.length > 0 && (
                <div className="space-y-1 rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Glossary Terms</p>
                  {mcm.glossaryTerms.map((t, i) => (
                    <p key={i} className="text-xs text-slate-700">§ {t}</p>
                  ))}
                </div>
              )}
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

function EvidenceAuditPanel({ audit }) {
  const [showSources, setShowSources] = useState(false);
  const [showClaims, setShowClaims] = useState(false);
  const hasClaims = audit.unsupportedClaimCount > 0;

  return (
    <section className={`book-panel border ${hasClaims ? "border-amber-200 bg-amber-50/30" : "border-sky-200 bg-sky-50/20"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Manuscript Evidence Audit</p>
          <h3 className="mt-1 text-sm font-bold text-slate-900">
            {hasClaims ? "Some factual claims need source review" : "Tracked evidence is internally consistent"}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {audit.sectionsWithEvidence} of {audit.draftedSections} drafted sections retain retrieved source evidence.
            Claim checks compare claim-like sentences only against evidence saved with that section.
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${hasClaims ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>
          {audit.coveragePercent}% coverage
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {[
          ["Sources used", audit.sourceUsage.length],
          ["Evidence-backed", audit.sectionsWithEvidence],
          ["Supported claims", audit.supportedClaimCount],
          ["Stale pruned", audit.staleEvidenceCount || 0],
          ["Needs review", audit.unsupportedClaimCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/80 bg-white/80 p-3 text-center">
            <p className="text-lg font-bold text-slate-900">{value}</p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowSources((value) => !value)}
          className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-sky-800 hover:bg-sky-50"
        >
          {showSources ? "Hide source inspector" : "Show source inspector"}
        </button>
        {audit.unsupportedClaimCount > 0 && (
          <button
            type="button"
            onClick={() => setShowClaims((value) => !value)}
            className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-50"
          >
            {showClaims ? "Hide claim review" : `Review ${audit.unsupportedClaimCount} claims`}
          </button>
        )}
      </div>

      {showSources && (
        <div className="mt-4 space-y-2">
          {audit.sections.map((section) => (
            <article key={section.sectionId} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-900">{section.sectionTitle}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {section.evidenceCount} evidence item{section.evidenceCount === 1 ? "" : "s"} · {section.sourceCount} source{section.sourceCount === 1 ? "" : "s"}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${section.evidenceCount ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {section.evidenceCount ? "SOURCE TRACKED" : "NO SOURCE"}
                </span>
              </div>
              {section.evidence.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {section.evidence.slice(0, 6).map((item, i) => (
                    <div key={`${item.sourceId}-${i}`} className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
                      <span className="font-semibold text-slate-800">{item.sourceTitle}</span>
                      {item.pageLabel ? <span className="text-slate-400"> · {item.pageLabel}</span> : null}
                      <span className="ml-1 rounded bg-slate-200/70 px-1 py-0.5 text-[9px] uppercase text-slate-500">{item.kind || "evidence"}</span>
                      <p className="mt-1 line-clamp-2">{item.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {showClaims && audit.unsupportedClaims.length > 0 && (
        <div className="mt-4 space-y-2">
          {audit.unsupportedClaims.slice(0, 20).map((claim, i) => (
            <article key={`${claim.sectionId}-${i}`} className="rounded-xl border border-amber-200 bg-white p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">{claim.sectionTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-700">{claim.text}</p>
              <p className="mt-1.5 text-[10px] text-amber-700">
                No matching retrieved evidence is saved with this section. Verify, rewrite, or remove the factual attribution/statistic before publishing.
              </p>
            </article>
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
        This audit is evidence-tracking QA, not external fact-checking. A “supported” claim means it matches retrieved evidence stored in this project.
      </p>
    </section>
  );
}

function PublicationConsistencyPanel({ report, citationRegistry }) {
  const [expanded, setExpanded] = useState(false);
  const reviews = report.checks.filter((check) => check.status === "review");

  return (
    <section className={`book-panel border ${reviews.length ? "border-amber-200 bg-amber-50/20" : "border-emerald-200 bg-emerald-50/20"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Publication Consistency</p>
          <h3 className="mt-1 text-sm font-bold text-slate-900">
            {reviews.length ? `${reviews.length} publishing detail${reviews.length === 1 ? "" : "s"} need review` : "Publishing surfaces are consistent"}
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Compares manuscript metadata with cover/publishing metadata and citation/export settings.
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${reviews.length ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
          {reviews.length ? `${reviews.length} REVIEW` : "PASS"}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-white/80 bg-white/80 p-3 text-center">
          <p className="text-lg font-bold text-slate-900">{report.passCount}</p>
          <p className="text-[10px] text-slate-500">Checks passed</p>
        </div>
        <div className="rounded-xl border border-white/80 bg-white/80 p-3 text-center">
          <p className="text-lg font-bold text-slate-900">{report.reviewCount}</p>
          <p className="text-[10px] text-slate-500">Need review</p>
        </div>
        <div className="rounded-xl border border-white/80 bg-white/80 p-3 text-center">
          <p className="text-lg font-bold text-slate-900">{citationRegistry.sources.length}</p>
          <p className="text-[10px] text-slate-500">Citable sources</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
      >
        {expanded ? "Hide consistency details" : "Show consistency details"}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {report.checks.map((check) => (
            <div key={check.id} className="rounded-xl border border-slate-100 bg-white p-3">
              <div className="flex items-start gap-2">
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  check.status === "pass"
                    ? "bg-emerald-100 text-emerald-700"
                    : check.status === "review"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-500"
                }`}>
                  {check.status}
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-800">{check.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{check.detail}</p>
                  {check.values && (
                    <div className="mt-1.5 grid gap-1 text-[10px] text-slate-500">
                      {check.values.manuscript && <span>Manuscript: {check.values.manuscript}</span>}
                      {check.values.cover && <span>Cover: {check.values.cover}</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PublishingPreflightPanel({ preflight }) {
  const tone = preflight.status === "block"
    ? "border-red-200 bg-red-50/30"
    : preflight.status === "review"
      ? "border-amber-200 bg-amber-50/30"
      : "border-emerald-200 bg-emerald-50/30";

  return (
    <section className={`book-panel border ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">KDP Publishing Preflight</p>
          <h3 className="mt-1 text-sm font-bold text-slate-900">
            {preflight.status === "block"
              ? "Required publishing fields are missing"
              : preflight.status === "review"
                ? "Ready for export after review"
                : "Preflight checks passed"}
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Checks metadata consistency, manuscript presence, layout selection, source safety, and evidence readiness before export.
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
          preflight.status === "block"
            ? "bg-red-100 text-red-700"
            : preflight.status === "review"
              ? "bg-amber-100 text-amber-800"
              : "bg-emerald-100 text-emerald-700"
        }`}>
          {preflight.blockingCount ? `${preflight.blockingCount} BLOCK` : preflight.warningCount ? `${preflight.warningCount} REVIEW` : "PASS"}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {preflight.checks.map((check) => (
          <div key={check.id} className="flex items-start gap-3 rounded-xl border border-white/80 bg-white/80 px-3 py-2.5">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              check.status === "pass"
                ? "bg-emerald-100 text-emerald-700"
                : check.status === "block"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
            }`}>
              {check.status === "pass" ? "✓" : check.status === "block" ? "!" : "○"}
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-800">{check.label}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{check.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10px] text-slate-400">
        This is an internal publishing preflight, not an Amazon approval or guarantee. Review the final KDP preview before publishing.
      </p>
    </section>
  );
}

function syntheticFrontMatterSubsection(title, role) {
  return {
    title,
    strategy: role,
    explanation: `Write the ${title} for this book.`,
    application: ""
  };
}

function FinalProductionPanel({ report, busy, error, onRun, onSync, canSync, archiveHistory = [] }) {
  const statusTone = report?.status === "pass"
    ? "border-emerald-200 bg-emerald-50/50"
    : report?.status === "block"
      ? "border-red-200 bg-red-50/40"
      : "border-amber-200 bg-amber-50/40";

  return (
    <section className={`book-panel border ${report ? statusTone : "border-slate-200"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Phase 04 · Final Production</p>
          <h3 className="mt-1 text-sm font-bold text-slate-900">Final pagination & KDP production check</h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">
            Renders the real paperback interior, validates final margins and trim, checks Cover Studio synchronization,
            and validates the generated EPUB structure before the final archive is created.
          </p>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={busy}
          className="shrink-0 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? "Running final check…" : report ? "↻ Re-run final check" : "Run Final Production Check"}
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}

      {!report && !busy && !error && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-500">
          Run this after your manuscript layout and front matter are final. The exact rendered page count is what should drive the paperback spine width.
        </div>
      )}

      {report && (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-white/80 bg-white/80 p-3 text-center">
              <p className="text-xl font-extrabold text-slate-900">{report.exactPageCount}</p>
              <p className="text-[10px] text-slate-500">Exact PDF pages</p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/80 p-3 text-center">
              <p className="text-sm font-extrabold text-slate-900">{report.trim?.label || "—"}</p>
              <p className="text-[10px] text-slate-500">Interior trim</p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/80 p-3 text-center">
              <p className="text-xl font-extrabold text-slate-900">{Number(report.cover?.spineWidth || 0).toFixed(3)}″</p>
              <p className="text-[10px] text-slate-500">Final spine width</p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/80 p-3 text-center">
              <p className={`text-sm font-extrabold uppercase ${
                report.status === "pass" ? "text-emerald-700" : report.status === "block" ? "text-red-700" : "text-amber-700"
              }`}>{report.status}</p>
              <p className="text-[10px] text-slate-500">{report.passed} pass · {report.reviews} review · {report.blocked} block</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {report.checks?.map((check) => (
              <div key={check.id} className="flex gap-2 rounded-xl border border-white/80 bg-white/75 px-3 py-2.5">
                <span className={`mt-0.5 shrink-0 font-bold ${
                  check.status === "pass" ? "text-emerald-600" : check.status === "block" ? "text-red-600" : "text-amber-600"
                }`}>
                  {check.status === "pass" ? "✓" : check.status === "block" ? "!" : "•"}
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-800">{check.label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
              report.epub?.status === "block"
                ? "bg-red-100 text-red-700"
                : report.epub?.status === "pass"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
            }`}>
              EPUB {String(report.epub?.status || "review").toUpperCase()}
            </span>
            {report.archiveManifest?.archiveId && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                Archive {report.archiveManifest.archiveId}
              </span>
            )}
            {archiveHistory.length > 0 && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-medium text-indigo-700">
                {archiveHistory.length} saved production snapshot{archiveHistory.length === 1 ? "" : "s"}
              </span>
            )}
            {canSync && (
              <button
                type="button"
                onClick={onSync}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100"
              >
                Sync {report.exactPageCount} pages to Cover Studio
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Paperback upload checklist", report.kdpChecklist?.paperback || []],
              ["Kindle eBook checklist", report.kdpChecklist?.ebook || []],
            ].map(([label, items]) => (
              <div key={label} className="rounded-xl border border-slate-100 bg-white/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                <div className="mt-2 space-y-1.5">
                  {items.map((item) => (
                    <p key={item.id} className="flex gap-2 text-[11px] leading-relaxed text-slate-600">
                      <span className={item.done ? "text-emerald-600" : "text-slate-300"}>{item.done ? "✓" : "○"}</span>
                      <span>{item.label}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default function FinishStep({ project, onMarkComplete, bookOutline, lessons, setLessons, fullProject, updateProject }) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [docxBusy, setDocxBusy] = useState(false);
  const [epubBusy, setEpubBusy] = useState(false);
  const [bundleBusy, setBundleBusy] = useState(false);
  const [productionBusy, setProductionBusy] = useState(false);
  const [productionReport, setProductionReport] = useState(null);
  const [productionError, setProductionError] = useState("");
  const [citationStyle, setCitationStyle] = useState(() => {
    try { return window.localStorage.getItem(CITATION_STYLE_KEY) || "none"; } catch { return "none"; }
  });
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
  const [benchHistory, setBenchHistory] = useState(() => loadBenchHistory());
  const devEditTriggered = useRef(false);

  const [rp, setRp] = useState(() => loadReaderPersonas());
  const [rpBusy, setRpBusy] = useState(false);
  const [rpError, setRpError] = useState("");
  const rpTriggered = useRef(false);

  const [mf, setMf] = useState(() => loadMultiFormat());
  const [mfBusy, setMfBusy] = useState(false);
  const [mfError, setMfError] = useState("");
  const mfTriggered = useRef(false);

  useEffect(() => {
    try { window.localStorage.setItem(CITATION_STYLE_KEY, citationStyle); } catch { /* ignore */ }
  }, [citationStyle]);

  // Persist front matter to localStorage whenever any field changes
  useEffect(() => {
    saveFrontMatter({ dedication, preface, howToUseThisBook, whatYouWillLearn, whoThisBookIsFor });
  }, [dedication, preface, howToUseThisBook, whatYouWillLearn, whoThisBookIsFor]);

  // Auto-trigger all three engines on mount (if no cached result)
  useEffect(() => {
    if (!devEdit && !devEditTriggered.current) {
      devEditTriggered.current = true;
      runDevelopmentalEdit();
    }
    if (!rp && !rpTriggered.current) {
      rpTriggered.current = true;
      runReaderPersonas();
    }
    if (!mf && !mfTriggered.current) {
      mfTriggered.current = true;
      runMultiFormat();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runDevelopmentalEdit() {
    setDevEditBusy(true);
    setDevEditError("");
    try {
      const digest   = buildManuscriptDigest(fullProject);
      const kg       = buildKnowledgeGraphSummary(fullProject);
      const ctx      = buildBookContext(fullProject);
      const category = fullProject?.research?.mainNicheLabel || fullProject?.research?.primaryNiche || "";
      const archetype = fullProject?.bookDetails?.structure || fullProject?.bookDetails?.bookType || "";
      const res = await fetch("/api/ai/developmental-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookContext: ctx, manuscriptDigest: digest, knowledgeGraph: kg, category, archetype })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Developmental edit failed.");
      }
      const data = await res.json();
      setDevEdit(data);
      saveDevEdit(data);
      setBenchHistory(loadBenchHistory());
      intelligenceService.recordEngineCompletion("devEdit", { qualityScore: data.overallPublishingScore, confidence: 0.85, provider: data._provider || "unknown" });
    } catch (e) {
      setDevEditError(e.message || "Could not complete the developmental edit.");
    } finally {
      setDevEditBusy(false);
    }
  }

  async function runReaderPersonas() {
    setRpBusy(true);
    setRpError("");
    try {
      const digest = buildManuscriptDigest(fullProject);
      const kg     = buildKnowledgeGraphSummary(fullProject);
      const ctx    = buildBookContext(fullProject);
      const res = await fetch("/api/ai/reader-personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookContext: ctx, manuscriptDigest: digest, knowledgeGraph: kg })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Reader simulation failed.");
      }
      const data = await res.json();
      setRp(data);
      saveReaderPersonas(data);
      intelligenceService.recordEngineCompletion("readerPersonas", { qualityScore: data.overallExperienceScore ?? 7.5, confidence: 0.8, provider: data._provider || "unknown" });
    } catch (e) {
      setRpError(e.message || "Could not complete the reader simulation.");
    } finally {
      setRpBusy(false);
    }
  }

  async function runMultiFormat() {
    setMfBusy(true);
    setMfError("");
    try {
      const digest = buildManuscriptDigest(fullProject);
      const kg     = buildKnowledgeGraphSummary(fullProject);
      const ctx    = buildBookContext(fullProject);
      const res = await fetch("/api/ai/multi-format-publishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookContext: ctx, manuscriptDigest: digest, knowledgeGraph: kg })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Publishing model failed.");
      }
      const data = await res.json();
      setMf(data);
      saveMultiFormat(data);
      intelligenceService.recordEngineCompletion("multiFormat", { qualityScore: data.publishingPipeline?.pipelineScore ?? 7.5, confidence: 0.82, provider: data._provider || "unknown" });
    } catch (e) {
      setMfError(e.message || "Could not complete the publishing model.");
    } finally {
      setMfBusy(false);
    }
  }

  const title = resolveBookTitle(project);
  const author = resolveAuthorName(project);
  const words = countManuscriptWords(project);
  const bundle = buildPublishingBundle(project);
  const referenceFiles = (fullProject?.resources?.files || []).filter((file) => file?.referenceAnalysis);
  const referenceSafety = useMemo(() => {
    const manuscriptText = Object.values(lessons || {})
      .map((entry) => String(entry?.prose || ""))
      .filter(Boolean)
      .join("\n\n");
    return assessReferenceOverlap(manuscriptText, fullProject?.resources);
  }, [lessons, fullProject?.resources]);
  const evidenceAudit = useMemo(
    () => buildPrecisionEvidenceAudit(lessons || {}),
    [lessons]
  );
  const publishingPreflight = useMemo(
    () => buildPublishingPreflight({
      project: { ...(fullProject || project || {}), lessons },
      settings,
      evidenceAudit,
      referenceSafety,
      wordCount: words,
      sectionCount: bundle.sectionCount,
    }),
    [fullProject, project, lessons, settings, evidenceAudit, referenceSafety, words, bundle.sectionCount]
  );
  const baseExportProject = useMemo(
    () => ({ ...(fullProject || project || {}), lessons }),
    [fullProject, project, lessons]
  );
  const citationRegistry = useMemo(
    () => buildCitationRegistry(baseExportProject),
    [baseExportProject]
  );
  const publicationConsistency = useMemo(
    () => buildPublicationConsistencyReport(baseExportProject, settings, citationStyle),
    [baseExportProject, settings, citationStyle]
  );
  const exportProject = useMemo(
    () => buildCitationReadyProject(baseExportProject, citationStyle),
    [baseExportProject, citationStyle]
  );
  const slug = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "book";

  const exportPayload = {
    project: exportProject,
    settings,
    citationStyle,
    publicationReport: {
      evidenceAudit,
      publishingPreflight,
      publicationConsistency,
      citationRegistry
    },
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

  async function runProductionReport() {
    setProductionBusy(true);
    setProductionError("");
    setStatus("");
    try {
      const res = await fetch("/api/export/production-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportPayload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Final production check failed.");
      setProductionReport(data);
    } catch (e) {
      setProductionError(e.message || "Could not run the final production check.");
    } finally {
      setProductionBusy(false);
    }
  }

  function syncFinalPageCountToCover() {
    const count = Number(productionReport?.exactPageCount);
    if (!count || !updateProject) return;
    updateProject((current) => {
      const cover = current?.bookCover || {};
      const studio = cover.coverStudio || {};
      const topSetup = cover.printSetup || {};
      const studioSetup = studio.printSetup || {};
      return {
        ...current,
        bookCover: {
          ...cover,
          printSetup: {
            ...topSetup,
            pageCount: count,
            estimatedPageCount: false,
            pageCountSource: "final-production",
            syncedAt: new Date().toISOString(),
          },
          coverStudio: {
            ...studio,
            printSetup: {
              ...studioSetup,
              pageCount: count,
              estimatedPageCount: false,
              pageCountSource: "final-production",
              syncedAt: new Date().toISOString(),
            }
          }
        }
      };
    });
    setProductionReport((prev) => prev ? {
      ...prev,
      cover: { ...(prev.cover || {}), pageCount: count, synced: true },
      checks: (prev.checks || []).map((check) =>
        check.id === "cover-page-sync"
          ? { ...check, status: "pass", detail: `Cover Studio now uses the exact final page count (${count}).` }
          : check
      )
    } : prev);
    setStatus(`Synced ${count} final pages to Cover Studio. Re-open Book Cover to review the final spine.`);
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
      const responseType = (res.headers.get("content-type") || "").toLowerCase();
      if (!blob.size) {
        throw new Error(`${label} export returned an empty file.`);
      }
      if (mimeType && !responseType.includes(mimeType)) {
        const responseText = await blob.text().catch(() => "");
        throw new Error(
          responseText
            ? `${label} export returned an unexpected response.`
            : `${label} export returned an unexpected file type.`
        );
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = getDownloadFilename(res, filename);
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Keep the object URL alive long enough for browsers that start the
      // download asynchronously after click().
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`${label} downloaded.`);
      return {
        filename: getDownloadFilename(res, filename),
        pageCount: Number(res.headers.get("x-book-page-count")) || null,
        archiveId: res.headers.get("x-publication-archive-id") || null,
      };
    } catch (e) {
      setStatus(e.message || `Could not export ${label}.`);
      return null;
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

  function exportEpub() {
    downloadFromApi("/api/export/epub", `${slug}.epub`, "application/epub+zip", setEpubBusy, "EPUB");
  }

  async function exportPublicationBundle() {
    const result = await downloadFromApi(
      "/api/export/publication-bundle",
      `${slug}-publication-bundle.zip`,
      "application/zip",
      setBundleBusy,
      "Final publication archive"
    );
    if (!result?.archiveId || !updateProject) return;

    const snapshot = {
      archiveId: result.archiveId,
      pageCount: result.pageCount || productionReport?.exactPageCount || null,
      status: productionReport?.status || null,
      fingerprintSha256: productionReport?.archiveManifest?.fingerprintSha256 || null,
      trimSize: productionReport?.trim?.id || settings.trimSize,
      coverExportedAt: fullProject?.bookCover?.coverStudio?.finalExport?.exportedAt
        || fullProject?.bookCover?.finalExport?.exportedAt
        || null,
      createdAt: new Date().toISOString(),
    };

    updateProject((current) => ({
      ...current,
      productionArchives: [
        snapshot,
        ...(Array.isArray(current?.productionArchives) ? current.productionArchives : [])
          .filter((item) => item?.archiveId !== snapshot.archiveId),
      ].slice(0, 10),
      productionSnapshot: snapshot,
    }));
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

      <EvidenceAuditPanel audit={evidenceAudit} />

      <PublishingPreflightPanel preflight={publishingPreflight} />

      <PublicationConsistencyPanel report={publicationConsistency} citationRegistry={citationRegistry} />

      {referenceFiles.length > 0 && (
        <section className={`book-panel border ${referenceSafety.risk === "review" ? "border-amber-200 bg-amber-50/40" : "border-emerald-200 bg-emerald-50/30"}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reference Safety</p>
              <h3 className="mt-1 text-sm font-bold text-slate-900">
                {referenceSafety.risk === "review" ? "Review source-like wording before export" : "No indexed verbatim overlap detected"}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Checked the manuscript against {referenceSafety.scannedPhrases} short phrase fingerprints and verified quotes
                from {referenceFiles.length} indexed PDF reference book{referenceFiles.length === 1 ? "" : "s"}.
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${referenceSafety.risk === "review" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
              {referenceSafety.risk === "review" ? `${referenceSafety.matches.length} match${referenceSafety.matches.length === 1 ? "" : "es"}` : "PASS"}
            </span>
          </div>

          {referenceSafety.matches.length > 0 && (
            <div className="mt-4 space-y-2">
              {referenceSafety.matches.slice(0, 8).map((match, i) => (
                <article key={i} className="rounded-lg border border-amber-200 bg-white p-3">
                  <p className="text-xs font-semibold text-slate-900">
                    {match.sourceTitle}{match.pageLabel ? <span className="font-normal text-slate-500"> · {match.pageLabel}</span> : null}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">“{match.text}”</p>
                </article>
              ))}
              <p className="text-[11px] font-medium text-amber-800">
                Rewrite or verify these passages before publishing. The app does not auto-delete your draft.
              </p>
            </div>
          )}

          <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
            This is a focused source-overlap safety check against phrase fingerprints extracted from your uploaded references.
            It is not a full plagiarism database or a substitute for final editorial review.
          </p>
        </section>
      )}

      {/* Publishing Readiness — Developmental Edit */}
      <PublishingReadinessPanel
        devEdit={devEdit}
        devEditBusy={devEditBusy}
        devEditError={devEditError}
        onRetry={() => { devEditTriggered.current = false; runDevelopmentalEdit(); }}
        benchHistory={benchHistory}
      />

      {/* Reader Persona Simulation Engine */}
      <ReaderPersonaPanel
        rp={rp}
        rpBusy={rpBusy}
        rpError={rpError}
        onRetry={() => { rpTriggered.current = false; runReaderPersonas(); }}
      />

      {/* Multi-Format Publishing Engine */}
      <MultiFormatPanel
        mf={mf}
        mfBusy={mfBusy}
        mfError={mfError}
        onRetry={() => { mfTriggered.current = false; runMultiFormat(); }}
      />

      <FinalProductionPanel
        report={productionReport}
        busy={productionBusy}
        error={productionError}
        onRun={runProductionReport}
        onSync={syncFinalPageCountToCover}
        canSync={Boolean(productionReport?.exactPageCount) && !productionReport?.cover?.synced}
        archiveHistory={Array.isArray(fullProject?.productionArchives) ? fullProject.productionArchives : []}
      />

      <section className="book-panel space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Verified citations</h3>
          <p className="mt-1 text-xs text-slate-500">
            Citation markers are added only to supported claim-like sentences in the downloaded files. Your saved manuscript is not modified.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["none", "No markers", "Keep prose clean; retain References only."],
            ["numbered", "Numbered", "Use [1], [2] markers tied to verified used sources."],
            ["author-year", "Author–year", "Use (Author, Year) markers tied to verified used sources."]
          ].map(([value, label, help]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCitationStyle(value)}
              className={`rounded-xl border p-3 text-left transition ${
                citationStyle === value
                  ? "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200"
                  : "border-slate-200 bg-white hover:border-indigo-200"
              }`}
            >
              <p className="text-xs font-bold text-slate-800">{label}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{help}</p>
            </button>
          ))}
        </div>
        {citationStyle !== "none" && (
          <p className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-[11px] text-indigo-700">
            {citationRegistry.sources.length} verified used source{citationRegistry.sources.length === 1 ? "" : "s"} available for citation-aware export.
          </p>
        )}
      </section>

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
          PDF is the paperback interior. EPUB is the reflowable Kindle manuscript. DOCX remains the editable source. Run Final Production Check before creating the final archive.
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
          <button
            type="button"
            disabled={epubBusy}
            onClick={exportEpub}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100 disabled:opacity-50"
          >
            {epubBusy ? "Building EPUB…" : "Download EPUB (.epub)"}
          </button>
          <button
            type="button"
            disabled={bundleBusy}
            onClick={exportPublicationBundle}
            className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-sm font-semibold text-indigo-800 shadow-sm hover:bg-indigo-100 disabled:opacity-50"
          >
            {bundleBusy ? "Building archive…" : "Download Final Publication Archive (.zip)"}
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
