import { useEffect, useId, useMemo, useRef, useState } from "react";
import { BOOK_FOCUS_PRESET_TAGS } from "@/lib/constants";
import { buildSyntheticProposedBookContent } from "@/lib/proposedBook";

const SECTIONS = [
  { key: "title", label: "Title", multiline: false },
  { key: "uniqueSellingProposition", label: "Unique Selling Proposition", multiline: true },
  { key: "differentiation", label: "Differentiation", multiline: true },
  { key: "keySellingPoints", label: "Key Selling Points", multiline: true },
  { key: "proposedAudience", label: "Proposed Audience", multiline: true },
  { key: "proposedTone", label: "Proposed Tone", multiline: true },
  { key: "proposedAuthorPersona", label: "Proposed Author Persona", multiline: true }
];

function normalizeTag(t) {
  return String(t || "")
    .trim()
    .replace(/\s+/g, " ");
}

function EditableBlock({ label, value, multiline, onChange }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-900">{label}</h3>
        <button
          type="button"
          aria-label={`Edit ${label}`}
          onClick={() => setEditing((v) => !v)}
          className="shrink-0 rounded-lg border border-transparent p-2 text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800"
          title={editing ? "Done editing" : "Edit"}
        >
          <span aria-hidden className="text-base">
            ✎
          </span>
        </button>
      </div>
      <div className="mt-4">
        {editing && multiline ?
          <textarea
            className="input-light min-h-[140px] w-full resize-y"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        : editing ?
          <input className="input-light w-full" value={value} onChange={(e) => onChange(e.target.value)} />
        : <p
            className={`whitespace-pre-wrap text-sm leading-relaxed text-slate-700 ${
              !value.trim() ? "italic text-slate-400" : ""
            }`}
          >
            {value.trim() ? value : `No ${label.toLowerCase()} yet.`}
          </p>}
      </div>
    </div>
  );
}

