import type {
  PlatformAnalytics, QualityDataPoint, EngineMetrics,
  GenerationEvent, RevisionPattern
} from "./types.js";

const ANALYTICS_KEY = "nonfiction-ai-intelligence-analytics";
const EVENTS_KEY    = "nonfiction-ai-intelligence-events";
const TREND_KEY     = "nonfiction-ai-intelligence-quality-trend";

const EXISTING_KEYS = {
  devEdit:       "nonfiction-ai-dev-edit",
  benchHistory:  "nonfiction-ai-bench-history",
  readerPersona: "nonfiction-ai-reader-personas",
  multiFormat:   "nonfiction-ai-multi-format",
};

const ENGINE_NAMES: Record<string, string> = {
  devEdit:            "Developmental Editing Engine",
  readerPersonas:     "Reader Persona Simulation Engine",
  multiFormat:        "Multi-Format Publishing Engine",
  research:           "Research Engine",
  outline:            "Outline Engine",
  write:              "Writing Engine",
  blueprint:          "Blueprint Engine",
  knowledgeGraph:     "Knowledge Graph Engine",
  benchmark:          "Quality Benchmark Engine",
  intelligence:       "Platform Intelligence Engine",
};

function safeRead(key: string): unknown {
  try { return JSON.parse(window.localStorage.getItem(key) || "null"); } catch { return null; }
}

