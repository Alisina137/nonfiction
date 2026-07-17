import type {
  IntelligenceReport, PlatformRecommendation, ExperimentConfig,
  GenerationEvent, QualityDataPoint,
} from "./types.js";
import { getActiveRuleSet, evaluateRuleEffectiveness } from "./ruleEngine.js";
import { collectAnalytics, getCachedAnalytics, recordGenerationEvent, recordQualityDataPoint } from "./analyticsCollector.js";
import { getKnowledgeLibrary } from "./knowledgeLibrary.js";
import { getVersionRegistry } from "./versionRegistry.js";

const RECS_KEY     = "nonfiction-ai-intelligence-recommendations";
const EXPTS_KEY    = "nonfiction-ai-intelligence-experiments";
const INIT_KEY     = "nonfiction-ai-intelligence-initialized";

function safeRead<T>(key: string, fallback: T): T {
  try { return JSON.parse(window.localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
}
function safeWrite(key: string, data: unknown): void {
  try { window.localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
}

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

class IntelligenceServiceSingleton {
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    const alreadySeeded = window.localStorage.getItem(INIT_KEY);
    if (!alreadySeeded) {
      getActiveRuleSet();
      getKnowledgeLibrary();
      getVersionRegistry();
      safeWrite(INIT_KEY, { version: "1.0", seededAt: new Date().toISOString() });
    }
  }

  getReport(): IntelligenceReport {
    this.initialize();
    const analytics    = collectAnalytics();
    analytics.ruleEffectiveness = evaluateRuleEffectiveness();
    const recs         = this.getRecommendations();
    return {
      generatedAt:            new Date().toISOString(),
      analytics,
      pendingRecommendations: recs.filter(r => r.status === "pending"),
      activeRuleSet:          getActiveRuleSet(),
      versionRegistry:        getVersionRegistry(),
      experiments:            this.getExperiments(),
    };
  }

  getAnalytics() {
    this.initialize();
    return getCachedAnalytics() ?? collectAnalytics();
  }

  getRecommendations(): PlatformRecommendation[] {
    return safeRead<PlatformRecommendation[]>(RECS_KEY, []);
  }

  addRecommendations(recs: Omit<PlatformRecommendation, "id" | "createdAt" | "approvedAt" | "rejectedAt">[]): void {
    const existing = this.getRecommendations();
    const next = [
      ...existing,
      ...recs.map(r => ({
        ...r,
        id:         uid(),
        createdAt:  new Date().toISOString(),
        approvedAt: null,
        rejectedAt: null,
      })),
    ];
    safeWrite(RECS_KEY, next);
  }

  approveRecommendation(id: string): void {
    const recs = this.getRecommendations();
    const rec  = recs.find(r => r.id === id);
    if (!rec || rec.status !== "pending") return;
    rec.status     = "approved";
    rec.approvedAt = new Date().toISOString();
    safeWrite(RECS_KEY, recs);
  }

  rejectRecommendation(id: string): void {
    const recs = this.getRecommendations();
    const rec  = recs.find(r => r.id === id);
    if (!rec || rec.status !== "pending") return;
    rec.status     = "rejected";
    rec.rejectedAt = new Date().toISOString();
    safeWrite(RECS_KEY, recs);
  }

  clearRecommendations(): void {
    safeWrite(RECS_KEY, []);
  }

  async generateAIRecommendations(): Promise<{ generated: number; error?: string }> {
    try {
      const analytics = collectAnalytics();
      analytics.ruleEffectiveness = evaluateRuleEffectiveness();
      const ruleSet   = getActiveRuleSet();
      const registry  = getVersionRegistry();

      const res = await fetch("/api/intelligence/recommendations/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          analytics: {
            averageQualityScore:  analytics.averageQualityScore,
            qualityDistribution:  analytics.qualityDistribution,
            mostCommonWeaknesses: analytics.mostCommonWeaknesses,
            mostCommonStrengths:  analytics.mostCommonStrengths,
            totalGenerations:     analytics.totalGenerations,
            topFormats:           analytics.topFormats,
            enginePerformance:    Object.fromEntries(
              Object.entries(analytics.enginePerformance)
                .map(([k, v]) => [k, { totalRuns: v.totalRuns, averageQualityImpact: v.averageQualityImpact }])
            ),
          },
          ruleEffectiveness: analytics.ruleEffectiveness,
          activeRuleCount:   ruleSet.rules.filter(r => r.enabled).length,
          engines:           Object.keys(registry.engines),
          platformVersion:   registry.platformVersion,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { generated: 0, error: (err as Record<string, string>).error || "Generation failed" };
      }

      const data = await res.json() as { recommendations: Omit<PlatformRecommendation, "id" | "createdAt" | "approvedAt" | "rejectedAt">[] };
      if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        this.addRecommendations(data.recommendations);
        return { generated: data.recommendations.length };
      }
      return { generated: 0 };
    } catch (e: unknown) {
      return { generated: 0, error: (e as Error).message || "Unknown error" };
    }
  }

  recordEngineCompletion(
    engineId: string,
    result: { qualityScore?: number; confidence?: number; provider?: string; rulesApplied?: string[] }
  ): void {
    const event: Omit<GenerationEvent, "id" | "timestamp"> = {
      engineId,
      projectId:    "local-" + (window.localStorage.getItem("nonfiction-ai-current-project-id") || "default"),
      qualityScore: result.qualityScore ?? 0,
      confidence:   result.confidence   ?? 0,
      rulesApplied: result.rulesApplied ?? [],
      duration:     0,
      provider:     result.provider     ?? "unknown",
      metadata:     {},
    };
    recordGenerationEvent(event);

    if (result.qualityScore && result.qualityScore > 0) {
      const qualityPoint: Omit<QualityDataPoint, "date"> = {
        overallScore:        result.qualityScore,
        editorialScore:      result.qualityScore,
        benchmarkScore:      result.qualityScore,
        readerScore:         result.qualityScore,
        publishingReadiness: result.qualityScore,
        projectId:           "local",
      };
      recordQualityDataPoint(qualityPoint);
    }
  }

  getExperiments(): ExperimentConfig[] {
    return safeRead<ExperimentConfig[]>(EXPTS_KEY, []);
  }

  createExperiment(config: Omit<ExperimentConfig, "id" | "createdAt" | "startedAt" | "completedAt" | "results">): ExperimentConfig {
    const experiments = this.getExperiments();
    const experiment: ExperimentConfig = {
      ...config,
      id:          uid(),
      createdAt:   new Date().toISOString(),
      startedAt:   null,
      completedAt: null,
      results:     null,
    };
    experiments.push(experiment);
    safeWrite(EXPTS_KEY, experiments);
    return experiment;
  }

  pauseExperiment(id: string): void {
    const experiments = this.getExperiments();
    const exp = experiments.find(e => e.id === id);
    if (exp && exp.status === "running") {
      exp.status = "paused";
      safeWrite(EXPTS_KEY, experiments);
    }
  }

  completeExperiment(id: string, results: Record<string, unknown>): void {
    const experiments = this.getExperiments();
    const exp = experiments.find(e => e.id === id);
    if (exp) {
      exp.status      = "completed";
      exp.completedAt = new Date().toISOString();
      exp.results     = results;
      safeWrite(EXPTS_KEY, experiments);
    }
  }

  exportReport(): string {
    const report = this.getReport();
    return JSON.stringify(report, null, 2);
  }
}

export const intelligenceService = new IntelligenceServiceSingleton();
