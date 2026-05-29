import { useEffect, useId, useRef, useState } from "react";
import {
  ALLOWED_RESOURCE_EXTENSIONS,
  parseResourceUploadFile,
  RESOURCE_FILE_MAX_BYTES
} from "@/lib/resources/fileUpload";

function safeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `ap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** One-line preview for dropdown (plain text). */
function previewLine(text, max = 140) {
  if (!text || typeof text !== "string") return "";
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max - 1)}…`;
}

function displayPersonaTitle(p) {
  const by = (p.inspiredBy || "").split(",")[0]?.trim();
  if (by) return by.length > 48 ? `${by.slice(0, 47)}…` : by;
  const desc = (p.authorDescription || "").trim();
  if (desc) return previewLine(desc, 52) || "Writing persona";
  return "Writing persona";
}

function buildSyntheticGenerated(draft) {
  const toneHints = (draft.inspiredBy || "").trim() || "clear, approachable nonfiction";
  const background = (draft.authorDescription || "").trim();
  const sampleBlob = (draft.writingSamples || [])
    .map((s) => (s?.text || "").trim())
    .filter(Boolean)
    .join("\n\n");
  const voiceNote = previewLine(background || toneHints || sampleBlob, 280);

  return {
    summary: voiceNote
      ? `This author writes with a voice shaped by ${toneHints}.${background ? ` ${previewLine(background, 420)}` : ""}`
      : `This persona favors a structured, reader-friendly explanatory style grounded in concrete examples and steady pacing.`,
    voice: {
      tone: previewLine(background || `${toneHints} — warm, intentional, precise`, 220) || "Conversational, direct, pragmatic",
      mood: previewLine(sampleBlob ? `${previewLine(sampleBlob, 160)} carries the emotional register.` : "Relaxed, encouraging, reassuring", 220) ||
        "Relaxed, encouraging, relatable",
      perspective: previewLine(background || "Primarily first-person guidance with occasional second-person coaching.", 220) ||
        "Primarily first-person and second-person (“you”), with mentor-to-reader framing."
    },
    style: {
      pacing: previewLine(background || sampleBlob ? "Balances setup and payoff with short explanations and periodic recaps." : "Steady, with breathing room between ideas.", 200),
      metaphors:
        previewLine(background || toneHints ? "Uses light analogy where it clarifies; avoids overwriting imagery." : "Sparse, purposeful metaphors to anchor abstract ideas.", 200),
      paragraphLength:
        previewLine(sampleBlob ? "Paragraph length mirrors the pasted sample when possible." : "Medium paragraphs; bullets for lists when clarity wins.", 200),
      vocabulary:
        previewLine(background ? "Matched to the author description—precise terms when needed, plain language elsewhere." : "Smart but plainspoken; jargon only when unpacked.", 200),
      sentenceStructure:
        previewLine(sampleBlob ? "Follows rhythms visible in writing samples." : "Mix of short grounding sentences with occasional longer explanatory lines.", 220)
    }
  };
}

function FieldLabel({ children, hint }) {
  return (
    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
      {children}
      {hint && (
        <span
          className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500"
          title={hint}
        >
          i
        </span>
      )}
    </label>
  );
}

