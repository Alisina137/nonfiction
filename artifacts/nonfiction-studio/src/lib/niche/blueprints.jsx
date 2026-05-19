/**
 * Reusable structure blueprints — sub-niches reference these by `blueprintKey`
 * and may supply `overrides` for beats, pacing, or recommendations.
 */
export const NICHE_BLUEPRINTS = {
  "self-help-transformation": {
    structureType: "transformation",
    pacingType: "progressive",
    emotionalArc: "problem → mindset shift → framework → implementation → transformation",
    hookStyle: "relatable pain + promised identity shift",
    endingStyle: "integrated new self + clear next actions",
    chapterFlow: [
      "Wake-up call & cost of staying stuck",
      "Belief audit & reframes",
      "Core framework introduction",
      "Habit / system installation",
      "Obstacles & relapse prevention",
      "Identity consolidation",
      "Maintenance & expansion"
    ],
    bestsellerPatterns: ["single named system", "chapter action steps", "before/after vignettes"],
    readerPsychology: "Readers want hope, clarity, and proof they can change without overwhelm.",
    recommendedChapters: { min: 8, max: 12, default: 10 },
    recommendedWordCount: { band: "25k–35k", midpoint: 30000 },
    sectionsPerChapter: 3,
    subsectionsPerSection: 3
  },
  "business-framework": {
    structureType: "framework-driven",
    pacingType: "modular-execution",
    emotionalArc: "status quo pain → insight → system → execution → scale",
    hookStyle: "expensive problem + contrarian mechanism",
    endingStyle: "scaling roadmap + metric targets",
    chapterFlow: [
      "Market / operator pain",
      "Principles & mental models",
      "Core framework",
      "Implementation playbook",
      "Optimization & metrics",
      "Scale & leverage",
      "Case synthesis"
    ],
    bestsellerPatterns: ["numbered frameworks", "case studies", "checklists"],
    readerPsychology: "Readers buy outcomes, credibility, and copy-paste systems.",
    recommendedChapters: { min: 8, max: 14, default: 10 },
    recommendedWordCount: { band: "30k–40k", midpoint: 35000 },
    sectionsPerChapter: 3,
    subsectionsPerSection: 3
  },
  "romance-escalation": {
    structureType: "romance-arc",
    pacingType: "conflict-driven",
    emotionalArc: "attraction → friction → deepening → rupture → reconciliation",
    hookStyle: "spark + immediate tension",
    endingStyle: "earned emotional payoff (HEA/HFN)",
    chapterFlow: [
      "Meet & spark",
      "Friction & banter",
      "Forced proximity",
      "Vulnerability beat",
      "Midpoint intimacy",
      "External pressure",
      "Breakup / dark moment",
      "Grand gesture & reunion"
    ],
    bestsellerPatterns: ["tropes front-loaded", "third-act separation", "high emotion beats"],
    readerPsychology: "Readers crave tension, fantasy fulfillment, and emotional catharsis.",
    recommendedChapters: { min: 12, max: 22, default: 16 },
    recommendedWordCount: { band: "50k–70k", midpoint: 60000 },
    sectionsPerChapter: 2,
    subsectionsPerSection: 2
  },
  "romance-dark": {
    structureType: "romance-arc",
    pacingType: "intense-escalation",
    emotionalArc: "forbidden pull → danger → obsession → consequence → twisted resolution",
    hookStyle: "moral boundary + irresistible pull",
    endingStyle: "dark HEA or morally grey resolution",
    chapterFlow: [
      "Dangerous introduction",
      "Power imbalance reveal",
      "Consent & tension dance",
      "Point of no return",
      "Consequences",
      "Betrayal or test",
      "Climax confrontation",
      "Resolution (dark or redemptive)"
    ],
    bestsellerPatterns: ["content warnings upfront", "slow trust burn", "high stakes"],
    readerPsychology: "Readers want taboo tension with safety rails in craft.",
    recommendedChapters: { min: 14, max: 24, default: 18 },
    recommendedWordCount: { band: "55k–75k", midpoint: 65000 },
    sectionsPerChapter: 2,
    subsectionsPerSection: 2
  },
  "romantasy-hybrid": {
    structureType: "romantasy-hybrid",
    pacingType: "dual-track",
    emotionalArc: "fantasy stakes + romance line merging at climax",
    hookStyle: "world danger + fated tension",
    endingStyle: "battle won + relationship locked",
    chapterFlow: [
      "World & stakes",
      "Meet & magical bond",
      "Training / quest launch",
      "Romance midpoint",
      "Faction conflict",
      "Separation / betrayal",
      "War climax",
      "Romance + world resolution"
    ],
    bestsellerPatterns: ["quest + relationship parity", "mid-book bond shift"],
    readerPsychology: "Readers want epic stakes AND relationship payoff.",
    recommendedChapters: { min: 18, max: 28, default: 22 },
    recommendedWordCount: { band: "70k–100k", midpoint: 85000 },
    sectionsPerChapter: 2,
    subsectionsPerSection: 3
  },
  "thriller-psychological": {
    structureType: "suspense-escalation",
    pacingType: "tight-unreliable",
    emotionalArc: "normalcy → unease → paranoia → revelation → confrontation",
    hookStyle: "disturbing question on page one",
    endingStyle: "twist reveal + visceral climax",
    chapterFlow: [
      "Ordinary world crack",
      "First wrong detail",
      "Escalating clues",
      "False stability",
      "Midpoint shock",
      "Collapse of trust",
      "Reveal",
      "Confrontation & aftermath"
    ],
    bestsellerPatterns: ["unreliable narrator", "clock pressure", "mini-cliffhangers"],
    readerPsychology: "Readers want dread, misdirection, and a fair-play twist.",
    recommendedChapters: { min: 10, max: 18, default: 14 },
    recommendedWordCount: { band: "60k–80k", midpoint: 70000 },
    sectionsPerChapter: 2,
    subsectionsPerSection: 2
  },
  "thriller-procedural": {
    structureType: "mystery-procedural",
    pacingType: "clue-driven",
    emotionalArc: "crime → investigation → complications → breakthrough → justice",
    hookStyle: "body / crime in opening",
    endingStyle: "culprit unmasked + cost paid",
    chapterFlow: [
      "Inciting crime",
      "Detective / lead introduced",
      "Evidence trail",
      "Red herrings",
      "Personal cost",
      "Break in case",
      "Trap / chase",
      "Resolution"
    ],
    bestsellerPatterns: ["tick-tock chapters", "fair clues", "personal stake for lead"],
    readerPsychology: "Readers want puzzles, pace, and satisfying justice.",
    recommendedChapters: { min: 12, max: 20, default: 16 },
    recommendedWordCount: { band: "65k–85k", midpoint: 75000 },
    sectionsPerChapter: 2,
    subsectionsPerSection: 2
  },
  "fantasy-epic": {
    structureType: "hero-journey",
    pacingType: "escalating-scope",
    emotionalArc: "ordinary → call → trials → abyss → transformation → return",
    hookStyle: "world + looming threat",
    endingStyle: "final battle + new order",
    chapterFlow: [
      "World & normal",
      "Call to adventure",
      "Allies & rules",
      "First trials",
      "Midpoint power shift",
      "Darkest hour",
      "Gathering forces",
      "Final battle"
    ],
    bestsellerPatterns: ["deep worldbuilding", "power escalation", "faction politics"],
    readerPsychology: "Readers want immersion, awe, and earned victory.",
    recommendedChapters: { min: 18, max: 30, default: 24 },
    recommendedWordCount: { band: "90k–120k", midpoint: 105000 },
    sectionsPerChapter: 2,
    subsectionsPerSection: 3
  },
  "fantasy-progression": {
    structureType: "power-progression",
    pacingType: "level-up",
    emotionalArc: "weak → training → breakthroughs → rival → apex",
    hookStyle: "underdog + clear power path",
    endingStyle: "tier breakthrough + new horizon",
    chapterFlow: [
      "Low point & system reveal",
      "First gains",
      "Mentor / dungeon",
      "Rival appears",
      "Midpoint rank jump",
      "Setback",
      "Tournament / crisis",
      "Evolution climax"
    ],
    bestsellerPatterns: ["visible progression", "loot/skills", "competition arcs"],
    readerPsychology: "Readers want measurable growth and dopamine hits.",
    recommendedChapters: { min: 16, max: 26, default: 20 },
    recommendedWordCount: { band: "70k–100k", midpoint: 85000 },
    sectionsPerChapter: 2,
    subsectionsPerSection: 3
  },
  "scifi-speculative": {
    structureType: "concept-thriller",
    pacingType: "idea-driven",
    emotionalArc: "status quo → disruption → exploration → crisis → resolution",
    hookStyle: "what-if premise",
    endingStyle: "world changed + human cost",
    chapterFlow: [
      "Premise showcase",
      "Disruption event",
      "Exploration / rules",
      "Moral dilemma",
      "Escalation",
      "Point of no return",
      "Climax choice",
      "New equilibrium"
    ],
    bestsellerPatterns: ["hard/soft rules clear", "ethical hinge"],
    readerPsychology: "Readers want wonder plus grounded consequences.",
    recommendedChapters: { min: 12, max: 22, default: 16 },
    recommendedWordCount: { band: "70k–95k", midpoint: 82000 },
    sectionsPerChapter: 2,
    subsectionsPerSection: 2
  },
  "story-narrative": {
    structureType: "narrative-arc",
    pacingType: "emotional-flow",
    emotionalArc: "setup → rising emotion → crisis → growth → resolution",
    hookStyle: "character + emotional question",
    endingStyle: "cathartic resolution",
    chapterFlow: [
      "Character & world",
      "Inciting moment",
      "Rising complications",
      "Emotional midpoint",
      "Crisis",
      "Dark moment",
      "Turn",
      "Resolution"
    ],
    bestsellerPatterns: ["strong voice", "scene sequels", "thematic closure"],
    readerPsychology: "Readers want to feel, relate, and finish satisfied.",
    recommendedChapters: { min: 8, max: 16, default: 12 },
    recommendedWordCount: { band: "20k–35k", midpoint: 28000 },
    sectionsPerChapter: 2,
    subsectionsPerSection: 2
  }
};

export const BLUEPRINT_OPTIONS = Object.keys(NICHE_BLUEPRINTS).map((key) => ({
  key,
  label: key.replace(/-/g, " ")
}));
