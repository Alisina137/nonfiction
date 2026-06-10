import { NICHE_BLUEPRINTS } from "@/lib/niche/blueprints";

function safeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Redistribute an array of word counts proportionally so they sum to `target`.
 * Handles rounding by adjusting the last element.
 */
function fixSums(counts, target) {
  if (!counts.length || target <= 0) return counts;
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) {
    const even = Math.round(target / counts.length);
    const result = counts.map(() => even);
    result[result.length - 1] = target - even * (counts.length - 1);
    return result;
  }
  const scaled = counts.map((c) => Math.max(1, Math.round((c / total) * target)));
  const diff = target - scaled.reduce((a, b) => a + b, 0);
  scaled[scaled.length - 1] = Math.max(1, scaled[scaled.length - 1] + diff);
  return scaled;
}

/**
 * Convert AI niche-outline response into bookOutline.chapters tree.
 *
 * New behaviour (Niche Native Outline engine):
 * - Uses AI-provided importance %, words at chapter, section, and subsection levels
 * - Applies a validation pass that corrects word-count sums at every level
 * - Supports dynamic 2–4 sections per chapter and 2–4 subsections per section
 */
export function applyNicheOutlineToBookOutline(aiPayload, architecture) {
  const chapters = Array.isArray(aiPayload?.chapters) ? aiPayload.chapters : [];

  const totalWords =
    Number(aiPayload?.totalWords) ||
    Number(architecture?.recommendedWordCount?.midpoint) ||
    45000;

  const chapterCount = chapters.length || 1;

  const mapped = chapters.map((ch, ci) => {
    const aiSections = Array.isArray(ch.sections) ? ch.sections : [];

    const chWords = Number(ch.words) > 0
      ? Number(ch.words)
      : Math.round(totalWords / chapterCount);

    const sections = aiSections.map((sec, si) => {
      const aiSubs = Array.isArray(sec.subsections) ? sec.subsections : [];

      const secWords = Number(sec.words) > 0
        ? Number(sec.words)
        : Math.round(chWords / Math.max(aiSections.length, 1));

      const subsections = aiSubs.map((sub, qi) => ({
        id: safeId(),
        title: sub.title || `${sec.title || "Section"}: Part ${qi + 1}`,
        words: Number(sub.words) > 0
          ? Number(sub.words)
          : Math.round(secWords / Math.max(aiSubs.length, 1)),
      }));

      return {
        id: safeId(),
        title: sec.title || `${ch.title || "Chapter"}: Section ${si + 1}`,
        importance: Number(sec.importance) > 0 ? Number(sec.importance) : undefined,
        words: secWords,
        expanded: true,
        subsections,
      };
    });

    return {
      id: safeId(),
      title: ch.title || `Chapter ${ci + 1}`,
      importance: Number(ch.importance) > 0 ? Number(ch.importance) : undefined,
      words: chWords,
      expanded: true,
      sections,
      arcRole: ch.arcRole || "",
      summary: ch.summary || "",
    };
  });

  // ── Validation pass ────────────────────────────────────────────────────────

  // 1. Fix subsection word sums within each section
  const pass1 = mapped.map((ch) => ({
    ...ch,
    sections: ch.sections.map((sec) => {
      if (!sec.subsections.length) return sec;
      const raw = sec.subsections.map((su) => su.words);
      const fixed = fixSums(raw, sec.words);
      return {
        ...sec,
        subsections: sec.subsections.map((su, i) => ({ ...su, words: fixed[i] })),
      };
    }),
  }));

  // 2. Fix section word sums within each chapter
  const pass2 = pass1.map((ch) => {
    if (!ch.sections.length) return ch;
    const raw = ch.sections.map((s) => s.words);
    const fixed = fixSums(raw, ch.words);
    const newSections = ch.sections.map((s, i) => {
      const newWords = fixed[i];
      if (newWords === s.words) return s;
      // Re-fix subsection sums when section words changed
      const subRaw = s.subsections.map((su) => su.words);
      const subFixed = fixSums(subRaw, newWords);
      return {
        ...s,
        words: newWords,
        subsections: s.subsections.map((su, qi) => ({ ...su, words: subFixed[qi] })),
      };
    });
    return { ...ch, sections: newSections };
  });

  // 3. Fix chapter word sums to match totalWords
  const rawChWords = pass2.map((ch) => ch.words);
  const fixedChWords = fixSums(rawChWords, totalWords);
  const pass3 = pass2.map((ch, ci) => {
    const newWords = fixedChWords[ci];
    if (newWords === ch.words) return ch;
    // Re-fix section sums when chapter words changed
    const secRaw = ch.sections.map((s) => s.words);
    const secFixed = fixSums(secRaw, newWords);
    const newSections = ch.sections.map((s, si) => {
      const sw = secFixed[si];
      if (sw === s.words) return s;
      const subRaw = s.subsections.map((su) => su.words);
      const subFixed = fixSums(subRaw, sw);
      return {
        ...s,
        words: sw,
        subsections: s.subsections.map((su, qi) => ({ ...su, words: subFixed[qi] })),
      };
    });
    return { ...ch, words: newWords, sections: newSections };
  });

  return {
    chapters: pass3,
    architectureNotes: aiPayload.architectureNotes || "",
  };
}

export function architectureDefaultsForDetails(architecture) {
  if (!architecture) return {};
  const band = architecture.recommendedWordCount?.band;
  return {
    chapterCount: architecture.recommendedChapters?.default,
    wordCountRange: band,
    genre: architecture.mainNicheLabel,
    structure: mapStructureType(architecture.structureType),
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
    "narrative-arc": "Thematic",
  };
  return map[structureType] || "Thematic";
}

export function getBlueprintKeys() {
  return Object.keys(NICHE_BLUEPRINTS);
}