function safeWrite(key: string, data: unknown): void {
  try { window.localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
}

export function getGenerationEvents(): GenerationEvent[] {
  try { return JSON.parse(window.localStorage.getItem(EVENTS_KEY) || "[]"); } catch { return []; }
}

export function recordGenerationEvent(event: Omit<GenerationEvent, "id" | "timestamp">): void {
  const events = getGenerationEvents();
  const newEvent: GenerationEvent = {
    ...event,
    id:        Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
  };
  events.push(newEvent);
  if (events.length > 200) events.splice(0, events.length - 200);
  safeWrite(EVENTS_KEY, events);
}

export function getQualityTrend(): QualityDataPoint[] {
  try { return JSON.parse(window.localStorage.getItem(TREND_KEY) || "[]"); } catch { return []; }
}

export function recordQualityDataPoint(point: Omit<QualityDataPoint, "date">): void {
  const trend = getQualityTrend();
  trend.push({ ...point, date: new Date().toISOString() });
  if (trend.length > 100) trend.splice(0, trend.length - 100);
  safeWrite(TREND_KEY, trend);
}

function buildEngineMetrics(events: GenerationEvent[]): Record<string, EngineMetrics> {
  const metrics: Record<string, EngineMetrics> = {};
  for (const e of events) {
    if (!metrics[e.engineId]) {
      metrics[e.engineId] = {
        engineId:             e.engineId,
        engineName:           ENGINE_NAMES[e.engineId] || e.engineId,
        totalRuns:            0,
        successRate:          1.0,
        averageConfidence:    0,
        averageQualityImpact: 0,
        lastRun:              null,
        version:              "1.0",
      };
    }
    const m = metrics[e.engineId];
    const prev = m.totalRuns;
    m.totalRuns++;
    m.averageConfidence    = (m.averageConfidence    * prev + e.confidence)    / m.totalRuns;
    m.averageQualityImpact = (m.averageQualityImpact * prev + e.qualityScore) / m.totalRuns;
    if (!m.lastRun || e.timestamp > m.lastRun) m.lastRun = e.timestamp;
  }
  return metrics;
}

function seedDefaultEngineMetrics(metrics: Record<string, EngineMetrics>): void {
  const defaults = ["devEdit", "readerPersonas", "multiFormat", "research", "outline", "write", "blueprint", "intelligence"];
  for (const id of defaults) {
    if (!metrics[id]) {
      metrics[id] = {
        engineId:             id,
        engineName:           ENGINE_NAMES[id] || id,
        totalRuns:            0,
        successRate:          1.0,
        averageConfidence:    0,
        averageQualityImpact: 0,
        lastRun:              null,
        version:              "1.0",
      };
    }
  }
}

function extractQualityScores(devEdit: unknown, bh: unknown[]): number[] {
  const scores: number[] = [];
  if (devEdit && typeof devEdit === "object" && "overallPublishingScore" in devEdit) {
    const s = (devEdit as Record<string, number>).overallPublishingScore;
    if (typeof s === "number") scores.push(s);
  }
  for (const b of bh) {
    if (b && typeof b === "object" && "overallPublishingScore" in b) {
      const s = (b as Record<string, number>).overallPublishingScore;
      if (typeof s === "number") scores.push(s);
    }
  }
  return scores;
}

function extractRevisionPatterns(): RevisionPattern[] {
  const patterns: RevisionPattern[] = [];
  const keys = Object.keys(window.localStorage).filter(k => k.startsWith("nonfiction-ai-"));
  const chapterKeys = keys.filter(k => k.includes("chapter"));
  if (chapterKeys.length > 0) {
    patterns.push({
      component:        "chapter",
      revisionCount:    chapterKeys.length,
      averageRevisions: 1,
      mostRevised:      [],
    });
  }
  return patterns;
}

export function collectAnalytics(): PlatformAnalytics {
  const events   = getGenerationEvents();
  const trend    = getQualityTrend();
  const devEdit  = safeRead(EXISTING_KEYS.devEdit);
  const bhRaw    = safeRead(EXISTING_KEYS.benchHistory);
  const bh       = Array.isArray(bhRaw) ? bhRaw : [];
  const rp       = safeRead(EXISTING_KEYS.readerPersona) as Record<string, unknown> | null;
  const mf       = safeRead(EXISTING_KEYS.multiFormat) as Record<string, unknown> | null;

  const qualityScores = extractQualityScores(devEdit, bh);
  const avgQuality    = qualityScores.length > 0
    ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : 0;

  const weaknesses: string[] = [];
  const strengths:  string[] = [];
  if (devEdit && typeof devEdit === "object" && "categories" in devEdit) {
    const cats = (devEdit as Record<string, Record<string, unknown>>).categories || {};
    for (const [key, val] of Object.entries(cats)) {
      const score = typeof val === "object" && val !== null && "score" in val
        ? Number((val as Record<string, unknown>).score) : 0;
      if (score < 7.0) weaknesses.push(key);
      if (score >= 8.5) strengths.push(key);
    }
  }

  const archetypes: Record<string, number> = {};
  for (const b of bh) {
    if (b && typeof b === "object" && "archetype" in b) {
      const a = String((b as Record<string, unknown>).archetype);
      archetypes[a] = (archetypes[a] || 0) + 1;
    }
  }

  const topFormats: string[] = [];
  if (mf && Array.isArray(mf.recommendedFormats)) {
    topFormats.push(...(mf.recommendedFormats as Array<Record<string, string>>)
      .slice(0, 3).map(f => f.formatName || ""));
  }

  const enginePerformance = buildEngineMetrics(events);
  seedDefaultEngineMetrics(enginePerformance);

  if (devEdit) {
    const m = enginePerformance["devEdit"];
    if (m.totalRuns === 0) { m.totalRuns = 1; m.averageConfidence = 0.85; m.averageQualityImpact = avgQuality || 7.5; m.lastRun = new Date().toISOString(); }
  }
  if (rp) {
    const m = enginePerformance["readerPersonas"];
    if (m.totalRuns === 0) { m.totalRuns = 1; m.averageConfidence = 0.8; m.averageQualityImpact = 7.8; m.lastRun = new Date().toISOString(); }
  }
  if (mf) {
    const m = enginePerformance["multiFormat"];
    if (m.totalRuns === 0) { m.totalRuns = 1; m.averageConfidence = 0.82; m.averageQualityImpact = 7.6; m.lastRun = new Date().toISOString(); }
  }

  const analytics: PlatformAnalytics = {
    collectedAt:          new Date().toISOString(),
    sessionCount:         Math.max(1, Math.ceil(events.length / 5) || 1),
    totalGenerations:     events.length,
    totalProjects:        1,
    averageQualityScore:  Math.round(avgQuality * 10) / 10,
    qualityTrend:         trend.slice(-20),
    enginePerformance,
    mostCommonWeaknesses: weaknesses.slice(0, 5),
    mostCommonStrengths:  strengths.slice(0, 5),
    publishingArchetypes: archetypes,
    generationStrategies: {},
    revisionPatterns:     extractRevisionPatterns(),
    ruleEffectiveness:    {},
    averageRevisionCount: 0,
    topFormats,
    qualityDistribution: {
      low:    qualityScores.filter(s => s < 6.5).length,
      medium: qualityScores.filter(s => s >= 6.5 && s < 8.0).length,
      high:   qualityScores.filter(s => s >= 8.0).length,
    },
  };

  safeWrite(ANALYTICS_KEY, analytics);
  return analytics;
}

export function getCachedAnalytics(): PlatformAnalytics | null {
  try {
    const cached = window.localStorage.getItem(ANALYTICS_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch { return null; }
}
