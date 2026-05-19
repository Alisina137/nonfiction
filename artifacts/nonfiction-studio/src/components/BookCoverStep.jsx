import { useEffect, useRef, useState } from "react";
import {
  resolveAudience,
  resolveAuthorName,
  resolveBookTitle,
  resolveGenre,
  resolveTone,
  resolveUsp
} from "@/lib/projectMeta";

const LAYOUT_OPTIONS = [
  { id: "typographic", label: "Typographic" },
  { id: "split-band", label: "Split band" },
  { id: "minimal", label: "Minimal" },
  { id: "bold-stack", label: "Bold stack" }
];

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

function CoverPreview({ title, cover }) {
  const primary = cover.primaryColor || "#0c4a6e";
  const accent = cover.accentColor || "#38bdf8";
  const text = cover.textColor || "#ffffff";
  const layout = cover.layoutStyle || "typographic";

  const base =
    layout === "minimal"
      ? "flex flex-col justify-center px-8 py-10"
      : layout === "bold-stack"
        ? "flex flex-col justify-end px-7 pb-10 pt-16"
        : layout === "split-band"
          ? "flex flex-col justify-between"
          : "flex flex-col justify-end px-7 pb-9 pt-12";

  return (
    <aside
      className={`mx-auto flex aspect-[2/3] w-full max-w-[280px] flex-col overflow-hidden rounded-lg shadow-xl ring-1 ring-slate-900/10 ${layout === "split-band" ? "" : ""}`}
      style={{ background: primary, color: text }}
    >
      {layout === "split-band" && <div className="h-[38%] w-full shrink-0" style={{ background: accent }} aria-hidden />}
      <div className={`${base} flex flex-1 flex-col ${layout === "split-band" ? "px-7 pb-9" : "w-full"}`}>
        {cover.tagline && (
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] opacity-90">{cover.tagline}</p>
        )}
        <h3 className="font-serif text-2xl font-bold leading-tight tracking-tight">{title}</h3>
        {cover.subtitle && <p className="mt-2 text-sm font-medium leading-snug opacity-95">{cover.subtitle}</p>}
        <p className="mt-auto pt-6 text-xs font-medium uppercase tracking-wider opacity-85">
          {cover.authorLine || "Author name"}
        </p>
      </div>
    </aside>
  );
}

