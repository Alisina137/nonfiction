import { DEFAULT_NICHE_REGISTRY } from "@/lib/niche/defaultRegistry";
import { NICHE_BLUEPRINTS } from "@/lib/niche/blueprints";

export const NICHE_REGISTRY_STORAGE_KEY = "nonfiction-ai-niche-registry";

export function slugifyId(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function cloneRegistry(reg) {
  return JSON.parse(JSON.stringify(reg));
}

export function normalizeRegistry(raw) {
  const base = cloneRegistry(DEFAULT_NICHE_REGISTRY);
  if (!raw || typeof raw !== "object") return base;
  const mains = Array.isArray(raw.mainNiches) ? raw.mainNiches : base.mainNiches;
  return {
    version: raw.version || base.version,
    mainNiches: mains.map((m, mi) => ({
      id: m.id || slugifyId(m.label) || `main-${mi}`,
      label: m.label || "Untitled niche",
      description: m.description || "",
      tones: Array.isArray(m.tones) ? m.tones : [],
      audiences: Array.isArray(m.audiences) ? m.audiences : [],
      publishingGoals: Array.isArray(m.publishingGoals) ? m.publishingGoals : [],
      subNiches: (Array.isArray(m.subNiches) ? m.subNiches : []).map((s, si) => ({
        id: s.id || slugifyId(s.label) || `sub-${mi}-${si}`,
        label: s.label || "Untitled sub-niche",
        blueprintKey: s.blueprintKey || "story-narrative",
        overrides: s.overrides && typeof s.overrides === "object" ? s.overrides : {}
      }))
    }))
  };
}

export function loadNicheRegistry() {
  if (typeof window === "undefined") return normalizeRegistry(DEFAULT_NICHE_REGISTRY);
  try {
    const stored = window.localStorage.getItem(NICHE_REGISTRY_STORAGE_KEY);
    if (!stored) return normalizeRegistry(DEFAULT_NICHE_REGISTRY);
    return normalizeRegistry(JSON.parse(stored));
  } catch {
    return normalizeRegistry(DEFAULT_NICHE_REGISTRY);
  }
}

export function saveNicheRegistry(registry) {
  const normalized = normalizeRegistry(registry);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(NICHE_REGISTRY_STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function resetNicheRegistryToDefaults() {
  return saveNicheRegistry(DEFAULT_NICHE_REGISTRY);
}

export function findMainNiche(registry, mainNicheId) {
  return registry?.mainNiches?.find((m) => m.id === mainNicheId) || null;
}

export function findSubNiche(registry, mainNicheId, subNicheId) {
  const main = findMainNiche(registry, mainNicheId);
  if (!main) return null;
  return main.subNiches?.find((s) => s.id === subNicheId) || null;
}

export function resolveArchitecture(registry, mainNicheId, subNicheId) {
  const main = findMainNiche(registry, mainNicheId);
  const sub = findSubNiche(registry, mainNicheId, subNicheId);
  if (!main || !sub) return null;

  const blueprint = NICHE_BLUEPRINTS[sub.blueprintKey] || NICHE_BLUEPRINTS["story-narrative"];
  const overrides = sub.overrides || {};

  return {
    mainNicheId: main.id,
    mainNicheLabel: main.label,
    subNicheId: sub.id,
    subNicheLabel: sub.label,
    blueprintKey: sub.blueprintKey,
    ...blueprint,
    ...overrides,
    tones: sub.tones?.length ? sub.tones : main.tones,
    audiences: sub.audiences?.length ? sub.audiences : main.audiences,
    publishingGoals: main.publishingGoals
  };
}

export function buildResearchFormProfile(registry, mainNicheId, subNicheId) {
  const arch = resolveArchitecture(registry, mainNicheId, subNicheId);
  const main = findMainNiche(registry, mainNicheId);
  if (!arch || !main) {
    return {
      architecture: null,
      tones: [],
      audiences: [],
      publishingGoals: [],
      placeholders: {},
      helperText: {},
      recommendations: {}
    };
  }

  const topicHint =
    arch.structureType === "romance-arc"
      ? "Central couple, trope, and emotional promise"
      : arch.structureType === "framework-driven"
        ? "Operator problem and measurable outcome"
        : "Core reader problem and transformation promise";

  return {
    architecture: arch,
    tones: arch.tones || [],
    audiences: arch.audiences || [],
    publishingGoals: arch.publishingGoals || [],
    placeholders: {
      bookTopic: `e.g. A ${arch.subNicheLabel} book that delivers ${arch.emotionalArc?.split("→")[0]?.trim() || "a clear payoff"}…`,
      stanceOnTopic: `Your unique angle within ${arch.mainNicheLabel} / ${arch.subNicheLabel}`,
      standout: `Bestseller hooks for this sub-niche: ${(arch.bestsellerPatterns || []).slice(0, 2).join(", ")}`,
      targetAudience: `Readers who expect ${arch.pacingType} pacing and ${arch.hookStyle}`
    },
    helperText: {
      bookTopic: topicHint,
      authorTones: `Voice options tuned for ${arch.subNicheLabel}.`,
      targetAudience: arch.readerPsychology || "Describe your ideal reader psychology and buying triggers.",
      publishingGoal: "This steers outline pacing, hook density, and ending style."
    },
    recommendations: {
      structureLabel: arch.structureType,
      pacingType: arch.pacingType,
      emotionalArc: arch.emotionalArc,
      chapterCount: arch.recommendedChapters?.default,
      chapterRange: `${arch.recommendedChapters?.min}–${arch.recommendedChapters?.max}`,
      wordCountBand: arch.recommendedWordCount?.band,
      hookStyle: arch.hookStyle,
      endingStyle: arch.endingStyle,
      chapterFlow: arch.chapterFlow || []
    }
  };
}
