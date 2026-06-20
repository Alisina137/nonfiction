import { NICHE_BLUEPRINTS } from "@/lib/niche/blueprints";

function safeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Dynamic outline scoring helpers ─────────────────────────────────────────

/**
 * Given chapters (with expansionScore), return the section count for each chapter
 * in the same original order.
 *
 * Rule:
 *   Top 2 by expansionScore  → 5 sections
 *   Bottom 3 by expansionScore → 3 sections
 *   All others               → 4 sections
 *
 * When n ≤ 5, "top 2" has higher priority than "bottom 3".
 */
export function assignSectionCounts(chapters) {
  const n = chapters.length;
  if (n === 0) return [];

  const sorted = chapters
    .map((ch, originalIndex) => ({ score: ch.expansionScore ?? 50, originalIndex }))
    .sort((a, b) => b.score - a.score);

  const counts = new Array(n).fill(4);

  // Bottom 3 → 3 (lower priority — set first)
  for (let i = Math.max(0, n - 3); i < n; i++) {
    counts[sorted[i].originalIndex] = 3;
  }
  // Top 2 → 5 (higher priority — overwrites)
  for (let i = 0; i < Math.min(2, n); i++) {
    counts[sorted[i].originalIndex] = 5;
  }

  return counts;
}

/**
 * Distribute `totalBudget` words across chapters proportionally based on
 * their composite score (importance * 0.4 + expansion * 0.4 + complexity * 0.2).
 *
 * Returns a parallel array of word counts that sum exactly to totalBudget.
 */
export function calculateWordDistribution(chapters, totalBudget) {
  if (chapters.length === 0) return [];

  const composites = chapters.map((ch) => {
    const imp = Math.max(1, ch.importanceScore ?? 50);
    const exp = Math.max(1, ch.expansionScore  ?? 50);
    const cmp = Math.max(1, ch.complexityScore ?? 50);
    return imp * 0.4 + exp * 0.4 + cmp * 0.2;
  });

  const total = composites.reduce((a, b) => a + b, 0) || chapters.length;
  const words = composites.map((score) => Math.max(300, Math.round((score / total) * totalBudget)));

  // Fix rounding so sum == totalBudget exactly
  const sum = words.reduce((a, b) => a + b, 0);
  const diff = totalBudget - sum;
  if (diff !== 0 && words.length > 0) {
    const maxIdx = composites.indexOf(Math.max(...composites));
    words[maxIdx] = Math.max(300, words[maxIdx] + diff);
  }

  return words;
}

/**
 * Build skeleton sections for a chapter (placeholder titles; user can then
 * click "✦ Sections" to replace them with AI-generated titles).
 */
function makeSkeletonSections(chapterIndex, sectionCount, chapterWords) {
  const secWords = Math.max(150, Math.round(chapterWords / Math.max(sectionCount, 1)));
  return Array.from({ length: sectionCount }, (_, si) => ({
    id:          safeId(),
    title:       `Section ${chapterIndex + 1}.${si + 1}`,
    objective:   "",
    words:       secWords,
    expanded:    true,
    subsections: [],
  }));
}

/**
 * Full dynamic outline transformer:
 *   1. Maps AI chapters to the outline data structure.
 *   2. Assigns section counts based on expansionScore (top 2 → 5, bottom 3 → 3, rest → 4).
 *   3. Distributes word counts dynamically from targetWords.
 *   4. Creates skeleton sections so the UI populates immediately.
 */
export function applyDynamicOutlineToBookOutline(aiPayload, architecture, targetWords) {
  const rawChapters = Array.isArray(aiPayload?.chapters) ? aiPayload.chapters : [];
  const n = rawChapters.length;
  if (n === 0) return { chapters: [], architectureNotes: "" };

  const budget = Math.max(1000, typeof targetWords === "number" ? targetWords : 45000);
  const reservePerEnd = Math.max(700, Math.round(budget * 0.035));
  const chapterBudget = Math.max(1000, budget - reservePerEnd * 2);

  const sectionCounts = assignSectionCounts(rawChapters);
  const wordCounts    = calculateWordDistribution(rawChapters, chapterBudget);

  const chapters = rawChapters.map((ch, ci) => {
    const title     = ch.title || ch.chapterTitle || `Chapter ${ci + 1}`;
    const objective = ch.chapterObjective || ch.summary || "";
    const chWords   = wordCounts[ci];
    const secCount  = sectionCounts[ci];

    return {
      id:              safeId(),
      title,
      objective,
      summary:         objective,
      arcRole:         ch.arcRole || "",
      importanceScore: ch.importanceScore ?? null,
      complexityScore: ch.complexityScore ?? null,
      expansionScore:  ch.expansionScore  ?? null,
      words:           chWords,
      expanded:        true,
      sections:        makeSkeletonSections(ci, secCount, chWords),
    };
  });

  return {
    chapters,
    architectureNotes: aiPayload.architectureNotes || "",
    introWords:  reservePerEnd,
    outroWords:  reservePerEnd,
  };
}

