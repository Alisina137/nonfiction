import type { PlatformRule, RuleSet, RuleCategory } from "./types.js";

const RULES_STORAGE_KEY = "nonfiction-ai-intelligence-rules";

const now = () => new Date().toISOString();

function makeRule(
  id: string, category: RuleCategory, name: string,
  description: string, condition: string, action: string,
  weight: number, effectivenessScore: number
): PlatformRule {
  const ts = now();
  return {
    id, category, name, description, condition, action,
    status: "active", enabled: true, weight,
    triggerCount: 0, effectivenessScore,
    lastTriggered: null, version: 1,
    createdAt: ts, updatedAt: ts,
  };
}

const DEFAULT_RULES: PlatformRule[] = [
  makeRule("wr-001","writing","Practical Examples Required",
    "Every major concept must include at least one practical example.",
    "conceptIntroduced && exampleCount === 0","flag for example addition",0.9,8.5),
  makeRule("wr-002","writing","Active Voice Preference",
    "Writing should prefer active voice for clarity and engagement.",
    "passiveVoiceRatio > 0.25","suggest active voice revision",0.7,7.2),
  makeRule("wr-003","writing","Chapter Length Balance",
    "Chapter word counts should be within 20% of each other for consistency.",
    "chapterLengthVariance > 0.2","flag for length adjustment",0.6,6.8),
  makeRule("wr-004","writing","Implementation Density",
    "At least 40% of content should be actionable implementation guidance.",
    "implementationRatio < 0.4","increase practical content",0.85,8.9),
  makeRule("ed-001","editorial","Readability Threshold",
    "Published score should be at least 7.0/10 for editorial quality.",
    "overallPublishingScore < 7.0","trigger developmental edit pass",1.0,9.1),
  makeRule("ed-002","editorial","Concept Repetition Limit",
    "Core concepts should not be restated more than 3 times without new framing.",
    "conceptRepetitionCount > 3","suggest fresh framing or removal",0.65,7.0),
  makeRule("ed-003","editorial","Reader Engagement Score",
    "Reader experience score should not fall below 6.5 for any persona.",
    "minReaderPersonaScore < 6.5","flag low-engagement sections for revision",0.8,8.2),
  makeRule("bp-001","blueprint","Framework Density",
    "Each book should contain 2–5 named frameworks to aid reader recall.",
    "frameworkCount < 2 || frameworkCount > 5","adjust framework density",0.75,7.8),
  makeRule("bp-002","blueprint","Exercise Per Chapter",
    "Each chapter should contain at least one practical exercise.",
    "chaptersWithoutExercise > 0","add exercise to flagged chapters",0.8,8.4),
  makeRule("bp-003","blueprint","Story Distribution",
    "Stories and examples should be distributed across chapters, not front-loaded.",
    "storyDistributionVariance > 0.4","redistribute stories across chapters",0.7,7.3),
  makeRule("ol-001","outline","Progressive Complexity",
    "Chapters should increase in complexity progressively.",
    "complexityTrendIsFlat || complexityTrendDeclines","reorder or restructure chapters",0.75,7.6),
  makeRule("ol-002","outline","Chapter Count Range",
    "Non-fiction books perform best with 7–12 chapters.",
    "chapterCount < 7 || chapterCount > 12","suggest chapter consolidation or expansion",0.6,6.5),
  makeRule("re-001","research","Competitor Analysis Depth",
    "Competitive analysis should include at least 5 comparable titles.",
    "competitorCount < 5","deepen competitive research",0.65,7.1),
  makeRule("re-002","research","Market Positioning Clarity",
    "Book positioning must be clearly differentiated from top competitors.",
    "positioningScore < 7.0","strengthen unique angle",0.85,8.7),
  makeRule("pu-001","publishing","Back Matter Completeness",
    "All published books must include acknowledgments, references, and author bio.",
    "backMatterCompleteness < 1.0","complete missing back matter sections",0.9,8.0),
  makeRule("pu-002","publishing","Multi-Format Readiness",
    "Content reuse ratio for secondary formats should exceed 50%.",
    "contentReuseRatio < 0.5","improve content modularity",0.7,7.4),
  makeRule("rx-001","reader_experience","Persona Coverage",
    "Book must resonate with primary reader persona at score ≥ 7.5.",
    "primaryPersonaScore < 7.5","improve primary audience alignment",0.9,8.8),
  makeRule("rx-002","reader_experience","Transformation Clarity",
    "Transformation promise (before→after) must be explicit and measurable.",
    "transformationClarityScore < 7.0","clarify reader transformation promise",0.85,8.5),
  makeRule("bm-001","benchmark","Market Position Score",
    "Book should score ≥ 7.0 overall against benchmark archetype.",
    "benchmarkOverallScore < 7.0","address benchmark gap areas",1.0,9.0),
  makeRule("bm-002","benchmark","Commercial Potential Threshold",
    "Commercial potential score must reach ≥ 7.5 before proceeding to export.",
    "commercialPotential < 7.5","strengthen commercial appeal",0.8,8.1),
];

