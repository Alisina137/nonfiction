import { useState } from "react";
import { aiFetch } from "@/lib/ai/aiFetch";
import { buildBookContext } from "@/lib/bookContext";
import { buildChapterSummaries, buildManuscriptContext } from "@/lib/writeBlocks";

// ─── Project helpers ──────────────────────────────────────────────────────────
function writingTone(fp) {
  const d = fp?.bookDetails || {};
  const r = fp?.research   || {};
  if (d.tone?.trim()) return d.tone.trim();
  if (Array.isArray(r.authorTones) && r.authorTones.length) return r.authorTones.join("; ");
  return fp?.tone || "Direct & practical";
}
function writingAudience(fp) {
  const d = fp?.bookDetails || {};
  const r = fp?.research   || {};
  return d.audience?.trim() || r.targetAudience?.trim() || fp?.audience || "";
}

// ─── Prose converters (keep lessons[id].prose in sync for export) ─────────────
function keyLessonsToProse(lessons) {
  if (!lessons?.length) return "";
  return "KEY LESSONS\n\n" + lessons.map((l, i) =>
    [`${i + 1}. ${l.title}`, l.principle, "", l.explanation,
      l.relatedChapters?.length ? `Related chapters: ${l.relatedChapters.join(", ")}` : ""]
      .filter((x) => x !== undefined).join("\n")
  ).join("\n\n");
}
function glossaryToProse(terms) {
  if (!terms?.length) return "";
  return "GLOSSARY\n\n" + terms.map((t) =>
    [t.term, t.definition,
      t.firstChapter ? `First introduced: ${t.firstChapter}` : "",
      t.relatedChapters?.length ? `Related chapters: ${t.relatedChapters.join(", ")}` : "",
      t.synonyms?.length ? `See also: ${t.synonyms.join(", ")}` : ""]
      .filter(Boolean).join("\n")
  ).join("\n\n");
}
function furtherReadingToProse(recs) {
  if (!recs?.length) return "";
  return "FURTHER READING\n\n" + recs.map((r) =>
    [[r.title, r.author && `— ${r.author}`, r.type && `(${r.type})`, r.difficulty && `· ${r.difficulty}`].filter(Boolean).join(" "),
      r.description, r.why && `Why recommended: ${r.why}`, r.url || ""].filter(Boolean).join("\n")
  ).join("\n\n");
}
function appendixToProse(entries) {
  if (!entries?.length) return "";
  return entries.map((e) => [`${e.title}${e.category ? ` [${e.category}]` : ""}`, "", e.content].filter((x) => x !== undefined).join("\n")).join("\n\n---\n\n");
}
function referencesToProse(groups) {
  if (!groups) return "";
  const parts = [];
  for (const [g, items] of Object.entries(groups)) {
    if (!Array.isArray(items) || !items.length) continue;
    parts.push(`${g}\n\n` + items.map((r, i) =>
      [`${i + 1}.`, r.author && `${r.author}.`, r.title && `"${r.title}."`, r.publication && `${r.publication},`, r.year && `${r.year}.`, r.url || "", r.notes && `(${r.notes})`].filter(Boolean).join(" ")
    ).join("\n"));
  }
  return "REFERENCES\n\n" + parts.join("\n\n");
}
function acknowledgmentsToProse(groups) {
  if (!groups?.length) return "";
  return groups.map((g) => `${g.name}\n\n${g.text}`).join("\n\n");
}
function theEndToProse(sd) {
  const p = ["The End"];
  if (sd?.thankYouMessage) p.push(sd.thankYouMessage);
  if (sd?.quote) p.push(`"${sd.quote}"`);
  return p.join("\n\n");
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────
function GenBtn({ busy, hasContent, disabled, onClick }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 shadow-sm transition hover:bg-violet-100 disabled:opacity-50">
      {busy
        ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />Writing…</>
        : hasContent ? "↻ Regenerate" : "✦ Generate"}
    </button>
  );
}

function DraftedBadge({ count, label }) {
  return (
    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
      {count != null ? `${count} ${label}` : "Drafted"}
    </span>
  );
}

