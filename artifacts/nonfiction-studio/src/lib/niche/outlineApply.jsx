import { NICHE_BLUEPRINTS } from "@/lib/niche/blueprints";

function safeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
