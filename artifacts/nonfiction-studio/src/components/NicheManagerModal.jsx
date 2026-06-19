import { useState } from "react";
import { slugifyId, deriveContentDirection } from "@/lib/niche/registry";

const CONTENT_DIRECTION_MAX = 1000;

function AutoTextarea({ value, onChange, placeholder, maxLength = CONTENT_DIRECTION_MAX }) {
  return (
    <textarea
      className="input-light w-full resize-none text-sm leading-relaxed transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200/60"
      rows={4}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => {
        const ta = e.target;
        ta.style.height = "auto";
        ta.style.height = `${Math.min(ta.scrollHeight, 320)}px`;
        onChange(e.target.value);
      }}
      onFocus={(e) => {
        e.target.style.height = "auto";
        e.target.style.height = `${Math.min(e.target.scrollHeight, 320)}px`;
      }}
    />
  );
}

function DeepNicheEditor({ deepNiches, onChange }) {
  const [input, setInput] = useState("");

  function addOne() {
    const v = input.trim();
    if (!v) return;
    if (deepNiches.some((d) => d.toLowerCase() === v.toLowerCase())) {
      setInput("");
      return;
    }
    onChange([...deepNiches, v]);
    setInput("");
  }

  function removeAt(idx) {
    onChange(deepNiches.filter((_, i) => i !== idx));
  }

  return (
    <div className="mt-3">
      <label className="text-xs font-semibold text-slate-700">Deep niches</label>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
        Add as many custom deep niches as you want for this sub-niche.
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {deepNiches.length === 0 && (
          <span className="text-[11px] italic text-slate-400">No deep niches yet — add one below.</span>
        )}
        {deepNiches.map((d, i) => (
          <span
            key={`${d}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-medium text-sky-800 shadow-sm"
          >
            {d}
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="text-sky-500 transition hover:text-red-600"
              aria-label={`Remove ${d}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="input-light flex-1 text-sm"
          value={input}
          placeholder="e.g. ADHD Time Management"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOne();
            }
          }}
        />
        <button
          type="button"
          onClick={addOne}
          disabled={!input.trim()}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function NicheManagerModal({ registry, onSave, onClose }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(registry)));
  // Track which main niches have sub-niches visible (expanded)
  const [expanded, setExpanded] = useState(() => new Set());

  function toggleExpanded(mainId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(mainId)) next.delete(mainId);
      else next.add(mainId);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(draft.mainNiches.map((m) => m.id)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  function updateMain(mainId, patch) {
    setDraft((prev) => ({
      ...prev,
      mainNiches: prev.mainNiches.map((m) => (m.id === mainId ? { ...m, ...patch } : m))
    }));
  }

  function addMainNiche() {
    const label = "New Main Niche";
    const id = slugifyId(label) + `-${Date.now().toString(36).slice(2, 6)}`;
    setDraft((prev) => ({
      ...prev,
      mainNiches: [
        ...prev.mainNiches,
        {
          id,
          label,
          description: "",
          tones: ["Narrative"],
          audiences: ["General readers"],
          publishingGoals: ["Amazon KDP bestseller"],
          subNiches: []
        }
      ]
    }));
    // Auto-expand newly added niche
    setExpanded((prev) => new Set([...prev, id]));
  }

  function deleteMain(mainId) {
    if (!window.confirm("Delete this main niche and all sub-niches?")) return;
    setDraft((prev) => ({
      ...prev,
      mainNiches: prev.mainNiches.filter((m) => m.id !== mainId)
    }));
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(mainId);
      return next;
    });
  }

  function addSub(mainId) {
    const label = "New Sub-Niche";
    const id = slugifyId(label) + `-${Date.now().toString(36).slice(2, 6)}`;
    setDraft((prev) => ({
      ...prev,
      mainNiches: prev.mainNiches.map((m) =>
        m.id !== mainId
          ? m
          : {
              ...m,
              subNiches: [
                ...(m.subNiches || []),
                {
                  id,
                  label,
                  blueprintKey: "self-help-transformation",
                  contentDirection: deriveContentDirection({ blueprintKey: "self-help-transformation" }),
                  deepNiches: [],
                  overrides: {}
                }
              ]
            }
      )
    }));
    // Auto-expand so user sees the new sub-niche
    setExpanded((prev) => new Set([...prev, mainId]));
  }

  function updateSub(mainId, subId, patch) {
    setDraft((prev) => ({
      ...prev,
      mainNiches: prev.mainNiches.map((m) =>
        m.id !== mainId
          ? m
          : {
              ...m,
              subNiches: (m.subNiches || []).map((s) => (s.id === subId ? { ...s, ...patch } : s))
            }
      )
    }));
  }

  function deleteSub(mainId, subId) {
    setDraft((prev) => ({
      ...prev,
      mainNiches: prev.mainNiches.map((m) =>
        m.id !== mainId ? m : { ...m, subNiches: (m.subNiches || []).filter((s) => s.id !== subId) }
      )
    }));
  }

  const allExpanded = draft.mainNiches.every((m) => expanded.has(m.id));
  const anyExpanded = draft.mainNiches.some((m) => expanded.has(m.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">

        {/* ── Header ── */}
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-slate-900">Niche catalog manager</h3>
            <p className="text-xs text-slate-500">Add, edit, or remove niches — saved in this browser.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={allExpanded ? collapseAll : expandAll}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {allExpanded ? "Collapse all" : "Expand all"}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              Close
            </button>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {draft.mainNiches.map((main) => {
            const isOpen = expanded.has(main.id);
            const subCount = (main.subNiches || []).length;

            return (
              <article key={main.id} className="rounded-xl border border-slate-200 overflow-hidden">

                {/* ── Main niche header row ── */}
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-3">
                  {/* Toggle button */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(main.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left group"
                    aria-expanded={isOpen}
                  >
                    <ChevronIcon open={isOpen} />
                    <span className="font-semibold text-slate-800 truncate group-hover:text-sky-700 transition-colors">
                      {main.label || "Untitled niche"}
                    </span>
                    <span className="flex-shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {subCount} sub-niche{subCount !== 1 ? "s" : ""}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteMain(main.id)}
                    className="flex-shrink-0 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 transition"
                  >
                    Delete
                  </button>
                </div>

                {/* ── Expanded content ── */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-3 space-y-4">
                    {/* Name + description */}
                    <div className="space-y-2">
                      <input
                        className="input-light w-full font-semibold"
                        value={main.label}
                        placeholder="Main niche name"
                        onChange={(e) => updateMain(main.id, { label: e.target.value })}
                      />
                      <textarea
                        className="input-light w-full min-h-[52px] text-sm"
                        placeholder="Description for this niche family"
                        value={main.description || ""}
                        onChange={(e) => updateMain(main.id, { description: e.target.value })}
                      />
                    </div>

                    {/* Sub-niches */}
                    {subCount > 0 && (
                      <ul className="space-y-2">
                        {(main.subNiches || []).map((sub) => {
                          const contentDirection =
                            typeof sub.contentDirection === "string"
                              ? sub.contentDirection
                              : deriveContentDirection(sub);
                          const deepNiches = Array.isArray(sub.deepNiches) ? sub.deepNiches : [];
                          return (
                            <li key={sub.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  className="input-light min-w-[160px] flex-1 text-sm font-medium"
                                  value={sub.label}
                                  onChange={(e) => updateSub(main.id, sub.id, { label: e.target.value })}
                                />
                                <button
                                  type="button"
                                  onClick={() => deleteSub(main.id, sub.id)}
                                  className="text-xs text-red-500 hover:text-red-700 hover:underline transition"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="mt-3">
                                <label className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                                  <span>Content Direction</span>
                                  <span className="text-[10px] font-normal text-slate-400">
                                    {contentDirection.length}/{CONTENT_DIRECTION_MAX}
                                  </span>
                                </label>
                                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                                  Controls emotional tone, pacing, structure, and reader experience.
                                </p>
                                <div className="mt-1.5">
                                  <AutoTextarea
                                    value={contentDirection}
                                    placeholder="Describe how books in this sub-niche should feel, flow, and emotionally connect with readers…"
                                    onChange={(val) => updateSub(main.id, sub.id, { contentDirection: val })}
                                  />
                                </div>
                              </div>
                              <DeepNicheEditor
                                deepNiches={deepNiches}
                                onChange={(next) => updateSub(main.id, sub.id, { deepNiches: next })}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <button
                      type="button"
                      onClick={() => addSub(main.id)}
                      className="text-sm font-medium text-sky-700 hover:text-sky-900 transition"
                    >
                      + Add sub-niche
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {/* ── Add main niche ── */}
        <div className="border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={addMainNiche} className="text-sm font-semibold text-sky-700 hover:text-sky-900 transition">
            + Add main niche
          </button>
        </div>

        {/* ── Footer ── */}
        <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 transition"
          >
            Save catalog
          </button>
        </footer>

      </div>
    </div>
  );
}
