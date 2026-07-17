export type RuleCategory =
  | "writing" | "editorial" | "blueprint" | "outline"
  | "research" | "publishing" | "reader_experience" | "benchmark";

export type RuleStatus = "active" | "inactive" | "deprecated";
export type RecommendationStatus = "pending" | "approved" | "rejected";
export type RecommendationPriority = "high" | "medium" | "low";
export type RecommendationType =
  | "rule_improvement" | "strategy" | "template" | "threshold" | "engine";

export interface PlatformRule {
  id: string;
  category: RuleCategory;
  name: string;
  description: string;
  condition: string;
  action: string;
  status: RuleStatus;
  enabled: boolean;
  weight: number;
  triggerCount: number;
  effectivenessScore: number;
  lastTriggered: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RuleSet {
  version: number;
  createdAt: string;
  description: string;
  rules: PlatformRule[];
}

export interface QualityDataPoint {
  date: string;
  overallScore: number;
  editorialScore: number;
  benchmarkScore: number;
  readerScore: number;
  publishingReadiness: number;
  projectId: string;
}

export interface EngineMetrics {
  engineId: string;
  engineName: string;
  totalRuns: number;
  successRate: number;
  averageConfidence: number;
  averageQualityImpact: number;
  lastRun: string | null;
  version: string;
}

export interface RevisionPattern {
  component: string;
  revisionCount: number;
  averageRevisions: number;
  mostRevised: string[];
}

export interface PlatformAnalytics {
  collectedAt: string;
  sessionCount: number;
  totalGenerations: number;
  totalProjects: number;
  averageQualityScore: number;
  qualityTrend: QualityDataPoint[];
  enginePerformance: Record<string, EngineMetrics>;
  mostCommonWeaknesses: string[];
  mostCommonStrengths: string[];
  publishingArchetypes: Record<string, number>;
  generationStrategies: Record<string, number>;
  revisionPatterns: RevisionPattern[];
  ruleEffectiveness: Record<string, number>;
  averageRevisionCount: number;
  topFormats: string[];
  qualityDistribution: { low: number; medium: number; high: number };
}

export interface PlatformRecommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  rationale: string;
  priority: RecommendationPriority;
  status: RecommendationStatus;
  aiGenerated: boolean;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  affectedRules: string[];
  expectedImpact: string;
  confidence: number;
}

export interface KnowledgeAsset {
  id: string;
  type: "framework" | "exercise" | "story" | "teaching" | "transition" | "blueprint" | "publishing";
  name: string;
  description: string;
  template: string;
  tags: string[];
  usageCount: number;
  effectivenessScore: number;
  version: number;
  createdAt: string;
}

export interface VersionEntry {
  id: string;
  name: string;
  version: string;
  promptVersion: number;
  deployedAt: string;
  inputs: string[];
  outputs: string[];
  capabilities: string[];
}

export interface VersionRegistry {
  platformVersion: string;
  updatedAt: string;
  engines: Record<string, VersionEntry>;
  ruleSetsVersion: number;
  qualityMetricsVersion: number;
  knowledgeStructuresVersion: number;
}

export interface ExperimentConfig {
  id: string;
  name: string;
  description: string;
  type: "rule_set" | "generation_strategy" | "editorial_threshold" | "quality_threshold" | "benchmark_threshold";
  status: "draft" | "running" | "paused" | "completed";
  controlConfig: Record<string, unknown>;
  testConfig: Record<string, unknown>;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  results: Record<string, unknown> | null;
  notes: string;
}

export interface GenerationEvent {
  id: string;
  timestamp: string;
  engineId: string;
  projectId: string;
  qualityScore: number;
  confidence: number;
  rulesApplied: string[];
  duration: number;
  provider: string;
  metadata: Record<string, unknown>;
}

export interface IntelligenceReport {
  generatedAt: string;
  analytics: PlatformAnalytics;
  pendingRecommendations: PlatformRecommendation[];
  activeRuleSet: RuleSet;
  versionRegistry: VersionRegistry;
  experiments: ExperimentConfig[];
}