function SectionCard({ icon, sectionLabel, title, status, expanded, onToggle, headerRight, children,
  borderCls, bgCls, iconCls }) {
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${borderCls}`}>
      <div className={`flex items-center justify-between gap-4 border-b px-6 py-4 ${bgCls}`} style={{ borderBottomColor: "inherit" }}>
        <div className="flex items-center gap-3">
          <span className={`text-xl leading-none ${iconCls}`}>{icon}</span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-slate-400">{sectionLabel}</p>
            <h3 className="text-[18px] font-semibold leading-tight text-slate-900">{title}</h3>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status}
          {headerRight}
          <button type="button" onClick={onToggle}
            className="rounded-lg px-2 py-1.5 text-slate-400 hover:bg-white/60 hover:text-slate-600">
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>
      {expanded && <div className="p-6">{children}</div>}
    </div>
  );
}

// ─── Prose editor (Conclusion & Epilogue) ─────────────────────────────────────
function ProseEditor({ blockId, block, lessons, isBusy, busyId, generateBlock, setProse, locked, lockMessage }) {
  const prose = String(lessons?.[blockId]?.prose || "").trim();
  const hasContent = prose.length >= 40;
  const isThisBusy = busyId === blockId;

  if (locked) return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
      <p className="text-xs font-medium text-slate-400">🔒 {lockMessage || "Complete all chapters before generating."}</p>
    </div>
  );

  if (isThisBusy && !hasContent) return (
    <div className="flex items-center gap-2 text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
      <span className="text-sm">Writing this section…</span>
    </div>
  );

  if (!hasContent) return (
    <GenBtn busy={isThisBusy} hasContent={false} disabled={isBusy} onClick={() => generateBlock(block)} />
  );

  return (
    <div>
      <textarea
        className="w-full resize-y rounded-xl border border-slate-200 bg-white/70 px-4 py-3 font-[inherit] text-[15px] leading-[1.8] text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
        style={{ minHeight: 280 }}
        value={prose}
        onChange={(e) => setProse(blockId, e.target.value)}
        disabled={isThisBusy}
      />
      <div className="mt-2">
        <GenBtn busy={isThisBusy} hasContent disabled={isBusy} onClick={() => generateBlock(block)} />
      </div>
    </div>
  );
}

// ─── Key Lessons editor ───────────────────────────────────────────────────────
function KeyLessonsEditor({ data, onUpdate }) {
  const lessons = data?.lessons || [];
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({});

  function startEdit(l) { setEditId(l.id); setDraft({ ...l }); }
  function saveEdit() {
    onUpdate({ lessons: lessons.map((l) => l.id === editId ? { ...draft } : l) });
    setEditId(null);
  }
  function del(id) { onUpdate({ lessons: lessons.filter((l) => l.id !== id) }); }
  function add() {
    const n = { id: `kl-${Date.now()}`, title: "New Lesson", principle: "", explanation: "", relatedChapters: [] };
    onUpdate({ lessons: [...lessons, n] });
    setEditId(n.id); setDraft(n);
  }

  if (!lessons.length) return (
    <p className="text-sm text-slate-400 italic">Generate to extract key lessons, or add manually.</p>
  );

  return (
    <div className="space-y-3">
      {lessons.map((l, i) => editId === l.id ? (
        <div key={l.id} className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 space-y-3">
          {[["Title", "title", "text"], ["Principle (one sentence)", "principle", "text"]].map(([lbl, field]) => (
            <div key={field}>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{lbl}</label>
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-amber-300"
                value={draft[field] || ""} onChange={(e) => setDraft((p) => ({ ...p, [field]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Explanation</label>
            <textarea className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-300"
              rows={3} value={draft.explanation || ""} onChange={(e) => setDraft((p) => ({ ...p, explanation: e.target.value }))} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Related chapters (comma-separated)</label>
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-amber-300"
              value={(draft.relatedChapters || []).join(", ")}
              onChange={(e) => setDraft((p) => ({ ...p, relatedChapters: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={saveEdit} className="rounded-lg bg-amber-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-700">Save</button>
            <button type="button" onClick={() => setEditId(null)} className="rounded-lg border border-slate-200 px-4 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      ) : (
        <div key={l.id} className="group flex gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 hover:border-amber-200 hover:bg-amber-50/20 transition">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[13px] font-bold text-amber-700">{i + 1}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900">{l.title}</p>
            {l.principle && <p className="mt-0.5 text-[13px] italic text-slate-600">{l.principle}</p>}
            {l.explanation && <p className="mt-2 text-[13px] text-slate-500 leading-relaxed">{l.explanation}</p>}
            {l.relatedChapters?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {l.relatedChapters.map((ch) => (
                  <span key={ch} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">{ch}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition">
            <button type="button" onClick={() => startEdit(l)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">Edit</button>
            <button type="button" onClick={() => del(l.id)} className="rounded-lg border border-red-100 bg-white px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-50">×</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-[12px] font-medium text-slate-500 hover:border-amber-300 hover:text-amber-600">
        + Add lesson
      </button>
    </div>
  );
}

// ─── Appendix editor ──────────────────────────────────────────────────────────
function AppendixEditor({ data, onUpdate }) {
  const entries = data?.entries || [];
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({});

  function startEdit(e) { setEditId(e.id); setDraft({ ...e }); }
  function saveEdit() { onUpdate({ entries: entries.map((e) => e.id === editId ? { ...draft } : e) }); setEditId(null); }
  function del(id) { onUpdate({ entries: entries.filter((e) => e.id !== id) }); }
  function add() {
    const n = { id: `ax-${Date.now()}`, title: "New Entry", category: "", content: "" };
    onUpdate({ entries: [...entries, n] });
    setEditId(n.id); setDraft(n);
  }

  return (
    <div className="space-y-3">
      {!entries.length && <p className="text-sm text-slate-400 italic">No entries yet. Add supplementary reference material manually.</p>}
      {entries.map((e) => editId === e.id ? (
        <div key={e.id} className="rounded-xl border border-sky-200 bg-sky-50/30 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[["Title", "title"], ["Category", "category"]].map(([lbl, field]) => (
              <div key={field}>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{lbl}</label>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-sky-300"
                  value={draft[field] || ""} onChange={(e2) => setDraft((p) => ({ ...p, [field]: e2.target.value }))} />
              </div>
            ))}
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Content</label>
            <textarea className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
              rows={6} value={draft.content || ""} onChange={(e2) => setDraft((p) => ({ ...p, content: e2.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={saveEdit} className="rounded-lg bg-sky-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-sky-700">Save</button>
            <button type="button" onClick={() => setEditId(null)} className="rounded-lg border border-slate-200 px-4 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      ) : (
        <div key={e.id} className="group flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 hover:border-sky-200 transition">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-900">{e.title}</p>
              {e.category && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-700">{e.category}</span>}
            </div>
            {e.content && <p className="mt-1 text-[13px] text-slate-500 line-clamp-2">{e.content}</p>}
          </div>
          <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition">
            <button type="button" onClick={() => startEdit(e)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">Edit</button>
            <button type="button" onClick={() => del(e.id)} className="rounded-lg border border-red-100 bg-white px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-50">×</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-[12px] font-medium text-slate-500 hover:border-sky-300 hover:text-sky-600">
        + Add entry
      </button>
    </div>
  );
}

// ─── Glossary editor ──────────────────────────────────────────────────────────
function GlossaryEditor({ data, onUpdate }) {
  const terms = data?.terms || [];
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({});
  const [search, setSearch] = useState("");

  const filtered = search
    ? terms.filter((t) => t.term.toLowerCase().includes(search.toLowerCase()) || t.definition.toLowerCase().includes(search.toLowerCase()))
    : terms;

  function startEdit(t) { setEditId(t.id); setDraft({ ...t }); }
  function saveEdit() {
    const sorted = terms.map((t) => t.id === editId ? { ...draft } : t).sort((a, b) => a.term.localeCompare(b.term));
    onUpdate({ terms: sorted }); setEditId(null);
  }
  function del(id) { onUpdate({ terms: terms.filter((t) => t.id !== id) }); }
  function add() {
    const n = { id: `gl-${Date.now()}`, term: "New Term", definition: "", firstChapter: "", relatedChapters: [], synonyms: [] };
    onUpdate({ terms: [...terms, n].sort((a, b) => a.term.localeCompare(b.term)) });
    setEditId(n.id); setDraft(n);
  }

  if (!terms.length) return <p className="text-sm text-slate-400 italic">Generate to scan the manuscript for key terms, or add manually.</p>;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input type="search" placeholder="Search terms…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-teal-300" />
        <span className="text-[12px] text-slate-400">{terms.length} terms</span>
        <button type="button" onClick={add} className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:border-teal-300 hover:text-teal-600">+ Add</button>
      </div>
      <div className="space-y-2">
        {filtered.map((t) => editId === t.id ? (
          <div key={t.id} className="rounded-xl border border-teal-200 bg-teal-50/30 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Term</label>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-teal-300"
                  value={draft.term || ""} onChange={(e) => setDraft((p) => ({ ...p, term: e.target.value }))} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">First chapter</label>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-teal-300"
                  value={draft.firstChapter || ""} onChange={(e) => setDraft((p) => ({ ...p, firstChapter: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Definition</label>
              <textarea className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-300"
                rows={3} value={draft.definition || ""} onChange={(e) => setDraft((p) => ({ ...p, definition: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[["Related chapters (comma-sep)", "relatedChapters"], ["Synonyms (comma-sep)", "synonyms"]].map(([lbl, field]) => (
                <div key={field}>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{lbl}</label>
                  <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-teal-300"
                    value={(draft[field] || []).join(", ")}
                    onChange={(e) => setDraft((p) => ({ ...p, [field]: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={saveEdit} className="rounded-lg bg-teal-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-teal-700">Save</button>
              <button type="button" onClick={() => setEditId(null)} className="rounded-lg border border-slate-200 px-4 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        ) : (
          <div key={t.id} className="group flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-white p-3 hover:border-teal-200 transition">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold text-slate-900">{t.term}</span>
                {t.synonyms?.length > 0 && <span className="text-[12px] text-slate-400">({t.synonyms.join(", ")})</span>}
              </div>
              <p className="mt-0.5 text-[13px] text-slate-600 leading-relaxed">{t.definition}</p>
              {t.firstChapter && <p className="mt-1 text-[11px] text-slate-400">First introduced: {t.firstChapter}</p>}
            </div>
            <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition">
              <button type="button" onClick={() => startEdit(t)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">Edit</button>
              <button type="button" onClick={() => del(t.id)} className="rounded-lg border border-red-100 bg-white px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-50">×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── References editor ────────────────────────────────────────────────────────
const REF_GROUPS = ["Books", "Articles", "Research Papers", "Standards", "Official Documentation", "Websites"];

function ReferencesEditor({ data, onUpdate }) {
  const groups = data?.groups || {};
  const [editKey, setEditKey] = useState(null);
  const [draft, setDraft] = useState({});

  function gItems(g) { return Array.isArray(groups[g]) ? groups[g] : []; }
  function startEdit(g, item) { setEditKey(`${g}/${item.id}`); setDraft({ ...item }); }
  function saveEdit() {
    if (!editKey) return;
    const [g] = editKey.split("/");
    onUpdate({ groups: { ...groups, [g]: gItems(g).map((r) => r.id === draft.id ? { ...draft } : r) } });
    setEditKey(null);
  }
  function del(g, id) { onUpdate({ groups: { ...groups, [g]: gItems(g).filter((r) => r.id !== id) } }); }
  function add(g) {
    const n = { id: `ref-${Date.now()}`, title: "", author: "", publication: "", year: "", url: "", notes: "" };
    onUpdate({ groups: { ...groups, [g]: [...gItems(g), n] } });
    setEditKey(`${g}/${n.id}`); setDraft(n);
  }

  return (
    <div className="space-y-6">
      <p className="text-[13px] text-slate-500">List sources grouped by type. This section is fully manual.</p>
      {REF_GROUPS.map((g) => {
        const items = gItems(g);
        return (
          <div key={g}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[13px] font-semibold text-slate-700">{g}{items.length > 0 && <span className="ml-1 font-normal text-slate-400">({items.length})</span>}</h4>
              <button type="button" onClick={() => add(g)} className="rounded-full border border-dashed border-slate-300 px-3 py-0.5 text-[11px] font-medium text-slate-400 hover:border-green-300 hover:text-green-600">+ Add</button>
            </div>
            {!items.length && <p className="text-[12px] text-slate-300 italic">No {g.toLowerCase()} added yet.</p>}
            <div className="space-y-2">
              {items.map((r) => editKey === `${g}/${r.id}` ? (
                <div key={r.id} className="rounded-xl border border-green-200 bg-green-50/30 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Title</label>
                      <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-green-300"
                        value={draft.title || ""} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} />
                    </div>
                    {[["Author(s)", "author"], ["Publication / Publisher", "publication"], ["Year", "year"], ["URL (optional)", "url"]].map(([lbl, field]) => (
                      <div key={field}>
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{lbl}</label>
                        <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-green-300"
                          value={draft[field] || ""} onChange={(e) => setDraft((p) => ({ ...p, [field]: e.target.value }))} />
                      </div>
                    ))}
                    <div className="col-span-2">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notes (optional)</label>
                      <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-green-300"
                        value={draft.notes || ""} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={saveEdit} className="rounded-lg bg-green-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-green-700">Save</button>
                    <button type="button" onClick={() => setEditKey(null)} className="rounded-lg border border-slate-200 px-4 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                  </div>
                </div>
              ) : (
                <div key={r.id} className="group flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-white p-3 hover:border-green-200 transition">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-[14px]">{r.title || <span className="text-slate-400 italic">Untitled</span>}</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">{[r.author, r.publication, r.year].filter(Boolean).join(" · ")}</p>
                    {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-green-600 underline">{r.url}</a>}
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button type="button" onClick={() => startEdit(g, r)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">Edit</button>
                    <button type="button" onClick={() => del(g, r.id)} className="rounded-lg border border-red-100 bg-white px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-50">×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Further Reading editor ───────────────────────────────────────────────────
const FR_TYPES = ["Book", "Article", "Course", "Website", "Podcast", "Research Paper"];
const FR_DIFFS = ["Beginner", "Intermediate", "Advanced"];
const DIFF_CLS  = { Beginner: "bg-emerald-100 text-emerald-700", Intermediate: "bg-amber-100 text-amber-700", Advanced: "bg-red-100 text-red-700" };

function FurtherReadingEditor({ data, onUpdate }) {
  const recs = data?.recommendations || [];
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({});

  function startEdit(r) { setEditId(r.id); setDraft({ ...r }); }
  function saveEdit() { onUpdate({ recommendations: recs.map((r) => r.id === editId ? { ...draft } : r) }); setEditId(null); }
  function del(id) { onUpdate({ recommendations: recs.filter((r) => r.id !== id) }); }
  function add() {
    const n = { id: `fr-${Date.now()}`, title: "", author: "", type: "Book", description: "", why: "", difficulty: "Intermediate", url: "" };
    onUpdate({ recommendations: [...recs, n] });
    setEditId(n.id); setDraft(n);
  }

  if (!recs.length) return <p className="text-sm text-slate-400 italic">Generate to suggest relevant further reading, or add manually.</p>;

  return (
    <div className="space-y-3">
      {recs.map((r) => editId === r.id ? (
        <div key={r.id} className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Title</label>
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-300"
                value={draft.title || ""} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Author / Organization</label>
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-300"
                value={draft.author || ""} onChange={(e) => setDraft((p) => ({ ...p, author: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Type</label>
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-300"
                  value={draft.type || "Book"} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))}>
                  {FR_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Difficulty</label>
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-300"
                  value={draft.difficulty || "Intermediate"} onChange={(e) => setDraft((p) => ({ ...p, difficulty: e.target.value }))}>
                  {FR_DIFFS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
            {[["Description", "description", 2], ["Why recommended", "why", 2]].map(([lbl, field, rows]) => (
              <div key={field} className="col-span-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{lbl}</label>
                <textarea className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
                  rows={rows} value={draft[field] || ""} onChange={(e) => setDraft((p) => ({ ...p, [field]: e.target.value }))} />
              </div>
            ))}
            <div className="col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">URL (optional)</label>
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-300"
                value={draft.url || ""} onChange={(e) => setDraft((p) => ({ ...p, url: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={saveEdit} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-indigo-700">Save</button>
            <button type="button" onClick={() => setEditId(null)} className="rounded-lg border border-slate-200 px-4 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      ) : (
        <div key={r.id} className="group flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 hover:border-indigo-200 hover:bg-indigo-50/20 transition">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-900">{r.title}</p>
              {r.type && <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">{r.type}</span>}
              {r.difficulty && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${DIFF_CLS[r.difficulty] || "bg-slate-100 text-slate-600"}`}>{r.difficulty}</span>}
            </div>
            {r.author && <p className="mt-0.5 text-[12px] text-slate-500">by {r.author}</p>}
            {r.description && <p className="mt-1.5 text-[13px] text-slate-600 leading-relaxed">{r.description}</p>}
            {r.why && <p className="mt-1 text-[12px] text-indigo-600 italic">{r.why}</p>}
            {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-[12px] text-indigo-500 underline">{r.url}</a>}
          </div>
          <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition">
            <button type="button" onClick={() => startEdit(r)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">Edit</button>
            <button type="button" onClick={() => del(r.id)} className="rounded-lg border border-red-100 bg-white px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-50">×</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-[12px] font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600">
        + Add recommendation
      </button>
    </div>
  );
}

