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
        Third-level focuses shown in the Research step's Deep Niche dropdown. Add as many as you want.
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

export default function NicheManagerModal({ registry, onSave, onClose }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(registry)));

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
  }

  function deleteMain(mainId) {
    if (!window.confirm("Delete this main niche and all sub-niches?")) return;
    setDraft((prev) => ({
      ...prev,
      mainNiches: prev.mainNiches.filter((m) => m.id !== mainId)
    }));
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
                  blueprintKey: "story-narrative",
                  contentDirection: deriveContentDirection({ blueprintKey: "story-narrative" }),
                  overrides: {}
                }
              ]
            }
      )
    }));
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-slate-900">Niche catalog manager</h3>
            <p className="text-xs text-slate-500">Add, edit, or remove niches—saved in this browser.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {draft.mainNiches.map((main) => (
            <article key={main.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap gap-2">
                <input
                  className="input-light min-w-[200px] flex-1 font-semibold"
                  value={main.label}
                  onChange={(e) => {
                    const label = e.target.value;
                    updateMain(main.id, { label });
                  }}
                />
                <button
                  type="button"
                  onClick={() => deleteMain(main.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  Delete main
                </button>
              </div>
              <textarea
                className="input-light mt-2 min-h-[60px] w-full text-sm"
                placeholder="Description for this niche family"
                value={main.description || ""}
                onChange={(e) => updateMain(main.id, { description: e.target.value })}
              />

              <ul className="mt-4 space-y-3">
                {(main.subNiches || []).map((sub) => {
                  const contentDirection =
                    typeof sub.contentDirection === "string"
                      ? sub.contentDirection
                      : deriveContentDirection(sub);
                  const deepNiches = Array.isArray(sub.deepNiches) ? sub.deepNiches : [];
                  return (
                    <li key={sub.id} className="rounded-lg bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          className="input-light min-w-[160px] flex-1 text-sm font-medium"
                          value={sub.label}
                          onChange={(e) => updateSub(main.id, sub.id, { label: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => deleteSub(main.id, sub.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-3">
                        <label className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                          <span>Content Direction</span>
                          <span className="text-[10px] font-normal text-slate-500">
                            {contentDirection.length}/{CONTENT_DIRECTION_MAX}
                          </span>
                        </label>
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                          This controls the emotional tone, pacing, structure, and reader experience for books in this sub-niche.
                        </p>
                        <div className="mt-1.5">
                          <AutoTextarea
                            value={contentDirection}
                            placeholder="Describe how books in this sub-niche should feel, flow, and emotionally connect with readers…"
                            onChange={(val) =>
                              updateSub(main.id, sub.id, { contentDirection: val })
                            }
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
              <button
                type="button"
                onClick={() => addSub(main.id)}
                className="mt-3 text-sm font-medium text-sky-700 hover:text-sky-900"
              >
                + Add sub-niche
              </button>
            </article>
          ))}
        </div>

        <div className="border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={addMainNiche} className="text-sm font-semibold text-sky-700">
            + Add main niche
          </button>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
        <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-700">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          Save catalog
        </button>
      </footer>
      </div>
    </div>
  );
}


