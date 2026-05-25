import { useEffect, useMemo, useState } from "react";
import NicheManagerModal from "@/components/NicheManagerModal";
import {
  findMainNiche,
  loadNicheRegistry,
  resetNicheRegistryToDefaults,
  saveNicheRegistry
} from "@/lib/niche/registry";
import { getDeepNiches, detectAudience, inferAudienceProfile } from "@/lib/niche/deepNiches";
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

export default function ResearchStep({ research, setResearch, errors }) {
  const [registry, setRegistry] = useState(() => loadNicheRegistry());
  const [managerOpen, setManagerOpen] = useState(false);
  const [suggestedTitles, setSuggestedTitles] = useState([]);
  const [titlesLoading, setTitlesLoading] = useState(false);
  const [titlesError, setTitlesError] = useState("");

  useEffect(() => { setRegistry(loadNicheRegistry()); }, []);

  const mainNicheId = research?.mainNicheId || "";
  const subNicheId  = research?.subNicheId  || "";
  const main        = findMainNiche(registry, mainNicheId);
  const subOptions  = main?.subNiches || [];
  const subSelected = subOptions.find((s) => s.id === subNicheId);

  const deepOptions = useMemo(() => {
    const fromRegistry = Array.isArray(subSelected?.deepNiches) ? subSelected.deepNiches : [];
    if (fromRegistry.length) return fromRegistry;
    return getDeepNiches(main?.label || "", subSelected?.label || "");
  }, [main?.label, subSelected?.label, subSelected?.deepNiches]);

  const deepNicheLabel = research?.deepNicheLabel || "";

  const marketIntel = useMemo(
    () => deepNicheLabel ? detectAudience(deepNicheLabel, subSelected?.label || "") : null,
    [deepNicheLabel, subSelected?.label]
  );

  function patch(partial) {
    setResearch(typeof partial === "function" ? partial : { ...research, ...partial });
  }

  function onMainNicheChange(id) {
    const nextMain   = findMainNiche(registry, id);
    const firstSub   = nextMain?.subNiches?.[0]?.id || "";
    patch({
      mainNicheId:   id,
      subNicheId:    firstSub,
      mainNicheLabel: nextMain?.label || "",
      subNicheLabel:  nextMain?.subNiches?.find((s) => s.id === firstSub)?.label || "",
      deepNicheLabel: "",
      genre:          nextMain?.label || ""
    });
    setSuggestedTitles([]);
    setTitlesError("");
  }

  function onSubNicheChange(id) {
    const sub = subOptions.find((s) => s.id === id);
    patch({ subNicheId: id, subNicheLabel: sub?.label || "", deepNicheLabel: "" });
    setSuggestedTitles([]);
    setTitlesError("");
  }

  function onDeepNicheChange(label) {
    patch({ deepNicheLabel: label });
    setSuggestedTitles([]);
    setTitlesError("");
  }

  async function onSuggestTitles() {
    if (!deepNicheLabel || titlesLoading) return;
    setTitlesLoading(true);
    setTitlesError("");
    const prev = suggestedTitles;
    try {
      const profileInfer = inferAudienceProfile(deepNicheLabel, subSelected?.label || "");
      const data = await aiFetch("/api/book/contextual-titles", {
        research: {
          ...research,
          deepNicheLabel,
          bookTopic: research.bookTopic?.trim() || deepNicheLabel
        },
        analysis: { books: [] },
        audienceCandidates: profileInfer.audiences,
        painPoints:         profileInfer.painPoints,
        transformations:    profileInfer.transformations
      });
      const plain    = Array.isArray(data.titles)   ? data.titles.slice(0, 6) : [];
      const enhanced = Array.isArray(data.enhanced) ? data.enhanced           : [];
      const merged   = plain.map((t) => {
        const match = enhanced.find((e) => e.title === t || e.title?.toLowerCase() === t?.toLowerCase());
        return match || { title: t };
      });
      if (!merged.length) throw new Error("No titles returned. Try again.");
      setSuggestedTitles(merged);
    } catch (err) {
      setSuggestedTitles(prev);
      setTitlesError(
        err instanceof GenerationCanceledError
          ? "Generation canceled — Grok approval declined."
          : err?.message || "Failed to suggest titles."
      );
    } finally {
      setTitlesLoading(false);
    }
  }

  function applyTitle(titleData) {
    patch({ bookTitle: typeof titleData === "string" ? titleData : titleData?.title || "" });
  }

  return (
    <section className="mx-auto max-w-3xl">

      {/* ── Header ── */}
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700/90">Step 1 — Idea input</p>
        <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Start with your idea
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Select your niche, choose a title, and add a concept in a sentence or two.
          The AI extracts full market intelligence — audience, tone, positioning, pain profile — automatically in the next step.
        </p>
      </header>

      {/* ── Niche action buttons ── */}
      <section className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-sky-300 hover:text-sky-800"
        >
          Manage niches
        </button>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm("Restore default 6×10 niche catalog? Custom niches will be replaced.")) return;
            const next = resetNicheRegistryToDefaults();
            setRegistry(next);
          }}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Reset catalog to defaults
        </button>
      </section>

      {/* ── Main form ── */}
      <section className="book-panel mt-6 space-y-6">

        {/* Niche selectors */}
        <section className="grid gap-5 md:grid-cols-2">
          <section>
            <FieldLabel hint="Top-level market category — drives chapter architecture and pacing.">Main niche</FieldLabel>
            <select className="input-light mt-1.5" value={mainNicheId} onChange={(e) => onMainNicheChange(e.target.value)}>
              <option value="">Select main niche</option>
              {registry.mainNiches.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            {errors.mainNicheId && <p className="mt-1 text-xs text-red-600">{errors.mainNicheId}</p>}
          </section>

          <section>
            <FieldLabel hint="Sub-niche selects the blueprint, pacing, and outline beats.">Sub-niche</FieldLabel>
            <select className="input-light mt-1.5" value={subNicheId} disabled={!mainNicheId} onChange={(e) => onSubNicheChange(e.target.value)}>
              <option value="">{mainNicheId ? "Select sub-niche" : "Choose main niche first"}</option>
              {subOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            {errors.subNicheId && <p className="mt-1 text-xs text-red-600">{errors.subNicheId}</p>}
          </section>
        </section>

        {/* Deep niche + title suggestions */}
        <section>
          <FieldLabel hint="Third-level focus — sharpens title suggestions and AI generation.">
            Deep niche <span className="font-normal text-slate-400">(optional)</span>
          </FieldLabel>
          <section className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <select
              className="input-light flex-1"
              value={deepNicheLabel}
              disabled={!subNicheId || deepOptions.length === 0}
              onChange={(e) => onDeepNicheChange(e.target.value)}
            >
              <option value="">
                {!subNicheId ? "Choose sub-niche first" : deepOptions.length === 0 ? "No deep niches for this sub-niche" : "Select deep niche"}
              </option>
              {deepOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <button
              type="button"
              onClick={onSuggestTitles}
              disabled={!deepNicheLabel || titlesLoading}
              className="whitespace-nowrap rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-sky-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {titlesLoading ? "Suggesting…" : "Suggest Titles"}
            </button>
          </section>

          {marketIntel && (
            <aside className="mt-3 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-900">
              <p className="font-semibold">{marketIntel.insight}</p>
              <p className="mt-1 text-emerald-800/90"><span className="font-semibold">Audience:</span> {marketIntel.audience}</p>
              <p className="mt-0.5 text-emerald-800/90"><span className="font-semibold">Opportunity:</span> {marketIntel.opportunity}</p>
            </aside>
          )}

          {titlesError && <p className="mt-2 text-xs text-red-600">{titlesError}</p>}

          {suggestedTitles.length > 0 && (
            <section className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Suggested titles — click to use
              </p>
              <section className="mt-2 grid gap-2 sm:grid-cols-3">
                {suggestedTitles.slice(0, 3).map((item) => {
                  const titleStr = typeof item === "string" ? item : item.title;
                  const active   = research.bookTitle === titleStr;
                  return (
                    <button
                      key={titleStr}
                      type="button"
                      onClick={() => applyTitle(item)}
                      className={`rounded-xl border px-4 py-3 text-left shadow-sm transition ${
                        active
                          ? "border-sky-600 bg-sky-600 text-white shadow-md shadow-sky-600/25"
                          : "border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md"
                      }`}
                    >
                      <p className="text-sm font-semibold leading-snug">{titleStr}</p>
                      {item.subtitle && (
                        <p className={`mt-1 text-[11px] leading-snug ${active ? "text-sky-100" : "text-slate-500"}`}>
                          {item.subtitle}
                        </p>
                      )}
                      {item.hook && (
                        <p className={`mt-1.5 text-[10px] italic ${active ? "text-sky-200" : "text-slate-400"}`}>
                          "{item.hook}"
                        </p>
                      )}
                    </button>
                  );
                })}
              </section>
              {suggestedTitles.length > 3 && (
                <section className="mt-2 grid gap-2 sm:grid-cols-3">
                  {suggestedTitles.slice(3).map((item) => {
                    const titleStr = typeof item === "string" ? item : item.title;
                    const active   = research.bookTitle === titleStr;
                    return (
                      <button
                        key={titleStr}
                        type="button"
                        onClick={() => applyTitle(item)}
                        className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold shadow-sm transition ${
                          active
                            ? "border-sky-600 bg-sky-600 text-white"
                            : "border-slate-200 bg-white text-slate-800 hover:border-sky-400"
                        }`}
                      >
                        {titleStr}
                      </button>
                    );
                  })}
                </section>
              )}
            </section>
          )}
        </section>

        {/* Book title */}
        <section>
          <FieldLabel hint="Your working title — can be refined later in the Title step.">Book title</FieldLabel>
          <input
            className="input-light mt-1.5"
            placeholder="Enter or pick a suggested title above"
            value={research.bookTitle || ""}
            onChange={(e) => patch({ bookTitle: e.target.value })}
          />
        </section>

        {/* Author name */}
        <section>
          <FieldLabel hint="Name as it will appear on the cover.">Author name</FieldLabel>
          <input
            className="input-light mt-1.5"
            placeholder="Enter your author name"
            value={research.authorName || ""}
            onChange={(e) => patch({ authorName: e.target.value })}
          />
          {errors.authorName && <p className="mt-1 text-xs text-red-600">{errors.authorName}</p>}
        </section>

        {/* ── Optional fields ── */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4 space-y-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Optional — helps the AI generate smarter content
          </p>

          {/* Book concept */}
          <section>
            <FieldLabel hint="What is this book about? Who is it for, and what will they achieve?">
              Book concept
            </FieldLabel>
            <textarea
              className="input-light mt-1.5 min-h-[80px] resize-y"
              placeholder="e.g. A practical system helping busy fathers build physical discipline in 30 minutes a day using stoic principles."
              value={research.bookTopic || ""}
              onChange={(e) => patch({ bookTopic: e.target.value })}
            />
          </section>

          {/* Desired transformation */}
          <section>
            <FieldLabel hint="The specific change the reader experiences by the last page.">
              Desired transformation
            </FieldLabel>
            <input
              className="input-light mt-1.5"
              placeholder="e.g. Stop overthinking and build consistent daily discipline within 90 days"
              value={research.stanceOnTopic || ""}
              onChange={(e) => patch({ stanceOnTopic: e.target.value })}
            />
          </section>

          {/* Custom notes */}
          <section>
            <FieldLabel hint="Anything else the AI should know — competitor books, unique angle, personal story, tone ideas.">
              Custom notes
            </FieldLabel>
            <textarea
              className="input-light mt-1.5 min-h-[80px] resize-y"
              placeholder="e.g. I want this to stand out from Atomic Habits by focusing on identity-level change in masculine psychology. I have 10 years of coaching experience."
              value={research.standout || ""}
              onChange={(e) => patch({ standout: e.target.value })}
            />
          </section>
        </div>

      </section>

      {/* ── Niche manager modal ── */}
      {managerOpen && (
        <NicheManagerModal
          registry={registry}
          onClose={() => setManagerOpen(false)}
          onSave={(next) => {
            const saved = saveNicheRegistry(next);
            setRegistry(saved);
            setManagerOpen(false);
          }}
        />
      )}
    </section>
  );
}