export default function ProposedBookStep({ proposedBook, setProposedBook, fullProject }) {
  const uid = useId();
  const panelRef = useRef(null);
  const openerRef = useRef(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customInput, setCustomInput] = useState("");

  const pb = proposedBook || {};
  const focusTags = Array.isArray(pb.focusTags) ? pb.focusTags.map(normalizeTag).filter(Boolean) : [];
  const content = pb.content && typeof pb.content === "object" ? pb.content : {};

  const presetAvail = useMemo(() => {
    const lowerTaken = new Set(focusTags.map((t) => t.toLowerCase()));
    const q = search.trim().toLowerCase();
    return BOOK_FOCUS_PRESET_TAGS.filter((t) => {
      if (lowerTaken.has(t.toLowerCase())) return false;
      if (!q) return true;
      return t.toLowerCase().includes(q);
    });
  }, [focusTags, search]);

  function mergeProposedBook(pbPatch) {
    setProposedBook(typeof pbPatch === "function" ? pbPatch : { ...(proposedBook || {}), ...pbPatch });
  }

  function commitTags(tags) {
    const unique = [];
    const seen = new Set();
    tags.forEach((t) => {
      const n = normalizeTag(t);
      if (!n) return;
      const low = n.toLowerCase();
      if (seen.has(low)) return;
      seen.add(low);
      unique.push(n);
    });
    mergeProposedBook({ focusTags: unique });
  }

  function removeTag(remove) {
    commitTags(focusTags.filter((t) => t.toLowerCase() !== remove.toLowerCase()));
  }

  function addTag(one) {
    const n = normalizeTag(one);
    if (!n) return;
    if (focusTags.some((t) => t.toLowerCase() === n.toLowerCase())) return;
    commitTags([...focusTags, n]);
  }

  function clearAllTags() {
    mergeProposedBook({ focusTags: [] });
  }

  function onGenerate() {
    const nextContent = buildSyntheticProposedBookContent(fullProject || {}, focusTags);
    mergeProposedBook({
      focusTags,
      content: nextContent,
      generatedAt: new Date().toISOString()
    });
  }

  function updateContentField(key, value) {
    mergeProposedBook({
      content: {
        ...content,
        [key]: value
      }
    });
  }

  function onCustomSubmit() {
    addTag(customInput);
    setCustomInput("");
  }

  useEffect(() => {
    function onDocDown(ev) {
      const t = ev.target;
      const p = panelRef.current;
      const o = openerRef.current;
      if (!p || !o) return;
      if (p.contains(t) || o.contains(t)) return;
      setPickOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const MIN_FOCUS = 5;
  const meetsSoftMinimum = focusTags.length >= MIN_FOCUS;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-xl font-semibold text-slate-900">Book Focus</h2>
        <p className="mt-2 text-sm text-slate-600">
          Select the main focus areas for your book to guide positioning and drafts.{" "}
          <span className="font-medium text-slate-800">
            We recommend selecting at least {MIN_FOCUS} topics.
          </span>
        </p>

        {!meetsSoftMinimum && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950">
            {focusTags.length} selected — aim for at least {MIN_FOCUS} pillars so downstream steps stay anchored.
          </p>
        )}

        <div className="relative mt-6">
          <div
            ref={openerRef}
            role="group"
            aria-label="Focus tags"
            className="flex min-h-[72px] flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 pr-20"
          >
            {focusTags.length === 0 && (
              <span className="flex items-center text-sm text-slate-400">
                Pick from the dropdown or add custom tags…
              </span>
            )}
            {focusTags.map((tag) => (
              <button
                key={tag.toLowerCase()}
                type="button"
                title="Remove topic"
                onClick={() => removeTag(tag)}
                className="group inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                <span className="truncate">{tag}</span>
                <span
                  aria-hidden
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] text-slate-400 group-hover:text-slate-600"
                >
                  ×
                </span>
              </button>
            ))}

          <div className="absolute right-2 top-2 flex items-center gap-1">
              {focusTags.length > 0 && (
                <button
                  type="button"
                  title="Clear all tags"
                  onClick={clearAllTags}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                >
                  ×
                </button>
              )}
              <button
                type="button"
                aria-expanded={pickOpen}
                aria-controls={`${uid}-preset-panel`}
                onClick={() => setPickOpen((o) => !o)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-500 shadow-sm hover:bg-slate-50"
              >
                <span aria-hidden>▼</span>
              </button>
            </div>
          </div>

          {pickOpen && (
            <div
              id={`${uid}-preset-panel`}
              ref={panelRef}
              role="dialog"
              aria-label="Suggested focus topics"
              className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            >
              <input
                type="text"
                className="sticky top-0 z-10 w-full border-b border-slate-100 px-4 py-2.5 text-sm outline-none placeholder:text-slate-400"
                placeholder="Search suggested topics…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="max-h-56 overflow-y-auto py-2">
                {presetAvail.length === 0 ?
                  <p className="px-4 py-6 text-center text-xs text-slate-500">
                    Nothing left in the list—that tag may already be added, or try a shorter search phrase.
                  </p>
                : presetAvail.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        addTag(t);
                        setSearch("");
                      }}
                    >
                      {t}
                    </button>
                  ))
                }
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <input
            id={`${uid}-custom-tag`}
            className="input-light min-w-[min(260px,calc(100%-6rem))] flex-1"
            placeholder="Add custom tag (press Enter)"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onCustomSubmit();
              }
            }}
          />
          <button type="button" onClick={onCustomSubmit} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Add
          </button>
        </div>

        <button
          type="button"
          onClick={onGenerate}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <span aria-hidden>✦</span>
          Generate Proposed Book With Focus
        </button>
      </section>

      {pb.generatedAt && (
        <section className="space-y-4 pb-16">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proposed book</h2>
          {SECTIONS.map(({ key, label, multiline }) => (
            <EditableBlock
              key={key}
              label={label}
              value={content[key] != null ? String(content[key]) : ""}
              multiline={multiline}
              onChange={(v) => updateContentField(key, v)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
