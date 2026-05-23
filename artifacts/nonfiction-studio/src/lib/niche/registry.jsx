import { DEFAULT_NICHE_REGISTRY } from "@/lib/niche/defaultRegistry";
import { NICHE_BLUEPRINTS } from "@/lib/niche/blueprints";
import { DEEP_NICHE_MAP } from "@/lib/niche/deepNiches";

export const NICHE_REGISTRY_STORAGE_KEY = "nonfiction-ai-niche-registry";

// Starter Content Direction descriptions derived from blueprintKey.
// Used to auto-migrate older sub-niches that have no contentDirection yet.
const BLUEPRINT_TO_CONTENT_DIRECTION = {
  "self-help-transformation":
    "This category should feel emotionally supportive and transformation-focused. Pacing is progressive — pain, reframe, framework, action, identity shift. Chapters combine relatable struggles, mindset insights, and practical exercises that build lasting change.",
  "business-framework":
    "This category should feel practical, system-oriented, and outcome-driven. Pacing is modular with numbered frameworks, case studies, checklists, and step-by-step implementation. Readers should finish each chapter with a concrete, copy-paste system.",
  "romance-escalation":
    "This category should feel emotionally charged, tension-driven, and reader-immersive. Pacing escalates from attraction through friction, midpoint intimacy, separation, and reunion. Chapters maximize banter, vulnerability, and emotional payoff.",
  "romance-dark":
    "This category should feel intense, taboo, and obsession-driven with careful craft and content warnings. Pacing escalates power dynamics, consequences, and morally grey resolutions with high emotional stakes.",
  "romantasy-hybrid":
    "This category should feel epic and emotionally charged in equal measure. Pacing balances fantasy world stakes with romance escalation, merging both arcs at the climax.",
  "thriller-psychological":
    "This category should feel unsettling, paranoid, and twist-driven. Pacing tightens with unreliable narration, mini-cliffhangers, and a fair-play reveal that recontextualizes earlier chapters.",
  "thriller-procedural":
    "This category should feel tight, clue-driven, and justice-oriented. Pacing follows tick-tock investigation beats — crime, evidence, red herrings, breakthrough, confrontation.",
  "fantasy-epic":
    "This category should feel immersive, world-rich, and stakes-escalating. Pacing follows the hero's journey with deep worldbuilding, power escalation, and faction politics culminating in earned victory.",
  "fantasy-progression":
    "This category should feel underdog-driven and progression-focused. Pacing follows clear tier breakthroughs, rivals, setbacks, and visible power growth that rewards readers chapter by chapter.",
  "story-narrative":
    "This category should feel emotionally engaging and reader-focused with storytelling elements and reflective pacing. Chapters carry a clear emotional arc with relatable characters, thematic depth, and meaningful resolution."
};

export function deriveContentDirection(sub) {
  if (sub?.contentDirection?.trim()) return sub.contentDirection.trim();
  // Legacy migration: old `narrativeType` string maps to a starter description.
  if (sub?.narrativeType) {
    const t = String(sub.narrativeType).toLowerCase();
    if (t.includes("story") || t.includes("narrative"))
      return BLUEPRINT_TO_CONTENT_DIRECTION["story-narrative"];
    if (t.includes("framework") || t.includes("analytic"))
      return BLUEPRINT_TO_CONTENT_DIRECTION["business-framework"];
  }
  return BLUEPRINT_TO_CONTENT_DIRECTION[sub?.blueprintKey] || BLUEPRINT_TO_CONTENT_DIRECTION["story-narrative"];
}

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
      subNiches: (Array.isArray(m.subNiches) ? m.subNiches : []).map((s, si) => {
        const seededDeep =
          (DEEP_NICHE_MAP[m.label] && DEEP_NICHE_MAP[m.label][s.label]) || [];
        const existingDeep = Array.isArray(s.deepNiches) ? s.deepNiches : [];
        const deepNiches = (existingDeep.length ? existingDeep : seededDeep)
          .map((d) => String(d || "").trim())
          .filter(Boolean);
        // de-dup preserving order
        const seen = new Set();
        const dedupDeep = deepNiches.filter((d) => {
          const k = d.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        return {
          id: s.id || slugifyId(s.label) || `sub-${mi}-${si}`,
          label: s.label || "Untitled sub-niche",
          blueprintKey: s.blueprintKey || "story-narrative",
          contentDirection: deriveContentDirection(s),
          deepNiches: dedupDeep,
          overrides: s.overrides && typeof s.overrides === "object" ? s.overrides : {}
        };
      })
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

export function resolveArchitecture(registry, mainNicheId, subNicheId, deepNicheLabel = "") {
  const main = findMainNiche(registry, mainNicheId);
  const sub = findSubNiche(registry, mainNicheId, subNicheId);
  if (!main || !sub) return null;

  const blueprint = NICHE_BLUEPRINTS[sub.blueprintKey] || NICHE_BLUEPRINTS["story-narrative"];
  const overrides = sub.overrides || {};
  const deepLabel = (deepNicheLabel || "").trim();

  return {
    mainNicheId: main.id,
    mainNicheLabel: main.label,
    subNicheId: sub.id,
    subNicheLabel: sub.label,
    deepNicheLabel: deepLabel,
    blueprintKey: sub.blueprintKey,
    contentDirection: sub.contentDirection || "",
    ...blueprint,
    ...overrides,
    tones: sub.tones?.length ? sub.tones : main.tones,
    audiences: sub.audiences?.length ? sub.audiences : main.audiences,
    publishingGoals: main.publishingGoals
  };
}

export function buildResearchFormProfile(registry, mainNicheId, subNicheId, deepNicheLabel = "") {
  const arch = resolveArchitecture(registry, mainNicheId, subNicheId, deepNicheLabel);
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