// ─── Acknowledgments editor ───────────────────────────────────────────────────
const ACK_DEFAULTS = ["Individuals", "Organizations", "Editors", "Reviewers", "Community", "Supporters"];

function AcknowledgmentsEditor({ data, onUpdate }) {
  const groups = data?.groups?.length
    ? data.groups
    : ACK_DEFAULTS.map((name) => ({ id: `ack-${name.toLowerCase()}`, name, text: "" }));
  const [newGroupName, setNewGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);

  function updateGroup(id, text) { onUpdate({ groups: groups.map((g) => g.id === id ? { ...g, text } : g) }); }
  function deleteGroup(id) { onUpdate({ groups: groups.filter((g) => g.id !== id) }); }
  function addGroup() {
    if (!newGroupName.trim()) return;
    onUpdate({ groups: [...groups, { id: `ack-${Date.now()}`, name: newGroupName.trim(), text: "" }] });
    setNewGroupName(""); setAddingGroup(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-slate-500">Thank the people and organizations who contributed to this book. Each group is a separate paragraph in the published version.</p>
      {groups.map((g) => (
        <div key={g.id}>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{g.name}</label>
            <button type="button" onClick={() => deleteGroup(g.id)} className="text-[11px] text-slate-300 hover:text-red-400">Remove</button>
          </div>
          <textarea
            className="w-full resize-y rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-[14px] leading-relaxed text-slate-700 outline-none transition focus:border-rose-300 focus:ring-1 focus:ring-rose-100"
            rows={3}
            placeholder={`Thank the ${g.name.toLowerCase()} who contributed…`}
            value={g.text || ""}
            onChange={(e) => updateGroup(g.id, e.target.value)}
          />
        </div>
      ))}
      {addingGroup ? (
        <div className="flex items-center gap-2">
          <input className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-rose-300"
            placeholder="Group name…" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addGroup(); if (e.key === "Escape") setAddingGroup(false); }}
            autoFocus />
          <button type="button" onClick={addGroup} className="rounded-lg bg-rose-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-700">Add</button>
          <button type="button" onClick={() => setAddingGroup(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] text-slate-500 hover:bg-slate-50">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAddingGroup(true)}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-[12px] font-medium text-slate-500 hover:border-rose-300 hover:text-rose-600">
          + Add group
        </button>
      )}
    </div>
  );
}

