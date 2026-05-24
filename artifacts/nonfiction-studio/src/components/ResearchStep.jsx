import { useEffect, useMemo, useRef, useState } from "react";
import NicheManagerModal from "@/components/NicheManagerModal";
import {
  buildResearchFormProfile,
  findMainNiche,
  loadNicheRegistry,
  resetNicheRegistryToDefaults,
  saveNicheRegistry
} from "@/lib/niche/registry";
import { getDeepNiches, detectAudience, inferAudienceProfile } from "@/lib/niche/deepNiches";
import { aiFetch, GenerationCanceledError } from "@/lib/ai/aiFetch";
import { archCacheKey, getArchCache, setArchCache } from "@/lib/ai/architecturePreviewCache";

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

  // Dynamic Architecture Preview state (AI-generated, niche-aware).
  const [archDynamic, setArchDynamic] = useState(null);
  const [archLoading, setArchLoading] = useState(false);
  const [archError, setArchError] = useState("");
  // Guards against stale in-flight responses overwriting current state when
  // the niche/audience/goal signature changes mid-request.
  const archRequestKeyRef = useRef("");

  useEffect(() => {
    setRegistry(loadNicheRegistry());
  }, []);

  const mainNicheId = research?.mainNicheId || "";
  const subNicheId = research?.subNicheId || "";
  const main = findMainNiche(registry, mainNicheId);
  const subOptions = main?.subNiches || [];
  const subSelected = subOptions.find((s) => s.id === subNicheId);
  const deepOptions = useMemo(() => {
    const fromRegistry = Array.isArray(subSelected?.deepNiches) ? subSelected.deepNiches : [];
    if (fromRegistry.length) return fromRegistry;
    return getDeepNiches(main?.label || "", subSelected?.label || "");
  }, [main?.label, subSelected?.label, subSelected?.deepNiches]);
  const deepNicheLabel = research?.deepNicheLabel || "";
  const marketIntel = useMemo(
    () =>
      deepNicheLabel
        ? detectAudience(deepNicheLabel, subSelected?.label || "")
        : null,
    [deepNicheLabel, subSelected?.label]
  );

  const profile = useMemo(
    () => buildResearchFormProfile(registry, mainNicheId, subNicheId, deepNicheLabel),
    [registry, mainNicheId, subNicheId, deepNicheLabel]
  );

  const arch = profile.architecture;
  const toneOptions = profile.tones?.length ? profile.tones : [];
  const audienceOptions = profile.audiences?.length ? profile.audiences : [];
  const publishingGoals = profile.publishingGoals?.length ? profile.publishingGoals : [];

  // ─── Dynamic architecture preview (AI, niche-aware) ─────────────────────────
  const archAudience = (research?.targetAudience || research?.audiencePreset || "").trim();
  const archGoal = (research?.publishingGoal || "").trim();
  const archTones = Array.isArray(research?.authorTones) ? research.authorTones : [];

  const archKey = arch
    ? archCacheKey({
        mainNicheId,
        subNicheId,
        deepNicheLabel,
        audience: archAudience,
        goal: archGoal,
        tones: archTones
      })
    : "";

  // Hydrate from cache instantly whenever the signature changes.
  useEffect(() => {
    if (!archKey) {
      setArchDynamic(null);
      setArchError("");
      return;
    }
    const cached = getArchCache(archKey);
    setArchDynamic(cached || null);
    setArchError("");
  }, [archKey]);

  async function generateArchitecturePreview({ force = false } = {}) {
    if (!arch || !archKey) return;
    if (!force) {
      const cached = getArchCache(archKey);
      if (cached) {
        setArchDynamic(cached);
        return;
      }
    }
    // Mark this request as the latest. Any earlier in-flight request whose
    // requestKey no longer matches `archRequestKeyRef.current` must NOT apply
    // its response — otherwise stale architecture overwrites fresh state.
    const requestKey = archKey;
    archRequestKeyRef.current = requestKey;
    setArchLoading(true);
    setArchError("");
    try {
      const data = await aiFetch("/api/ai/architecture-preview", {
        niche: arch.mainNicheLabel,
        subNiche: arch.subNicheLabel,
        deepNiche: deepNicheLabel,
        audience: archAudience,
        goal: archGoal,
        tones: archTones,
        contentDirection: arch.contentDirection || ""
      });
      const clean = {
        structure: data.structure || "",
        chapters: data.chapters || "",
        emotionalArc: data.emotionalArc || "",
        pacing: data.pacing || "",
        wordBand: data.wordBand || "",
        contentDirection: data.contentDirection || ""
      };
      // Always populate the cache for this specific request's signature,
      // even if it's no longer the active one — future selections of the
      // same combination get an instant cache hit.
      setArchCache(requestKey, clean);
      if (archRequestKeyRef.current === requestKey) {
        setArchDynamic(clean);
      }
    } catch (err) {
      if (archRequestKeyRef.current !== requestKey) return; // stale failure
      if (err instanceof GenerationCanceledError) {
        setArchError("Preview canceled — Grok approval declined.");
      } else {
        setArchError(err?.message || "Could not generate architecture preview.");
      }
    } finally {
      if (archRequestKeyRef.current === requestKey) {
        setArchLoading(false);
      }
    }
  }

  // Auto-generate (debounced) when the signature changes and is fully ready
  // and no cached entry exists yet. Required fields: main+sub niche selected
  // and either audience or goal provided so the result is meaningful.
  useEffect(() => {
    if (!arch || !archKey) return;
    if (!archAudience && !archGoal) return;
    if (getArchCache(archKey)) return;
    const id = setTimeout(() => {
      generateArchitecturePreview({ force: false });
    }, 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archKey, arch?.mainNicheLabel, arch?.subNicheLabel]);

  function patch(partial) {
    setResearch(typeof partial === "function" ? partial : { ...research, ...partial });
  }

  function onMainNicheChange(id) {
    const nextMain = findMainNiche(registry, id);
    const firstSub = nextMain?.subNiches?.[0]?.id || "";
    patch({
      mainNicheId: id,
      subNicheId: firstSub,
      mainNicheLabel: nextMain?.label || "",
      subNicheLabel: nextMain?.subNiches?.find((s) => s.id === firstSub)?.label || "",
      deepNicheLabel: "",
      genre: nextMain?.label || "",
      authorTones: [],
      audiencePreset: "",
      publishingGoal: ""
    });
    setSuggestedTitles([]);
    setTitlesError("");
  }

  function onSubNicheChange(id) {
    const sub = subOptions.find((s) => s.id === id);
    patch({
      subNicheId: id,
      subNicheLabel: sub?.label || "",
      deepNicheLabel: "",
      authorTones: []
    });
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
    const previousTitles = suggestedTitles;
    try {
      const intel = detectAudience(deepNicheLabel, subSelected?.label || "");
      const profileInfer = inferAudienceProfile(deepNicheLabel, subSelected?.label || "");
      const enrichedResearch = {
        ...research,
        deepNicheLabel,
        targetAudience: research.targetAudience?.trim() || intel.audience,
        bookTopic: research.bookTopic?.trim() || deepNicheLabel
      };
      const data = await aiFetch("/api/book/contextual-titles", {
        research: enrichedResearch,
        analysis: { books: [] },
        audienceCandidates: profileInfer.audiences,
        painPoints: profileInfer.painPoints,
        transformations: profileInfer.transformations
      });
      const titles = Array.isArray(data.titles) ? data.titles.slice(0, 3) : [];
      if (!titles.length) throw new Error("No titles returned. Try again.");
      setSuggestedTitles(titles);
    } catch (err) {
      // Preserve any previously generated titles when the user cancels Grok approval.
      setSuggestedTitles(previousTitles);
      if (err instanceof GenerationCanceledError) {
        setTitlesError("Generation canceled — Grok approval declined.");
      } else {
        setTitlesError(err?.message || "Failed to suggest titles.");
      }
    } finally {
      setTitlesLoading(false);
    }
  }

  function applyTitle(title) {
    patch({ bookTitle: title });
  }

  function toggleTone(tone) {
    const set = new Set(research.authorTones || []);
    if (set.has(tone)) set.delete(tone);
    else set.add(tone);
    patch({ authorTones: Array.from(set) });
  }

  function selectAudiencePreset(aud) {
    patch({
      audiencePreset: aud,
      targetAudience: research.targetAudience?.trim() ? research.targetAudience : aud
    });
  }

  return (
    <section className="mx-auto max-w-4xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700/90">Publishing intelligence</p>
        <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Position your book in the market
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Niche and sub-niche drive tone, audience presets, pacing, chapter architecture, and outline generation.
          This is not a generic form—it adapts to bestseller patterns for your category.
        </p>
      </header>

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

      {arch && (
        <aside className="mt-6 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/90 via-white to-indigo-50/40 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-800">
                Architecture preview
                {archDynamic && (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-800">
                    AI-tuned
                  </span>
                )}
                {archLoading && (
                  <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-sky-800">
                    Generating…
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {arch.mainNicheLabel} › {arch.subNicheLabel}
                {arch.deepNicheLabel ? (
                  <>
                    {" "}
                    ›{" "}
                    <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-sky-800">
                      {arch.deepNicheLabel}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={() => generateArchitecturePreview({ force: true })}
              disabled={archLoading || (!archAudience && !archGoal)}
              title={
                !archAudience && !archGoal
                  ? "Pick a publishing goal or describe the target audience to enable AI tuning."
                  : "Regenerate with OpenAI"
              }
              className="shrink-0 whitespace-nowrap rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-semibold text-sky-800 shadow-sm hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {archLoading ? "…" : archDynamic ? "Regenerate" : "Generate"}
            </button>
          </div>
          {arch.deepNicheLabel && (
            <p className="mt-0.5 text-[11px] uppercase tracking-wider text-sky-700/80">
              Deep niche focus active — architecture sharpened for this audience
            </p>
          )}
          {archError && (
            <p className="mt-2 text-[11px] font-medium text-rose-700">{archError}</p>
          )}
          {(archDynamic?.contentDirection || profile.recommendations.contentDirection) && (
            <p className="mt-3 rounded-lg border border-slate-200 bg-white/70 p-3 text-xs italic leading-relaxed text-slate-600">
              <span className="not-italic font-semibold uppercase tracking-wider text-slate-500">Content direction · </span>
              {archDynamic?.contentDirection || profile.recommendations.contentDirection}
            </p>
          )}
          {(() => {
            if (!arch.deepNicheLabel) return null;
            const focus = inferAudienceProfile(arch.deepNicheLabel, arch.subNicheLabel);
            return (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">Focus audiences</span>
                  {focus.audiences.slice(0, 5).map((a) => (
                    <span key={a} className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                      {a}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Transformations</span>
                  {focus.transformations.slice(0, 4).map((t) => (
                    <span key={t} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">Pain points</span>
                  {focus.painPoints.slice(0, 4).map((p) => (
                    <span key={p} className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
          <dl className="mt-4 grid gap-3 text-xs text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-500">Structure</dt>
              <dd>{archDynamic?.structure || profile.recommendations.structureLabel}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Pacing</dt>
              <dd>{archDynamic?.pacing || profile.recommendations.pacingType}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Chapters</dt>
              <dd>
                {archDynamic?.chapters
                  ? `${archDynamic.chapters} recommended`
                  : `${profile.recommendations.chapterCount} recommended (${profile.recommendations.chapterRange})`}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Word band</dt>
              <dd>{archDynamic?.wordBand || profile.recommendations.wordCountBand}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-500">Emotional arc</dt>
              <dd>{archDynamic?.emotionalArc || profile.recommendations.emotionalArc}</dd>
            </div>
          </dl>
          {!archDynamic && !archLoading && (!archAudience && !archGoal) && (
            <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white/60 px-3 py-2 text-[11px] text-slate-500">
              Select a publishing goal or describe your target audience to unlock an AI-tuned preview for this niche.
            </p>
          )}
          {profile.recommendations.chapterFlow?.length > 0 && (
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-slate-600">
              {profile.recommendations.chapterFlow.slice(0, 6).map((beat) => (
                <li key={beat}>{beat}</li>
              ))}
              {profile.recommendations.chapterFlow.length > 6 && (
                <li className="list-none pl-0 text-slate-400">+{profile.recommendations.chapterFlow.length - 6} more beats…</li>
              )}
            </ol>
          )}
        </aside>
      )}

      <section className="book-panel mt-8 space-y-6">
        <section className="grid gap-5 md:grid-cols-2">
          <section>
            <FieldLabel hint="Top-level market category—controls architecture family.">Main niche</FieldLabel>
            <select
              className="input-light mt-1.5"
              value={mainNicheId}
              onChange={(e) => onMainNicheChange(e.target.value)}
            >
              <option value="">Select main niche</option>
              {registry.mainNiches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            {errors.mainNicheId && <p className="mt-1 text-xs text-red-600">{errors.mainNicheId}</p>}
          </section>

          <section>
            <FieldLabel hint="Sub-niche selects blueprint, pacing, and outline beats.">Sub-niche</FieldLabel>
            <select
              className="input-light mt-1.5"
              value={subNicheId}
              disabled={!mainNicheId}
              onChange={(e) => onSubNicheChange(e.target.value)}
            >
              <option value="">{mainNicheId ? "Select sub-niche" : "Choose main niche first"}</option>
              {subOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {errors.subNicheId && <p className="mt-1 text-xs text-red-600">{errors.subNicheId}</p>}
          </section>
        </section>

        <section>
          <FieldLabel hint="Third-level focus — drives audience targeting and title suggestions.">
            Deep niche
          </FieldLabel>
          <section className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <select
              className="input-light flex-1"
              value={deepNicheLabel}
              disabled={!subNicheId || deepOptions.length === 0}
              onChange={(e) => onDeepNicheChange(e.target.value)}
            >
              <option value="">
                {!subNicheId
                  ? "Choose sub-niche first"
                  : deepOptions.length === 0
                  ? "No deep niches available for this sub-niche"
                  : "Select deep niche"}
              </option>
              {deepOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
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
              <p className="mt-1 text-emerald-800/90">
                <span className="font-semibold">Audience:</span> {marketIntel.audience}
              </p>
              <p className="mt-0.5 text-emerald-800/90">
                <span className="font-semibold">Opportunity:</span> {marketIntel.opportunity}
              </p>
            </aside>
          )}

          {titlesError && (
            <p className="mt-2 text-xs text-red-600">{titlesError}</p>
          )}

          {suggestedTitles.length > 0 && (
            <section className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Suggested titles — click to use
              </p>
              <section className="mt-2 grid gap-2 sm:grid-cols-3">
                {suggestedTitles.map((title) => {
                  const active = research.bookTitle === title;
                  return (
                    <button
                      key={title}
                      type="button"
                      onClick={() => applyTitle(title)}
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold leading-snug shadow-sm transition ${
                        active
                          ? "border-sky-600 bg-sky-600 text-white shadow-md shadow-sky-600/25"
                          : "border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md"
                      }`}
                    >
                      {title}
                    </button>
                  );
                })}
              </section>
            </section>
          )}
        </section>

        <section>
          <FieldLabel hint={profile.helperText.publishingGoal}>Publishing goal</FieldLabel>
          <select
            className="input-light mt-1.5"
            value={research.publishingGoal || ""}
            onChange={(e) => patch({ publishingGoal: e.target.value })}
            disabled={!subNicheId}
          >
            <option value="">Select goal</option>
            {publishingGoals.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          {errors.publishingGoal && <p className="mt-1 text-xs text-red-600">{errors.publishingGoal}</p>}
        </section>

        <section>
          <FieldLabel hint="Working title; optional.">Book title (optional)</FieldLabel>
          <input
            className="input-light mt-1.5"
            placeholder="Enter your book's title"
            value={research.bookTitle || ""}
            onChange={(e) => patch({ bookTitle: e.target.value })}
          />
        </section>

        <section>
          <FieldLabel hint="Name as it should appear on the cover.">Author name</FieldLabel>
          <input
            className="input-light mt-1.5"
            placeholder="Enter your author name"
            value={research.authorName || ""}
            onChange={(e) => patch({ authorName: e.target.value })}
          />
          {errors.authorName && <p className="mt-1 text-xs text-red-600">{errors.authorName}</p>}
        </section>

        <section>
          <FieldLabel hint={profile.helperText.bookTopic || "Core promise of the book."}>Book topic</FieldLabel>
          <input
            className="input-light mt-1.5"
            placeholder={profile.placeholders.bookTopic || "Enter book topic"}
            value={research.bookTopic || ""}
            onChange={(e) => patch({ bookTopic: e.target.value })}
          />
          {errors.bookTopic && <p className="mt-1 text-xs text-red-600">{errors.bookTopic}</p>}
        </section>

        <section>
          <FieldLabel hint="Your angle within this sub-niche.">Stance on topic (optional)</FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[88px] resize-y"
            placeholder={profile.placeholders.stanceOnTopic || "Your stance"}
            value={research.stanceOnTopic || ""}
            onChange={(e) => patch({ stanceOnTopic: e.target.value })}
          />
        </section>

        <section>
          <FieldLabel hint="Differentiation vs bestsellers in this sub-niche.">What makes this book stand out?</FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[88px] resize-y"
            placeholder={profile.placeholders.standout || "Your differentiation"}
            value={research.standout || ""}
            onChange={(e) => patch({ standout: e.target.value })}
          />
        </section>

        <section>
          <FieldLabel hint={profile.helperText.authorTones}>Author tone</FieldLabel>
          {!subNicheId ? (
            <p className="mt-2 text-xs text-slate-500">Select a sub-niche to load tone options.</p>
          ) : (
            <section className="mt-2 flex flex-wrap gap-2">
              {toneOptions.map((tone) => {
                const on = research.authorTones?.includes(tone);
                return (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => toggleTone(tone)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                      on
                        ? "border-sky-600 bg-sky-600 text-white shadow-md shadow-sky-600/25"
                        : "border-slate-200/90 bg-white text-slate-700 shadow-sm hover:border-sky-300/80 hover:bg-sky-50/60"
                    }`}
                  >
                    {tone}
                  </button>
                );
              })}
            </section>
          )}
          {errors.authorTones && <p className="mt-1 text-xs text-red-600">{errors.authorTones}</p>}
        </section>

        <section>
          <FieldLabel hint="Quick-select reader segments for this niche.">Reader preset</FieldLabel>
          <section className="mt-2 flex flex-wrap gap-2">
            {audienceOptions.map((aud) => {
              const on = research.audiencePreset === aud;
              return (
                <button
                  key={aud}
                  type="button"
                  disabled={!subNicheId}
                  onClick={() => selectAudiencePreset(aud)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    on
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200"
                  } disabled:opacity-40`}
                >
                  {aud}
                </button>
              );
            })}
          </section>
        </section>

        <section>
          <FieldLabel hint={profile.helperText.targetAudience}>Target audience (specific)</FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[88px] resize-y"
            placeholder={profile.placeholders.targetAudience || "Describe your ideal reader"}
            value={research.targetAudience || ""}
            onChange={(e) => patch({ targetAudience: e.target.value })}
          />
          {errors.targetAudience && <p className="mt-1 text-xs text-red-600">{errors.targetAudience}</p>}
        </section>
      </section>

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

