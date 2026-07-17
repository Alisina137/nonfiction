import type { VersionRegistry, VersionEntry } from "./types.js";

const REGISTRY_KEY = "nonfiction-ai-intelligence-version-registry";

export const PLATFORM_VERSION = "2.0.0";

const DEFAULT_ENGINES: Record<string, VersionEntry> = {
  research: {
    id: "research", name: "Research Engine", version: "1.0", promptVersion: 1,
    deployedAt: new Date().toISOString(),
    inputs: ["bookTopic", "niche", "audience"],
    outputs: ["researchData", "competitorAnalysis", "marketPosition"],
    capabilities: ["niche-analysis", "competitor-research", "audience-profiling"],
  },
  outline: {
    id: "outline", name: "Outline Engine", version: "1.0", promptVersion: 2,
    deployedAt: new Date().toISOString(),
    inputs: ["researchData", "bookDNA"],
    outputs: ["chapterOutline", "sectionStructure"],
    capabilities: ["chapter-planning", "progressive-structure"],
  },
  blueprint: {
    id: "blueprint", name: "Blueprint Engine", version: "1.0", promptVersion: 3,
    deployedAt: new Date().toISOString(),
    inputs: ["outline", "bookDNA"],
    outputs: ["frameworkLibrary", "exerciseLibrary", "storyLibrary"],
    capabilities: ["framework-design", "exercise-creation", "story-selection"],
  },
  writing: {
    id: "writing", name: "Writing Engine", version: "1.0", promptVersion: 4,
    deployedAt: new Date().toISOString(),
    inputs: ["outline", "blueprint", "bookDNA"],
    outputs: ["chapterContent", "manuscript"],
    capabilities: ["chapter-writing", "section-writing", "style-consistency"],
  },
  knowledgeGraph: {
    id: "knowledgeGraph", name: "Knowledge Graph Engine", version: "1.0", promptVersion: 5,
    deployedAt: new Date().toISOString(),
    inputs: ["manuscript"],
    outputs: ["conceptMap", "topicConnections", "glossary"],
    capabilities: ["concept-extraction", "relationship-mapping"],
  },
  developmentalEdit: {
    id: "developmentalEdit", name: "Developmental Editing Engine", version: "2.0", promptVersion: 17,
    deployedAt: new Date().toISOString(),
    inputs: ["manuscript", "bookContext", "knowledgeGraph"],
    outputs: ["editorialReport", "qualityScores", "revisionPriorities"],
    capabilities: ["quality-assessment", "benchmark-comparison", "reader-modeling"],
  },
  readerPersona: {
    id: "readerPersona", name: "Reader Persona Simulation Engine", version: "1.0", promptVersion: 18,
    deployedAt: new Date().toISOString(),
    inputs: ["manuscript", "bookContext", "knowledgeGraph"],
    outputs: ["personaSimulations", "readerExperienceScores", "engagementAnalysis"],
    capabilities: ["persona-simulation", "experience-modeling", "engagement-prediction"],
  },
  multiFormatPublishing: {
    id: "multiFormatPublishing", name: "Multi-Format Publishing Engine", version: "1.0", promptVersion: 19,
    deployedAt: new Date().toISOString(),
    inputs: ["manuscript", "bookContext", "knowledgeGraph"],
    outputs: ["masterContentModel", "recommendedFormats", "contentMapping"],
    capabilities: ["format-recommendation", "content-repurposing", "cross-format-validation"],
  },
  intelligence: {
    id: "intelligence", name: "Continuous Learning & Platform Intelligence Engine", version: "1.0", promptVersion: 20,
    deployedAt: new Date().toISOString(),
    inputs: ["analytics", "ruleSet", "qualityTrend", "enginePerformance"],
    outputs: ["recommendations", "ruleEffectiveness", "platformReport"],
    capabilities: [
      "analytics-collection", "rule-evaluation", "recommendation-generation",
      "version-management", "engine-performance-monitoring", "knowledge-library",
      "experiment-support",
    ],
  },
};

export function getVersionRegistry(): VersionRegistry {
  try {
    const stored = window.localStorage.getItem(REGISTRY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as VersionRegistry;
      if (parsed?.platformVersion) {
        for (const [id, entry] of Object.entries(DEFAULT_ENGINES)) {
          if (!parsed.engines[id]) parsed.engines[id] = entry;
        }
        return parsed;
      }
    }
  } catch { /* ignore */ }
  const registry: VersionRegistry = {
    platformVersion:            PLATFORM_VERSION,
    updatedAt:                  new Date().toISOString(),
    engines:                    { ...DEFAULT_ENGINES },
    ruleSetsVersion:            1,
    qualityMetricsVersion:      1,
    knowledgeStructuresVersion: 1,
  };
  saveVersionRegistry(registry);
  return registry;
}

export function saveVersionRegistry(registry: VersionRegistry): void {
  try { window.localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry)); } catch { /* ignore */ }
}

export function registerEngine(entry: VersionEntry): void {
  const registry = getVersionRegistry();
  registry.engines[entry.id] = { ...entry, deployedAt: new Date().toISOString() };
  registry.updatedAt = new Date().toISOString();
  saveVersionRegistry(registry);
}

export function bumpRuleSetVersion(): void {
  const registry = getVersionRegistry();
  registry.ruleSetsVersion++;
  registry.updatedAt = new Date().toISOString();
  saveVersionRegistry(registry);
}

export function bumpQualityMetricsVersion(): void {
  const registry = getVersionRegistry();
  registry.qualityMetricsVersion++;
  registry.updatedAt = new Date().toISOString();
  saveVersionRegistry(registry);
}

export function getEngineVersion(engineId: string): string {
  const registry = getVersionRegistry();
  return registry.engines[engineId]?.version ?? "unknown";
}
