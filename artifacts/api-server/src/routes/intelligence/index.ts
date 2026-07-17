import { Router } from "express";
import { generateContent, extractJSON } from "../ai/aiRouter.js";
import { systemPrompt } from "../ai/prompts.js";

const router = Router();

function aiErrorResponse(res: any, error: any) {
  const message = error?.message || "Intelligence service error";
  return res.status(error?.status || 500).json({ error: message });
}

function buildIntelligencePrompt(payload: {
  analytics: {
    averageQualityScore: number;
    qualityDistribution: { low: number; medium: number; high: number };
    mostCommonWeaknesses: string[];
    mostCommonStrengths: string[];
    totalGenerations: number;
    topFormats: string[];
    enginePerformance: Record<string, { totalRuns: number; averageQualityImpact: number }>;
  };
  ruleEffectiveness: Record<string, number>;
  activeRuleCount: number;
  engines: string[];
  platformVersion: string;
}): string {
  const { analytics } = payload;
  return `You are the Platform Intelligence Advisor for Nonfiction AI Studio — a professional nonfiction book writing system.

Analyse the platform analytics snapshot below and generate 5–7 specific, actionable improvement recommendations.

Platform Version: ${payload.platformVersion}
Active Engines: ${payload.engines.join(", ")}
Active Rules: ${payload.activeRuleCount}

ANALYTICS SNAPSHOT:
- Average Quality Score: ${analytics.averageQualityScore.toFixed(1)}/10
- Quality Distribution: ${analytics.qualityDistribution.low} low / ${analytics.qualityDistribution.medium} medium / ${analytics.qualityDistribution.high} high
- Total Generation Events: ${analytics.totalGenerations}
- Most Common Weaknesses: ${analytics.mostCommonWeaknesses.join(", ") || "none detected"}
- Most Common Strengths: ${analytics.mostCommonStrengths.join(", ") || "none detected"}
- Top Publishing Formats: ${analytics.topFormats.join(", ") || "none"}

ENGINE PERFORMANCE:
${Object.entries(analytics.enginePerformance)
  .map(([id, m]) => `  ${id}: ${m.totalRuns} runs, avg quality impact ${m.averageQualityImpact.toFixed(1)}`)
  .join("\n") || "  No engine data yet"}

RULE EFFECTIVENESS (rule_id → score 0–10):
${Object.entries(payload.ruleEffectiveness)
  .map(([id, score]) => `  ${id}: ${score.toFixed(1)}`)
  .slice(0, 10).join("\n") || "  No rule data yet"}

REQUIREMENTS:
1. Generate 5–7 specific, actionable recommendations
2. Each recommendation must require HUMAN APPROVAL before taking effect
3. Never suggest copying user content or accessing other users' data
4. Focus on: writing quality, editorial standards, rule refinements, engine tuning, or knowledge library improvements
5. If analytics show no data yet, generate foundational platform improvement recommendations

Return ONLY valid JSON in this exact structure:
{
  "recommendations": [
    {
      "type": "rule_improvement" | "strategy" | "template" | "threshold" | "engine",
      "title": "string (concise, action-oriented, max 60 chars)",
      "description": "string (what to change and how, max 200 chars)",
      "rationale": "string (why this improves quality, max 150 chars)",
      "priority": "high" | "medium" | "low",
      "status": "pending",
      "aiGenerated": true,
      "affectedRules": ["rule-id-1"],
      "expectedImpact": "string (measurable expected improvement, max 100 chars)",
      "confidence": 0.0
    }
  ]
}`;
}

router.post("/recommendations/generate", async (req, res) => {
  try {
    const payload = req.body || {};
    const prompt  = buildIntelligencePrompt(payload);

    const { text } = await generateContent(prompt, systemPrompt(), {});
    const data      = extractJSON(text);

    const str  = (v: unknown, d = "")  => (typeof v === "string" ? v.trim() : d);
    const arr  = (v: unknown)           => (Array.isArray(v) ? v : []);
    const num  = (v: unknown, d = 0.7) => (typeof v === "number" && isFinite(v) ? Math.min(1, Math.max(0, v)) : d);
    const prio = (v: unknown) => ["high","medium","low"].includes(String(v)) ? String(v) : "medium";
    const type = (v: unknown) => ["rule_improvement","strategy","template","threshold","engine"].includes(String(v)) ? String(v) : "strategy";

    const recommendations = arr(data.recommendations).map((r: unknown) => {
      const rec = r as Record<string, unknown>;
      return {
        type:           type(rec.type),
        title:          str(rec.title, "Platform improvement"),
        description:    str(rec.description),
        rationale:      str(rec.rationale),
        priority:       prio(rec.priority),
        status:         "pending" as const,
        aiGenerated:    true,
        affectedRules:  arr(rec.affectedRules).map(String),
        expectedImpact: str(rec.expectedImpact),
        confidence:     num(rec.confidence, 0.7),
      };
    }).filter((r: { title: string }) => r.title.length > 3);

    return res.json({ recommendations, _count: recommendations.length });
  } catch (error: unknown) {
    return aiErrorResponse(res, error);
  }
});

router.get("/health", (_req, res) => {
  return res.json({
    status:     "ok",
    service:    "platform-intelligence",
    version:    "1.0",
    timestamp:  new Date().toISOString(),
    features: [
      "analytics-collection",
      "rule-evaluation",
      "recommendation-generation",
      "version-management",
      "engine-performance-monitoring",
      "knowledge-library",
      "experiment-support",
    ],
  });
});

router.get("/analytics", (_req, res) => {
  return res.json({
    message:   "Platform analytics are collected client-side and stored in localStorage for privacy.",
    note:      "Send analytics to POST /recommendations/generate to receive AI recommendations.",
    timestamp: new Date().toISOString(),
  });
});

export default router;
