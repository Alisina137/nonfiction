import { useState } from "react";
import { Link } from "wouter";
import {
  buildManuscriptMarkdown,
  buildManuscriptPlainText,
  buildPublishingBundle,
  countManuscriptWords
} from "@/lib/manuscript";
import { resolveAuthorName, resolveBookTitle } from "@/lib/projectMeta";

function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FinishStep({ project, onMarkComplete }) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [status, setStatus] = useState("");

  const title = resolveBookTitle(project);
  const author = resolveAuthorName(project);
  const words = countManuscriptWords(project);
  const bundle = buildPublishingBundle(project);
  const slug = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "book";

  async function exportPdf() {
    setPdfBusy(true);
    setStatus("");
    try {
      const res = await fetch("/api/export/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "PDF export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("PDF downloaded.");
    } catch (e) {
      setStatus(e.message || "Could not export PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  function exportPublishingPack() {
    const pack = {
      ...bundle,
      exportedAt: new Date().toISOString()
    };
    downloadText(`${slug}-publishing-pack.json`, JSON.stringify(pack, null, 2), "application/json");
    setStatus("Publishing pack JSON downloaded.");
  }

  return (
    <section className="mx-auto max-w-3xl">
      <section className="rounded-[1.35rem] border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-sky-50/40 px-6 py-10 text-center shadow-soft-card md:px-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Ready to publish</p>
        <h2 className="mt-3 font-serif text-2xl font-bold tracking-tight text-emerald-950 md:text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-emerald-900/80">by {author}</p>
        <p className="mt-5 text-sm leading-relaxed text-slate-600">
          Your manuscript, marketing copy, and cover brief are saved in this browser. Export everything below, or jump
          back to any step from the sidebar.
        </p>
      </section>

      <section className="book-panel mt-8 grid gap-4 sm:grid-cols-3">
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

      {status && <p className="mt-4 text-center text-sm text-slate-600">{status}</p>}

      <section className="book-panel mt-8">
        <h3 className="text-sm font-bold text-slate-900">Export</h3>
        <p className="mt-1 text-sm text-slate-600">Download assets for KDP, designers, or archival.</p>
        <section className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              downloadText(`${slug}-manuscript.txt`, buildManuscriptPlainText(project));
              setStatus("Manuscript .txt downloaded.");
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:border-sky-200 hover:bg-sky-50/50"
          >
            Manuscript (.txt)
          </button>
          <button
            type="button"
            onClick={() => {
              downloadText(`${slug}-manuscript.md`, buildManuscriptMarkdown(project), "text/markdown;charset=utf-8");
              setStatus("Manuscript .md downloaded.");
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:border-sky-200 hover:bg-sky-50/50"
          >
            Manuscript (.md)
          </button>
          <button
            type="button"
            disabled={pdfBusy}
            onClick={exportPdf}
            className="rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-600/25 hover:from-sky-700 disabled:opacity-50"
          >
            {pdfBusy ? "Building PDF…" : "Full book (PDF)"}
          </button>
          <button
            type="button"
            onClick={exportPublishingPack}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:border-sky-200 hover:bg-sky-50/50"
          >
            Publishing pack (.json)
          </button>
        </section>
      </section>

      {bundle.description && (
        <section className="book-panel mt-6">
          <h3 className="text-sm font-bold text-slate-900">Listing preview</h3>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{bundle.description}</p>
          {bundle.shortHook && (
            <p className="mt-4 border-t border-slate-100 pt-4 text-sm font-medium text-sky-800">{bundle.shortHook}</p>
          )}
        </section>
      )}

      <section className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
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
