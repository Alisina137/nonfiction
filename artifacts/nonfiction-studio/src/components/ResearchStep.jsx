import { useEffect, useMemo, useRef, useState } from "react";
import NicheManagerModal from "@/components/NicheManagerModal";
import {
  findMainNiche,
  loadNicheRegistry,
  resetNicheRegistryToDefaults,
  saveNicheRegistry
} from "@/lib/niche/registry";
import { getDeepNiches, detectAudience, inferAudienceProfile } from "@/lib/niche/deepNiches";
import { aiFetch, GenerationCanceledError } from "@/lib/ai/aiFetch";
import { buildBookContext } from "@/lib/bookContext";

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

export default function ResearchStep({ research, setResearch, errors, fullProject }) {
  const [registry, setRegistry] = useState(() => loadNicheRegistry());
  const [managerOpen, setManagerOpen] = useState(false);

  // Title suggestions
  const [suggestedTitles, setSuggestedTitles] = useState([]);
  const [titlesLoading, setTitlesLoading] = useState(false);
  const [titlesError, setTitlesError] = useState("");

  // Subtitle suggestions
  const [subtitleSuggestions, setSubtitleSuggestions] = useState([]);
  const [subtitlesLoading, setSubtitlesLoading] = useState(false);
  const [subtitlesError, setSubtitlesError] = useState("");

  // Topic suggestion
  const [topicLoading, setTopicLoading] = useState(false);
  const [topicError, setTopicError]     = useState("");

  const subtitleDebounceRef = useRef(null);

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
    const nextMain = findMainNiche(registry, id);
    const firstSub = nextMain?.subNiches?.[0]?.id || "";
    patch({
      mainNicheId:    id,
      subNicheId:     firstSub,
      mainNicheLabel: nextMain?.label || "",
      subNicheLabel:  nextMain?.subNiches?.find((s) => s.id === firstSub)?.label || "",
      deepNicheLabel: "",
      genre:          nextMain?.label || ""
    });
    setSuggestedTitles([]);
    setTitlesError("");
    setSubtitleSuggestions([]);
  }

  function onSubNicheChange(id) {
    const sub = subOptions.find((s) => s.id === id);
    patch({ subNicheId: id, subNicheLabel: sub?.label || "", deepNicheLabel: "" });
    setSuggestedTitles([]);
    setTitlesError("");
    setSubtitleSuggestions([]);
  }

  function onDeepNicheChange(label) {
    patch({ deepNicheLabel: label });
    setSuggestedTitles([]);
    setTitlesError("");
  }

  // ─── Auto-suggest subtitles (debounced) ─────────────────────────────────────
  useEffect(() => {
    const title = research?.bookTitle?.trim() || "";
    if (!title || title.length < 4 || !mainNicheId) {
      clearTimeout(subtitleDebounceRef.current);
      return;
    }
    clearTimeout(subtitleDebounceRef.current);
    subtitleDebounceRef.current = setTimeout(() => {
      fetchSubtitles(title);
    }, 1800);
    return () => clearTimeout(subtitleDebounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [research?.bookTitle, mainNicheId, subNicheId]);

  async function fetchSubtitles(titleOverride) {
    const title = (titleOverride || research?.bookTitle || "").trim();
    if (!title || subtitlesLoading) return;
    setSubtitlesLoading(true);
    setSubtitlesError("");
    try {
      const ctx = fullProject ? buildBookContext({ ...fullProject, research }) : null;
      const data = await aiFetch("/api/ai/suggest-subtitles", {
        title,
        niche:     research?.mainNicheLabel || "",
        subNiche:  research?.subNicheLabel  || "",
        bookTopic: research?.bookTopic      || "",
        bookContext: ctx
      });
      const subs = Array.isArray(data.subtitles) ? data.subtitles.filter(Boolean) : [];
      if (!subs.length) throw new Error("No subtitles returned. Try again.");
      setSubtitleSuggestions(subs);
    } catch (err) {
      setSubtitleSuggestions([]);
      setSubtitlesError(
        err instanceof GenerationCanceledError
          ? "Generation canceled — Grok approval declined."
          : err?.message || "Failed to suggest subtitles."
      );
    } finally {
      setSubtitlesLoading(false);
    }
  }

  // ─── Topic suggestion ────────────────────────────────────────────────────────
  async function fetchTopic() {
    const title = (research?.bookTitle || "").trim();
    if (!title || topicLoading) return;
    setTopicLoading(true);
    setTopicError("");
    try {
      const data = await aiFetch("/api/ai/suggest-topic", {
        title,
        subtitle:  research?.bookSubtitle   || "",
        niche:     research?.mainNicheLabel || "",
        subNiche:  research?.subNicheLabel  || "",
        deepNiche: research?.deepNicheLabel || ""
      });
      if (data?.topic) patch({ bookTopic: data.topic });
    } catch (err) {
      setTopicError(err?.message || "Failed to generate topic. Try again.");
    } finally {
      setTopicLoading(false);
    }
  }

  // ─── Title suggestions ───────────────────────────────────────────────────────
  async function onSuggestTitles() {
    if (!main || !subSelected || titlesLoading) return;
    setTitlesLoading(true);
    setTitlesError("");
    const prev = suggestedTitles;
    try {
      const nicheForInfer = deepNicheLabel || subSelected?.label || "";
      const profileInfer = inferAudienceProfile(nicheForInfer, subSelected?.label || "");
      const data = await aiFetch("/api/book/contextual-titles", {
        research: {
          ...research,
          deepNicheLabel,
          bookTopic: research.bookTopic?.trim() || deepNicheLabel || subSelected?.label || ""
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
    const isObj   = typeof titleData === "object" && titleData !== null;
    const title    = isObj ? (titleData.title    || "") : String(titleData || "");
    const subtitle = isObj ? (titleData.subtitle || "") : "";
    const angle    = isObj ? (titleData.angle    || "") : "";   // → bookTopic
    const hook     = isObj ? (titleData.hook     || "") : "";   // → stanceOnTopic
    const audience = isObj ? (titleData.audience || "") : "";   // → targetAudience

    setResearch((prev) => ({
      ...prev,
      bookTitle:   title,
      ...(subtitle ? { bookSubtitle:   subtitle } : {}),
      ...(angle    ? { bookTopic:      angle    } : {}),
      ...(hook     ? { stanceOnTopic:  hook     } : {}),
      ...(audience ? { targetAudience: audience } : {})
    }));

    // Fetch subtitle suggestions for the chosen title
    if (title) {
      clearTimeout(subtitleDebounceRef.current);
      subtitleDebounceRef.current = setTimeout(() => fetchSubtitles(title), 400);
    }
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
          Choose a niche, name your book, and describe its core topic.
          Title, subtitle, and topic flow into every AI step — outline, writing, cover, and description.
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
              disabled={!main || !subSelected || titlesLoading}
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

        {/* ── Book Title ── */}
        <section>
          <FieldLabel hint="Your working title — can be refined later in the Title step.">Book title</FieldLabel>
          <input
            className="input-light mt-1.5"
            placeholder="Enter or pick a suggested title above"
            value={research.bookTitle || ""}
            onChange={(e) => patch({ bookTitle: e.target.value })}
          />
        </section>

        {/* ── Book Subtitle ── */}
        <section>
          <div className="flex items-end justify-between gap-2">
            <FieldLabel hint="Clarifies who the book is for and what transformation they get. Used in the outline, writing, cover, and description steps.">
              Book subtitle <span className="font-normal text-slate-400">(recommended)</span>
            </FieldLabel>
            <button
              type="button"
              disabled={!research?.bookTitle?.trim() || subtitlesLoading}
              onClick={() => fetchSubtitles()}
              className="mb-0.5 whitespace-nowrap rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition hover:border-sky-400 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {subtitlesLoading ? "Generating…" : "AI Suggest"}
            </button>
          </div>
          <input
            className="input-light mt-1.5"
            placeholder="e.g. The Entrepreneur's System for Unbreakable Daily Habits"
            value={research.bookSubtitle || ""}
            onChange={(e) => patch({ bookSubtitle: e.target.value })}
          />

          {/* Subtitle suggestions */}
          {subtitlesError && <p className="mt-1.5 text-xs text-red-600">{subtitlesError}</p>}
          {subtitleSuggestions.length > 0 && (
            <section className="mt-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Suggested subtitles — click to apply
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {subtitleSuggestions.map((sub) => {
                  const active = research.bookSubtitle === sub;
                  return (
                    <li key={sub}>
                      <button
                        type="button"
                        onClick={() => patch({ bookSubtitle: sub })}
                        className={`w-full rounded-lg border px-3.5 py-2.5 text-left text-sm transition ${
                          active
                            ? "border-sky-500 bg-sky-500 text-white font-semibold shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50"
                        }`}
                      >
                        {sub}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {subtitlesLoading && (
            <p className="mt-2 text-xs text-slate-400 animate-pulse">
              Generating subtitle suggestions based on your title and niche…
            </p>
          )}
        </section>

        {/* ── Book Topic ── */}
        <section>
          <div className="flex items-end justify-between gap-2">
            <FieldLabel hint="The exact core topic — who it's for and what it helps them achieve. Auto-filled when you pick a title suggestion; used by every AI step.">
              Book topic
            </FieldLabel>
            <button
              type="button"
              disabled={!research?.bookTitle?.trim() || topicLoading}
              onClick={fetchTopic}
              className="mb-0.5 whitespace-nowrap rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition hover:border-sky-400 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {topicLoading ? "Generating…" : "AI Generate"}
            </button>
          </div>
          <textarea
            className="input-light mt-1.5 min-h-[72px] resize-y"
            placeholder="e.g. Self-discipline for entrepreneurs — building unbreakable daily systems while running a business"
            value={research.bookTopic || ""}
            onChange={(e) => patch({ bookTopic: e.target.value })}
          />
          {topicError && <p className="mt-1 text-xs text-red-600">{topicError}</p>}
          {topicLoading && (
            <p className="mt-1 text-xs text-slate-400 animate-pulse">
              Generating topic description based on your title and niche…
            </p>
          )}
          {!topicError && !topicLoading && (
            <p className="mt-1 text-[11px] text-slate-400">
              Tip: be specific — "Self-discipline for entrepreneurs" beats "discipline habits".
            </p>
          )}
        </section>

        {/* ── Author name ── */}
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
            Optional — shapes AI research, outline, and writing
          </p>

          {/* Desired transformation */}
          <section>
            <FieldLabel hint="The specific change the reader experiences by the last page. Auto-filled from title suggestions.">
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
              className="input-light mt-1.5 min-h-[72px] resize-y"
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
