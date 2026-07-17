import type { KnowledgeAsset } from "./types.js";

const LIBRARY_KEY = "nonfiction-ai-intelligence-knowledge-library";

const DEFAULT_ASSETS: Omit<KnowledgeAsset, "createdAt">[] = [
  {
    id: "ft-001", type: "framework", name: "3-Step Transformation Framework",
    description: "Guides reader from current state through transition to desired outcome.",
    template: "Step 1: Diagnose the current state → Step 2: Apply the core method → Step 3: Sustain the new state",
    tags: ["transformation", "3-step", "practical"], usageCount: 0, effectivenessScore: 8.5, version: 1,
  },
  {
    id: "ft-002", type: "framework", name: "Problem-Solution-Result Framework",
    description: "Classic PSR arc for non-fiction chapters.",
    template: "Problem: [what the reader struggles with] → Solution: [the method] → Result: [measurable outcome]",
    tags: ["PSR", "chapter-structure", "clarity"], usageCount: 0, effectivenessScore: 8.2, version: 1,
  },
  {
    id: "ft-003", type: "framework", name: "The Belief Bridge",
    description: "Moves reader from limiting belief to empowering belief.",
    template: "Old belief: [limitation] → Evidence against: [counter-examples] → New belief: [empowering reframe]",
    tags: ["mindset", "belief", "transformation"], usageCount: 0, effectivenessScore: 7.9, version: 1,
  },
  {
    id: "ft-004", type: "framework", name: "The Staircase Framework",
    description: "Progressive skill-building from foundation to mastery.",
    template: "Foundation → Core Skill → Advanced Application → Mastery → Teaching Others",
    tags: ["progression", "skill-building", "mastery"], usageCount: 0, effectivenessScore: 8.0, version: 1,
  },
  {
    id: "ft-005", type: "framework", name: "The Diagnosis-Prescription Framework",
    description: "Identifies root cause before offering solution — used in business/productivity books.",
    template: "Symptoms: [what reader experiences] → Diagnosis: [root cause] → Prescription: [targeted solution]",
    tags: ["diagnosis", "root-cause", "business"], usageCount: 0, effectivenessScore: 8.3, version: 1,
  },
  {
    id: "ex-001", type: "exercise", name: "Self-Assessment Audit",
    description: "Reader evaluates current state before applying chapter content.",
    template: "Rate yourself 1–10 on [skill/behavior]. What specific examples support your rating? What would a 10 look like?",
    tags: ["self-assessment", "audit", "reflection"], usageCount: 0, effectivenessScore: 8.1, version: 1,
  },
  {
    id: "ex-002", type: "exercise", name: "30-Day Implementation Sprint",
    description: "Structured 30-day application of chapter concepts.",
    template: "Week 1: [foundation habit] | Week 2: [skill building] | Week 3: [integration] | Week 4: [optimization + review]",
    tags: ["implementation", "30-day", "accountability"], usageCount: 0, effectivenessScore: 8.6, version: 1,
  },
  {
    id: "ex-003", type: "exercise", name: "The Pre-Mortem Analysis",
    description: "Reader imagines failure before attempting implementation.",
    template: "Imagine it's 90 days from now and you failed to apply [concept]. What went wrong? Now plan to prevent those exact obstacles.",
    tags: ["pre-mortem", "planning", "obstacles"], usageCount: 0, effectivenessScore: 7.8, version: 1,
  },
  {
    id: "st-001", type: "story", name: "The Reluctant Convert",
    description: "Expert who resisted the method before embracing it — builds credibility.",
    template: "Meet [expert]. They were skeptical of [approach] until [turning point]. Here's what changed everything.",
    tags: ["credibility", "skeptic", "convert"], usageCount: 0, effectivenessScore: 8.3, version: 1,
  },
  {
    id: "st-002", type: "story", name: "The Common Mistake Story",
    description: "Shows reader the wrong path through a relatable example.",
    template: "[Person] did what most people do: [common mistake]. The result? [painful outcome]. There's a better way.",
    tags: ["mistake", "contrast", "warning"], usageCount: 0, effectivenessScore: 8.0, version: 1,
  },
  {
    id: "st-003", type: "story", name: "The Compounding Result",
    description: "Demonstrates exponential improvement through consistent application.",
    template: "After 30 days: [small improvement]. After 90 days: [notable change]. After 1 year: [dramatic transformation].",
    tags: ["compounding", "long-term", "results"], usageCount: 0, effectivenessScore: 7.7, version: 1,
  },
  {
    id: "tp-001", type: "teaching", name: "Tell-Show-Do Pattern",
    description: "Classic instructional design: explain, demonstrate, then have reader practice.",
    template: "TELL: Here's the principle. SHOW: Here's what it looks like in practice. DO: Now your turn — [exercise].",
    tags: ["instruction", "TSD", "practice"], usageCount: 0, effectivenessScore: 8.8, version: 1,
  },
  {
    id: "tp-002", type: "teaching", name: "Myth-Busting Opening",
    description: "Chapter opens by debunking a common misconception.",
    template: "Most people believe [common myth]. This seems logical but it's exactly wrong. Here's what actually works.",
    tags: ["myth", "contrast", "counterintuitive"], usageCount: 0, effectivenessScore: 8.4, version: 1,
  },
  {
    id: "tr-001", type: "transition", name: "The Forward Bridge",
    description: "Ends chapter by previewing what comes next and building anticipation.",
    template: "Now that you understand [current concept], you're ready to tackle [next concept] — which is where most people make the biggest mistake.",
    tags: ["bridge", "forward", "anticipation"], usageCount: 0, effectivenessScore: 7.6, version: 1,
  },
  {
    id: "pp-001", type: "publishing", name: "The Single-Reader Promise",
    description: "Dedication or preface addresses one specific reader archetype.",
    template: "This book is for the [specific person] who [specific situation]. If that's you, you're in exactly the right place.",
    tags: ["dedication", "targeting", "connection"], usageCount: 0, effectivenessScore: 8.2, version: 1,
  },
];

export function getKnowledgeLibrary(): KnowledgeAsset[] {
  try {
    const stored = window.localStorage.getItem(LIBRARY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as KnowledgeAsset[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  const ts  = new Date().toISOString();
  const lib = DEFAULT_ASSETS.map(a => ({ ...a, createdAt: ts }));
  saveKnowledgeLibrary(lib);
  return lib;
}

export function saveKnowledgeLibrary(assets: KnowledgeAsset[]): void {
  try { window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(assets)); } catch { /* ignore */ }
}

export function getAssetsByType(type: KnowledgeAsset["type"]): KnowledgeAsset[] {
  return getKnowledgeLibrary().filter(a => a.type === type);
}

export function getAssetById(id: string): KnowledgeAsset | undefined {
  return getKnowledgeLibrary().find(a => a.id === id);
}

export function recordAssetUsage(id: string, qualityImpact: number): void {
  const assets = getKnowledgeLibrary();
  const asset  = assets.find(a => a.id === id);
  if (!asset) return;
  asset.usageCount++;
  asset.effectivenessScore = Math.min(10, Math.max(0,
    asset.effectivenessScore * 0.9 + qualityImpact * 10 * 0.1
  ));
  saveKnowledgeLibrary(assets);
}

export function getMostEffectiveAssets(limit = 5): KnowledgeAsset[] {
  return [...getKnowledgeLibrary()]
    .sort((a, b) => b.effectivenessScore - a.effectivenessScore)
    .slice(0, limit);
}

export function getMostUsedAssets(limit = 5): KnowledgeAsset[] {
  return [...getKnowledgeLibrary()]
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, limit);
}
