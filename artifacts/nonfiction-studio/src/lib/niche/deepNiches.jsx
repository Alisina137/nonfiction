/**
 * Deep Niche map — third-level specialization beneath Main › Sub niche.
 * Keyed by Main Niche label → Sub-niche label → array of deep niche strings.
 *
 * Plus a lightweight rule-based audience detector so we can show market
 * insight without burning an AI call.
 */

/** Deep niches are now user-defined per sub-niche in the Niche Catalog Manager. */
export const DEEP_NICHE_MAP = {};

export function getDeepNiches(mainLabel, subLabel) {
  if (!mainLabel || !subLabel) return [];
  const branch = DEEP_NICHE_MAP[mainLabel];
  if (!branch) return [];
  return branch[subLabel] || [];
}

/**
 * Rule-based audience detection — keyword match on deep niche text.
 * Returns { audience, insight, opportunity } so we can show inline market intel.
 */
const AUDIENCE_RULES = [
  {
    match: /adhd/i,
    audience: "Distracted professionals and students, ages 18–40",
    insight: "High-conversion audience detected: ADHD readers searching for actionable systems.",
    opportunity: "Low-competition: ADHD productivity for students."
  },
  {
    match: /shadow work|inner child|reparent|abandonment|emotional neglect/i,
    audience: "Women 25–45 working through trauma and emotional healing",
    insight: "High-intent audience detected: emotionally exhausted women seeking healing tools.",
    opportunity: "Evergreen low-competition niche with strong word-of-mouth."
  },
  {
    match: /dopamine|digital (minimalism|detox|distraction)/i,
    audience: "Overthinkers and distracted knowledge workers, ages 20–40",
    insight: "Trending audience detected: burnt-out professionals seeking focus reset.",
    opportunity: "High-conversion opportunity: dopamine detox is a hot search term."
  },
  {
    match: /introvert|small talk|shy/i,
    audience: "Shy professionals and introverts, ages 22–40",
    insight: "Underserved audience detected: introverts who want practical scripts, not generic advice.",
    opportunity: "Low-competition opportunity: communication books specifically for introverts."
  },
  {
    match: /people[- ]pleas|assertiv|insecurity|self[- ]love|confidence/i,
    audience: "Women 25–45 ready to reclaim boundaries and self-worth",
    insight: "Engaged audience detected: readers ready to invest in self-confidence work.",
    opportunity: "Evergreen segment — bestseller-tested niche."
  },
  {
    match: /stoic|discipline|masculine|mindset for men/i,
    audience: "Men 20–40 pursuing self-mastery and discipline",
    insight: "High-spend audience detected: men investing in mindset and self-mastery.",
    opportunity: "Growing niche driven by social-media demand for stoic / discipline content."
  },
  {
    match: /millionaire|wealth|money mindset|goal achievement|success/i,
    audience: "Ambitious 20–45 readers chasing measurable career and money outcomes",
    insight: "High-intent audience detected: outcome-driven readers willing to pay for systems.",
    opportunity: "Competitive but lucrative — differentiate with a named framework."
  },
  {
    match: /meditation|spiritual healing|letting go|emotional freedom/i,
    audience: "Anxious adults 25–55 seeking gentle, practical inner work",
    insight: "Calm-seeking audience detected: readers looking for guided emotional healing.",
    opportunity: "Steady evergreen demand — pairs well with journal companions."
  },
  {
    match: /deep work|focus|procrastination/i,
    audience: "Knowledge workers and students fighting distraction",
    insight: "High-intent audience detected: professionals losing hours to distraction.",
    opportunity: "Strong cross-sell market with productivity & time-management buyers."
  },
  {
    match: /habit|consistency|90[- ]day|life reset/i,
    audience: "Self-improvers ages 20–45 hungry for a reset and a system",
    insight: "Motivated audience detected: people in a transition window ready to act.",
    opportunity: "Time-bound transformation books convert well on Amazon."
  },
  {
    match: /charisma|workplace communication/i,
    audience: "Early- and mid-career professionals improving their presence",
    insight: "Career-driven audience detected: readers tying skill to promotions and income.",
    opportunity: "Strong niche — pairs with leadership and career titles."
  }
];

export function detectAudience(deepLabel, fallbackSub = "") {
  const target = `${deepLabel || ""} ${fallbackSub || ""}`.trim();
  for (const rule of AUDIENCE_RULES) {
    if (rule.match.test(target))
      return { audience: rule.audience, insight: rule.insight, opportunity: rule.opportunity };
  }
  return {
    audience: `Readers actively searching for "${deepLabel || fallbackSub}" solutions`,
    insight: `Targeted audience detected for ${deepLabel || fallbackSub}.`,
    opportunity: "Focus on a specific reader pain to stand out in this niche."
  };
}

/**
 * Rich audience inference — returns an array of "for X" candidates so the
 * title generator can plug them into the audience-first formulas.
 * Keyed by keyword pattern on the deep niche (and sub-niche fallback).
 */
