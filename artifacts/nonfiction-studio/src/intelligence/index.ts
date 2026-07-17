export { intelligenceService } from "./intelligenceService.js";

export {
  getActiveRuleSet,
  saveRuleSet,
  updateRule,
  toggleRule,
  getRulesByCategory,
  recordRuleTrigger,
  evaluateRuleEffectiveness,
  getRarelytriggeredRules,
  getConflictingRules,
} from "./ruleEngine.js";

export {
  collectAnalytics,
  getCachedAnalytics,
  recordGenerationEvent,
  recordQualityDataPoint,
  getQualityTrend,
  getGenerationEvents,
} from "./analyticsCollector.js";

export {
  getKnowledgeLibrary,
  saveKnowledgeLibrary,
  getAssetsByType,
  getAssetById,
  recordAssetUsage,
  getMostEffectiveAssets,
  getMostUsedAssets,
} from "./knowledgeLibrary.js";

export {
  getVersionRegistry,
  saveVersionRegistry,
  registerEngine,
  bumpRuleSetVersion,
  bumpQualityMetricsVersion,
  getEngineVersion,
  PLATFORM_VERSION,
} from "./versionRegistry.js";

export type {
  RuleCategory,
  RuleStatus,
  RecommendationStatus,
  RecommendationPriority,
  RecommendationType,
  PlatformRule,
  RuleSet,
  QualityDataPoint,
  EngineMetrics,
  RevisionPattern,
  PlatformAnalytics,
  PlatformRecommendation,
  KnowledgeAsset,
  VersionEntry,
  VersionRegistry,
  ExperimentConfig,
  GenerationEvent,
  IntelligenceReport,
} from "./types.js";
