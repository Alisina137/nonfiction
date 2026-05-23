import { useEffect, useMemo, useState } from "react";
import NicheManagerModal from "@/components/NicheManagerModal";
import {
  buildResearchFormProfile,
  findMainNiche,
  loadNicheRegistry,
  resetNicheRegistryToDefaults,
  saveNicheRegistry
} from "@/lib/niche/registry";
import { getDeepNiches, detectAudience } from "@/lib/niche/deepNiches";

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

  useEffect(() => {
    setRegistry(loadNicheRegistry());
  }, []);

  const mainNicheId = research?.mainNicheId || "";
  const subNicheId = research?.subNicheId || "";
  const main = findMainNiche(registry, mainNicheId);
  const subOptions = main?.subNiches || [];
  const subSelected = subOptions.find((s) => s.id === subNicheId);
  const deepOptions = useMemo(
    () => getDeepNiches(main?.label || "", subSelected?.label || ""),
    [main?.label, subSelected?.label]
  );
  const deepNicheLabel = research?.deepNicheLabel || "";
  const marketIntel = useMemo(
    () =>
      deepNicheLabel
        ? detectAudience(deepNicheLabel, subSelected?.label || "")
        : null,
    [deepNicheLabel, subSelected?.label]
  );

  const profile = useMemo(
    () => buildResearchFormProfile(registry, mainNicheId, subNicheId),
    [registry, mainNicheId, subNicheId]
  );

  const arch = profile.architecture;
  const toneOptions = profile.tones?.length ? profile.tones : [];
  const audienceOptions = profile.audiences?.length ? profile.audiences : [];
  const publishingGoals = profile.publishingGoals?.length ? profile.publishingGoals : [];

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
    setSuggestedTitles([]);
    try {
      const intel = detectAudience(deepNicheLabel, subSelected?.label || "");
      const enrichedResearch = {
        ...research,
        deepNicheLabel,
        targetAudience: research.targetAudience?.trim() || intel.audience,
        bookTopic: research.bookTopic?.trim() || deepNicheLabel
      };
      const resp = await fetch("/api/book/contextual-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ research: enrichedResearch, analysis: { books: [] } })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || `Title generation failed (${resp.status})`);
      const titles = Array.isArray(data.titles) ? data.titles.slice(0, 3) : [];
      if (!titles.length) throw new Error("No titles returned. Try again.");
      setSuggestedTitles(titles);
    } catch (err) {
      setTitlesError(err?.message || "Failed to suggest titles.");
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
          <p className="text-xs font-bold uppercase tracking-wider text-sky-800">Architecture preview</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {arch.mainNicheLabel} › {arch.subNicheLabel}
          </p>
          <dl className="mt-4 grid gap-3 text-xs text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-500">Structure</dt>
              <dd>{profile.recommendations.structureLabel}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Pacing</dt>
              <dd>{profile.recommendations.pacingType}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Chapters</dt>
              <dd>
                {profile.recommendations.chapterCount} recommended ({profile.recommendations.chapterRange})
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Word band</dt>
              <dd>{profile.recommendations.wordCountBand}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-500">Emotional arc</dt>
              <dd>{profile.recommendations.emotionalArc}</dd>
            </div>
          </dl>
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

