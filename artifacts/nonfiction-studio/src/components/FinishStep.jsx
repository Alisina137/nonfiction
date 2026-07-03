import { useMemo, useState } from "react";
import { Link } from "wouter";
import { countManuscriptWords, buildPublishingBundle } from "@/lib/manuscript";
import { resolveAuthorName, resolveBookTitle } from "@/lib/projectMeta";
import { DEFAULT_EXPORT_SETTINGS } from "@/lib/exportSettings";
import ExportSettingsPanel from "@/components/ExportSettingsPanel";
import { blockHasContent, enumerateWriteBlocks, lessonToProse } from "@/lib/writeBlocks";
import { aiFetch, GenerationCanceledError } from "@/lib/ai/aiFetch";
import { buildBookContext } from "@/lib/bookContext";

// The three front-matter sections generated from this step. They must wait
// until every chapter + section is fully drafted, since they summarize the
// finished manuscript.
const FRONT_MATTER_KINDS = ["howToUseThisBook", "whatYouWillLearn", "whoThisBookIsFor"];
const FRONT_MATTER_LABELS = {
  howToUseThisBook: "How to Use This Book",
  whatYouWillLearn: "What You Will Learn",
  whoThisBookIsFor: "Who This Book Is For"
};

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

export default function FinishStep({ project, onMarkComplete, bookOutline, lessons, setLessons, fullProject }) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [docxBusy, setDocxBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [settings, setSettings] = useState(DEFAULT_EXPORT_SETTINGS);
  const [dedication, setDedication] = useState("");
  const [acknowledgments, setAcknowledgments] = useState("");
  const [preface, setPreface] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [fmStatus, setFmStatus] = useState("");

  const title = resolveBookTitle(project);
  const author = resolveAuthorName(project);
  const words = countManuscriptWords(project);
  const bundle = buildPublishingBundle(project);
  const slug = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "book";

  const exportPayload = { project, settings, dedication, acknowledgments, preface };

  // ─── Front matter generation (How to Use / What You Will Learn / Who This Is For) ──
  // These need the full manuscript as context, so they stay locked until every
  // chapter and section is drafted.
  const allBlocks = useMemo(() => enumerateWriteBlocks(bookOutline), [bookOutline]);
  const chapterBodyBlocks = useMemo(
    () => allBlocks.filter((b) => b.kind === "section" || b.kind === "subsection"),
    [allBlocks]
  );
  const frontMatterBlocks = useMemo(
    () => allBlocks.filter((b) => FRONT_MATTER_KINDS.includes(b.kind)),
    [allBlocks]
  );
  const chapterBodyDone = useMemo(
    () => chapterBodyBlocks.filter((b) => blockHasContent(lessons, b.id)).length,
    [chapterBodyBlocks, lessons]
  );
  const manuscriptComplete = chapterBodyBlocks.length > 0 && chapterBodyDone === chapterBodyBlocks.length;
  const frontMatterLocked = !manuscriptComplete;
  const frontMatterLockMessage = chapterBodyBlocks.length === 0
    ? "Add chapters and sections in the Outline step, then write your manuscript before generating these sections."
    : `Finish generating every chapter and section in the Write step to unlock these sections (${chapterBodyDone}/${chapterBodyBlocks.length} sections drafted).`;

  function patchLesson(blockId, patch) {
    setLessons((prev) => {
      const base = prev && typeof prev === "object" ? prev : {};
      const cur  = base[blockId] && typeof base[blockId] === "object" ? base[blockId] : {};
      return { ...base, [blockId]: { ...cur, ...patch, updatedAt: new Date().toISOString() } };
    });
  }

  async function generateFrontMatterBlock(block) {
    if (frontMatterLocked) {
      setFmStatus(frontMatterLockMessage);
      return;
    }
    setBusyId(block.id);
    setFmStatus("");
    try {
      const data = await aiFetch("/api/ai/lesson", {
        subsection:        block.subsection,
        chapterContext:    block.chapterContext,
        previousConcepts:  [],
        upcomingTopics:    [],
        chapterSummaries:  [],
        subsectionPurpose: block.subsection?.objective || block.subsection?.description || null,
        audience:          writingAudience(fullProject),
        tone:              writingTone(fullProject),
        resources:         fullProject?.resources ?? null,
        bookContext:       buildBookContext(fullProject),
        bookStructure:     fullProject?.bookDetails?.structure || fullProject?.research?.structure || "",
        sectionTitle:      block.sectionTitle || null
      }, { noCache: true });
      const lesson = data.lesson || data;
      const prose  = lessonToProse(lesson);
      patchLesson(block.id, { lesson, prose, generatedAt: new Date().toISOString() });
      setFmStatus(`Drafted "${block.label}".`);
    } catch (e) {
      if (e instanceof GenerationCanceledError) setFmStatus("Generation canceled.");
      else setFmStatus(e.message || "Could not generate this section.");
    } finally {
      setBusyId(null);
    }
  }

  function setFrontMatterProse(blockId, prose) {
    patchLesson(blockId, { prose });
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
            <div>
              <label className="text-xs font-semibold text-slate-700">Dedication</label>
              <textarea
                className="input-light mt-1 min-h-[60px] resize-y text-sm"
                value={dedication}
                onChange={(e) => setDedication(e.target.value)}
                placeholder={`To everyone who believed this book was possible…`}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Acknowledgments</label>
              <textarea
                className="input-light mt-1 min-h-[80px] resize-y text-sm"
                value={acknowledgments}
                onChange={(e) => setAcknowledgments(e.target.value)}
                placeholder="Thank you to…"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Preface</label>
              <textarea
                className="input-light mt-1 min-h-[100px] resize-y text-sm"
                value={preface}
                onChange={(e) => setPreface(e.target.value)}
                placeholder="A note from the author…"
              />
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] text-slate-600">
              <span className="font-semibold">Front matter page order:</span> Cover → Abstract → Dedication → Acknowledgments → Table of Contents → Preface → How to Use This Book → What You Will Learn → Who This Book Is For → Chapter 1…
            </div>

            {/* AI-generated front matter sections */}
            {frontMatterBlocks.length > 0 && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">AI-generated sections</h4>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Written from your finished manuscript, so they only unlock once every chapter and section is drafted.
                  </p>
                </div>

                {frontMatterLocked ? (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
                    🔒 {frontMatterLockMessage}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
                    ✓ Manuscript complete — these sections are ready to generate.
                  </div>
                )}

                {fmStatus && (
                  <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
                    {fmStatus}
                  </p>
                )}

                {frontMatterBlocks.map((block) => {
                  const prose = String(lessons?.[block.id]?.prose || "").trim();
                  const hasContent = blockHasContent(lessons, block.id);
                  const isThisBusy = busyId === block.id;
                  const label = FRONT_MATTER_LABELS[block.kind] || block.label;

                  return (
                    <div key={block.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-xs font-semibold text-slate-700">{label}</label>
                        {hasContent && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Drafted
                          </span>
                        )}
                      </div>

                      {isThisBusy && !hasContent ? (
                        <div className="mt-2 flex items-center gap-2 text-slate-400">
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                          <span className="text-xs">Writing…</span>
                        </div>
                      ) : !hasContent ? (
                        frontMatterLocked ? (
                          <div className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center">
                            <p className="text-[11px] font-medium text-slate-400">🔒 Locked until the manuscript is complete.</p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={Boolean(busyId)}
                            onClick={() => generateFrontMatterBlock(block)}
                            className="mt-2 flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 shadow-sm transition hover:bg-violet-100 disabled:opacity-50"
                          >
                            ✦ Generate
                          </button>
                        )
                      ) : (
                        <div className="mt-2">
                          <textarea
                            className="input-light min-h-[100px] w-full resize-y text-sm"
                            value={prose}
                            onChange={(e) => setFrontMatterProse(block.id, e.target.value)}
                            disabled={isThisBusy}
                          />
                          <button
                            type="button"
                            disabled={Boolean(busyId) || frontMatterLocked}
                            onClick={() => generateFrontMatterBlock(block)}
                            className="mt-2 flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            ↻ Regenerate
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
            acknowledgments && "Acknowledgments page",
            preface && "Preface page"
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
