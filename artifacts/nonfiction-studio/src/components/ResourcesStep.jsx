import { useRef, useState, useCallback, useEffect } from "react";
import {
  ALLOWED_RESOURCE_EXTENSIONS,
  bytesToLabel,
  parseResourceUploadFile,
  RESOURCE_FILE_MAX_BYTES
} from "@/lib/resources/fileUpload";
import { aiFetch } from "@/lib/ai/aiFetch";
import { buildBookContext } from "@/lib/bookContext";

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "academic_paper",  label: "Academic Paper" },
  { value: "book",            label: "Book" },
  { value: "gov_report",      label: "Government Report" },
  { value: "research_study",  label: "Research Study" },
  { value: "competitor_book", label: "Competitor Book" },
  { value: "case_study",      label: "Case Study" },
  { value: "statistics",      label: "Statistics Source" },
  { value: "interview",       label: "Interview / Transcript" },
  { value: "blog_article",    label: "Blog / Article" },
  { value: "writing_style",   label: "Writing Style Reference" },
  { value: "note",            label: "Note / Finding" },
  { value: "other",           label: "Other" }
];

const PRIORITIES = [
  { value: "critical", label: "Critical", color: "bg-rose-100 text-rose-800 border-rose-200" },
  { value: "high",     label: "High",     color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "medium",   label: "Medium",   color: "bg-sky-100 text-sky-800 border-sky-200" },
  { value: "low",      label: "Low",      color: "bg-slate-100 text-slate-500 border-slate-200" }
];

const USE_FOR_OPTIONS = [
  { value: "entire_book",   label: "Entire Book" },
  { value: "outline_only",  label: "Outline Only" },
  { value: "writing_style", label: "Writing Style" },
  { value: "statistics",    label: "Statistics" },
  { value: "quotes",        label: "Quotes" },
  { value: "research_only", label: "Research Only" }
];

const CITATION_STYLES = [
  { value: "none",    label: "None" },
  { value: "apa",     label: "APA" },
  { value: "mla",     label: "MLA" },
  { value: "chicago", label: "Chicago" }
];

function safeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `rs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isProbablyUrl(s) {
  const t = s.trim().toLowerCase();
  return t.startsWith("http://") || t.startsWith("https://");
}

function priorityInfo(value) {
  return PRIORITIES.find((p) => p.value === value) || PRIORITIES[2];
}

function categoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label || value || "Other";
}

function blobFromResourceFile(entry) {
  if (entry.encoding === "text" && typeof entry.textContent === "string")
    return new Blob([entry.textContent], { type: entry.mimeType || "text/plain" });
  if (entry.encoding === "base64" && entry.dataBase64) {
    const bin = typeof atob === "function" ? atob(entry.dataBase64) : "";
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: entry.mimeType || "application/octet-stream" });
  }
  return null;
}

function matchesSearch(resource, query) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return [resource.title, resource.label, resource.originalName, resource.url, resource.note, resource.body]
    .filter(Boolean)
    .some((s) => s.toLowerCase().includes(q));
}

// ─── Small shared UI ──────────────────────────────────────────────────────────

function PriorityBadge({ value }) {
  const { label, color } = priorityInfo(value);
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${color}`}>
      {label}
    </span>
  );
}

function UseForChips({ values = [] }) {
  const non_default = values.filter((v) => v !== "entire_book");
  if (!non_default.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {non_default.map((v) => (
        <span key={v} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          {USE_FOR_OPTIONS.find((o) => o.value === v)?.label || v}
        </span>
      ))}
    </div>
  );
}

