/**
 * Knowledge Graph & Concept Intelligence Engine
 *
 * Builds a progressive Knowledge Graph from the knowledgeGraphDelta stored
 * inside each written lesson entry (lesson.knowledgeGraphDelta).
 *
 * The graph is INTERNAL — readers never see it. It is passed as bookContext.knowledgeGraph
 * to every subsequent section write so the AI can enforce:
 *   — First Introduction Rule  (define a concept the first time it appears)
 *   — Reinforcement Rule       (deepen, never redefine)
 *   — Dependency Validation    (prerequisites must come first)
 *   — Contradiction Detection  (consistent definitions and advice)
 *   — Cross References         (natural forward/backward links)
 *   — Question Coverage        (every concept answers at least one reader question)
 */

const MAX_CONCEPTS   = 50;
const MAX_FRAMEWORKS = 20;
const MAX_DEFS       = 30;
const MAX_OPEN_QS    = 15;
const MAX_STORY_TYPES = 12;

function cap(v, max) {
  if (v == null) return "";
  const s = String(v).replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * Build a compact Knowledge Graph Summary from all lesson entries.
 *
 * @param {object} project — The full project object from localStorage
 * @returns {object|null}  — Compact KG object for injection into bookContext
 */
export function buildKnowledgeGraphSummary(project) {
  const lessons = project?.lessons;
  if (!lessons || typeof lessons !== "object") return null;

  const conceptRegistry = {};   // key (lowercase) → ConceptCard
  const frameworkRegistry = {}; // key (lowercase) → FrameworkCard
  const definitionRegistry = {}; // key (lowercase) → DefinitionCard
  const answeredQuestions = new Set();
  const raisedQuestions = [];
  const storyTypesSeen = [];

  for (const entry of Object.values(lessons)) {
    if (!entry || typeof entry !== "object") continue;
    const delta = entry.lesson?.knowledgeGraphDelta;
    if (!delta || typeof delta !== "object") continue;

    // Location label — for "introduced at" context
    const lessonObj = entry.lesson || {};
    const locLabel = cap(
      [lessonObj.chapter, lessonObj.section || lessonObj.title].filter(Boolean).join(" › "),
      80
    );

    // ── New concepts ──────────────────────────────────────────────────────────
    if (Array.isArray(delta.newConcepts)) {
      for (const c of delta.newConcepts) {
        if (!c?.name || typeof c.name !== "string") continue;
        const key = c.name.toLowerCase().trim();
        if (!conceptRegistry[key]) {
          conceptRegistry[key] = {
            name:           c.name,
            definition:     cap(c.definition, 130),
            difficulty:     c.difficulty    || "intermediate",
            importance:     c.importance    || "medium",
            category:       c.category      || "concept",
            readerQuestion: cap(c.readerQuestion, 110),
            introducedAt:   locLabel,
          };
        }
      }
    }

    // ── Frameworks ────────────────────────────────────────────────────────────
    if (Array.isArray(delta.frameworks)) {
      for (const f of delta.frameworks) {
        if (!f?.name || typeof f.name !== "string") continue;
        const key = f.name.toLowerCase().trim();
        if (!frameworkRegistry[key]) {
          frameworkRegistry[key] = {
            name:         f.name,
            type:         f.type     || "model",
            purpose:      cap(f.purpose, 110),
            introducedAt: locLabel,
          };
        }
      }
    }

    // ── Definitions ───────────────────────────────────────────────────────────
    if (Array.isArray(delta.definitionsEstablished)) {
      for (const d of delta.definitionsEstablished) {
        if (!d?.term || typeof d.term !== "string") continue;
        const key = d.term.toLowerCase().trim();
        if (!definitionRegistry[key]) {
          definitionRegistry[key] = {
            term:       d.term,
            definition: cap(d.definition, 130),
          };
        }
      }
    }

    // ── Reader questions ──────────────────────────────────────────────────────
    if (Array.isArray(delta.questionsAnswered)) {
      for (const q of delta.questionsAnswered) {
        if (typeof q === "string" && q.trim()) {
          answeredQuestions.add(q.toLowerCase().trim());
        }
      }
    }
    if (Array.isArray(delta.questionsRaised)) {
      for (const q of delta.questionsRaised) {
        if (typeof q === "string" && q.trim()) {
          raisedQuestions.push(q.trim());
        }
      }
    }

    // ── Stories ───────────────────────────────────────────────────────────────
    if (Array.isArray(delta.storiesUsed)) {
      for (const s of delta.storiesUsed) {
        if (s?.type && typeof s.type === "string" && storyTypesSeen.length < MAX_STORY_TYPES) {
          storyTypesSeen.push(s.type);
        }
      }
    }
  }

  const concepts   = Object.values(conceptRegistry).slice(0, MAX_CONCEPTS);
  const frameworks = Object.values(frameworkRegistry).slice(0, MAX_FRAMEWORKS);
  const definitions = Object.values(definitionRegistry).slice(0, MAX_DEFS);
  const openQuestions = [...new Set(
    raisedQuestions.filter(q => !answeredQuestions.has(q.toLowerCase().trim()))
  )].slice(0, MAX_OPEN_QS);
  const storyTypes = [...new Set(storyTypesSeen)].slice(0, MAX_STORY_TYPES);

  if (!concepts.length && !frameworks.length && !definitions.length) return null;

  return {
    concepts,
    frameworks,
    definitions,
    openQuestions,
    storyTypes,
    totals: {
      concepts:          concepts.length,
      frameworks:        frameworks.length,
      answeredQuestions: answeredQuestions.size,
      openQuestions:     openQuestions.length,
    },
  };
}