export default function BookCoverStep({ bookCover, setBookCover, fullProject, description, errors }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const visitRef = useRef(false);
  const cover = bookCover && typeof bookCover === "object" ? bookCover : {};
  const title = resolveBookTitle(fullProject);

  useEffect(() => {
    if (visitRef.current) return;
    visitRef.current = true;
    const author = resolveAuthorName(fullProject);
    setBookCover((prev) => {
      const p = prev && typeof prev === "object" ? prev : {};
      return {
        subtitle: p.subtitle || "",
        tagline: p.tagline || "",
        layoutStyle: p.layoutStyle || "typographic",
        primaryColor: p.primaryColor || "#0c4a6e",
        accentColor: p.accentColor || "#38bdf8",
        textColor: p.textColor || "#ffffff",
        designNotes: p.designNotes || "",
        generatedAt: p.generatedAt ?? null,
        ...p,
        authorLine: p.authorLine || author
      };
    });
  }, [fullProject, setBookCover]);

  function patch(partial) {
    setBookCover((prev) => ({
      ...(prev && typeof prev === "object" ? prev : {}),
      ...partial
    }));
  }

  async function onGenerate() {
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch("/api/ai/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle: cover.subtitle || "",
          audience: resolveAudience(fullProject),
          tone: resolveTone(fullProject),
          genre: resolveGenre(fullProject),
          usp: resolveUsp(fullProject),
          authorName: resolveAuthorName(fullProject),
          description: description || ""
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      patch({
        subtitle: data.subtitle || cover.subtitle,
        tagline: data.tagline || cover.tagline,
        authorLine: data.authorLine || cover.authorLine,
        layoutStyle: data.layoutStyle || cover.layoutStyle,
        primaryColor: data.primaryColor || cover.primaryColor,
        accentColor: data.accentColor || cover.accentColor,
        textColor: data.textColor || cover.textColor,
        designNotes: data.designNotes || cover.designNotes,
        generatedAt: new Date().toISOString()
      });
      setStatus("Cover brief generated—tweak colors and copy to taste.");
    } catch (e) {
      setStatus(e.message || "Could not generate cover brief.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-5xl">
      <p className="text-sm leading-relaxed text-slate-600">
        Lock in cover copy and a designer-ready brief. The preview is a layout mock—not a final print file—but it
        reflects your palette and hierarchy.
      </p>

      {errors?.form && <p className="mt-4 text-center text-sm text-red-600">{errors.form}</p>}
      {status && <p className="mt-3 text-center text-sm text-slate-600">{status}</p>}

      <section className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="book-panel space-y-5">
          <section>
            <FieldLabel hint="Appears under the main title on the cover.">Subtitle</FieldLabel>
            <input
              className="input-light mt-1.5"
              value={cover.subtitle || ""}
              onChange={(e) => patch({ subtitle: e.target.value })}
              placeholder="A practical playbook for…"
            />
          </section>

          <section>
            <FieldLabel hint="Short hook at the top of the cover.">Tagline</FieldLabel>
            <input
              className="input-light mt-1.5"
              value={cover.tagline || ""}
              onChange={(e) => patch({ tagline: e.target.value })}
              placeholder="Systems that compound"
            />
          </section>

          <section>
            <FieldLabel hint="Exactly as it should read on the cover.">Author line</FieldLabel>
            <input
              className="input-light mt-1.5"
              value={cover.authorLine || ""}
              onChange={(e) => patch({ authorLine: e.target.value })}
            />
          </section>

          <section>
            <FieldLabel hint="Guides the visual mock and designer handoff.">Layout style</FieldLabel>
            <select
              className="input-light mt-1.5"
              value={cover.layoutStyle || "typographic"}
              onChange={(e) => patch({ layoutStyle: e.target.value })}
            >
              {LAYOUT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <section>
              <FieldLabel>Primary</FieldLabel>
              <input
                type="color"
                className="mt-2 h-10 w-full cursor-pointer rounded-lg border border-slate-200"
                value={cover.primaryColor || "#0c4a6e"}
                onChange={(e) => patch({ primaryColor: e.target.value })}
              />
            </section>
            <section>
              <FieldLabel>Accent</FieldLabel>
              <input
                type="color"
                className="mt-2 h-10 w-full cursor-pointer rounded-lg border border-slate-200"
                value={cover.accentColor || "#38bdf8"}
                onChange={(e) => patch({ accentColor: e.target.value })}
              />
            </section>
            <section>
              <FieldLabel>Text</FieldLabel>
              <input
                type="color"
                className="mt-2 h-10 w-full cursor-pointer rounded-lg border border-slate-200"
                value={cover.textColor || "#ffffff"}
                onChange={(e) => patch({ textColor: e.target.value })}
              />
            </section>
          </section>

          <section>
            <FieldLabel hint="Notes for you or a cover designer.">Design notes</FieldLabel>
            <textarea
              className="input-light mt-1.5 min-h-[100px] resize-y"
              value={cover.designNotes || ""}
              onChange={(e) => patch({ designNotes: e.target.value })}
              placeholder="Typography mood, imagery to avoid, hierarchy…"
            />
          </section>
        </section>

        <section className="flex flex-col items-center gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Preview</p>
          <CoverPreview title={title} cover={cover} />
        </section>
      </section>

      <section className="mt-8 flex justify-center">
        <button
          type="button"
          disabled={busy}
          onClick={onGenerate}
          className="rounded-full bg-gradient-to-r from-sky-600 to-sky-500 px-8 py-3 text-sm font-semibold text-white shadow-md shadow-sky-600/28 transition hover:from-sky-700 hover:to-sky-600 disabled:opacity-50"
        >
          {busy ? "Generating…" : "Generate cover brief"}
        </button>
      </section>
    </section>
  );
}

