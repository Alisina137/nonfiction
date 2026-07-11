import { useState } from "react";
import { Link } from "wouter";
import { countManuscriptWords, buildPublishingBundle } from "@/lib/manuscript";
import { resolveAuthorName, resolveBookTitle } from "@/lib/projectMeta";
import { DEFAULT_EXPORT_SETTINGS } from "@/lib/exportSettings";
import ExportSettingsPanel from "@/components/ExportSettingsPanel";
import { aiFetch, GenerationCanceledError } from "@/lib/ai/aiFetch";
import { buildBookContext } from "@/lib/bookContext";
import { lessonToProse } from "@/lib/writeBlocks";

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
  const [dedication, setDedication] = useState("");
  const [preface, setPreface] = useState("");
  const [howToUseThisBook, setHowToUseThisBook] = useState("");
  const [whatYouWillLearn, setWhatYouWillLearn] = useState("");
  const [whoThisBookIsFor, setWhoThisBookIsFor] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [fmStatus, setFmStatus] = useState("");
  const [generatingAll, setGeneratingAll] = useState(false);

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
