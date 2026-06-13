import { useEffect, useRef, useState } from "react";
import {
  resolveAudience,
  resolveAuthorName,
  resolveBookTitle,
  resolveGenre,
  resolveIdea,
  resolveTone,
  resolveUsp
} from "@/lib/projectMeta";
import { enumerateWriteBlocks } from "@/lib/writeBlocks";
import { aiFetch, GenerationCanceledError } from "@/lib/ai/aiFetch";

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

function manuscriptSample(project, maxChars = 1100) {
  const lessons = project?.lessons && typeof project.lessons === "object" ? project.lessons : {};
  const blocks = enumerateWriteBlocks(project?.bookOutline);
  const chunks = [];
  for (const block of blocks) {
    const prose = String(lessons[block.id]?.prose || "").trim();
    if (!prose) continue;
    chunks.push(`${block.label}: ${prose}`);
    if (chunks.join("\n\n").length > maxChars) break;
  }
  return chunks.join("\n\n").slice(0, maxChars);
}

export default function DescriptionStep({
  description,
  setDescription,
  bookMarketing,
  setBookMarketing,
  fullProject,
  errors
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const visitRef = useRef(false);
  const marketing = bookMarketing && typeof bookMarketing === "object" ? bookMarketing : {};

  useEffect(() => {
    if (visitRef.current) return;
    visitRef.current = true;
    const usp = resolveUsp(fullProject);
    if (!description?.trim() && usp) {
      setDescription(usp);
    }
  }, [description, fullProject, setDescription]);

  function patchMarketing(partial) {
    setBookMarketing((prev) => ({
      ...(prev && typeof prev === "object" ? prev : {}),
      ...partial
    }));
  }

  async function onGenerate() {
    setBusy(true);
    setStatus("");
    try {
      const data = await aiFetch("/api/ai/description", {
        enriched: true,
        idea: resolveIdea(fullProject),
        title: resolveBookTitle(fullProject),
        audience: resolveAudience(fullProject),
        tone: resolveTone(fullProject),
        genre: resolveGenre(fullProject),
        usp: resolveUsp(fullProject),
        authorName: resolveAuthorName(fullProject),
        focusTags: fullProject?.proposedBook?.focusTags || [],
        shortSample: manuscriptSample(fullProject)
      }, { noCache: true });
      if (data.description) setDescription(data.description);
      patchMarketing({
        shortHook: data.shortHook || marketing.shortHook || "",
        keywords: data.keywords || marketing.keywords || "",
        generatedAt: new Date().toISOString()
      });
      setStatus("Marketing copy generated—you can edit every field.");
    } catch (e) {
      setStatus(e.message || "Could not generate description.");
    } finally {
      setBusy(false);
    }
  }

  const wordCount = (description || "").trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm leading-relaxed text-slate-600">
        Craft your Amazon/KDP back-cover description and discovery keywords. Generation uses your manuscript voice, USP,
        and audience from earlier steps.
      </p>

      {errors?.form && <p className="mt-4 text-center text-sm text-red-600">{errors.form}</p>}
      {status && <p className="mt-3 text-center text-sm text-slate-600">{status}</p>}

      <div className="book-panel mt-7 space-y-6">
        <div>
          <FieldLabel hint="120–200 words: transformation promise, outcomes, and a curiosity hook.">
            Book description
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[200px] w-full resize-y leading-relaxed"
            value={description || ""}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Generate or write your listing description…"
          />
          <p className="mt-1 text-xs text-slate-500">{wordCount} words · aim for 120–200</p>
        </div>

        <div>
          <FieldLabel hint="Short line for ads, social, or the top of your listing.">One-line hook</FieldLabel>
          <input
            className="input-light mt-1.5"
            value={marketing.shortHook || ""}
            onChange={(e) => patchMarketing({ shortHook: e.target.value })}
            placeholder="e.g. Build systems that compound—without burnout."
          />
        </div>

        <div>
          <FieldLabel hint="Comma-separated phrases readers search on Amazon.">Keywords</FieldLabel>
          <input
            className="input-light mt-1.5"
            value={marketing.keywords || ""}
            onChange={(e) => patchMarketing({ keywords: e.target.value })}
            placeholder="productivity systems, time management, …"
          />
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          disabled={busy}
          onClick={onGenerate}
          className="rounded-full bg-gradient-to-r from-sky-600 to-sky-500 px-8 py-3 text-sm font-semibold text-white shadow-md shadow-sky-600/28 transition hover:from-sky-700 hover:to-sky-600 disabled:opacity-50"
        >
          {busy ? "Generating…" : "Generate description & keywords"}
        </button>
      </div>
    </div>
  );
}


