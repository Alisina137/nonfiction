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

// ─── Concept Analysis Cache (localStorage) ───────────────────────────────────
const CONCEPT_CACHE_KEY = "nonfiction-concept-cache-v1";
const CONCEPT_MAX = 20;

function conceptSigKey({ mainNicheId, subNicheId, deepNicheLabel, bookTitle }) {
  return [
    String(mainNicheId || ""),
    String(subNicheId || ""),
    String(deepNicheLabel || "").toLowerCase(),
    String(bookTitle || "").toLowerCase().trim()
  ].join("|");
}

function getConceptCache(key) {
  if (!key) return null;
  try {
    const all = JSON.parse(window.localStorage.getItem(CONCEPT_CACHE_KEY) || "{}");
    return all[key]?.data || null;
  } catch { return null; }
}

function setConceptCache(key, data) {
  if (!key || !data) return;
  try {
    const all = JSON.parse(window.localStorage.getItem(CONCEPT_CACHE_KEY) || "{}");
    all[key] = { data, at: Date.now() };
    const entries = Object.entries(all)
      .sort((a, b) => ((b[1]).at || 0) - ((a[1]).at || 0))
      .slice(0, CONCEPT_MAX);
    window.localStorage.setItem(CONCEPT_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

// ─── Helper components ────────────────────────────────────────────────────────

function FieldLabel({ children, hint, aiRecommended }) {
  return (
    <label className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-slate-800">
      {children}
      {aiRecommended && (
        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-700">
          AI ★
        </span>
      )}
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

function ScoreBar({ label, value, color = "sky" }) {
  const pct = Math.round(((value || 0) / 10) * 100);
  const bar = {
    sky: "bg-sky-500",
    emerald: "bg-emerald-500",
    violet: "bg-violet-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500"
  }[color] || "bg-sky-500";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 shrink-0 font-medium text-slate-600">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right font-bold tabular-nums text-slate-700">
        {typeof value === "number" ? value.toFixed(1) : "—"}
      </span>
    </div>
  );
}

function LevelBadge({ value }) {
  const cls = {
    Low: "bg-emerald-100 text-emerald-800",
    Medium: "bg-amber-100 text-amber-800",
    High: "bg-rose-100 text-rose-800"
  }[value] || "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {value || "—"}
    </span>
  );
}

function ChipSelect({ options, value, onChange, disabled }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = value === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(on ? "" : opt)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              on
                ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/60"
            } disabled:opacity-40`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Constants for new optional fields ───────────────────────────────────────
const PAIN_LEVELS = [
  "Mild frustration",
  "Burnout",
  "Identity crisis",
  "Chronic procrastination",
  "No direction",
  "High ambition / low consistency"
];

const ENERGY_STYLES = [
  "Calm mentor",
  "Hard-hitting coach",
  "Stoic philosopher",
  "Masculine discipline",
  "Inspirational motivator",
  "Scientific thinker"
];

const CONTENT_DEPTHS = ["Beginner", "Intermediate", "Advanced", "Expert"];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ResearchStep({ research, setResearch, errors }) {
  const [registry, setRegistry] = useState(() => loadNicheRegistry());
  const [managerOpen, setManagerOpen] = useState(false);

  // Title suggestion state (enhanced = {title, subtitle?, hook?, audience?, angle?}[])
  const [suggestedTitles, setSuggestedTitles] = useState([]);
  const [titlesLoading, setTitlesLoading] = useState(false);
  const [titlesError, setTitlesError] = useState("");

  // Architecture preview state (AI-tuned, per niche+audience+goal)
  const [archDynamic, setArchDynamic] = useState(null);
  const [archLoading, setArchLoading] = useState(false);
  const [archError, setArchError] = useState("");
  const archRequestKeyRef = useRef("");

  // Concept analysis state (AI Publishing Intelligence — triggered by title)
  const [conceptAnalysis, setConceptAnalysis] = useState(null);
  const [conceptLoading, setConceptLoading] = useState(false);
  const conceptKeyRef = useRef("");

  // Track which fields were auto-filled by AI so we can show the AI badge
  const [aiFilledFields, setAiFilledFields] = useState(new Set());

  useEffect(() => { setRegistry(loadNicheRegistry()); }, []);

  // ─── Derived niche values ─────────────────────────────────────────────────
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
  const bookTitle = (research?.bookTitle || "").trim();

  const marketIntel = useMemo(
    () => deepNicheLabel ? detectAudience(deepNicheLabel, subSelected?.label || "") : null,
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

  // ─── Architecture preview ─────────────────────────────────────────────────
  const archAudience = (research?.targetAudience || research?.audiencePreset || "").trim();
  const archGoal = (research?.publishingGoal || "").trim();
  const archTones = Array.isArray(research?.authorTones) ? research.authorTones : [];

  const archKey = arch
    ? archCacheKey({ mainNicheId, subNicheId, deepNicheLabel, audience: archAudience, goal: archGoal, tones: archTones })
    : "";

  useEffect(() => {
    if (!archKey) { setArchDynamic(null); setArchError(""); return; }
    const cached = getArchCache(archKey);
    setArchDynamic(cached || null);
    setArchError("");
  }, [archKey]);

  async function generateArchitecturePreview({ force = false } = {}) {
    if (!arch || !archKey) return;
    if (!force) {
      const cached = getArchCache(archKey);
      if (cached) { setArchDynamic(cached); return; }
    }
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
      setArchCache(requestKey, clean);
      if (archRequestKeyRef.current === requestKey) setArchDynamic(clean);
    } catch (err) {
      if (archRequestKeyRef.current !== requestKey) return;
      setArchError(err instanceof GenerationCanceledError
        ? "Preview canceled — Grok approval declined."
        : err?.message || "Could not generate architecture preview.");
    } finally {
      if (archRequestKeyRef.current === requestKey) setArchLoading(false);
    }
  }

  useEffect(() => {
    if (!arch || !archKey || (!archAudience && !archGoal)) return;
    if (getArchCache(archKey)) return;
    const id = setTimeout(() => generateArchitecturePreview({ force: false }), 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archKey, arch?.mainNicheLabel, arch?.subNicheLabel]);

  // ─── Concept analysis (Publishing Intelligence) ───────────────────────────

  const conceptKey = (mainNicheId && subNicheId && bookTitle.length >= 4)
    ? conceptSigKey({ mainNicheId, subNicheId, deepNicheLabel, bookTitle })
    : "";

  // Hydrate from cache instantly when key changes
  useEffect(() => {
    if (!conceptKey) { setConceptAnalysis(null); return; }
    const cached = getConceptCache(conceptKey);
    if (cached) setConceptAnalysis(cached);
  }, [conceptKey]);

  async function runConceptAnalysis({ force = false } = {}) {
    if (!conceptKey || !arch) return;
    if (!force) {
      const cached = getConceptCache(conceptKey);
      if (cached) { setConceptAnalysis(cached); return; }
    }
    const reqKey = conceptKey;
    conceptKeyRef.current = reqKey;
    setConceptLoading(true);
    try {
      const data = await aiFetch("/api/ai/analyze-book-concept", {
        niche: arch.mainNicheLabel,
        subNiche: arch.subNicheLabel,
        deepNiche: deepNicheLabel,
        title: bookTitle
      });
      setConceptCache(reqKey, data);
      if (conceptKeyRef.current !== reqKey) return;
      setConceptAnalysis(data);
      applyConceptToFields(data);
    } catch (err) {
      if (conceptKeyRef.current !== reqKey) return;
      if (!(err instanceof GenerationCanceledError)) {
        console.warn("[ResearchStep] concept analysis failed:", err?.message);
      }
    } finally {
      if (conceptKeyRef.current === reqKey) setConceptLoading(false);
    }
  }

  // Apply analysis to empty fields only (non-destructive)
  function applyConceptToFields(data) {
    if (!data) return;
    const filled = new Set();
    const updates = {};

    if (data.bookTopic && !research?.bookTopic?.trim()) {
      updates.bookTopic = data.bookTopic;
      filled.add("bookTopic");
    }
    if (data.targetAudience && !research?.targetAudience?.trim()) {
      updates.targetAudience = data.targetAudience;
      filled.add("targetAudience");
    }
    if (data.standoutFactor && !research?.standout?.trim()) {
      updates.standout = data.standoutFactor;
      filled.add("standout");
    }
    if (data.uniqueAngle && !research?.stanceOnTopic?.trim()) {
      updates.stanceOnTopic = data.uniqueAngle;
      filled.add("stanceOnTopic");
    }
    if (data.promise && !research?.corePromise?.trim()) {
      updates.corePromise = data.promise;
      filled.add("corePromise");
    }
    if (data.readerEnergy && !research?.energyStyle) {
      const match = ENERGY_STYLES.find(
        (s) => s.toLowerCase().includes(data.readerEnergy.toLowerCase().split(" ")[0])
      );
      if (match) { updates.energyStyle = match; filled.add("energyStyle"); }
    }
    if (data.tone && !research?.authorTones?.length) {
      const match = toneOptions.find(
        (t) => t.toLowerCase().includes(data.tone.toLowerCase().split(" ")[0])
      );
      if (match) { updates.authorTones = [match]; filled.add("authorTones"); }
    }

    if (Object.keys(updates).length > 0) {
      patch(updates);
      setAiFilledFields((prev) => new Set([...prev, ...filled]));
    }
  }

  // Auto-trigger debounced concept analysis when title + niche are ready
  useEffect(() => {
    if (!conceptKey) return;
    if (getConceptCache(conceptKey)) return;
    const id = setTimeout(() => runConceptAnalysis({ force: false }), 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptKey]);

  // ─── Handler functions ────────────────────────────────────────────────────

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
    setConceptAnalysis(null);
    setAiFilledFields(new Set());
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
    setConceptAnalysis(null);
    setAiFilledFields(new Set());
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
      // Build enhanced list: prefer server-provided enhanced, fall back to plain strings
      const plainTitles = Array.isArray(data.titles) ? data.titles.slice(0, 6) : [];
      const enhanced = Array.isArray(data.enhanced) ? data.enhanced : [];
      const merged = plainTitles.map((t) => {
        const match = enhanced.find((e) => e.title === t || e.title?.toLowerCase() === t?.toLowerCase());
        return match || { title: t };
      });
      if (!merged.length) throw new Error("No titles returned. Try again.");
      setSuggestedTitles(merged);
    } catch (err) {
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

  function applyTitle(titleData) {
    const title = typeof titleData === "string" ? titleData : titleData?.title || "";
    patch({ bookTitle: title });
    // Concept analysis auto-triggers via the bookTitle useEffect above
  }

  function toggleTone(tone) {
    const set = new Set(research.authorTones || []);
    if (set.has(tone)) set.delete(tone); else set.add(tone);
    patch({ authorTones: Array.from(set) });
    setAiFilledFields((prev) => { const next = new Set(prev); next.delete("authorTones"); return next; });
  }

  function selectAudiencePreset(aud) {
    patch({
      audiencePreset: aud,
      targetAudience: research.targetAudience?.trim() ? research.targetAudience : aud
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const intelligenceActive = !!(mainNicheId && subNicheId && bookTitle.length >= 4);

  return (
    <section className="mx-auto max-w-4xl">

      {/* ── Header ── */}
      <header>
        {intelligenceActive ? (
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/80" />
            Publishing Intelligence Active
          </div>
        ) : (
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700/90">
            Publishing intelligence
          </p>
        )}
        <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Position your book in the market
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Niche and sub-niche drive tone, audience presets, pacing, chapter architecture, and outline
          generation. Enter a book title and the AI strategist auto-fills your positioning profile.
        </p>
      </header>

      {/* ── Strategy Insights Banner (when concept loaded) ── */}
      {conceptAnalysis?.strategyInsights?.length > 0 && (
        <div className="mt-4 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-indigo-50/40 p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-violet-700">
            AI Strategist Insights
          </p>
          <div className="flex flex-wrap gap-2">
            {conceptAnalysis.strategyInsights.map((insight, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-3 py-1 text-[11px] font-medium text-violet-900"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                {insight}
              </span>
            ))}
          </div>
          {conceptLoading && (
            <p className="mt-1.5 text-[10px] font-medium text-violet-500 animate-pulse">
              AI optimizing positioning…
            </p>
          )}
        </div>
      )}
      {conceptLoading && !conceptAnalysis && (
        <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3">
          <p className="text-[11px] font-semibold text-violet-700 animate-pulse">
            AI optimizing publishing positioning for "{bookTitle}"…
          </p>
        </div>
      )}

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

      {/* ── Architecture preview aside ── */}
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
                  <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-sky-800 animate-pulse">
                    Generating…
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {arch.mainNicheLabel} › {arch.subNicheLabel}
                {arch.deepNicheLabel ? (
                  <> ›{" "}
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
              title={!archAudience && !archGoal ? "Pick a publishing goal or describe the target audience to enable AI tuning." : "Regenerate"}
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
          {archError && <p className="mt-2 text-[11px] font-medium text-rose-700">{archError}</p>}
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
                    <span key={a} className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">{a}</span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Transformations</span>
                  {focus.transformations.slice(0, 4).map((t) => (
                    <span key={t} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">{t}</span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">Pain points</span>
                  {focus.painPoints.slice(0, 4).map((p) => (
                    <span key={p} className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-800">{p}</span>
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
          {!archDynamic && !archLoading && !archAudience && !archGoal && (
            <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white/60 px-3 py-2 text-[11px] text-slate-500">
              Select a publishing goal or describe your target audience to unlock an AI-tuned preview.
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

      {/* ── Main form fields ── */}
      <section className="book-panel mt-8 space-y-6">

        {/* Niche selectors */}
        <section className="grid gap-5 md:grid-cols-2">
          <section>
            <FieldLabel hint="Top-level market category—controls architecture family.">Main niche</FieldLabel>
            <select className="input-light mt-1.5" value={mainNicheId} onChange={(e) => onMainNicheChange(e.target.value)}>
              <option value="">Select main niche</option>
              {registry.mainNiches.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            {errors.mainNicheId && <p className="mt-1 text-xs text-red-600">{errors.mainNicheId}</p>}
          </section>

          <section>
            <FieldLabel hint="Sub-niche selects blueprint, pacing, and outline beats.">Sub-niche</FieldLabel>
            <select className="input-light mt-1.5" value={subNicheId} disabled={!mainNicheId} onChange={(e) => onSubNicheChange(e.target.value)}>
              <option value="">{mainNicheId ? "Select sub-niche" : "Choose main niche first"}</option>
              {subOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            {errors.subNicheId && <p className="mt-1 text-xs text-red-600">{errors.subNicheId}</p>}
          </section>
        </section>

        {/* Deep niche + suggest titles */}
        <section>
          <FieldLabel hint="Third-level focus — drives audience targeting and title suggestions.">Deep niche</FieldLabel>
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

          {/* Enhanced title cards */}
          {suggestedTitles.length > 0 && (
            <section className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Suggested titles — click to use
              </p>
              <section className="mt-2 grid gap-2 sm:grid-cols-3">
                {suggestedTitles.slice(0, 3).map((item) => {
                  const titleStr = typeof item === "string" ? item : item.title;
                  const active = research.bookTitle === titleStr;
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
                    const active = research.bookTitle === titleStr;
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

        {/* Publishing goal */}
        <section>
          <FieldLabel hint={profile.helperText.publishingGoal}>Publishing goal</FieldLabel>
          <select
            className="input-light mt-1.5"
            value={research.publishingGoal || ""}
            onChange={(e) => patch({ publishingGoal: e.target.value })}
            disabled={!subNicheId}
          >
            <option value="">Select goal</option>
            {publishingGoals.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          {errors.publishingGoal && <p className="mt-1 text-xs text-red-600">{errors.publishingGoal}</p>}
        </section>

        {/* Book title */}
        <section>
          <FieldLabel hint="Your working title — the AI strategist analyzes it live.">
            Book title
            {conceptLoading && (
              <span className="ml-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-600 animate-pulse">
                AI analyzing…
              </span>
            )}
            {conceptAnalysis && !conceptLoading && (
              <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                Analyzed ✓
              </span>
            )}
          </FieldLabel>
          <input
            className="input-light mt-1.5"
            placeholder="Enter your book's title — AI will auto-fill your positioning"
            value={research.bookTitle || ""}
            onChange={(e) => patch({ bookTitle: e.target.value })}
          />
          {conceptAnalysis && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {conceptAnalysis.painPoints?.slice(0, 3).map((p) => (
                <span key={p} className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800">{p}</span>
              ))}
              {conceptAnalysis.transformations?.slice(0, 2).map((t) => (
                <span key={t} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">{t}</span>
              ))}
            </div>
          )}
        </section>

        {/* Author name */}
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

        {/* Book topic */}
        <section>
          <FieldLabel
            hint="Publisher-style positioning statement — WHO it's for, WHAT transformation it delivers, WHY it matters."
            aiRecommended={aiFilledFields.has("bookTopic")}
          >
            Book topic
            {conceptLoading && !research?.bookTopic?.trim() && (
              <span className="ml-1.5 rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-700 animate-pulse">
                AI generating…
              </span>
            )}
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[88px] resize-y transition-all"
            placeholder={
              conceptLoading && !research?.bookTopic?.trim()
                ? "AI generating book positioning…"
                : conceptAnalysis?.bookTopic
                ? `AI: "${conceptAnalysis.bookTopic}"`
                : (profile.placeholders.bookTopic || "e.g. A practical system helping ambitious men build discipline and emotional control using Stoic principles.")
            }
            value={research.bookTopic || ""}
            onChange={(e) => {
              patch({ bookTopic: e.target.value });
              setAiFilledFields((prev) => { const n = new Set(prev); n.delete("bookTopic"); return n; });
            }}
          />
          {errors.bookTopic && <p className="mt-1 text-xs text-red-600">{errors.bookTopic}</p>}
        </section>

        {/* Stance on topic */}
        <section>
          <FieldLabel
            hint="Your angle within this sub-niche."
            aiRecommended={aiFilledFields.has("stanceOnTopic")}
          >
            Stance on topic (optional)
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[88px] resize-y"
            placeholder={
              conceptAnalysis?.uniqueAngle
                ? `AI suggestion: "${conceptAnalysis.uniqueAngle}"`
                : (profile.placeholders.stanceOnTopic || "Your stance")
            }
            value={research.stanceOnTopic || ""}
            onChange={(e) => {
              patch({ stanceOnTopic: e.target.value });
              setAiFilledFields((prev) => { const n = new Set(prev); n.delete("stanceOnTopic"); return n; });
            }}
          />
        </section>

        {/* Standout factor */}
        <section>
          <FieldLabel
            hint="Differentiation vs bestsellers in this sub-niche."
            aiRecommended={aiFilledFields.has("standout")}
          >
            What makes this book stand out?
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[88px] resize-y"
            placeholder={
              conceptAnalysis?.standoutFactor
                ? `AI suggestion: "${conceptAnalysis.standoutFactor}"`
                : (profile.placeholders.standout || "Your differentiation")
            }
            value={research.standout || ""}
            onChange={(e) => {
              patch({ standout: e.target.value });
              setAiFilledFields((prev) => { const n = new Set(prev); n.delete("standout"); return n; });
            }}
          />
        </section>

        {/* Author tone */}
        <section>
          <FieldLabel
            hint={profile.helperText.authorTones}
            aiRecommended={aiFilledFields.has("authorTones")}
          >
            Author tone
          </FieldLabel>
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

        {/* Reader preset */}
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
                    on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200"
                  } disabled:opacity-40`}
                >
                  {aud}
                </button>
              );
            })}
          </section>
        </section>

        {/* Target audience */}
        <section>
          <FieldLabel
            hint={profile.helperText.targetAudience}
            aiRecommended={aiFilledFields.has("targetAudience")}
          >
            Target audience (specific)
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[88px] resize-y"
            placeholder={
              conceptAnalysis?.targetAudience
                ? `AI suggestion: "${conceptAnalysis.targetAudience}"`
                : (profile.placeholders.targetAudience || "Describe your ideal reader")
            }
            value={research.targetAudience || ""}
            onChange={(e) => {
              patch({ targetAudience: e.target.value });
              setAiFilledFields((prev) => { const n = new Set(prev); n.delete("targetAudience"); return n; });
            }}
          />
          {errors.targetAudience && <p className="mt-1 text-xs text-red-600">{errors.targetAudience}</p>}
        </section>

        {/* ── NEW OPTIONAL FIELDS ── */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 space-y-6">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Advanced Publishing Profile
            <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[9px] text-sky-700">Optional</span>
          </p>

          {/* Core Promise */}
          <section>
            <FieldLabel
              hint="The single most important outcome the reader gets."
              aiRecommended={aiFilledFields.has("corePromise")}
            >
              Core promise
            </FieldLabel>
            <input
              className="input-light mt-1.5"
              placeholder={
                conceptAnalysis?.promise
                  ? `AI: "${conceptAnalysis.promise}"`
                  : "e.g. Build discipline in 90 days"
              }
              value={research.corePromise || ""}
              onChange={(e) => {
                patch({ corePromise: e.target.value });
                setAiFilledFields((prev) => { const n = new Set(prev); n.delete("corePromise"); return n; });
              }}
            />
          </section>

          {/* Reader Pain Level */}
          <section>
            <FieldLabel hint="The emotional intensity of the reader's problem before reading.">
              Reader pain level
            </FieldLabel>
            <ChipSelect
              options={PAIN_LEVELS}
              value={research.readerPainLevel || ""}
              onChange={(v) => patch({ readerPainLevel: v })}
              disabled={false}
            />
          </section>

          {/* Energy Style */}
          <section>
            <FieldLabel
              hint="The emotional energy your writing voice conveys to the reader."
              aiRecommended={aiFilledFields.has("energyStyle")}
            >
              Energy style
            </FieldLabel>
            <ChipSelect
              options={ENERGY_STYLES}
              value={research.energyStyle || ""}
              onChange={(v) => {
                patch({ energyStyle: v });
                setAiFilledFields((prev) => { const n = new Set(prev); n.delete("energyStyle"); return n; });
              }}
              disabled={false}
            />
          </section>

          {/* Content Depth */}
          <section>
            <FieldLabel hint="The knowledge level this book targets.">Content depth</FieldLabel>
            <ChipSelect
              options={CONTENT_DEPTHS}
              value={research.contentDepth || ""}
              onChange={(v) => patch({ contentDepth: v })}
              disabled={false}
            />
          </section>

          {/* Competitor Inspiration */}
          <section>
            <FieldLabel hint="Books in the same niche you admire or want to position alongside.">
              Competitor inspiration
            </FieldLabel>
            <input
              className="input-light mt-1.5"
              placeholder="e.g. Atomic Habits, Deep Work, Can't Hurt Me"
              value={research.competitorInspiration || ""}
              onChange={(e) => patch({ competitorInspiration: e.target.value })}
            />
          </section>

          {/* Reader Transformation */}
          <section>
            <FieldLabel hint="The specific change the reader experiences by the last page.">
              Reader transformation
            </FieldLabel>
            <input
              className="input-light mt-1.5"
              placeholder="e.g. Stop overthinking and build consistent daily discipline"
              value={research.readerTransformation || ""}
              onChange={(e) => patch({ readerTransformation: e.target.value })}
            />
          </section>
        </div>

        {/* ── MARKET VALIDATION PANEL ── */}
        {conceptAnalysis && (
          <aside className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/40 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-800">
                  Market Validation
                  <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-semibold text-indigo-700">
                    AI-scored
                  </span>
                </p>
                {conceptAnalysis.idealReader && (
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600 max-w-xl">
                    {conceptAnalysis.idealReader}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => runConceptAnalysis({ force: true })}
                disabled={conceptLoading}
                className="shrink-0 rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50 disabled:opacity-50"
              >
                {conceptLoading ? "…" : "Refresh"}
              </button>
            </div>

            <div className="space-y-2">
              <ScoreBar label="Demand" value={conceptAnalysis.demandScore} color="sky" />
              <ScoreBar label="KDP Opportunity" value={conceptAnalysis.kdpOpportunityScore} color="emerald" />
              <ScoreBar label="Emotional Buying" value={conceptAnalysis.emotionalBuyingScore} color="violet" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <p className="text-slate-500 mb-1">Competition</p>
                <LevelBadge value={conceptAnalysis.competitionLevel} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <p className="text-slate-500 mb-1">Virality</p>
                <LevelBadge value={conceptAnalysis.viralityPotential} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <p className="text-slate-500 mb-1">TikTok fit</p>
                <LevelBadge value={conceptAnalysis.tiktokCompatibility} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <p className="text-slate-500 mb-1">YouTube Shorts</p>
                <LevelBadge value={conceptAnalysis.youtubeCompatibility} />
              </div>
            </div>

            {conceptAnalysis.writingStyle && (
              <p className="mt-3 text-[11px] text-slate-600">
                <span className="font-semibold">Recommended style:</span> {conceptAnalysis.writingStyle}
              </p>
            )}
          </aside>
        )}

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