function UseForSelector({ selected, onChange }) {
  function toggle(value) {
    if (value === "entire_book") { onChange(["entire_book"]); return; }
    const without = selected.filter((v) => v !== "entire_book" && v !== value);
    if (selected.includes(value)) {
      onChange(without.length ? without : ["entire_book"]);
    } else {
      onChange([...without, value]);
    }
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {USE_FOR_OPTIONS.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              active ? "border-sky-400 bg-sky-100 text-sky-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function FormRow({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// ─── Resource Card ────────────────────────────────────────────────────────────

function ResourceCard({ resource, type, onRemove, onExtract, extracting, onDownload }) {
  const [expanded, setExpanded] = useState(false);
  const hasExtractable = (resource.encoding === "text" && resource.textContent) || resource.body;
  const title = resource.title || resource.label || resource.originalName || "Untitled";
  const preview = resource.summary || resource.note || resource.body || (type === "link" ? resource.url : "");

  return (
    <li className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <PriorityBadge value={resource.priority} />
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {categoryLabel(resource.category)}
            </span>
            {resource.isStyleRef && (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                ✦ Style ref
              </span>
            )}
            {resource.summary && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                Insights extracted
              </span>
            )}
          </div>

          <p className="mt-1.5 text-sm font-semibold text-slate-900">{title}</p>

          {type === "link" && (
            <a href={resource.url} target="_blank" rel="noopener noreferrer"
              className="block truncate text-xs text-sky-700 hover:underline">
              {resource.url}
            </a>
          )}
          {type === "file" && (
            <p className="text-[11px] text-slate-500">
              .{resource.extension} · {bytesToLabel(resource.sizeBytes || 0)}
              {resource.encoding === "text" ? " · Readable" : ""}
            </p>
          )}

          {!expanded && preview && (
            <p className="mt-1 line-clamp-2 text-xs text-slate-600">{preview}</p>
          )}

          <UseForChips values={resource.useFor || ["entire_book"]} />

          {expanded && (
            <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
              {resource.note && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Note</p>
                  <p className="mt-0.5 text-xs text-slate-700">{resource.note}</p>
                </div>
              )}
              {resource.summary && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">AI Extracted Insights</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-700">{resource.summary}</p>
                </div>
              )}
              {resource.body && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Content</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-700 line-clamp-8">{resource.body}</p>
                </div>
              )}
              {resource.textContent && !resource.summary && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">File Text Preview</p>
                  <p className="mt-0.5 line-clamp-6 whitespace-pre-wrap text-xs text-slate-700">{resource.textContent}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
          <button type="button" onClick={() => setExpanded((e) => !e)}
            className="text-xs font-medium text-slate-400 hover:text-slate-700">
            {expanded ? "▲ Collapse" : "▼ Expand"}
          </button>
          {hasExtractable && (
            <button type="button" disabled={extracting} onClick={() => onExtract(resource)}
              className="text-xs font-medium text-sky-700 hover:text-sky-900 disabled:opacity-40">
              {extracting ? "Extracting…" : resource.summary ? "Re-extract" : "Extract insights"}
            </button>
          )}
          {type === "file" && onDownload && (
            <button type="button" onClick={() => onDownload(resource)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800">
              Download
            </button>
          )}
          <button type="button" onClick={() => onRemove(resource.id)}
            className="text-xs font-medium text-rose-600 hover:text-rose-800">
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

// ─── Citation Panel ───────────────────────────────────────────────────────────

function CitationPanel({ settings, onUpdate }) {
  const citation = settings?.citation || { style: "none", inline: false, bibliography: false };
  const [open, setOpen] = useState(false);

  function patchCitation(patch) {
    onUpdate({ ...(settings || {}), citation: { ...citation, ...patch } });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-semibold text-slate-800">
          Citation Settings
          {citation.style !== "none" && (
            <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
              {citation.style.toUpperCase()}
            </span>
          )}
        </span>
        <span className="text-xs text-slate-400">{open ? "▲ Close" : "▼ Configure"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1.5">Citation style</p>
            <div className="flex flex-wrap gap-2">
              {CITATION_STYLES.map((s) => (
                <button key={s.value} type="button" onClick={() => patchCitation({ style: s.value })}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    citation.style === s.value
                      ? "border-sky-400 bg-sky-100 text-sky-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {citation.style !== "none" && (
            <div className="flex flex-wrap gap-5">
              {[{ key: "inline", label: "Inline citations" }, { key: "bibliography", label: "Generate bibliography" }].map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={!!citation[key]}
                    onChange={(e) => patchCitation({ [key]: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 accent-sky-600" />
                  {label}
                </label>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-400">Citation style is injected into AI prompts during outline and lesson generation.</p>
        </div>
      )}
    </div>
  );
}

// ─── Add forms ────────────────────────────────────────────────────────────────

const GENERATE_PHASES = [
  "Analyzing book context…",
  "Searching for relevant resources…",
  "Generating resource recommendation…"
];

function AddLinkForm({ onAdd, onRequestGenerate, generating, generatePhase, generateError }) {
  const [f, setF] = useState({ url: "", title: "", category: "blog_article", priority: "medium", useFor: ["entire_book"], isStyleRef: false, note: "" });
  const patch = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const isNote = f.category === "note";

  function canSubmit() {
    if (isNote) return f.title.trim().length > 0 || f.note.trim().length > 0;
    return f.url.trim().length > 0 && isProbablyUrl(f.url);
  }

  function submit() {
    if (!canSubmit()) return;
    const urlVal   = f.url.trim();
    const titleVal = f.title.trim() || urlVal || "Resource";
    onAdd({ id: safeId(), ...f, url: urlVal, title: titleVal, note: f.note.trim() });
    setF({ url: "", title: "", category: "blog_article", priority: "medium", useFor: ["entire_book"], isStyleRef: false, note: "" });
  }

  async function handleGenerate() {
    if (!onRequestGenerate || generating) return;
    const result = await onRequestGenerate({ category: f.category, priority: f.priority, useFor: f.useFor });
    if (result) {
      setF((prev) => ({
        ...prev,
        url:   result.url   || "",
        title: result.label || "",
        note:  result.note  || ""
      }));
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <FormRow label={isNote ? "URL (optional)" : "URL *"}>
          <input className="input-light" placeholder={isNote ? "optional for notes" : "https://…"} value={f.url}
            onChange={(e) => patch("url", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} />
        </FormRow>
        <FormRow label={isNote ? "Title / Label *" : "Label (optional)"}>
          <input className="input-light" placeholder={isNote ? "e.g. Key finding or principle" : "e.g. NIH Sleep Study 2023"}
            value={f.title} onChange={(e) => patch("title", e.target.value)} />
        </FormRow>
        <FormRow label="Category">
          <select className="input-light" value={f.category} onChange={(e) => patch("category", e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </FormRow>
        <FormRow label="Priority">
          <select className="input-light" value={f.priority} onChange={(e) => patch("priority", e.target.value)}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </FormRow>
        <div className="md:col-span-2">
          <FormRow label="Note for generation (optional)">
            <input className="input-light" placeholder="e.g. cite their 2023 pricing data for Chapter 4"
              value={f.note} onChange={(e) => patch("note", e.target.value)} />
          </FormRow>
        </div>
      </div>
      <FormRow label="Use for">
        <UseForSelector selected={f.useFor} onChange={(v) => patch("useFor", v)} />
      </FormRow>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={f.isStyleRef} onChange={(e) => patch("isStyleRef", e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-violet-600" />
        Use as writing style reference
      </label>

      {/* Loading phase indicator */}
      {generating && generatePhase && (
        <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <span className="text-xs font-medium text-sky-700">{generatePhase}</span>
        </div>
      )}
      {!generating && generateError && (
        <p className="text-xs text-rose-600">{generateError}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={submit} disabled={!canSubmit()}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
          Add link
        </button>
        {onRequestGenerate && (
          <button type="button" onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-5 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50 transition-colors">
            {generating ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                Generating…
              </>
            ) : (
              <>✨ Generate Resource</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function AddFindingForm({ onAdd }) {
  const [f, setF] = useState({ label: "", body: "", category: "note", priority: "medium", useFor: ["entire_book"], isStyleRef: false });
  const patch = (k, v) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    if (!f.body.trim()) return;
    onAdd({ id: safeId(), ...f, label: f.label.trim() || "Finding", body: f.body.trim() });
    setF({ label: "", body: "", category: "note", priority: "medium", useFor: ["entire_book"], isStyleRef: false });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <FormRow label="Title / tag">
          <input className="input-light" placeholder="e.g. Survey n=412, Q3 2023" value={f.label} onChange={(e) => patch("label", e.target.value)} />
        </FormRow>
        <FormRow label="Category">
          <select className="input-light" value={f.category} onChange={(e) => patch("category", e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </FormRow>
        <FormRow label="Priority">
          <select className="input-light" value={f.priority} onChange={(e) => patch("priority", e.target.value)}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </FormRow>
      </div>
      <FormRow label="Content *">
        <textarea className="input-light min-h-[100px]"
          placeholder="Paste stats, quotes, frameworks, data you want woven into the book…"
          value={f.body} onChange={(e) => patch("body", e.target.value)} />
      </FormRow>
      <FormRow label="Use for">
        <UseForSelector selected={f.useFor} onChange={(v) => patch("useFor", v)} />
      </FormRow>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={f.isStyleRef} onChange={(e) => patch("isStyleRef", e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-violet-600" />
        Use as writing style reference
      </label>
      <button type="button" onClick={submit} disabled={!f.body.trim()}
        className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50">
        Add finding
      </button>
    </div>
  );
}

function FileDropZone({ onFilesChosen, fileLoading, fileForm, setFileForm }) {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const patch = (k, v) => setFileForm((p) => ({ ...p, [k]: v }));

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer?.files;
    if (files?.length) onFilesChosen(files, fileForm);
  }, [onFilesChosen, fileForm]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <FormRow label="Category">
          <select className="input-light" value={fileForm.category} onChange={(e) => patch("category", e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </FormRow>
        <FormRow label="Priority">
          <select className="input-light" value={fileForm.priority} onChange={(e) => patch("priority", e.target.value)}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </FormRow>
        <div className="md:col-span-2">
          <FormRow label="Note (applies to all files in this batch)">
            <input className="input-light" placeholder="e.g. Competitor analysis — Chapter 3 pricing section"
              value={fileForm.note} onChange={(e) => patch("note", e.target.value)} />
          </FormRow>
        </div>
      </div>

      <FormRow label="Use for">
        <UseForSelector selected={fileForm.useFor} onChange={(v) => patch("useFor", v)} />
      </FormRow>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={fileForm.isStyleRef} onChange={(e) => patch("isStyleRef", e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-violet-600" />
        Use as writing style reference
      </label>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => !fileLoading && fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragActive ? "border-sky-400 bg-sky-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
        } ${fileLoading ? "pointer-events-none opacity-50" : ""}`}
      >
        <p className="text-sm font-medium text-slate-700">{fileLoading ? "Reading files…" : "Drop files here or click to choose"}</p>
        <p className="mt-1 text-xs text-slate-500">
          {ALLOWED_RESOURCE_EXTENSIONS.map((e) => `.${e}`).join(" ")} · max {bytesToLabel(RESOURCE_FILE_MAX_BYTES)} each
        </p>
      </div>

      <input ref={fileInputRef} type="file" className="sr-only" multiple
        accept=".pdf,.doc,.docx,.md,.txt"
        onChange={(e) => { if (e.target.files?.length) { onFilesChosen(e.target.files, fileForm); e.target.value = ""; } }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ResourcesStep({ resources, setResources, fullProject }) {
  const [activeTab, setActiveTab] = useState("links");
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [extractingIds, setExtractingIds] = useState(new Set());
  const [fileForm, setFileForm] = useState({ category: "book", priority: "medium", useFor: ["entire_book"], isStyleRef: false, note: "" });
  const [linkGenerating, setLinkGenerating] = useState(false);
  const [linkGeneratePhase, setLinkGeneratePhase] = useState("");
  const [linkGenerateError, setLinkGenerateError] = useState("");

  const links    = resources.links    || [];
  const findings = resources.findings || [];
  const files    = resources.files    || [];
  const settings = resources.settings || {};

  function patch(key, value) {
    setResources({ ...resources, [key]: value });
  }

  function applyFilters(list) {
    return list.filter((r) => {
      if (!matchesSearch(r, search)) return false;
      if (filterPriority !== "all" && r.priority !== filterPriority) return false;
      if (filterCategory !== "all" && r.category !== filterCategory) return false;
      return true;
    });
  }

  // ── Links ──────────────────────────────────────────────────────────────────

  function addLink(link) {
    patch("links", [...links, link]);
  }

  function removeLink(id) {
    patch("links", links.filter((l) => l.id !== id));
  }

  // ── Files ──────────────────────────────────────────────────────────────────

  async function handleFilesChosen(fileList, form) {
    setFileLoading(true);
    setFileError("");
    try {
      const entries = [];
      for (let i = 0; i < fileList.length; i++) {
        const parsed = await parseResourceUploadFile(fileList[i]);
        entries.push({
          id: safeId(),
          ...parsed,
          category:   form.category,
          priority:   form.priority,
          useFor:     form.useFor,
          isStyleRef: form.isStyleRef,
          note:       form.note.trim(),
          uploadedAt: new Date().toISOString(),
          summary:    null
        });
      }
      patch("files", [...files, ...entries]);
      setFileForm({ category: "book", priority: "medium", useFor: ["entire_book"], isStyleRef: false, note: "" });
    } catch (e) {
      setFileError(e.message || "Upload failed.");
    } finally {
      setFileLoading(false);
    }
  }

  function removeFile(id) {
    patch("files", files.filter((f) => f.id !== id));
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

  // ── Findings ───────────────────────────────────────────────────────────────

  function addFinding(finding) {
    patch("findings", [...findings, finding]);
  }

  function removeFinding(id) {
    patch("findings", findings.filter((f) => f.id !== id));
  }

  // ── AI Extract insights ────────────────────────────────────────────────────

  async function extractInsights(resource) {
    const text = resource.textContent || resource.body;
    if (!text) return;

    setExtractingIds((prev) => new Set(prev).add(resource.id));
    try {
      const data = await aiFetch("/api/ai/extract-resource", {
        text:     text.slice(0, 8000),
        title:    resource.title || resource.label || resource.originalName || "",
        category: resource.category || "other"
      }, { noCache: true });

      const summary = data.summary || "";

      if (files.some((f) => f.id === resource.id)) {
        patch("files", files.map((f) => f.id === resource.id ? { ...f, summary } : f));
      } else if (findings.some((f) => f.id === resource.id)) {
        patch("findings", findings.map((f) => f.id === resource.id ? { ...f, summary } : f));
      }
    } catch (e) {
      console.error("Extract failed:", e.message);
    } finally {
      setExtractingIds((prev) => { const s = new Set(prev); s.delete(resource.id); return s; });
    }
  }

  // ── AI Generate Resource ───────────────────────────────────────────────────

  async function handleGenerateLink({ category, priority, useFor }) {
    setLinkGenerating(true);
    setLinkGenerateError("");
    setLinkGeneratePhase(GENERATE_PHASES[0]);

    const t1 = setTimeout(() => setLinkGeneratePhase(GENERATE_PHASES[1]), 1200);
    const t2 = setTimeout(() => setLinkGeneratePhase(GENERATE_PHASES[2]), 2600);

    try {
      const bookContext = buildBookContext(fullProject);
      const existingResources = [
        ...links.map((l) => ({ label: l.title || l.label, url: l.url })),
        ...findings.map((f) => ({ label: f.label })),
      ];
      const competitorBooks = fullProject?.analysis?.books || [];

      const data = await aiFetch(
        "/api/ai/generate-resource",
        { bookContext, category, priority, useFor, existingResources, competitorBooks },
        { noCache: true }
      );
      return data;
    } catch (e) {
      setLinkGenerateError(e.message || "Generation failed. Try again.");
      return null;
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setLinkGenerating(false);
      setLinkGeneratePhase("");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const filteredLinks    = applyFilters(links);
  const filteredFiles    = applyFilters(files);
  const filteredFindings = applyFilters(findings);
  const totalCount = links.length + files.length + findings.length;

  const TABS = [
    { id: "links",    label: "Links",    count: links.length },
    { id: "files",    label: "Files",    count: files.length },
    { id: "findings", label: "Findings", count: findings.length }
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-slate-900 md:text-3xl">Resources</h2>
        <p className="mt-1.5 text-sm text-slate-600">
          Attach research sources, uploaded files, and key findings. Set priority levels and targeting so the AI uses each source
          exactly where it matters most.
          {totalCount > 0 && (
            <span className="ml-1 font-medium text-slate-800">
              {totalCount} resource{totalCount !== 1 ? "s" : ""} added.
            </span>
          )}
        </p>
      </div>

      <CitationPanel settings={settings} onUpdate={(s) => patch("settings", s)} />

      {/* Search + Filter bar */}
      {totalCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input-light min-w-0 flex-1"
            placeholder="Search resources…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input-light w-auto" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="all">All priorities</option>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select className="input-light w-auto" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {(search || filterPriority !== "all" || filterCategory !== "all") && (
            <button type="button" onClick={() => { setSearch(""); setFilterPriority("all"); setFilterCategory("all"); }}
              className="text-xs text-slate-500 hover:text-slate-800">
              Clear
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="flex border-b border-slate-200">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              {tab.label}
              {tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  activeTab === tab.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mt-6 space-y-6">

          {/* ── Links tab ── */}
          {activeTab === "links" && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">Add a reference link</h3>
                <AddLinkForm
                  onAdd={addLink}
                  onRequestGenerate={handleGenerateLink}
                  generating={linkGenerating}
                  generatePhase={linkGeneratePhase}
                  generateError={linkGenerateError}
                />
              </div>

              {filteredLinks.length > 0 ? (
                <ul className="space-y-3">
                  {filteredLinks.map((link) => (
                    <ResourceCard key={link.id} resource={link} type="link"
                      onRemove={removeLink} onExtract={extractInsights}
                      extracting={extractingIds.has(link.id)} />
                  ))}
                </ul>
              ) : links.length > 0 ? (
                <p className="text-xs text-slate-500">No links match the current filter.</p>
              ) : (
                <p className="text-xs text-slate-500">No links yet. Add URLs to journals, articles, datasets, or any reference page.</p>
              )}
            </>
          )}

          {/* ── Files tab ── */}
          {activeTab === "files" && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">Upload files</h3>
                <FileDropZone
                  onFilesChosen={handleFilesChosen}
                  fileLoading={fileLoading}
                  fileForm={fileForm}
                  setFileForm={setFileForm}
                />
                {fileError && <p className="mt-3 text-xs text-rose-700">{fileError}</p>}
              </div>

              {filteredFiles.length > 0 ? (
                <ul className="space-y-3">
                  {filteredFiles.map((file) => (
                    <ResourceCard key={file.id} resource={file} type="file"
                      onRemove={removeFile} onExtract={extractInsights}
                      extracting={extractingIds.has(file.id)} onDownload={triggerDownload} />
                  ))}
                </ul>
              ) : files.length > 0 ? (
                <p className="text-xs text-slate-500">No files match the current filter.</p>
              ) : (
                <p className="text-xs text-slate-500">No files yet. Upload PDFs, Word docs, or plain text files.</p>
              )}
            </>
          )}

          {/* ── Findings tab ── */}
          {activeTab === "findings" && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">Add a finding</h3>
                <AddFindingForm onAdd={addFinding} />
              </div>

              {filteredFindings.length > 0 ? (
                <ul className="space-y-3">
                  {filteredFindings.map((finding) => (
                    <ResourceCard key={finding.id} resource={finding} type="finding"
                      onRemove={removeFinding} onExtract={extractInsights}
                      extracting={extractingIds.has(finding.id)} />
                  ))}
                </ul>
              ) : findings.length > 0 ? (
                <p className="text-xs text-slate-500">No findings match the current filter.</p>
              ) : (
                <p className="text-xs text-slate-500">No findings yet. Add raw notes, quotes, stats, and data points to be woven into the book.</p>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