function GeneratedPersonaCard({ generated }) {
  if (!generated) return null;
  const v = generated.voice || {};
  const s = generated.style || {};

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 shadow-inner">
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-4">
        <span className="text-lg" aria-hidden>
          ✦
        </span>
        <h3 className="font-serif text-xl font-bold text-slate-900">Generated Persona</h3>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</p>
        <p className="mt-2 rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700">{generated.summary}</p>
      </div>

      <div className="mt-6">
        <p className="text-sm font-bold text-slate-800">Voice Characteristics</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Tone", body: v.tone },
            { label: "Mood", body: v.mood },
            { label: "Perspective", body: v.perspective }
          ].map(({ label, body }) => (
            <div key={label} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-sm text-slate-700">{body || "—"}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-bold text-slate-800">Writing Style</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            { label: "Pacing", body: s.pacing },
            { label: "Use of Metaphors", body: s.metaphors },
            { label: "Paragraph Length", body: s.paragraphLength },
            { label: "Vocabulary Level", body: s.vocabulary }
          ].map(({ label, body }) => (
            <div key={label} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-sm text-slate-700">{body || "—"}</p>
            </div>
          ))}
          <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sentence Structure</p>
            <p className="mt-2 text-sm text-slate-700">{s.sentenceStructure || "—"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const CREATE_NEW_VALUE = "__create_new__";

export default function AuthorPersonaStep({ authorPersona, setAuthorPersona }) {
  const uid = useId();
  const listboxId = `${uid}-persona-listbox`;
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);

  const saved = Array.isArray(authorPersona.savedPersonas) ? authorPersona.savedPersonas : [];
  const selectedId = authorPersona.selectedId;
  const draft = authorPersona.draft || {
    inspiredBy: "",
    authorDescription: "",
    writingSamples: [{ text: "", source: "" }]
  };

  const samples = Array.isArray(draft.writingSamples) && draft.writingSamples.length ? draft.writingSamples : [{ text: "", source: "" }];

  const selectedPersona = selectedId ? saved.find((p) => p.id === selectedId) : null;

  /** Rich row text for trigger when closed */
  function triggerSummary() {
    if (!selectedId) return "Choose a persona or create new…";
    if (selectedId === CREATE_NEW_VALUE) return "Create New Persona";
    const p = selectedPersona;
    if (!p) return "Choose a persona or create new…";
    const title = p.name?.trim() || displayPersonaTitle(p);
    const sub = previewLine(p.authorDescription || p.generated?.summary || "", 100);
    return { title, sub };
  }

  const trigger = triggerSummary();

  function updateDraft(patch) {
    setAuthorPersona({
      ...authorPersona,
      draft: {
        ...draft,
        ...(typeof patch === "function" ? patch(draft) : patch)
      }
    });
  }

  function setSamples(next) {
    updateDraft({ writingSamples: next });
  }

  function selectOption(idOrCreate) {
    if (idOrCreate === CREATE_NEW_VALUE) {
      setAuthorPersona({
        ...authorPersona,
        selectedId: CREATE_NEW_VALUE,
        draft: {
          inspiredBy: "",
          authorDescription: "",
          writingSamples: [{ text: "", source: "" }]
        }
      });
      setOpen(false);
      return;
    }

    const p = saved.find((x) => x.id === idOrCreate);
    if (!p) {
      setOpen(false);
      return;
    }

    const ws =
      Array.isArray(p.writingSamples) && p.writingSamples.length ? p.writingSamples : [{ text: "", source: "" }];

    setAuthorPersona({
      ...authorPersona,
      selectedId: p.id,
      draft: {
        inspiredBy: p.inspiredBy ?? "",
        authorDescription: p.authorDescription ?? "",
        writingSamples: ws.map((w) => ({ text: w.text ?? "", source: w.source ?? "" }))
      }
    });
    setOpen(false);
  }

  function mergeSampleTexts(text) {
    const parts = [];
    text.split(/\n\s*\n+/).forEach((chunk) => {
      const t = chunk.trim();
      if (t) parts.push(t);
    });
    if (!parts.length) return;
    setSamples(parts.map((t) => ({ text: t, source: "" })));
  }

  async function onWritingSampleFilesChosen(event) {
    const picked = event.target.files;
    if (!picked?.length) return;

    try {
      const appended = [];
      /* eslint-disable no-await-in-loop */
      for (let i = 0; i < picked.length; i += 1) {
        const file = picked.item(i);
        if (!file) continue;
        if (file.size > RESOURCE_FILE_MAX_BYTES) continue;
        const entry = await parseResourceUploadFile(file);
        let textContent = "";
        if (entry.encoding === "text" && typeof entry.textContent === "string") {
          textContent = entry.textContent;
        }
        appended.push(textContent.trim());
      }
      /* eslint-enable no-await-in-loop */

      mergeSampleTexts(appended.filter(Boolean).join("\n\n"));
    } finally {
      event.target.value = "";
    }
  }

  function addSampleRow() {
    setSamples([...samples, { text: "", source: "" }]);
  }

  function updateSample(idx, patch) {
    const next = samples.map((row, i) => (i === idx ? { ...row, ...patch } : row));
    setSamples(next);
  }

  function removeSample(idx) {
    if (samples.length <= 1) {
      setSamples([{ text: "", source: "" }]);
      return;
    }
    setSamples(samples.filter((_, i) => i !== idx));
  }

  function handleGeneratePersona() {
    const generated = buildSyntheticGenerated(draft);
    const name = draft.inspiredBy?.split(",")[0]?.trim() || previewLine(draft.authorDescription || "Writing persona", 40);

    if (selectedId && selectedId !== CREATE_NEW_VALUE && selectedPersona) {
      const nextSaved = saved.map((p) =>
        p.id === selectedId
          ? {
              ...p,
              name,
              inspiredBy: draft.inspiredBy,
              authorDescription: draft.authorDescription,
              writingSamples: samples.map((s) => ({ text: s.text, source: s.source || "" })),
              generated,
              updatedAt: new Date().toISOString()
            }
          : p
      );

      setAuthorPersona({
        ...authorPersona,
        savedPersonas: nextSaved,
        selectedId
      });
      return;
    }

    const id = safeId();
    const entry = {
      id,
      name,
      inspiredBy: draft.inspiredBy,
      authorDescription: draft.authorDescription,
      writingSamples: samples.map((s) => ({ text: s.text, source: s.source || "" })),
      generated,
      updatedAt: new Date().toISOString()
    };

    setAuthorPersona({
      ...authorPersona,
      savedPersonas: [...saved, entry],
      selectedId: id,
      draft: {
        inspiredBy: entry.inspiredBy,
        authorDescription: entry.authorDescription,
        writingSamples: entry.writingSamples.map((w) => ({ text: w.text, source: w.source }))
      }
    });
  }

  useEffect(() => {
    function onPointerDown(ev) {
      const t = ev.target;
      const panel = panelRef.current;
      const btn = buttonRef.current;
      if (!panel || !btn) return;
      if (panel.contains(t) || btn.contains(t)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-500" aria-hidden>
            ◉
          </span>
          <h2 className="text-base font-semibold text-slate-900">Your Saved Personas ({saved.length})</h2>
        </div>

        <div className="relative mt-3">
          <button
            ref={buttonRef}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            onClick={() => setOpen((o) => !o)}
            className="input-light flex min-h-[48px] w-full items-start justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="min-w-0 flex-1">
              {typeof trigger === "string" ? (
                <span className="text-sm text-slate-500">{trigger}</span>
              ) : (
                <>
                  <span className="block text-sm font-semibold text-slate-900">{trigger.title}</span>
                  {trigger.sub && <span className="mt-0.5 block text-xs leading-snug text-slate-600">{trigger.sub}</span>}
                </>
              )}
            </span>
            <span className="shrink-0 text-slate-400" aria-hidden>
              ▼
            </span>
          </button>

          {open && (
            <div
              ref={panelRef}
              id={listboxId}
              role="listbox"
              aria-label="Personas"
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[min(340px,calc(100vh-220px))] overflow-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl"
            >
              <button
                type="button"
                role="option"
                aria-selected={selectedId === CREATE_NEW_VALUE}
                className={`flex w-full flex-col px-4 py-3 text-left hover:bg-slate-50 ${selectedId === CREATE_NEW_VALUE ? "bg-slate-50" : ""}`}
                onClick={() => selectOption(CREATE_NEW_VALUE)}
              >
                <span className="text-sm font-semibold text-slate-900">Create New Persona</span>
                <span className="mt-0.5 text-xs text-slate-500">Clears fields below so you can start fresh</span>
              </button>

              {saved.length > 0 && <div className="my-1 border-t border-slate-100" />}

              {saved.map((p) => {
                const title = p.name?.trim() || displayPersonaTitle(p);
                const sub = previewLine(p.authorDescription || p.generated?.summary || "", 120);
                const isSel = selectedId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    className={`flex w-full flex-col px-4 py-3 text-left hover:bg-slate-50 ${isSel ? "bg-slate-50" : ""}`}
                    onClick={() => selectOption(p.id)}
                  >
                    <span className="text-sm font-semibold text-slate-900">{title}</span>
                    {sub ? <span className="mt-0.5 text-xs leading-snug text-slate-600">{sub}</span> : (
                      <span className="mt-0.5 text-xs italic text-slate-400">No description yet — open to view details after generating</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="relative my-8">
        <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" aria-hidden />
        <p className="relative mx-auto inline-block bg-slate-100 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Create New Persona
        </p>
      </div>

      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-500" aria-hidden>
            ◉
          </span>
          <h2 className="text-base font-semibold text-slate-900">Author Information</h2>
        </div>

        <div>
          <FieldLabel hint="Optional: names of writers whose readability and cadence you want to evoke.">
            Inspired By (Optional)
          </FieldLabel>
          <input
            className="input-light mt-1.5"
            placeholder="e.g. Malcolm Gladwell, Brené Brown…"
            value={draft.inspiredBy ?? ""}
            onChange={(e) => updateDraft({ inspiredBy: e.target.value })}
          />
          <p className="mt-1.5 text-xs text-slate-500">Name authors whose style inspires you (separate multiple authors with commas).</p>
        </div>

        <div>
          <FieldLabel hint="Background and positioning help steer tone and vocabulary.">Author Description (Optional)</FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[140px] resize-y"
            placeholder={`Describe the author's background, expertise, credentials, and writing approach.`}
            value={draft.authorDescription ?? ""}
            onChange={(e) => updateDraft({ authorDescription: e.target.value })}
          />
          <p className="mt-1.5 text-xs text-slate-500">Provide context about the author to help shape the persona.</p>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <span className="text-slate-500" aria-hidden>
            ▭
          </span>
          <h2 className="text-base font-semibold text-slate-900">Writing Samples</h2>
        </div>

        <div className="mt-4 space-y-4">
          {samples.map((row, idx) => (
            <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <textarea
                className="input-light min-h-[120px] resize-y bg-white"
                placeholder="Paste your writing sample here (at least 200 words recommended)…"
                value={row.text ?? ""}
                onChange={(e) => updateSample(idx, { text: e.target.value })}
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="min-w-[min(280px,calc(100%-8rem))] flex-1">
                  <label className="sr-only" htmlFor={`${uid}-sample-src-${idx}`}>
                    Source (optional)
                  </label>
                  <input
                    id={`${uid}-sample-src-${idx}`}
                    className="input-light"
                    placeholder="Source (optional)"
                    value={row.source ?? ""}
                    onChange={(e) => updateSample(idx, { source: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={addSampleRow}
                  title="Add another sample slot"
                >
                  + Add
                </button>
                {samples.length > 1 && (
                  <button
                    type="button"
                    className="rounded-xl px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    onClick={() => removeSample(idx)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <span className="sr-only">Upload text files into writing samples</span>
          <input
            type="file"
            accept={ALLOWED_RESOURCE_EXTENSIONS.join(",")}
            multiple
            className="hidden"
            id={`${uid}-sample-upload`}
            onChange={(e) => onWritingSampleFilesChosen(e)}
          />
          <label
            htmlFor={`${uid}-sample-upload`}
            className="input-light inline-flex cursor-pointer items-center justify-center gap-2 font-medium text-slate-700"
          >
            <span aria-hidden>⎙</span> Upload Files ({ALLOWED_RESOURCE_EXTENSIONS.join(", ")})
          </label>
          <p className="mt-2 text-xs text-slate-500">Text is extracted locally when possible (.txt, .md, …). Larger documents may truncate.</p>
        </div>
      </section>

      {selectedPersona?.generated && <div className="mt-8"><GeneratedPersonaCard generated={selectedPersona.generated} /></div>}

      <div className="mt-8">
        <button
          type="button"
          onClick={handleGeneratePersona}
          className="w-full rounded-2xl bg-slate-900 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          ✦ Generate Persona
        </button>
      </div>
    </div>
  );
}
