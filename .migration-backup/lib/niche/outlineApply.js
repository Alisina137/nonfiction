import { NICHE_BLUEPRINTS } from "@/lib/niche/blueprints";

function safeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Convert AI niche-outline response into bookOutline.chapters tree.
 */
export function applyNicheOutlineToBookOutline(aiPayload, architecture) {
  const chapters = Array.isArray(aiPayload?.chapters) ? aiPayload.chapters : [];
  const secsPer = architecture?.sectionsPerChapter ?? 2;
  const subsPer = architecture?.subsectionsPerSection ?? 2;
  const defaultChWords = Math.max(
    800,
    Math.round((architecture?.recommendedWordCount?.midpoint || 50000) / Math.max(chapters.length, 1))
  );

  const mapped = chapters.map((ch, ci) => {
    const aiSections = Array.isArray(ch.sections) ? ch.sections : [];
    const sectionCount = Math.max(aiSections.length, secsPer);
    const secWords = Math.max(200, Math.round(defaultChWords / Math.max(sectionCount, 1)));

    const sections = Array.from({ length: sectionCount }, (_, si) => {
      const fromAi = aiSections[si];
      const aiSubs = fromAi && Array.isArray(fromAi.subsections) ? fromAi.subsections : [];
      const subCount = Math.max(aiSubs.length, subsPer);
      const subWords = Math.max(120, Math.round(secWords / Math.max(subCount, 1)));

      const subsections = Array.from({ length: subCount }, (_, qi) => ({
        id: safeId(),
        title: aiSubs[qi]?.title || fromAi?.title || `Beat ${qi + 1}`,
        words: subWords
      }));

      return {
        id: safeId(),
        title: fromAi?.title || `Section ${si + 1}`,
        words: secWords,
        expanded: true,
        subsections
      };
    });

    return {
      id: safeId(),
      title: ch.title || `Chapter ${ci + 1}`,
      words: defaultChWords,
      expanded: true,
      sections,
      arcRole: ch.arcRole || "",
      summary: ch.summary || ""
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