/**
 * Convert AI niche-outline response into bookOutline.chapters tree.
 *
 * Supports two output modes from the AI:
 *   1. Chapters-only (new spec): chapters with empty sections[] → keep empty,
 *      user will click "✦ Sections" per chapter to populate them.
 *   2. Full tree (legacy): chapters already contain sections + subsections.
 *
 * Field name compatibility:
 *   - chapter: ch.title OR ch.chapterTitle
 *   - chapter objective: ch.chapterObjective OR ch.summary
 *   - section: sec.title (legacy only)
 *   - subsection: sub.title (legacy only)
 */
export function applyNicheOutlineToBookOutline(aiPayload, architecture) {
  const chapters = Array.isArray(aiPayload?.chapters) ? aiPayload.chapters : [];
  const subsPer = architecture?.subsectionsPerSection ?? 2;
  const defaultChWords = Math.max(
    800,
    Math.round((architecture?.recommendedWordCount?.midpoint || 50000) / Math.max(chapters.length, 1))
  );

  const mapped = chapters.map((ch, ci) => {
    // Support both field names
    const chapterTitle     = ch.title || ch.chapterTitle || `Chapter ${ci + 1}`;
    const chapterObjective = ch.chapterObjective || ch.summary || "";

    const aiSections = Array.isArray(ch.sections) ? ch.sections : [];

    // CHAPTERS-ONLY MODE: AI returned empty sections[] — respect it.
    // User will generate sections per-chapter using "✦ Sections" button.
    if (aiSections.length === 0) {
      return {
        id:        safeId(),
        title:     chapterTitle,
        objective: chapterObjective,
        summary:   chapterObjective,
        arcRole:   ch.arcRole || "",
        words:     defaultChWords,
        expanded:  true,
        sections:  []
      };
    }

    // FULL TREE MODE (legacy): sections were provided inline by the AI
    const secWords = Math.max(200, Math.round(defaultChWords / Math.max(aiSections.length, 1)));

    const sections = aiSections.map((fromAi, si) => {
      const aiSubs = fromAi && Array.isArray(fromAi.subsections) ? fromAi.subsections : [];
      const subCount = Math.max(aiSubs.length, subsPer);
      const subWords = Math.max(120, Math.round(secWords / Math.max(subCount, 1)));

      const subsections = Array.from({ length: subCount }, (_, qi) => ({
        id:      safeId(),
        title:   aiSubs[qi]?.title || `Part ${qi + 1}`,
        intent:  aiSubs[qi]?.intent || "",
        purpose: aiSubs[qi]?.purpose || "",
        words:   subWords
      }));

      return {
        id:        safeId(),
        title:     fromAi?.title || `Section ${si + 1}`,
        objective: fromAi?.objective || "",
        words:     secWords,
        expanded:  true,
        subsections
      };
    });

    return {
      id:        safeId(),
      title:     chapterTitle,
      objective: chapterObjective,
      summary:   chapterObjective,
      arcRole:   ch.arcRole || "",
      words:     defaultChWords,
      expanded:  true,
      sections
    };
  });

  return {
    chapters: mapped,
    architectureNotes: aiPayload.architectureNotes || ""
  };
}

export function architectureDefaultsForDetails(architecture) {
  if (!architecture) return {};
  const band = architecture.recommendedWordCount?.band;
  return {
    chapterCount: architecture.recommendedChapters?.default,
    wordCountRange: band,
    genre: architecture.mainNicheLabel,
    structure: mapStructureType(architecture.structureType)
  };
}

function mapStructureType(structureType) {
  const map = {
    "framework-driven": "How-to",
    "transformation": "Problem-solution",
    "romance-arc": "Chronological",
    "romantasy-hybrid": "Hybrid / mixed",
    "suspense-escalation": "Chronological",
    "mystery-procedural": "Chronological",
    "hero-journey": "Chronological",
    "power-progression": "Modular",
    "concept-thriller": "Problem-solution",
    "narrative-arc": "Thematic"
  };
  return map[structureType] || "Thematic";
}

export function getBlueprintKeys() {
  return Object.keys(NICHE_BLUEPRINTS);
}
