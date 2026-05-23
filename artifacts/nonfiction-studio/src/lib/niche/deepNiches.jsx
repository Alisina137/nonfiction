/**
 * Deep Niche map — third-level specialization beneath Main › Sub niche.
 * Keyed by Main Niche label → Sub-niche label → array of deep niche strings.
 *
 * Plus a lightweight rule-based audience detector so we can show market
 * insight without burning an AI call.
 */

export const DEEP_NICHE_MAP = {
  "Self-Help": {
    Success: [
      "Millionaire Mindset",
      "Stoic Success Principles",
      "Goal Achievement Systems",
      "Success Through Discipline"
    ],
    "Spiritual + Happiness": [
      "Spiritual Healing for Anxiety",
      "Letting Go & Emotional Freedom",
      "Meditation for Emotional Healing"
    ],
    "Time Management": [
      "ADHD Time Management",
      "Deep Work Focus",
      "Digital Distraction Detox",
      "Anti-Procrastination Systems"
    ],
    "Communication & Social Skills": [
      "Small Talk for Introverts",
      "Assertiveness Training",
      "Workplace Communication",
      "Charisma Building"
    ],
    "Inner Child": [
      "Shadow Work Journal",
      "Reparenting Yourself",
      "Healing Abandonment Wounds",
      "Emotional Neglect Recovery"
    ],
    Motivational: [
      "Discipline Over Motivation",
      "Success Mindset for Men",
      "Consistency & Habit Building"
    ],
    "Self-Esteem": [
      "Self-Love for Women",
      "Confidence for Introverts",
      "Healing Insecurity",
      "Overcoming People-Pleasing"
    ],
    "Personal Transformation": [
      "Dopamine Detox",
      "Masculine Discipline",
      "90-Day Life Reset",
      "Digital Minimalism"
    ]
  }
};

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
