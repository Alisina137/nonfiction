/**
 * Book Memory — compresses all validated project data into a compact,
 * token-efficient context object that is passed to every AI generation call.
 *
 * Fields are strictly size-capped so the block stays under ~600 tokens
 * even when fully populated. Uses multi-source resolution (bookDetails >
 * proposedBook > research > intelligence) so whichever steps the user has
 * completed automatically improve later generations.
 */

import { resolveBookTitle } from "@/lib/projectMeta";

const CREATE_NEW_PERSONA_ID = "__create_new__";

function cap(v, max) {
  if (v == null) return "";
  const s = String(v).replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// ─── Active persona resolution ────────────────────────────────────────────────

export function getActivePersona(project) {
  const ap = project?.authorPersona || {};
  const saved = Array.isArray(ap.savedPersonas) ? ap.savedPersonas : [];
  const id = ap.selectedId;
  if (id && id !== CREATE_NEW_PERSONA_ID) {
    return saved.find((p) => p.id === id) || null;
  }
  return saved[0] || null;
}

// ─── Author summary (compressed persona + bio) ────────────────────────────────

function buildAuthorSummary(persona, bio) {
  if (persona) {
    // voiceSummary is the master AI instruction — use it as the primary source
    const voiceSummary = persona.voiceSummary || persona.generated?.voiceSummary || "";
    if (voiceSummary) {
      const framework = persona.signatureFramework || persona.generated?.signatureFramework || "";
      const suffix = framework ? ` Uses the ${cap(framework, 60)}.` : "";
      return cap(voiceSummary + suffix, 320);
    }
  }

  const parts = [];

  if (persona) {
    const desc = persona.authorDescription || persona.draft?.authorDescription || "";
    if (desc) parts.push(cap(desc, 100));

    const inspired = persona.inspiredBy || persona.draft?.inspiredBy || "";
    if (inspired) parts.push(`Inspired by: ${cap(inspired, 60)}`);

    const archetype = persona.authorArchetype || "";
    if (archetype) parts.push(`Archetype: ${cap(archetype, 40)}`);

    const relationship = persona.readerRelationship || "";
    if (relationship) parts.push(`Relationship: ${cap(relationship, 30)}`);

    const voiceTone = persona.generated?.voice?.tone;
    const voiceMood = persona.generated?.voice?.mood;
    const sentenceStyle = persona.generated?.style?.sentenceStructure;
    if (voiceTone) parts.push(`Voice: ${cap(voiceTone, 60)}`);
    if (voiceMood && voiceMood !== voiceTone) parts.push(`Mood: ${cap(voiceMood, 50)}`);
    if (sentenceStyle) parts.push(`Sentences: ${cap(sentenceStyle, 80)}`);
  }

  if (!parts.length) {
    const bg = bio?.professionalBackground;
    if (bg) parts.push(cap(bg, 120));
  }

  return parts.join("; ").slice(0, 280);
}

// ─── Progressive chapter summaries ───────────────────────────────────────────
// For each chapter that has generated lessons, extract a compressed summary
// of key frameworks/concepts. Passed to the lesson prompt so the AI knows
// what has already been covered and can build on it without repeating.

function buildChapterSummaries(project) {
  const chapters = project.bookOutline?.chapters || [];
  const lessons = project.lessons || {};
  const summaries = [];

  for (const ch of chapters) {
    const concepts = [];
    for (const sec of ch.sections || []) {
      for (const sub of sec.subsections || []) {
        const entry = sub.id ? lessons[sub.id] : null;
        if (!entry) continue;
        const fw = entry.lesson?.framework;
        const title = entry.lesson?.title || sub.title;
        if (fw) concepts.push(cap(fw, 90));
        else if (title) concepts.push(cap(title, 60));
      }
    }
    if (!concepts.length) continue;
    summaries.push({
      title: cap(ch.title, 80),
      summary: concepts.slice(0, 3).join("; ").slice(0, 200)
    });
    if (summaries.length >= 6) break;
  }

  return summaries;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build the book memory object from the current project state.
 * Returns null if the project has no meaningful data yet.
 *
 * @param {object} project  The full project from localStorage
 * @returns {object|null}   Compact context object for AI generation
 */
export function buildBookContext(project) {
  if (!project) return null;

  const research = project.research || {};
  const intel    = project.analysis?.intelligence || {};
  const pb       = project.proposedBook?.content || {};
  const bd       = project.bookDetails || {};
  const bio      = project.authorBio || {};
  const persona  = getActivePersona(project);

  // Multi-source resolution: later steps override earlier ones where available
  const audience = cap(
    bd.audience || pb.proposedAudience || research.targetAudience || intel.targetAudience,
    220
  );
  const tone = cap(
    bd.tone || (pb.proposedTone || "").slice(0, 120) ||
    (Array.isArray(research.authorTones) ? research.authorTones.join(", ") : "") ||
    intel.energyStyle,
    140
  );
  const usp = cap(bd.uniqueSellingProposition || pb.uniqueSellingProposition, 220);
  const differentiation = cap(pb.differentiation, 220);
  const keySellingPoints = cap(pb.keySellingPoints, 220);

  const ctx = {
    // Book identity
    title:    cap(resolveBookTitle(project), 110),
    subtitle: cap(bd.subtitle || research.bookSubtitle || project.bookTitle?.selectedCard?.subtitle, 100),

    // Niche positioning
    niche:       cap(research.mainNicheLabel, 60),
    subNiche:    cap(research.subNicheLabel,  60),
    deepNiche:   cap(research.deepNicheLabel, 60),
    bookTopic:   cap(research.bookTopic,       220),
    stance:      cap(research.stanceOnTopic,   160),
    standout:    cap(research.standout,         160),
    publishingGoal: cap(research.publishingGoal, 80),

    // Audience + voice (fully resolved)
    audience,
    tone,
    genre:         cap(bd.genre || research.mainNicheLabel, 60),
    wordCountRange: cap(bd.wordCountRange, 40),
    chapterCount:  bd.chapterCount || 8,
    structure:     cap(bd.structure, 130),

    // Positioning intelligence
    usp,
    differentiation,
    keySellingPoints,
    keywords:      cap(bd.keywords, 220),

    // Author
    authorName:    cap(bio.authorName || research.authorName, 80),
    authorSummary: buildAuthorSummary(persona, bio),

    // Competitive intelligence (from Step 2 market analysis)
    readerPainProfile:     cap(intel.readerPainProfile,      200),
    transformationPromise: cap(intel.transformationPromise,  160),
    marketGap:             cap(intel.marketGapAnalysis,       200),
    writingStyleFingerprint: cap(intel.writingStyleFingerprint, 160),
    positioningStrategy:   cap(intel.positioningStrategy,    180),
    emotionalTriggers:     Array.isArray(intel.emotionalTriggers)
      ? intel.emotionalTriggers.slice(0, 4).join(", ")
      : "",
    competitorTitles: (project.analysis?.books || [])
      .slice(0, 5)
      .map((b) => b.title)
      .filter(Boolean)
      .join("; "),

    // Progressive chapter context (grows as the book is written)
    previousChapterSummaries: buildChapterSummaries(project)
  };

  // Return null if there's nothing useful (very early in workflow)
  const hasContent = ctx.title || ctx.bookTopic || ctx.niche || ctx.audience;
  return hasContent ? ctx : null;
}