const AUDIENCE_CANDIDATE_RULES = [
  {
    match: /adhd/i,
    audiences: ["Students", "Distracted Professionals", "Entrepreneurs", "Remote Workers", "ADHD Adults"],
    painPoints: ["scattered focus", "missed deadlines", "task paralysis"],
    transformations: ["consistent deep focus", "finished projects", "calm productivity"]
  },
  {
    match: /shadow work|inner child|reparent|abandonment|emotional neglect/i,
    audiences: ["Women", "Trauma Survivors", "People Recovering From Toxic Relationships", "Emotionally Exhausted Adults"],
    painPoints: ["unresolved childhood wounds", "self-sabotage", "emotional flashbacks"],
    transformations: ["inner safety", "self-reparenting", "emotional freedom"]
  },
  {
    match: /dopamine|digital (minimalism|detox|distraction)/i,
    audiences: ["Overthinkers", "Distracted Professionals", "Burnt-Out Knowledge Workers", "Young Men"],
    painPoints: ["constant phone urge", "shallow attention", "low motivation"],
    transformations: ["restored focus", "natural motivation", "calm attention"]
  },
  {
    match: /introvert|small talk|shy/i,
    audiences: ["Introverts", "Shy Professionals", "Introverted Men", "Socially Anxious Adults"],
    painPoints: ["awkward conversations", "social drain", "fear of speaking up"],
    transformations: ["effortless conversation", "quiet confidence", "energized social skill"]
  },
  {
    match: /people[- ]pleas|assertiv/i,
    audiences: ["Women", "People-Pleasers", "Codependent Adults", "Recovering Yes-Sayers"],
    painPoints: ["over-giving", "resentment", "loss of self"],
    transformations: ["clear boundaries", "self-trust", "guilt-free no"]
  },
  {
    match: /insecurity|self[- ]love|confidence|self[- ]esteem/i,
    audiences: ["Women", "Teen Girls", "Introverts", "Socially Anxious Adults", "Women Who Overthink"],
    painPoints: ["self-doubt", "comparison spirals", "fear of judgment"],
    transformations: ["unshakable confidence", "self-worth", "inner steadiness"]
  },
  {
    match: /stoic|discipline|masculine|mindset for men/i,
    audiences: ["Young Men", "Ambitious Men", "Entrepreneurs", "High Performers", "Distracted Young Adults"],
    painPoints: ["weak follow-through", "comfort addiction", "lack of direction"],
    transformations: ["unbreakable discipline", "stoic calm", "decisive action"]
  },
  {
    match: /millionaire|wealth|money mindset|goal achievement|success/i,
    audiences: ["Entrepreneurs", "Ambitious Men", "High Performers", "Young Professionals", "Side Hustlers"],
    painPoints: ["scattered goals", "imposter mindset", "stalled income"],
    transformations: ["systemized growth", "wealth-building habits", "decisive execution"]
  },
  {
    match: /meditation|spiritual healing|letting go|emotional freedom/i,
    audiences: ["Anxious Adults", "Overthinkers", "Burnt-Out Professionals", "Women in Transition"],
    painPoints: ["chronic anxiety", "stuck emotions", "racing mind"],
    transformations: ["inner calm", "emotional release", "grounded presence"]
  },
  {
    match: /deep work|focus|procrastination/i,
    audiences: ["Students", "Knowledge Workers", "Entrepreneurs", "Overthinkers", "Remote Workers"],
    painPoints: ["constant distraction", "shallow output", "deadline panic"],
    transformations: ["deep focus sessions", "high-quality output", "calm momentum"]
  },
  {
    match: /habit|consistency|90[- ]day|life reset/i,
    audiences: ["Young Men", "Busy Moms", "Self-Improvers", "Burnt-Out Professionals"],
    painPoints: ["broken streaks", "motivation crashes", "stuck routine"],
    transformations: ["lasting habits", "daily momentum", "identity-level change"]
  },
  {
    match: /charisma|workplace communication/i,
    audiences: ["Early-Career Professionals", "Introverts at Work", "Aspiring Leaders", "Remote Workers"],
    painPoints: ["being overlooked", "weak presence", "meeting anxiety"],
    transformations: ["magnetic presence", "respected voice", "natural leadership"]
  },
  {
    match: /burnout|exhaust|overwhelm/i,
    audiences: ["Busy Moms", "Burnt-Out Professionals", "Caregivers", "High Achievers"],
    painPoints: ["chronic exhaustion", "emotional numbness", "guilt of rest"],
    transformations: ["sustainable energy", "recovered focus", "guilt-free rest"]
  }
];

export function inferAudienceProfile(deepLabel, fallbackSub = "") {
  const target = `${deepLabel || ""} ${fallbackSub || ""}`.trim();
  for (const rule of AUDIENCE_CANDIDATE_RULES) {
    if (rule.match.test(target)) {
      return {
        audiences: rule.audiences,
        painPoints: rule.painPoints,
        transformations: rule.transformations
      };
    }
  }
  // Generic fallback — always return something useful
  return {
    audiences: ["Students", "Entrepreneurs", "Busy Professionals", "Women", "Young Men"],
    painPoints: ["confusion", "stuck patterns", "lack of clarity"],
    transformations: ["clarity", "momentum", "lasting change"]
  };
}