// ─── The End editor ───────────────────────────────────────────────────────────
function TheEndEditor({ data, onUpdate }) {
  const msg   = data?.thankYouMessage || "";
  const quote = data?.quote || "";

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-14 text-center select-none">
        <div className="absolute inset-0 bg-gradient-to-t from-violet-900/20 to-transparent pointer-events-none" />
        <p className="relative text-[11px] font-bold uppercase tracking-[3px] text-violet-400 mb-4">Reading Complete</p>
        <h2 className="relative text-[52px] font-bold tracking-tight text-white" style={{ fontFamily: "Georgia, serif" }}>The End</h2>
        <div className="relative mx-auto mt-2 h-px w-16 bg-gradient-to-r from-transparent via-violet-400 to-transparent" />
        {msg   && <p className="relative mt-6 text-[15px] leading-relaxed text-slate-300 max-w-sm mx-auto">{msg}</p>}
        {quote && <p className="relative mt-4 text-[14px] italic text-slate-400 max-w-xs mx-auto">"{quote}"</p>}
        <div className="relative mt-8 flex items-center justify-center gap-2">
          <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-700">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-violet-500 to-amber-400" />
          </div>
          <span className="text-[12px] font-semibold text-violet-400">100%</span>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Thank-you message</label>
          <textarea className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] leading-relaxed text-slate-700 outline-none transition focus:border-violet-300 focus:ring-1 focus:ring-violet-100"
            rows={3} placeholder="Thank you for reading…" value={msg}
            onChange={(e) => onUpdate({ ...data, thankYouMessage: e.target.value })} />
        </div>
        <div>
          <label className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Closing quote (optional)</label>
          <input type="text" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-700 outline-none transition focus:border-violet-300"
            placeholder="An inspiring closing thought…" value={quote}
            onChange={(e) => onUpdate({ ...data, quote: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BackMatterSection({
  bookOutline, lessons, setLessons, fullProject,
  blocks, blockById, generateBlock, isBusy, busyId, manuscriptComplete,
}) {
  const outline = bookOutline && typeof bookOutline === "object" ? bookOutline : {};

  const conclusion         = outline.conclusion;
  const epilogueNode       = outline.epilogue;
  const keyLessonsNode     = outline.keyLessons;
  const appendixNode       = outline.appendix;
  const glossaryNode       = outline.glossary;
  const referencesNode     = outline.references;
  const furtherReadingNode = outline.furtherReading;
  const ackNode            = outline.backAcknowledgments;
  const theEndNode         = outline.theEnd;

  const [expanded,    setExpanded]    = useState({});
  const [busySection, setBusySection] = useState(null);
  const [batchBusy,   setBatchBusy]   = useState(false);
  const [status,      setStatus]      = useState("");

  const toggle     = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));
  const isExp      = (key) => Boolean(expanded[key]);
  const secBusy    = (key) => busySection === key;
  const anyBusy    = isBusy || batchBusy || Boolean(busySection);

  // ─── Lesson helpers ────────────────────────────────────────────────────────
  function patchLesson(id, patch) {
    setLessons((prev) => {
      const base = prev && typeof prev === "object" ? prev : {};
      const cur  = base[id] && typeof base[id] === "object" ? base[id] : {};
      return { ...base, [id]: { ...cur, ...patch, updatedAt: new Date().toISOString() } };
    });
  }
  function getSD(id) { return lessons?.[id]?.structuredData || null; }
  function setSD(id, structuredData, prose) {
    patchLesson(id, { structuredData, ...(prose !== undefined ? { prose } : {}) });
  }
  function setProse(id, prose) { patchLesson(id, { prose }); }

  // ─── Content detection ─────────────────────────────────────────────────────
  const hasProse = (id) => String(lessons?.[id]?.prose || "").trim().length >= 40;
  const hasKL    = Boolean(keyLessonsNode?.id     && getSD(keyLessonsNode.id)?.lessons?.length > 0);
  const hasGl    = Boolean(glossaryNode?.id       && getSD(glossaryNode.id)?.terms?.length > 0);
  const hasFR    = Boolean(furtherReadingNode?.id  && getSD(furtherReadingNode.id)?.recommendations?.length > 0);

  // ─── Build AI context ──────────────────────────────────────────────────────
  function buildCtx() {
    return {
      bookContext:       buildBookContext(fullProject),
      chapterSummaries:  buildChapterSummaries(blocks, lessons),
      manuscriptContent: buildManuscriptContext(blocks, lessons),
      tone:              writingTone(fullProject),
      audience:          writingAudience(fullProject),
    };
  }

  // ─── Structured generation ─────────────────────────────────────────────────
  async function genKeyLessons(force = false) {
    if (!keyLessonsNode?.id || (!force && hasKL)) return;
    setBusySection("keyLessons"); setStatus("Generating Key Lessons…");
    try {
      const data = await aiFetch("/api/ai/back-matter/key-lessons", buildCtx(), { noCache: true });
      if (data?.lessons?.length) {
        setSD(keyLessonsNode.id, { lessons: data.lessons }, keyLessonsToProse(data.lessons));
        setStatus(`Generated ${data.lessons.length} key lessons.`);
      }
    } catch (e) { setStatus(e.message || "Failed to generate key lessons."); }
    finally { setBusySection(null); }
  }

  async function genGlossary(force = false) {
    if (!glossaryNode?.id || (!force && hasGl)) return;
    setBusySection("glossary"); setStatus("Generating Glossary…");
    try {
      const data = await aiFetch("/api/ai/back-matter/glossary", buildCtx(), { noCache: true });
      if (data?.terms?.length) {
        setSD(glossaryNode.id, { terms: data.terms }, glossaryToProse(data.terms));
        setStatus(`Generated ${data.terms.length} glossary terms.`);
      }
    } catch (e) { setStatus(e.message || "Failed to generate glossary."); }
    finally { setBusySection(null); }
  }

  async function genFurtherReading(force = false) {
    if (!furtherReadingNode?.id || (!force && hasFR)) return;
    setBusySection("furtherReading"); setStatus("Generating Further Reading…");
    try {
      const data = await aiFetch("/api/ai/back-matter/further-reading", buildCtx(), { noCache: true });
      if (data?.recommendations?.length) {
        setSD(furtherReadingNode.id, { recommendations: data.recommendations }, furtherReadingToProse(data.recommendations));
        setStatus(`Generated ${data.recommendations.length} recommendations.`);
      }
    } catch (e) { setStatus(e.message || "Failed to generate further reading."); }
    finally { setBusySection(null); }
  }

  async function generateAll() {
    setBatchBusy(true); setStatus("Generating back matter…");
    try {
      if (conclusion?.id) {
        const block = blockById?.get(conclusion.id);
        if (block && !hasProse(conclusion.id)) await generateBlock(block);
      }
      if (epilogueNode?.id) {
        const block = blockById?.get(epilogueNode.id);
        if (block && !hasProse(epilogueNode.id)) await generateBlock(block);
      }
      await genKeyLessons();
      await genGlossary();
      await genFurtherReading();
      setStatus("Back matter generated.");
    } catch (e) { setStatus(e.message || "Generation error."); }
    finally { setBatchBusy(false); }
  }

  // ─── Structured data updaters ──────────────────────────────────────────────
  const updateKL  = (sd) => keyLessonsNode?.id     && setSD(keyLessonsNode.id,     sd, keyLessonsToProse(sd.lessons));
  const updateAx  = (sd) => appendixNode?.id        && setSD(appendixNode.id,        sd, appendixToProse(sd.entries));
  const updateGl  = (sd) => glossaryNode?.id        && setSD(glossaryNode.id,        sd, glossaryToProse(sd.terms));
  const updateRef = (sd) => referencesNode?.id      && setSD(referencesNode.id,      sd, referencesToProse(sd.groups));
  const updateFR  = (sd) => furtherReadingNode?.id  && setSD(furtherReadingNode.id,  sd, furtherReadingToProse(sd.recommendations));
  const updateAck = (sd) => ackNode?.id             && setSD(ackNode.id,             sd, acknowledgmentsToProse(sd.groups));
  const updateEnd = (sd) => theEndNode?.id          && setSD(theEndNode.id,          sd, theEndToProse(sd));

  const lockMsg = manuscriptComplete ? null : "Complete all chapters and sections first.";
  const hasAnyNode = conclusion?.id || epilogueNode?.id || keyLessonsNode?.id ||
    appendixNode?.id || glossaryNode?.id || referencesNode?.id ||
    furtherReadingNode?.id || ackNode?.id || theEndNode?.id;

  if (!hasAnyNode) return null;

  return (
    <div className="mt-12">
      {/* Divider */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[1.5px] text-slate-400">Back Matter</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* Generate banner */}
      {manuscriptComplete ? (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-violet-200 bg-violet-50/60 px-6 py-4">
          <div>
            <p className="text-[13px] font-semibold text-violet-900">Generate Back Matter</p>
            <p className="mt-0.5 text-[12px] text-violet-600">
              Automatically create Conclusion, Epilogue, Key Lessons, Glossary &amp; Further Reading from your manuscript.
            </p>
          </div>
          <button type="button" disabled={anyBusy} onClick={generateAll}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-300 bg-violet-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50">
            {batchBusy
              ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-200 border-t-white" />Generating…</>
              : "✦ Generate Back Matter"}
          </button>
        </div>
      ) : (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-medium text-amber-700">
          🔒 Complete all chapters and sections to unlock back matter generation.
        </div>
      )}

      {status && (
        <p className="mb-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-2 text-[12px] text-slate-500">{status}</p>
      )}

      <div className="flex flex-col gap-4">

        {/* 1 — Conclusion */}
        {conclusion?.id && (() => {
          const block = blockById?.get(conclusion.id);
          const done  = hasProse(conclusion.id);
          return (
            <SectionCard icon="◎" sectionLabel="Back Matter · 1 of 9" title={conclusion.title || "Conclusion"}
              status={done && <DraftedBadge />}
              expanded={isExp("conclusion")} onToggle={() => toggle("conclusion")}
              borderCls="border-slate-200" bgCls="bg-slate-50/60" iconCls="text-slate-500"
              headerRight={block && <GenBtn busy={busyId === conclusion.id} hasContent={done} disabled={anyBusy || !manuscriptComplete} onClick={() => generateBlock(block)} />}>
              <p className="mb-4 text-[13px] text-slate-500">A concise closing summary — synthesize the book's overall journey and leave readers with final encouragement.</p>
              <ProseEditor blockId={conclusion.id} block={block} lessons={lessons} isBusy={anyBusy} busyId={busyId} generateBlock={generateBlock} setProse={setProse} locked={!manuscriptComplete} lockMessage={lockMsg} />
            </SectionCard>
          );
        })()}

        {/* 2 — Epilogue */}
        {epilogueNode?.id && (() => {
          const block = blockById?.get(epilogueNode.id);
          const done  = hasProse(epilogueNode.id);
          return (
            <SectionCard icon="✦" sectionLabel="Back Matter · 2 of 9" title={epilogueNode.title || "Epilogue"}
              status={done && <DraftedBadge />}
              expanded={isExp("epilogue")} onToggle={() => toggle("epilogue")}
              borderCls="border-violet-100" bgCls="bg-violet-50/40" iconCls="text-violet-500"
              headerRight={block && <GenBtn busy={busyId === epilogueNode.id} hasContent={done} disabled={anyBusy || !manuscriptComplete} onClick={() => generateBlock(block)} />}>
              <p className="mb-4 text-[13px] text-slate-500">An emotional, personal ending — the final conversation between author and reader about how the journey has changed them.</p>
              <ProseEditor blockId={epilogueNode.id} block={block} lessons={lessons} isBusy={anyBusy} busyId={busyId} generateBlock={generateBlock} setProse={setProse} locked={!manuscriptComplete} lockMessage={lockMsg} />
            </SectionCard>
          );
        })()}

        {/* 3 — Key Lessons */}
        {keyLessonsNode?.id && (
          <SectionCard icon="◈" sectionLabel="Back Matter · 3 of 9" title={keyLessonsNode.title || "Key Lessons"}
            status={hasKL && <DraftedBadge count={getSD(keyLessonsNode.id)?.lessons?.length} label="lessons" />}
            expanded={isExp("keyLessons")} onToggle={() => toggle("keyLessons")}
            borderCls="border-amber-100" bgCls="bg-amber-50/40" iconCls="text-amber-500"
            headerRight={<GenBtn busy={secBusy("keyLessons")} hasContent={hasKL} disabled={anyBusy || !manuscriptComplete} onClick={() => genKeyLessons(true)} />}>
            <p className="mb-4 text-[13px] text-slate-500">Quick-reference cards of the most important principles — the ideas readers will return to long after finishing.</p>
            <KeyLessonsEditor data={getSD(keyLessonsNode.id)} onUpdate={updateKL} />
          </SectionCard>
        )}

        {/* 4 — Appendix */}
        {appendixNode?.id && (
          <SectionCard icon="⊞" sectionLabel="Back Matter · 4 of 9" title={appendixNode.title || "Appendix"}
            status={getSD(appendixNode.id)?.entries?.length > 0 && <DraftedBadge count={getSD(appendixNode.id).entries.length} label="entries" />}
            expanded={isExp("appendix")} onToggle={() => toggle("appendix")}
            borderCls="border-sky-100" bgCls="bg-sky-50/40" iconCls="text-sky-500">
            <AppendixEditor data={getSD(appendixNode.id)} onUpdate={updateAx} />
          </SectionCard>
        )}

        {/* 5 — Glossary */}
        {glossaryNode?.id && (
          <SectionCard icon="≡" sectionLabel="Back Matter · 5 of 9" title={glossaryNode.title || "Glossary"}
            status={hasGl && <DraftedBadge count={getSD(glossaryNode.id)?.terms?.length} label="terms" />}
            expanded={isExp("glossary")} onToggle={() => toggle("glossary")}
            borderCls="border-teal-100" bgCls="bg-teal-50/40" iconCls="text-teal-500"
            headerRight={<GenBtn busy={secBusy("glossary")} hasContent={hasGl} disabled={anyBusy || !manuscriptComplete} onClick={() => genGlossary(true)} />}>
            <p className="mb-4 text-[13px] text-slate-500">A searchable, alphabetical dictionary of key terms as used specifically in this book, with chapter references.</p>
            <GlossaryEditor data={getSD(glossaryNode.id)} onUpdate={updateGl} />
          </SectionCard>
        )}

        {/* 6 — References */}
        {referencesNode?.id && (
          <SectionCard icon="◉" sectionLabel="Back Matter · 6 of 9" title={referencesNode.title || "References"}
            expanded={isExp("references")} onToggle={() => toggle("references")}
            borderCls="border-green-100" bgCls="bg-green-50/40" iconCls="text-green-600">
            <ReferencesEditor data={getSD(referencesNode.id)} onUpdate={updateRef} />
          </SectionCard>
        )}

        {/* 7 — Further Reading */}
        {furtherReadingNode?.id && (
          <SectionCard icon="→" sectionLabel="Back Matter · 7 of 9" title={furtherReadingNode.title || "Further Reading"}
            status={hasFR && <DraftedBadge count={getSD(furtherReadingNode.id)?.recommendations?.length} label="picks" />}
            expanded={isExp("furtherReading")} onToggle={() => toggle("furtherReading")}
            borderCls="border-indigo-100" bgCls="bg-indigo-50/40" iconCls="text-indigo-500"
            headerRight={<GenBtn busy={secBusy("furtherReading")} hasContent={hasFR} disabled={anyBusy || !manuscriptComplete} onClick={() => genFurtherReading(true)} />}>
            <p className="mb-4 text-[13px] text-slate-500">Curated resources guiding readers toward continued learning, tailored to your book's topics and audience level.</p>
            <FurtherReadingEditor data={getSD(furtherReadingNode.id)} onUpdate={updateFR} />
          </SectionCard>
        )}

        {/* 8 — Acknowledgments */}
        {ackNode?.id && (
          <SectionCard icon="♡" sectionLabel="Back Matter · 8 of 9" title={ackNode.title || "Acknowledgments"}
            expanded={isExp("backAcknowledgments")} onToggle={() => toggle("backAcknowledgments")}
            borderCls="border-rose-100" bgCls="bg-rose-50/40" iconCls="text-rose-500">
            <AcknowledgmentsEditor data={getSD(ackNode.id)} onUpdate={updateAck} />
          </SectionCard>
        )}

        {/* 9 — The End */}
        {theEndNode?.id && (
          <SectionCard icon="★" sectionLabel="Back Matter · 9 of 9" title={theEndNode.title || "The End"}
            expanded={isExp("theEnd")} onToggle={() => toggle("theEnd")}
            borderCls="border-purple-100" bgCls="bg-purple-50/40" iconCls="text-purple-500">
            <TheEndEditor data={getSD(theEndNode.id) || {}} onUpdate={updateEnd} />
          </SectionCard>
        )}

      </div>
    </div>
  );
}
