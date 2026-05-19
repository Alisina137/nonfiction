import { useMemo, useRef, useState } from "react";
import {
  ALLOWED_RESOURCE_EXTENSIONS,
  bytesToLabel,
  parseResourceUploadFile,
  RESOURCE_FILE_MAX_BYTES
} from "@/lib/resources/fileUpload";

const LINK_KINDS = [
  { value: "journal", label: "Journal / academic" },
  { value: "website", label: "Website / article" },
  { value: "topic", label: "Topic hub / wiki" },
  { value: "newsletter", label: "Newsletter / podcast" },
  { value: "dataset", label: "Dataset / repo" },
  { value: "other", label: "Other resource" }
];

function safeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `rs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isProbablyUrl(s) {
  const t = s.trim().toLowerCase();
  return t.startsWith("http://") || t.startsWith("https://");
}

function blobFromResourceFile(entry) {
  if (entry.encoding === "text" && typeof entry.textContent === "string") {
    return new Blob([entry.textContent], { type: entry.mimeType || "text/plain" });
  }
  if (entry.encoding === "base64" && entry.dataBase64) {
    const bin = typeof atob === "function" ? atob(entry.dataBase64) : "";
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: entry.mimeType || "application/octet-stream" });
  }
  return null;
}

export default function ResourcesStep({ resources, setResources }) {
  const fileInputRef = useRef(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkKind, setLinkKind] = useState("website");
  const [linkNote, setLinkNote] = useState("");
  const [findingLabel, setFindingLabel] = useState("");
  const [findingBody, setFindingBody] = useState("");
  const [uploadFileNote, setUploadFileNote] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState("");

  const links = resources.links || [];
  const findings = resources.findings || [];
  const files = resources.files || [];

  const groupedHint = useMemo(
    () => `${links.length} link(s), ${findings.length} finding(s), ${files.length} file(s)`,
    [links.length, findings.length, files.length]
  );

  function addLink() {
    const url = linkUrl.trim();
    if (!url || !isProbablyUrl(url)) return;
    setResources({
      ...resources,
      links: [
        ...links,
        {
          id: safeId(),
          url,
          title: linkTitle.trim() || url,
          kind: linkKind,
          note: linkNote.trim()
        }
      ]
    });
    setLinkUrl("");
    setLinkTitle("");
    setLinkNote("");
    setLinkKind("website");
  }

  function removeLink(id) {
    setResources({ ...resources, links: links.filter((l) => l.id !== id) });
  }

  function addFinding() {
    const body = findingBody.trim();
    if (!body) return;
    setResources({
      ...resources,
      findings: [
        ...findings,
        {
          id: safeId(),
          label: findingLabel.trim() || "Finding",
          body
        }
      ]
    });
    setFindingBody("");
    setFindingLabel("");
  }

  function removeFinding(id) {
    setResources({ ...resources, findings: findings.filter((f) => f.id !== id) });
  }

  async function onFilesChosen(event) {
    const picked = event.target.files;
    if (!picked?.length) return;

    setFileLoading(true);
    setFileError("");
    const note = uploadFileNote.trim();

    try {
      const newEntries = [];
      for (let i = 0; i < picked.length; i += 1) {
        /* eslint-disable no-await-in-loop */
        const parsed = await parseResourceUploadFile(picked[i]);
        /* eslint-enable no-await-in-loop */
        newEntries.push({
          id: safeId(),
          ...parsed,
          note,
          uploadedAt: new Date().toISOString()
        });
      }
      setResources({ ...resources, files: [...files, ...newEntries] });
      setUploadFileNote("");
    } catch (e) {
      setFileError(e.message || "Upload failed.");
    } finally {
      setFileLoading(false);
      event.target.value = "";
    }
  }

  function removeUploadedFile(id) {
    setResources({ ...resources, files: files.filter((f) => f.id !== id) });
  }

  function triggerDownload(entry) {
    const blob = blobFromResourceFile(entry);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = entry.originalName || `resource.${entry.extension}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="font-serif text-2xl font-bold text-slate-900 md:text-3xl">Resources</h2>
      <p className="mt-2 text-sm text-slate-600">
        Add authoritative links (journals, deep articles, benchmarks, tooling pages) plus your own research notes—later steps
        can treat both as grounding material so outputs stay factual and differentiated. {groupedHint}
      </p>

      <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-lg font-semibold text-slate-900">Reference links</h3>
        <p className="mt-1 text-xs text-slate-600">
          Paste HTTPS URLs only. Optionally name them and jot why they matter—the model weighs that context heavier.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600">URL</label>
            <input
              className="input-light mt-1"
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Label (optional)</label>
            <input
              className="input-light mt-1"
              placeholder="e.g. NIH sleep meta-analysis"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Resource type</label>
            <select className="input-light mt-1" value={linkKind} onChange={(e) => setLinkKind(e.target.value)}>
              {LINK_KINDS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600">Note for generation (optional)</label>
            <input
              className="input-light mt-1"
              placeholder="e.g. cite their 2023 stats table for chapter on pricing"
              value={linkNote}
              onChange={(e) => setLinkNote(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={addLink}
          className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Add link
        </button>

        {links.length > 0 ? (
          <ul className="mt-6 space-y-3">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 md:flex-row md:items-start md:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{link.title}</p>
                  <p className="truncate text-xs text-sky-800">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {link.url}
                    </a>
                  </p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {LINK_KINDS.find((k) => k.value === link.kind)?.label || link.kind}
                  </p>
                  {link.note ? <p className="mt-1 text-xs text-slate-700">{link.note}</p> : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 text-xs font-medium text-rose-700 hover:text-rose-900"
                  onClick={() => removeLink(link.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-slate-500">No links yet.</p>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-lg font-semibold text-slate-900">Upload files</h3>
        <p className="mt-1 text-xs text-slate-600">
          PDF, Word (.doc / .docx), Markdown, or plain text. Stored in this browser for your book—use for deep references the
          model should respect. Max {bytesToLabel(RESOURCE_FILE_MAX_BYTES)} each.
        </p>
        <p className="mt-2 text-[11px] text-slate-500">
          Allowed extensions:{" "}
          {ALLOWED_RESOURCE_EXTENSIONS.map((e) => (
            <code key={e} className="mr-2 rounded bg-slate-100 px-1">
              .{e}
            </code>
          ))}
        </p>

        <div className="mt-4">
          <label className="text-xs font-medium text-slate-600">Note for uploads (optional, applies to this batch)</label>
          <input
            className="input-light mt-1"
            placeholder="e.g. Chapter 3 — pricing study from client work"
            value={uploadFileNote}
            onChange={(e) => setUploadFileNote(e.target.value)}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          accept=".pdf,.doc,.docx,.md,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
          multiple
          onChange={onFilesChosen}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={fileLoading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            {fileLoading ? "Reading files…" : "Choose files"}
          </button>
        </div>

        {fileError ? <p className="mt-3 text-xs text-rose-700">{fileError}</p> : null}

        {files.length > 0 ? (
          <ul className="mt-6 space-y-3">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 md:flex-row md:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{file.originalName}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    .{file.extension} · {file.encoding === "text" ? "Text (inline)" : "Binary (stored)"} ·{" "}
                    {bytesToLabel(file.sizeBytes || 0)}
                  </p>
                  {file.note ? <p className="mt-1 text-xs text-slate-700">{file.note}</p> : null}
                  {file.encoding === "text" && file.textContent != null ? (
                    <p className="mt-2 line-clamp-2 text-[11px] text-slate-500">
                      {file.textContent.length.toLocaleString()} characters
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-3">
                  <button type="button" className="text-xs font-medium text-sky-800 hover:underline" onClick={() => triggerDownload(file)}>
                    Download
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-rose-700 hover:text-rose-900"
                    onClick={() => removeUploadedFile(file.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-slate-500">No files uploaded.</p>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-lg font-semibold text-slate-900">Your findings</h3>
        <p className="mt-1 text-xs text-slate-600">
          Raw notes, interview quotes, data you want woven into drafts—anything you want preserved verbatim or semantically when
          the book is generated later.
        </p>
        <div className="mt-4">
          <label className="text-xs font-medium text-slate-600">Finding title / tag</label>
          <input
            className="input-light mt-1"
            placeholder="e.g. Survey n=412 insight"
            value={findingLabel}
            onChange={(e) => setFindingLabel(e.target.value)}
          />
        </div>
        <div className="mt-3">
          <label className="text-xs font-medium text-slate-600">Content</label>
          <textarea
            className="input-light mt-1 min-h-[120px]"
            placeholder="Paste stats, anecdotes, hypotheses, citations you want modeled in prose…"
            value={findingBody}
            onChange={(e) => setFindingBody(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={addFinding}
          className="mt-4 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Add finding
        </button>

        {findings.length > 0 ? (
          <ul className="mt-6 space-y-4">
            {findings.map((f) => (
              <li key={f.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex justify-between gap-4">
                  <p className="text-sm font-semibold text-slate-900">{f.label}</p>
                  <button type="button" className="text-xs font-medium text-rose-700" onClick={() => removeFinding(f.id)}>
                    Remove
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs text-slate-700">{f.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-slate-500">No findings yet.</p>
        )}
      </section>
    </div>
  );
}