export function getActiveRuleSet(): RuleSet {
  try {
    const stored = window.localStorage.getItem(RULES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as RuleSet;
      if (parsed?.rules?.length) return parsed;
    }
  } catch { /* ignore */ }
  const ruleSet: RuleSet = {
    version: 1,
    createdAt: now(),
    description: "Default platform rule set — v1.0",
    rules: DEFAULT_RULES,
  };
  saveRuleSet(ruleSet);
  return ruleSet;
}

export function saveRuleSet(ruleSet: RuleSet): void {
  try { window.localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(ruleSet)); } catch { /* ignore */ }
}

export function updateRule(id: string, changes: Partial<PlatformRule>): RuleSet {
  const ruleSet = getActiveRuleSet();
  const idx = ruleSet.rules.findIndex(r => r.id === id);
  if (idx === -1) return ruleSet;
  ruleSet.rules[idx] = {
    ...ruleSet.rules[idx],
    ...changes,
    version: ruleSet.rules[idx].version + 1,
    updatedAt: now(),
  };
  ruleSet.version += 1;
  saveRuleSet(ruleSet);
  return ruleSet;
}

export function toggleRule(id: string): RuleSet {
  const ruleSet = getActiveRuleSet();
  const rule = ruleSet.rules.find(r => r.id === id);
  if (!rule) return ruleSet;
  return updateRule(id, { enabled: !rule.enabled });
}

export function getRulesByCategory(category: RuleCategory): PlatformRule[] {
  return getActiveRuleSet().rules.filter(r => r.category === category && r.enabled);
}

export function recordRuleTrigger(ruleId: string, qualityImpact: number): void {
  const ruleSet = getActiveRuleSet();
  const rule = ruleSet.rules.find(r => r.id === ruleId);
  if (!rule) return;
  rule.triggerCount++;
  rule.lastTriggered = now();
  rule.effectivenessScore = Math.min(10, Math.max(0,
    rule.effectivenessScore * 0.9 + qualityImpact * 10 * 0.1
  ));
  rule.updatedAt = now();
  saveRuleSet(ruleSet);
}

export function evaluateRuleEffectiveness(): Record<string, number> {
  const ruleSet = getActiveRuleSet();
  return Object.fromEntries(ruleSet.rules.map(r => [r.id, r.effectivenessScore]));
}

export function getRarelytriggeredRules(): PlatformRule[] {
  const ruleSet = getActiveRuleSet();
  return ruleSet.rules.filter(r => r.enabled && r.triggerCount === 0);
}

export function getConflictingRules(): Array<[PlatformRule, PlatformRule]> {
  const ruleSet = getActiveRuleSet();
  const conflicts: Array<[PlatformRule, PlatformRule]> = [];
  for (let i = 0; i < ruleSet.rules.length; i++) {
    for (let j = i + 1; j < ruleSet.rules.length; j++) {
      const a = ruleSet.rules[i];
      const b = ruleSet.rules[j];
      if (a.category === b.category && a.enabled && b.enabled &&
          a.effectivenessScore < 5 && b.effectivenessScore > 8) {
        conflicts.push([a, b]);
      }
    }
  }
  return conflicts;
}
