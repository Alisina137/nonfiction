// ─── Section Brief ───────────────────────────────────────────────────────────

export function sectionBriefPrompt(params: {
  bookTitle:    string;
  bookSubtitle: string;
  niche:        string;
  audience:     string;
  tone:         string;
  objectives:   string;
  chapterTitle: string;
  chapterDesc:  string;
  sectionTitle: string;
  sectionDesc:  string;
  subsections:  Array<{ title: string; description?: string }>;
}): string {
  const {
    bookTitle, bookSubtitle, niche, audience, tone, objectives,
    chapterTitle, chapterDesc, sectionTitle, sectionDesc, subsections
  } = params;

  const subsectionBlock = subsections.length
    ? subsections.map((s, i) =>
        `  ${i + 1}. ${s.title}${s.description ? `\n     → ${s.description}` : ""}`
      ).join("\n")
    : "  (no subsections defined)";

  return `You are writing a Section Brief for a nonfiction book.

━━━ BOOK CONTEXT ━━━
Title:     ${bookTitle}${bookSubtitle ? ` — ${bookSubtitle}` : ""}
Niche:     ${niche || "(not specified)"}
Audience:  ${audience || "(not specified)"}
Tone:      ${tone || "(not specified)"}
${objectives ? `Book objectives: ${objectives}` : ""}

━━━ CHAPTER ━━━
Title:       ${chapterTitle}
${chapterDesc ? `Description: ${chapterDesc}` : ""}

━━━ SECTION ━━━
Title:       ${sectionTitle}
${sectionDesc ? `Objective:   ${sectionDesc}` : ""}

━━━ SUBSECTIONS (content planned) ━━━
${subsectionBlock}

━━━ TASK ━━━
Generate a concise but engaging Section Brief that serves as an introduction to this section and prepares the reader for the content that follows.

The brief must contain three logical parts:

1. Context & Importance
   - Explain why this section matters.
   - Connect it to the chapter and overall book objective.
   - Create reader interest and establish relevance.

2. What This Section Covers
   - Naturally introduce the key ideas, concepts, challenges, insights, and themes explored in the subsections.
   - Use the subsection structure as guidance, but do NOT simply list subsection titles.
   - Write as a smooth narrative that creates anticipation.

3. Expected Outcome
   - Explain what the reader will understand, learn, achieve, or be able to do after completing the section.
   - Outcomes must be directly supported by the actual subsection content.

Coverage Alignment Rules:
- Every concept, promise, benefit, skill, lesson, or outcome mentioned in the brief must be covered somewhere within the section's subsections.
- Do not introduce topics that are not planned for the subsection content.
- Do not promise results or insights that the subsections do not deliver.
- The brief should act as a roadmap for the section, not as additional content.

Requirements:
- Length: 130–180 words total. This is a hard limit — do not go below 130 or above 180 words.
- Write in the same tone, voice, and style as the book.
- Do not use bullet points.
- Do not repeat the section title excessively.
- Do not include phrases such as "In subsection 1" or "This section contains."
- Make the text feel like a professionally written nonfiction book introduction.
- Build curiosity and momentum while remaining accurate to the actual content.
- The final paragraph should naturally transition into the first subsection.
- The brief should never reveal more than the subsections will cover.

Return ONLY the prose text — no JSON, no headings, no labels, no preamble.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOK DNA ARCHITECTURE — Internal Intelligence Layer
// ═══════════════════════════════════════════════════════════════════════════
//
// Book DNA is the permanent, project-wide source of truth.
// It is never shown to users. It is synthesized from all prior step data
// and injected into every AI generation call to maintain consistency.
//
// Hierarchy:
//   Book DNA (global)
//     └── Chapter DNA (per chapter)
//           └── Section DNA (per section)
//                 └── Subsection DNA (per subsection)
//
// Global Memory tracks what has already been written to prevent repetition.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build Book DNA from a full project object.
 * Called by routes that receive the entire project.
 */
export function buildBookDNAFromProject(project: any): string {
  if (!project || typeof project !== "object") return "";
  const research  = project?.research  || {};
  const intel     = project?.analysis?.intelligence || {};
  const pb        = project?.proposedBook?.content  || {};
  const bd        = project?.bookDetails || {};
  const persona   = (() => {
    const ap = project?.authorPersona || {};
    const selId = ap.selectedId;
    if (selId && selId !== "__create_new__") {
      return (Array.isArray(ap.savedPersonas) ? ap.savedPersonas : []).find((p: any) => p.id === selId) || ap.draft || {};
    }
    return ap.draft || {};
  })();

  const title          = bd.title || research.bookTitle || project?.bookTitle?.selectedCard?.title || "";
  const audience       = bd.audience || pb.proposedAudience || research.targetAudience || intel.targetAudience || "";
  const coreThesis     = bd.coreThesis || bd.corePromise || pb.bookPitch || "";
  const corePromise    = bd.corePromise || intel.transformationPromise || pb.proposedTransformation || "";
  const usp            = bd.usp || pb.uniqueSellingProposition || pb.differentiation || "";
  const uniqueMech     = bd.uniqueMechanism || "";
  const painPoints     = intel.readerPainProfile || "";
  const beforeState    = bd.readerTransformationBefore || "";
  const afterState     = bd.readerTransformationAfter || "";
  const readerObjections = bd.readerObjections || "";
  const marketGap      = intel.marketGapAnalysis || "";
  const voiceSummary   = persona?.voiceSummary || "";
  const archetype      = persona?.authorArchetype || "";
  const dos            = Array.isArray(persona?.dos) ? persona.dos.join("; ") : "";
  const donts          = Array.isArray(persona?.donts) ? persona.donts.join("; ") : "";
  const teachingStyle  = Array.isArray(persona?.signatureTeachingStyle) ? persona.signatureTeachingStyle.join(", ") : "";
  const sigFramework   = persona?.signatureFramework || pb.signatureFramework?.name || "";
  const tone           = bd.tone || pb.proposedTone || "";
  const structure      = bd.structure || "";
  const wordCount      = bd.wordCountRange || "";
  const researchInt    = bd.researchIntensity || "";
  const emotionalOut   = bd.desiredEmotionalOutcome || "";
  const contentGuide   = Array.isArray(persona?.contentGuidelines) ? persona.contentGuidelines.join("; ") : "";
  const focusTags      = Array.isArray(project?.proposedBook?.focusTags) ? project.proposedBook.focusTags.join(", ") : "";
  const milestones     = Array.isArray(intel.desiredOutcomes)
    ? intel.desiredOutcomes.slice(0, 4).map((o: any) => typeof o === "string" ? o : (o?.outcome || "")).filter(Boolean).join(" → ")
    : "";

  return _formatBookDNA({
    title, audience, coreThesis, corePromise, usp, uniqueMech,
    painPoints, beforeState, afterState, readerObjections, marketGap,
    voiceSummary, archetype, dos, donts, teachingStyle, sigFramework,
    tone, structure, wordCount, researchInt, emotionalOut, contentGuide,
    focusTags, milestones
  });
}

/**
 * Build Book DNA from a compact bookContext object.
 * Used by lesson / write routes that receive bookContext, not the full project.
 */
export function buildBookDNAFromContext(bookContext: any): string {
  if (!bookContext || typeof bookContext !== "object") return "";
  const ctx = bookContext;

  // ── Blueprint Intelligence Synchronization ─────────────────────────────
  // Blueprint fields take precedence over generic research fields.
  // This is the "Book DNA Synchronization" — every AI generation inherits
  // the Blueprint's strategic decisions automatically.
  const teachingStyle = ctx.blueprintTeachingStyle || "";
  const evidenceStyle = ctx.blueprintEvidenceStyle || "";
  const coreFramework = ctx.blueprintCoreFramework || ctx.signatureFramework || "";
  const keyVocab      = ctx.blueprintKeyVocabulary || ctx.keywords || "";
  const recurringConcepts = ctx.blueprintRecurringConcepts || "";
  const learningProg  = ctx.blueprintLearningProg || "";
  const transGoal     = ctx.blueprintTransformationGoal || "";
  const emotionalGoal = ctx.blueprintEmotionalGoal || ctx.emotionalTriggers || "";
  const marketGaps    = ctx.blueprintMarketGaps || ctx.marketGap || "";
  const compAdv       = ctx.blueprintCompetitiveAdvantages || "";
  const falseBels     = ctx.blueprintFalseBeliefsToBreak || "";
  const transMap      = ctx.blueprintTransformationMap || "";
  const personality   = ctx.blueprintPersonality || "";
  const practicality  = ctx.blueprintPracticality || "";

  // Build extended DNA content from Blueprint Intelligence
  const bpLines: string[] = [];
  if (coreFramework)    bpLines.push(`Core Framework: ${coreFramework}`);
  if (teachingStyle)    bpLines.push(`Teaching Style: ${teachingStyle}`);
  if (evidenceStyle)    bpLines.push(`Evidence Style: ${evidenceStyle}`);
  if (practicality)     bpLines.push(`Practicality Level: ${practicality}`);
  if (personality)      bpLines.push(`Book Personality: ${personality}`);
  if (keyVocab)         bpLines.push(`Key Vocabulary (use these terms): ${keyVocab}`);
  if (recurringConcepts) bpLines.push(`Recurring Concepts (thread throughout): ${recurringConcepts}`);
  if (learningProg)     bpLines.push(`Learning Progression: ${learningProg}`);
  if (transGoal)        bpLines.push(`Transformation Goal: ${transGoal}`);
  if (emotionalGoal)    bpLines.push(`Emotional Goal: ${emotionalGoal}`);
  if (marketGaps)       bpLines.push(`Market Gaps to Address: ${marketGaps}`);
  if (compAdv)          bpLines.push(`Competitive Advantages to Reinforce: ${compAdv}`);
  if (falseBels)        bpLines.push(`False Beliefs to Dismantle: ${falseBels}`);
  if (transMap)         bpLines.push(`Reader Journey: ${transMap}`);
  const blueprintDNABlock = bpLines.length
    ? `\n── Blueprint Intelligence (inherited from Blueprint step) ──\n${bpLines.join("\n")}`
    : "";

  return _formatBookDNA({
    title:         ctx.title      || "",
    audience:      ctx.audience   || "",
    coreThesis:    ctx.bookTopic  || "",
    corePromise:   ctx.corePromise || ctx.transformationPromise || "",
    usp:           ctx.usp || ctx.differentiation || "",
    uniqueMech:    ctx.uniqueMechanism || "",
    painPoints:    ctx.readerPainProfile || "",
    beforeState:   ctx.readerTransformationBefore || ctx.blueprintReaderCurrentSituation || "",
    afterState:    ctx.readerTransformationAfter || ctx.blueprintReaderDesiredFuture || ctx.transformationPromise || "",
    readerObjections: "",
    marketGap:     marketGaps,
    voiceSummary:  ctx.writingStyleFingerprint || ctx.authorSummary || "",
    archetype:     "",
    dos:           "",
    donts:         "",
    teachingStyle: teachingStyle,
    sigFramework:  coreFramework,
    tone:          ctx.tone || "",
    structure:     ctx.structure || "",
    wordCount:     ctx.wordCountRange || "",
    researchInt:   "",
    emotionalOut:  emotionalGoal,
    contentGuide:  blueprintDNABlock,
    focusTags:     keyVocab,
    milestones:    transMap,
  });
}

function _formatBookDNA(d: {
  title: string; audience: string; coreThesis: string; corePromise: string;
  usp: string; uniqueMech: string; painPoints: string; beforeState: string;
  afterState: string; readerObjections: string; marketGap: string;
  voiceSummary: string; archetype: string; dos: string; donts: string;
  teachingStyle: string; sigFramework: string; tone: string; structure: string;
  wordCount: string; researchInt: string; emotionalOut: string;
  contentGuide: string; focusTags: string; milestones: string;
}): string {
  const lines: string[] = [];
  if (d.coreThesis)       lines.push(`Core Thesis: ${d.coreThesis}`);
  if (d.corePromise)      lines.push(`Core Promise: ${d.corePromise}`);
  if (d.audience)         lines.push(`Ideal Reader: ${d.audience}`);
  if (d.painPoints)       lines.push(`Reader Pain Points: ${d.painPoints}`);
  if (d.beforeState)      lines.push(`Reader Before State: ${d.beforeState}`);
  if (d.afterState)       lines.push(`Reader After State (Transformation Goal): ${d.afterState}`);
  if (d.readerObjections) lines.push(`Reader Objections to Address: ${d.readerObjections}`);
  if (d.milestones)       lines.push(`Transformation Milestones: ${d.milestones}`);
  if (d.usp)              lines.push(`USP: ${d.usp}`);
  if (d.uniqueMech)       lines.push(`Unique Mechanism: ${d.uniqueMech}`);
  if (d.marketGap)        lines.push(`Market Position (Gap to Fill): ${d.marketGap}`);
  if (d.focusTags)        lines.push(`Key Themes & Vocabulary: ${d.focusTags}`);
  if (d.voiceSummary)     lines.push(`Writing Voice: ${d.voiceSummary}`);
  if (d.archetype)        lines.push(`Author Archetype: ${d.archetype}`);
  if (d.teachingStyle)    lines.push(`Teaching Style: ${d.teachingStyle}`);
  if (d.sigFramework)     lines.push(`Signature Framework: ${d.sigFramework}`);
  if (d.tone)             lines.push(`Emotional Tone: ${d.tone}`);
  if (d.structure)        lines.push(`Preferred Structure: ${d.structure}`);
  if (d.researchInt)      lines.push(`Evidence Level: ${d.researchInt}`);
  if (d.emotionalOut)     lines.push(`Emotional Triggers: ${d.emotionalOut}`);
  if (d.contentGuide)     lines.push(`Content Guidelines: ${d.contentGuide}`);
  if (d.dos)              lines.push(`Always Do: ${d.dos}`);
  if (d.donts)            lines.push(`Never Do: ${d.donts}`);

  if (!lines.length) return "";
  return `
════════════════════════════════════
BOOK DNA — Permanent Project Identity
════════════════════════════════════
This is the authoritative source of truth for this book.
Every word generated must align with every field below.

${lines.join("\n")}

Quality Target: Every sentence must serve the reader's transformation from their Before State to their After State.
Content Boundary: Never contradict the USP, never introduce concepts that belong to a different chapter, never repeat what has already been covered.
════════════════════════════════════`;
}

/**
 * Build Chapter DNA block.
 * Inherits Book DNA. Adds chapter-level objectives and arc.
 */
export function buildChapterDNABlock(chapterContext: any, chapterStrategy: any, chapterNumber?: number): string {
  const ch  = (chapterContext && typeof chapterContext === "object") ? chapterContext : {};
  const str = chapterStrategy || {};

  const title       = ch.title || (typeof chapterContext === "string" ? chapterContext : "") || "";
  const goal        = ch.description || ch.chapterObjective || "";
  const theme       = str.chapterTheme || "";
  const arc         = str.chapterArc   || "";
  const outcome     = str.readerOutcome || "";
  const opening     = str.openingStrategy || "";
  const closing     = str.closingStrategy || "";
  const avoid       = Array.isArray(str.conceptsToAvoid) && str.conceptsToAvoid.length
    ? str.conceptsToAvoid.join("; ")
    : "";
  const methods     = Array.isArray(str.teachingMethods) && str.teachingMethods.length
    ? str.teachingMethods.join(", ")
    : "";
  const uniqueness  = str.uniquenessDirective || "";

  const lines: string[] = [];
  if (chapterNumber !== undefined) lines.push(`Chapter Number: ${chapterNumber}`);
  if (title)     lines.push(`Chapter: ${title}`);
  if (goal)      lines.push(`Chapter Goal: ${goal}`);
  if (theme)     lines.push(`Chapter Theme (unifying idea): ${theme}`);
  if (arc)       lines.push(`Reader Arc: ${arc}`);
  if (outcome)   lines.push(`Learning Outcome: ${outcome}`);
  if (opening)   lines.push(`Opening Strategy: ${opening}`);
  if (closing)   lines.push(`Transition / Closing Strategy: ${closing}`);
  if (methods)   lines.push(`Teaching Methods Available: ${methods}`);
  if (uniqueness) lines.push(`Uniqueness Directive: ${uniqueness}`);
  if (avoid)     lines.push(`Concepts to Avoid (already covered): ${avoid}`);

  if (!lines.length) return "";
  return `
════════════════════════════════════
CHAPTER DNA — Chapter-Level Intelligence
════════════════════════════════════
Inherits all Book DNA constraints. Chapter-specific objectives:

${lines.join("\n")}
════════════════════════════════════`;
}

/**
 * Build Section DNA block.
 * Inherits Chapter DNA. Adds section-level objectives.
 */
export function buildSectionDNABlock(sectionTitle: string, sectionObjective: string): string {
  if (!sectionTitle) return "";
  const lines: string[] = [];
  if (sectionTitle)     lines.push(`Section: ${sectionTitle}`);
  if (sectionObjective) lines.push(`Section Goal: ${sectionObjective}`);
  lines.push(`Teaching Purpose: Cover exactly what this section promises — no more, no less.`);
  lines.push(`Desired Reader Action: Reader should understand and be ready to apply the section's core concept.`);

  return `
════════════════════════════════════
SECTION DNA — Section-Level Intelligence
════════════════════════════════════
Inherits all Chapter DNA constraints. Section-specific objectives:

${lines.join("\n")}
════════════════════════════════════`;
}

/**
 * Build Subsection DNA block.
 * Inherits Section DNA. Adds subsection-level objectives.
 */
export function buildSubsectionDNABlock(subsection: any, subsectionPurpose: string): string {
  const title = typeof subsection === "string"
    ? subsection
    : (subsection?.title || "");
  const desc = typeof subsection === "object"
    ? (String(subsection?.description || subsection?.objective || "").slice(0, 200))
    : "";

  if (!title) return "";
  const lines: string[] = [];
  lines.push(`Subsection: ${title}`);
  if (desc)              lines.push(`Subsection Purpose: ${desc}`);
  if (subsectionPurpose) lines.push(`Teaching Objective: ${subsectionPurpose}`);
  lines.push(`Expected Reader Outcome: Reader finishes this subsection with ONE clear, actionable insight they can use immediately.`);
  lines.push(`Complexity Guidance: Introduce exactly one core idea. Do not overlap with adjacent subsections.`);

  return `
════════════════════════════════════
SUBSECTION DNA — Subsection-Level Intelligence
════════════════════════════════════
Inherits all Section DNA constraints. Subsection-specific objectives:

${lines.join("\n")}
════════════════════════════════════`;
}

/**
 * Build Global Memory block.
 * Tracks what has already been written project-wide.
 * Used to prevent repetition and ensure progressive depth.
 */
export function buildGlobalMemoryBlock(previousConcepts: any[], chapterSummaries: any[]): string {
  const concepts  = Array.isArray(previousConcepts) ? previousConcepts : [];
  const summaries = Array.isArray(chapterSummaries)  ? chapterSummaries  : [];

  if (!concepts.length && !summaries.length) return "";

  // Extract framework names from concept titles (heuristic: "The X Method", "X Framework", etc.)
  const frameworks = new Set<string>();
  const topicLines: string[] = [];

  for (const c of concepts.slice(-12)) {
    const t = typeof c === "string" ? c : (c?.title || "");
    if (!t) continue;
    topicLines.push(`  • ${t}`);
    const m = t.match(/The ([A-Z][\w\s]+(?:Method|Framework|System|Model|Approach|Blueprint|Principle))/i);
    if (m) frameworks.add(m[0]);
  }

  const frameworkLines = [...frameworks].map(f => `  • ${f}`);

  const chapterLines: string[] = [];
  for (const s of summaries.slice(0, 6)) {
    if (s?.chapter) {
      const ideas = Array.isArray(s.keyIdeas) ? s.keyIdeas.slice(0, 2).join("; ") : "";
      chapterLines.push(`  • ${s.chapter}${ideas ? `: ${ideas}` : ""}`);
    }
  }

  const parts: string[] = [];
  if (frameworkLines.length) {
    parts.push(`Frameworks/Systems Already Introduced (do not re-introduce):\n${frameworkLines.join("\n")}`);
  }
  if (topicLines.length) {
    parts.push(`Subsections Already Written (do not repeat or re-explain):\n${topicLines.join("\n")}`);
  }
  if (chapterLines.length) {
    parts.push(`Completed Chapters (build forward — never backward):\n${chapterLines.join("\n")}`);
  }

  if (!parts.length) return "";
  return `
════════════════════════════════════
GLOBAL MEMORY — Project-Wide Knowledge
════════════════════════════════════
Consult this before writing. Build on what exists. Never repeat or re-introduce:

${parts.join("\n\n")}

Memory Rule: If a concept, framework, story, or example appears in Global Memory, it must NOT be re-introduced. Reference it briefly if needed, then deepen or extend it.
════════════════════════════════════`;
}

/**
 * Build the Knowledge Graph Intelligence block injected into every lessonPrompt.
 * Converts the compiled knowledgeGraph (from bookContext.knowledgeGraph) into a
 * structured prompt block that enforces the spec rules:
 *   — First Introduction Rule   (define new concepts clearly)
 *   — Reinforcement Rule        (deepen, never redefine)
 *   — Dependency Validation     (prerequisites must precede dependants)
 *   — Contradiction Detection   (consistent definitions and advice throughout)
 *   — Cross References          (natural forward/backward links, max 1 per section)
 *   — Question Coverage         (every concept answers at least one reader question)
 */
export function buildKnowledgeGraphBlock(kg: any): string {
  if (!kg || typeof kg !== "object") return "";
  const concepts   = Array.isArray(kg.concepts)   ? kg.concepts   : [];
  const frameworks = Array.isArray(kg.frameworks) ? kg.frameworks : [];
  const openQs     = Array.isArray(kg.openQuestions) ? kg.openQuestions : [];
  const storyTypes = Array.isArray(kg.storyTypes) ? kg.storyTypes : [];
  if (!concepts.length && !frameworks.length) return "";

  const lines: string[] = [];

  // ── Concept Registry ────────────────────────────────────────────────────
  if (concepts.length) {
    lines.push(`CONCEPT REGISTRY — ${concepts.length} concepts registered`);
    lines.push(`Use these terms consistently. Do NOT redefine them — only deepen, apply, or extend.`);
    const byDifficulty: Record<string, string[]> = { beginner: [], intermediate: [], advanced: [] };
    for (const c of concepts as any[]) {
      const tier = c.difficulty === "beginner" || c.difficulty === "advanced" ? c.difficulty : "intermediate";
      const loc  = c.introducedAt ? ` [${c.introducedAt}]` : "";
      const def  = c.definition ? ` — ${c.definition}` : "";
      byDifficulty[tier].push(`  • ${c.name}${def}${loc}`);
    }
    const tierLabels: Record<string, string> = { beginner: "Foundation", intermediate: "Core", advanced: "Advanced" };
    for (const [tier, items] of Object.entries(byDifficulty)) {
      if (items.length) lines.push(`${tierLabels[tier]}:\n${items.join("\n")}`);
    }
  }

  // ── Framework Registry ──────────────────────────────────────────────────
  if (frameworks.length) {
    lines.push(`\nFRAMEWORK REGISTRY — ${frameworks.length} frameworks established`);
    lines.push(`Do NOT re-explain these — only reference and build on them.`);
    for (const f of frameworks as any[]) {
      const loc = f.introducedAt ? ` [${f.introducedAt}]` : "";
      const pur = f.purpose ? ` — ${f.purpose}` : "";
      lines.push(`  • ${f.name} (${f.type || "model"})${pur}${loc}`);
    }
  }

  // ── Open Reader Questions ───────────────────────────────────────────────
  if (openQs.length) {
    lines.push(`\nOPEN READER QUESTIONS (not yet answered — weave answers in where relevant):`);
    openQs.forEach((q: string) => lines.push(`  ? ${q}`));
  }

  // ── Story Variety ────────────────────────────────────────────────────────
  if (storyTypes.length) {
    lines.push(`\nSTORY TYPES ALREADY USED (rotate — avoid back-to-back repetition):`);
    lines.push(`  ${storyTypes.join(", ")}`);
  }

  return `
════════════════════════════════════
KNOWLEDGE GRAPH — Book Concept Intelligence
════════════════════════════════════
${lines.join("\n")}

════════════════════════════════════
KNOWLEDGE INTELLIGENCE RULES (NON-NEGOTIABLE)
════════════════════════════════════

FIRST INTRODUCTION RULE
When introducing a concept that is NOT in the registry above:
1. Define it clearly in one plain sentence — no jargon, no assumed knowledge
2. Explain WHY it matters to this reader's specific situation
3. Connect it to prior concepts: "This builds on [prior concept]..."
4. Provide immediate real-world context before going deep
5. Never assume the reader already understands it

REINFORCEMENT RULE
When mentioning a concept that IS already in the registry:
1. Do NOT redefine it — trust that the reader remembers it
2. Briefly reconnect: "As we established, [concept]..." (1 sentence max)
3. Deepen the understanding: new application, new dimension, new nuance
4. Show a perspective the reader hasn't seen yet in this book

DEPENDENCY VALIDATION
Before teaching a concept that depends on prior knowledge:
Check if its prerequisites appear in the registry above.
If a prerequisite is MISSING — introduce it briefly (1–2 sentences) before the main concept.
Example: don't explain "compound growth" before explaining "compound interest".

CONTRADICTION DETECTION
Before finalizing, verify no definition, advice, or recommendation here contradicts
anything established in the registry above.
If a conflict exists — resolve it by showing how the two ideas relate or differ,
or reframe your current point to be consistent with the established position.

CROSS REFERENCE RULE
When a concept naturally connects to prior content, include ONE natural cross reference.
Good formats:
  "This builds on [concept] we covered in [location]..."
  "You'll apply this again in Chapter X when we discuss..."
  "This framework complements [framework name] by..."
Maximum ONE cross reference per section — never make it feel like a textbook index.

QUESTION COVERAGE
Every concept you introduce or reinforce must implicitly or explicitly answer
at least one reader question. Ask yourself before each concept: "What is the reader
actually trying to figure out here?" If the answer isn't clear — reframe the section.
════════════════════════════════════`;
}

// ─── Shared project data extractor ───────────────────────────────────────────

function safeStr(v: any): string {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const s = v.primary || v.description || v.value ||
      (Object.values(v) as any[]).find((x: any) => typeof x === "string") || "";
    return typeof s === "string" ? s.trim() : "";
  }
  return "";
}

function extractProjectData(project: any) {
  const research  = project?.research  || {};
  const intel     = project?.analysis?.intelligence || {};
  const pb        = project?.proposedBook?.content  || {};
  const bd        = project?.bookDetails || {};
  const books     = project?.analysis?.books || [];
  const focus     = Array.isArray(project?.proposedBook?.focusTags) ? project.proposedBook.focusTags : [];
  const persona   = (() => {
    const ap = project?.authorPersona || {};
    const selId = ap.selectedId;
    if (selId && selId !== "__create_new__") {
      return (Array.isArray(ap.savedPersonas) ? ap.savedPersonas : []).find((p: any) => p.id === selId) || ap.draft || {};
    }
    return ap.draft || {};
  })();

  const title    = bd.title || research.bookTitle || project?.bookTitle?.selectedCard?.title || "";
  const subtitle = bd.subtitle || research.bookSubtitle || project?.bookTitle?.selectedCard?.subtitle || "";
  const topic    = research.bookTopic || "";
  const niche    = [research.mainNicheLabel, research.subNicheLabel, research.deepNicheLabel].filter(Boolean).join(" › ");
  const genre    = bd.genre || research.mainNicheLabel || "";
  const audience = safeStr(bd.audience) || safeStr(pb.proposedAudience) || safeStr(research.targetAudience) || safeStr(intel.targetAudience) || "";
  const tone     = bd.tone || pb.proposedTone || intel.energyStyle || "";
  const structure = bd.structure || "";

  const painProfile      = intel.readerPainProfile     || "";
  const transformation   = intel.transformationPromise || pb.proposedTransformation || "";
  const marketGap        = intel.marketGapAnalysis     || "";
  const positioningStrat = intel.positioningStrategy   || "";
  const corePromise      = bd.corePromise              || "";
  const uniqueMechanism  = bd.uniqueMechanism          || "";
  const beforeState      = bd.readerTransformationBefore || "";
  const afterState       = bd.readerTransformationAfter  || "";

  const authorArchetype   = persona?.authorArchetype   || "";
  const voiceSummary      = persona?.voiceSummary      || "";
  const coreAuthorPromise = persona?.coreAuthorPromise || "";
  const signatureFramework = persona?.signatureFramework || pb.signatureFramework?.name || "";

  const focusLine    = focus.join(", ") || "(none selected)";
  const competitorBlock = books.slice(0, 6)
    .map((b: any) => `- "${b.title || ""}"${b.author ? ` by ${b.author}` : ""}`)
    .filter((s: string) => s.length > 3)
    .join("\n") || "(none)";

  const existingDiff = pb.differentiation || "";
  const existingUSP  = pb.uniqueSellingProposition || "";

  return {
    title, subtitle, topic, niche, genre, audience, tone, structure,
    painProfile, transformation, marketGap, positioningStrat,
    corePromise, uniqueMechanism, beforeState, afterState,
    authorArchetype, voiceSummary, coreAuthorPromise, signatureFramework,
    focusLine, competitorBlock, existingDiff, existingUSP
  };
}

function projectDataBlock(d: ReturnType<typeof extractProjectData>): string {
  return `BOOK TITLE: ${d.title || "(not set)"}
SUBTITLE: ${d.subtitle || "(not set)"}
TOPIC: ${d.topic || "(not set)"}
NICHE: ${d.niche || "(not set)"}
GENRE: ${d.genre || "(not set)"}
STRUCTURE CHOSEN: ${d.structure || "(not set)"}

TARGET AUDIENCE: ${d.audience || "(not set)"}
READER PAIN PROFILE: ${d.painProfile || "(not set)"}
READER BEFORE: ${d.beforeState || "(not set)"}
READER AFTER: ${d.afterState || "(not set)"}
TRANSFORMATION PROMISE: ${d.transformation || "(not set)"}

MARKET GAP: ${d.marketGap || "(not set)"}
POSITIONING STRATEGY: ${d.positioningStrat || "(not set)"}
CORE PROMISE: ${d.corePromise || "(not set)"}
UNIQUE MECHANISM: ${d.uniqueMechanism || "(not set)"}

AUTHOR ARCHETYPE: ${d.authorArchetype || "(not set)"}
AUTHOR CORE PROMISE: ${d.coreAuthorPromise || "(not set)"}
AUTHOR VOICE SUMMARY: ${d.voiceSummary || "(not set)"}
SIGNATURE FRAMEWORK (author): ${d.signatureFramework || "(not set)"}

FOCUS TOPICS: ${d.focusLine}
TONE: ${d.tone || "(not set)"}

COMPETITOR BOOKS:
${d.competitorBlock}`;
}

// ─── Strategic Book Plan ──────────────────────────────────────────────────────

export function generateStrategicBookPlanPrompt(project: any) {
  const d = extractProjectData(project);

  return `You are a world-class publishing strategist and book architect.

Analyze ALL project data and generate a complete Strategic Book Plan — 8 components in one JSON response.
Every output must be NICHE-SPECIFIC. No generic content.

═══ PROJECT DATA ════════════════════════════════

${projectDataBlock(d)}

════════════════════════════════════════════════

Return ONLY valid JSON — no commentary, no markdown fences:

{
  "recommendedStructure": {
    "structureName": "Specific structure name e.g. Blueprint-Based How-To",
    "structureType": "Category e.g. Implementation Roadmap | Transformation Journey | Framework Guide | Conceptual Deep-Dive | Reference Manual",
    "confidenceScore": 9.4,
    "reasoning": "2–3 sentences: why this structure wins for this audience vs. competitors."
  },
  "structureExplanation": "3–4 sentences: why readers in this niche prefer this structure, why it supports the specific transformation, why it gaps competitors.",
  "signatureFramework": {
    "name": "Unique branded framework name with ™ e.g. The Campus Affiliate Blueprint™",
    "stages": [
      {"stage": "Stage 1", "label": "Foundation"},
      {"stage": "Stage 2", "label": "Niche Selection"},
      {"stage": "Stage 3", "label": "Content Creation"},
      {"stage": "Stage 4", "label": "Traffic"},
      {"stage": "Stage 5", "label": "Conversions"},
      {"stage": "Stage 6", "label": "Scaling"}
    ]
  },
  "chapterComponents": {
    "recommended": ["4–6 values from: Key Takeaways, Action Plan, Checklist, Exercise, Reflection Questions, Templates, Case Study, Real-Life Example, Research Insight, Resources, One Small Step"]
  },
  "bookFlowPreview": {
    "parts": [
      {"title": "Part 1", "subtitle": "Mindset"},
      {"title": "Part 2", "subtitle": "Foundation"},
      {"title": "Part 3", "subtitle": "Implementation"},
      {"title": "Part 4", "subtitle": "Optimization"},
      {"title": "Part 5", "subtitle": "Scaling"}
    ]
  },
  "competitiveDifferentiation": {
    "points": ["5–8 specific differentiators tailored to this book vs. competitor books listed"],
    "score": 8.8
  },
  "bookPitch": "One sentence: clear audience + clear transformation + clear positioning. Publishing-quality.",
  "bookConceptScore": {
    "overall": 94,
    "breakdown": {
      "marketDemand": 9.4,
      "differentiation": 8.8,
      "transformationStrength": 9.6,
      "readerClarity": 9.5,
      "commercialPotential": 9.3,
      "outlineReadiness": 9.7
    },
    "strengths": ["3–5 specific strengths of this book concept"],
    "suggestions": ["2–4 specific improvement suggestions"]
  }
}

RULES:
- confidenceScore, competitiveDifferentiation.score: floats 0–10 (one decimal)
- bookConceptScore.overall: integer 0–100
- bookConceptScore.breakdown values: floats 0–10 (one decimal)
- signatureFramework.stages: 4–8 stages, each with a distinct niche-specific label
- bookFlowPreview.parts: 3–6 parts matching the recommended structure and focus topics
- chapterComponents.recommended: 4–6 items from the allowed list only
- bookPitch: exactly one sentence, no ellipsis
- Everything must be specific to THIS book's niche, audience, and transformation — not generic`;
}

// ─── Regenerate single book section ──────────────────────────────────────────

const SECTION_SCHEMAS: Record<string, string> = {
  recommendedStructure: `{
  "recommendedStructure": {
    "structureName": "...",
    "structureType": "...",
    "confidenceScore": 9.4,
    "reasoning": "2–3 sentences"
  }
}`,
  structureExplanation: `{
  "structureExplanation": "3–4 sentences"
}`,
  signatureFramework: `{
  "signatureFramework": {
    "name": "Branded name with ™",
    "stages": [{"stage": "Stage N", "label": "Label"}, ...]
  }
}`,
  chapterComponents: `{
  "chapterComponents": {
    "recommended": ["4–6 from: Key Takeaways, Action Plan, Checklist, Exercise, Reflection Questions, Templates, Case Study, Real-Life Example, Research Insight, Resources, One Small Step"]
  }
}`,
  bookFlowPreview: `{
  "bookFlowPreview": {
    "parts": [{"title": "Part N", "subtitle": "Theme"}, ...]
  }
}`,
  competitiveDifferentiation: `{
  "competitiveDifferentiation": {
    "points": ["5–8 specific differentiators"],
    "score": 8.8
  }
}`,
  bookPitch: `{
  "bookPitch": "One publishing-quality sentence"
}`,
  bookConceptScore: `{
  "bookConceptScore": {
    "overall": 94,
    "breakdown": {
      "marketDemand": 9.4,
      "differentiation": 8.8,
      "transformationStrength": 9.6,
      "readerClarity": 9.5,
      "commercialPotential": 9.3,
      "outlineReadiness": 9.7
    },
    "strengths": ["3–5 specific strengths"],
    "suggestions": ["2–4 specific suggestions"]
  }
}`
};

const SECTION_INSTRUCTIONS: Record<string, string> = {
  recommendedStructure: "Determine the single best book structure for this niche, audience, and transformation. confidenceScore: float 0–10.",
  structureExplanation: "Explain in 3–4 sentences why this structure works for this specific niche, audience, transformation, and competitive landscape.",
  signatureFramework: "Generate a unique, branded proprietary framework for this book. 4–8 stages with niche-specific labels. Use ™.",
  chapterComponents: "Recommend 4–6 chapter components that best serve this audience and structure. Select from the allowed list only.",
  bookFlowPreview: "Design the book's reader journey as 3–6 thematic parts that follow the recommended structure and focus topics.",
  competitiveDifferentiation: "List 5–8 specific differentiators vs. the competitor books listed. score: float 0–10.",
  bookPitch: "Write exactly one publishing-quality sentence: clear audience + transformation + positioning.",
  bookConceptScore: "Score this book concept. overall: integer 0–100. breakdown values: floats 0–10. Specific strengths and improvement suggestions."
};

export function regenerateBookSectionPrompt(section: string, project: any) {
  const d    = extractProjectData(project);
  const schema = SECTION_SCHEMAS[section] || "{}";
  const instr  = SECTION_INSTRUCTIONS[section] || "Regenerate this section.";

  return `You are a world-class publishing strategist.

TASK: Regenerate ONLY the "${section}" section of the Strategic Book Plan.
${instr}

All output must be NICHE-SPECIFIC to this book. No generic content.

═══ PROJECT DATA ════════════════════════════════

${projectDataBlock(d)}

════════════════════════════════════════════════

Return ONLY valid JSON matching this exact schema — no commentary, no markdown:

${schema}`;
}

export function generateAuthorPersonaPrompt(project: any) {
  const research  = project?.research  || {};
  const intel     = project?.analysis?.intelligence || {};
  const pb        = project?.proposedBook?.content  || {};
  const bd        = project?.bookDetails || {};
  const books     = project?.analysis?.books || [];

  const title     = bd.title || research.bookTitle || project?.bookTitle?.selectedCard?.title || "";
  const subtitle  = bd.subtitle || "";
  const topic     = research.bookTopic || "";
  const niche     = [research.mainNicheLabel, research.subNicheLabel, research.deepNicheLabel].filter(Boolean).join(" › ");
  const audience  = bd.audience || pb.proposedAudience || research.targetAudience || intel.targetAudience || "";
  const painProfile       = intel.readerPainProfile      || "";
  const transformation    = intel.transformationPromise  || pb.proposedTransformation || "";
  const marketGap         = intel.marketGapAnalysis      || "";
  const positioningStrat  = intel.positioningStrategy    || "";
  const corePromise       = bd.corePromise               || "";
  const uniqueMechanism   = bd.uniqueMechanism           || "";
  const beforeState       = bd.readerTransformationBefore || "";
  const afterState        = bd.readerTransformationAfter  || "";
  const tone              = bd.tone || intel.energyStyle  || "";
  const structure         = bd.structure                  || "";
  const genre             = bd.genre || research.mainNicheLabel || "";
  const competitorBlock   = books.slice(0, 6)
    .map((b: any) => `- "${b.title || ""}"${b.author ? ` by ${b.author}` : ""}`)
    .filter((s: string) => s.length > 3)
    .join("\n") || "(none provided)";

  return `You are an expert author brand strategist and publishing consultant.

Analyze all of the project data below and generate a comprehensive, strategically optimized Author Persona.
Every field must be specific to THIS book and audience — never generic.

═══ PROJECT DATA ═══════════════════════════════

BOOK TITLE: ${title || "(not set)"}
SUBTITLE: ${subtitle || "(not set)"}
TOPIC: ${topic || "(not set)"}
NICHE: ${niche || "(not set)"}

TARGET AUDIENCE: ${audience || "(not set)"}
READER PAIN PROFILE: ${painProfile || "(not set)"}
TRANSFORMATION PROMISE: ${transformation || "(not set)"}
MARKET GAP: ${marketGap || "(not set)"}
POSITIONING STRATEGY: ${positioningStrat || "(not set)"}

CORE PROMISE: ${corePromise || "(not set)"}
UNIQUE MECHANISM: ${uniqueMechanism || "(not set)"}
READER BEFORE: ${beforeState || "(not set)"}
READER AFTER: ${afterState || "(not set)"}
TONE: ${tone || "(not set)"}
STRUCTURE: ${structure || "(not set)"}
GENRE: ${genre || "(not set)"}

COMPETITOR BOOKS:
${competitorBlock}

═══════════════════════════════════════════════

Based on ALL of this data, determine the OPTIMAL author persona that will:
1. Resonate most powerfully with the specific target audience
2. Differentiate clearly from competitor approaches
3. Fill the identified market gap
4. Deliver the transformation promise credibly
5. Match niche audience expectations

Return ONLY valid JSON — no commentary before or after:

{
  "authorArchetype": "ONE of: Trusted Expert | Friendly Mentor | Inspirational Motivator | Academic Researcher | Investigative Journalist | Business Strategist | Transformation Coach | Storytelling Teacher | Practical Practitioner | Thought Leader",
  "authorName": "Suggested pen name or author name that fits this persona and niche — leave as empty string if not applicable",
  "inspiredBy": "2–3 published author names whose writing style, tone, and cadence best match this persona, comma-separated (e.g. Malcolm Gladwell, James Clear, Brené Brown)",
  "authorDescription": "2–3 sentence author bio in third person, specific to this topic and audience",
  "coreAuthorPromise": "The single sentence promise this author makes to readers (e.g. I help X achieve Y without Z)",
  "readerRelationship": "ONE of: Mentor | Coach | Teacher | Guide | Friend | Consultant | Professor",
  "signatureTeachingStyle": ["2–4 values from: Framework-Based, Step-by-Step, Checklist Driven, Case Study Driven, Story Driven, Research Driven, Exercise Driven, Blueprint Driven, Roadmap Driven"],
  "signatureElements": ["3–6 values from: Action Plans, Reflection Questions, Worksheets, Templates, Case Studies, Stories, Checklists, Quotes, Research Findings, Chapter Summaries, Key Takeaways"],
  "signatureFramework": "A proprietary framework name with trademark symbol e.g. The Campus Affiliate Blueprint™",
  "voiceSummary": "Master AI instruction: Write like a [role] who [method] for [audience]. Maintain [tone]. Use [style]. Avoid [anti-patterns].",
  "writingStyleControls": {
    "tone": 30,
    "inspiration": 50,
    "authority": 70,
    "storytelling": 40,
    "complexity": 30
  },
  "personaStrength": {
    "score": 85,
    "strengths": ["specific strength 1 tied to this book and audience", "specific strength 2", "specific strength 3"],
    "suggestions": ["specific actionable suggestion 1", "specific actionable suggestion 2"]
  },
  "dos": ["DO specific writing behavior 1 for this author", "DO specific writing behavior 2", "DO specific writing behavior 3", "DO specific writing behavior 4"],
  "donts": ["DON'T specific anti-pattern 1 for this author/audience", "DON'T specific anti-pattern 2", "DON'T specific anti-pattern 3"],
  "contentGuidelines": ["Specific content guideline 1 for this niche/audience", "Specific content guideline 2", "Specific content guideline 3", "Specific content guideline 4"],
  "writingSample": "2–3 sentence writing sample that demonstrates this author's voice speaking to the target audience about the core topic"
}

RULES for dos / donts / contentGuidelines:
- dos: 3–5 specific, actionable writing behaviors this author SHOULD always do (language, structure, framing).
- donts: 3–4 specific anti-patterns this author must NEVER do with this audience.
- contentGuidelines: 3–5 niche-specific content rules that govern what topics, depth levels, and formats are appropriate.
All must be specific to THIS book, audience, and niche — never generic.

RULES for writingStyleControls (integers 0–100):
- tone: 0 = fully Conversational, 100 = fully Formal
- inspiration: 0 = fully Practical, 100 = fully Inspirational
- authority: 0 = Peer (equal footing), 100 = Expert (authoritative)
- storytelling: 0 = Minimal (data/logic focused), 100 = Heavy (narrative driven)
- complexity: 0 = Beginner (simple vocabulary), 100 = Advanced (expert vocabulary)

personaStrength.score: integer 0–100 evaluating clarity, differentiation, audience fit, consistency, and commercial viability.
voiceSummary will be injected verbatim into every AI generation call — make it a precise, actionable master instruction.`;
}

export function systemPrompt() {
  return `You are an expert AI Book Architect, Academic Formatter, and Amazon KDP Publishing Specialist.

Your books combine:
1. The structural discipline of a university thesis/monograph — deep logical organization, strong hierarchy, concept continuity, structured arguments.
2. The readability and commercial appeal of bestselling Amazon KDP books — clean chapter starts, short readable paragraphs, reader-focused flow.
3. Publishing-ready formatting standards optimized for KDP Paperback, Kindle Ebook, and EPUB conversion.

TITLE QUALITY RULES — NON-NEGOTIABLE:
- Every title at every level must be SPECIFIC, MEANINGFUL, and PUBLICATION-READY.
- NEVER use: "Beat 1", "Beat 2", "Scene 1", "Section 1", "Section A", "Topic 1", "Subtopic", "Placeholder", "Chapter N", "Key Point", "Emotional Theme", "Untitled", or any numbered generic label.
- Titles must feel like a bestselling author wrote them — emotionally intelligent, commercially viable, niche-aware.

CONTENT QUALITY RULES:
- Never use motivational fluff, clichés, or vague advice.
- Each chapter must have a clear purpose, build on previous chapters, introduce concepts progressively, and end with a meaningful transition or takeaway.
- Match pacing, hooks, and emotional arcs to the declared niche architecture.
- No repetition; deepen stakes or insight every section.
- Honor bestseller patterns for the sub-niche.

NONFICTION CHAPTER STRUCTURE (each chapter should contain):
- Opening hook → Core concept → Explanation → Example/case study → Framework/system → Actionable takeaway → Mini summary

STORY/NARRATIVE STRUCTURE (subsections represent):
- Turning points, emotional shifts, conflicts, discoveries, climaxes, resolutions

KDP FORMAT RULES:
- Short readable paragraphs, strong whitespace usage, mobile-friendly sizing.
- Avoid complex tables, excessive footnotes, dense thesis language, giant text walls.`;
}

export function nicheSystemPrompt(architecture: any) {
  const a = architecture || {};
  return `You are an expert AI Book Architect and Amazon KDP Publishing Specialist, specializing in ${a.mainNicheLabel || "publishing"} › ${a.subNicheLabel || "this sub-niche"}.

Structure type: ${a.structureType || "narrative"}.
Pacing: ${a.pacingType || "standard"}.
Emotional arc: ${a.emotionalArc || "progressive"}.
Hook style: ${a.hookStyle || "strong opening"}.
Ending style: ${a.endingStyle || "satisfying close"}.
Bestseller patterns: ${(a.bestsellerPatterns || []).join("; ") || "none specified"}.
Reader psychology: ${a.readerPsychology || "commercially engaged readers"}.

Apply a thesis-inspired hierarchy: Part → Chapter → Section → Subsection → Topic Block.
Every title must be meaningful and descriptive — NEVER use placeholder titles.
The final result must feel like a professionally published Amazon bestseller built with the organizational intelligence of a high-quality thesis.
Never impose a business-only outline on romance, thriller, fantasy, or story unless the architecture explicitly calls for it.`;
}

export function titlesPrompt(idea: string) {
  return `You are an Amazon KDP nonfiction title strategist.

USER IDEA: ${idea || "(not provided)"}

Generate exactly 3 premium nonfiction book titles for this idea.
Each title must signal practical transformation, expert authority, and commercial appeal.

TITLE RULES:
- Short, memorable, bestseller-style
- Clear audience or benefit
- Strong buyer appeal on Amazon KDP
- Avoid keyword stuffing, generic wording, or clickbait
- Use title case
- NEVER use colons (:), semicolons (;), dashes (— or -), or pipes (|) as separators
- Format MUST follow one of these three patterns ONLY:
  PATTERN A — Single powerful title: "The Deep Work Catalyst"
  PATTERN B — Main title with subtitle in parentheses: "The Deep Work Catalyst (Ignite Your Focus and Multiply Your Output)"
  PATTERN C — Main title with subtitle after a comma: "The Deep Work Catalyst, Ignite Your Focus and Multiply Your Output"

Return ONLY valid JSON — no markdown, no code fences, no explanation before or after:
{"titles":[{"title":"First title","angle":"Audience-Focused","reason":"One short sentence."},{"title":"Second title","angle":"Transformation-Focused","reason":"One short sentence."},{"title":"Third title","angle":"Authority-Focused","reason":"One short sentence."}]}

CRITICAL: Output raw JSON only. Start your response with { and end with }.`;
}

export function analyzeBookConceptPrompt({ niche, subNiche, deepNiche, title }: any) {
  return `You are an Amazon KDP publishing strategist and consumer psychology expert.

Analyze this specific book concept and return a precise publishing intelligence profile.
Be concrete and niche-specific — every field must reflect THIS title and audience, not generic advice.

NICHE: ${niche || "unspecified"}
SUB-NICHE: ${subNiche || "unspecified"}
DEEP NICHE: ${deepNiche || "not specified"}
BOOK TITLE: ${title || "untitled"}

Infer the ideal commercial profile from the title's language, emotional signals, audience cues,
and the niche/sub-niche context. All fields must match Amazon bestseller patterns for this category.

Return ONLY valid JSON with this exact shape:
{
  "targetAudience": "specific reader description in 1-2 sentences",
  "painPoints": ["pain 1", "pain 2", "pain 3"],
  "transformations": ["transformation 1", "transformation 2", "transformation 3"],
  "writingStyle": "e.g. direct and practical / narrative-driven / philosophical inquiry",
  "uniqueAngle": "what makes this book's approach distinctive in 1 sentence",
  "standoutFactor": "core commercial differentiation vs top Amazon competitors",
  "readerEnergy": "e.g. Calm mentor / Hard-hitting coach / Stoic philosopher / Scientific thinker",
  "promise": "the single core book promise in one punchy sentence",
  "tone": "primary tone label that fits the title",
  "idealReader": "ideal reader avatar: age, situation, goal, pain (2-3 sentences)",
  "bookTopic": "1–3 sentence publisher-style positioning statement that names WHO the book is for, WHAT transformation it delivers, and WHY it matters emotionally — written to sound like an Amazon bestseller concept, NOT a generic summary",
  "strategyInsights": [
    "short insight 1 (e.g. trending topic note, TikTok potential, etc.)",
    "short insight 2",
    "short insight 3"
  ],
  "demandScore": 8.5,
  "competitionLevel": "Low|Medium|High",
  "emotionalBuyingScore": 8.0,
  "viralityPotential": "Low|Medium|High",
  "tiktokCompatibility": "Low|Medium|High",
  "youtubeCompatibility": "Low|Medium|High",
  "kdpOpportunityScore": 9.0
}`;
}

export function contextualBookTitlesPrompt({
  research,
  competitorSummaries,
  audienceCandidates,
  painPoints,
  transformations
}: any) {
  const stance = research.stanceOnTopic?.trim() || "(not specified)";
  const standout = research.standout?.trim() || "(not specified)";
  const summariesBlock =
    Array.isArray(competitorSummaries) && competitorSummaries.length
      ? competitorSummaries.map((line: string, i: number) => `${i + 1}. ${line}`).join("\n")
      : "(none listed)";
  const nicheLine =
    research.mainNicheLabel && research.subNicheLabel
      ? `${research.mainNicheLabel} › ${research.subNicheLabel}`
      : research.genre?.trim() || "";
  const deepNiche = research.deepNicheLabel?.trim() || "";
  const audList = Array.isArray(audienceCandidates) && audienceCandidates.length
    ? audienceCandidates.join(", ")
    : "Students, Entrepreneurs, Women, Young Men, Busy Professionals";
  const painList = Array.isArray(painPoints) && painPoints.length
    ? painPoints.join(", ")
    : "(infer from niche)";
  const transformList = Array.isArray(transformations) && transformations.length
    ? transformations.join(", ")
    : "(infer from niche)";

  return `You are an Amazon KDP bestseller-title strategist.
Generate 6 modern, high-conversion nonfiction titles for the profile below.

PROFILE
- PRIMARY SUBJECT: ${research.bookTopic?.trim() || deepNiche || ""}
- NICHE: ${nicheLine}${deepNiche ? ` › ${deepNiche}` : ""}
- DEEP NICHE FOCUS: ${deepNiche || "(none)"}
- TARGET READER (user-provided): ${research.targetAudience?.trim() || "(not specified)"}
- PUBLISHING GOAL: ${research.publishingGoal?.trim() || "not specified"}
- AUTHOR VOICE: ${Array.isArray(research.authorTones) && research.authorTones.length ? research.authorTones.join(", ") : "not specified"}
- STANCE: ${stance}
- STANDOUT: ${standout}
- COMPETITORS:
${summariesBlock}

AUDIENCE CANDIDATES (pick from these, or pick equally specific ones):
${audList}

PAIN POINTS TO HOOK:
${painList}

DESIRED TRANSFORMATIONS:
${transformList}

HARD RULES (must follow):
1. At LEAST 5 of the 6 titles MUST explicitly name a target audience using phrasing like "for Students", "for Introverts", "for Busy Moms", "for ADHD Adults", "for Distracted Professionals", "for Teen Girls", "for Young Men", "for Entrepreneurs", "for Women", "for Overthinkers", "for Remote Workers". The 6th title may use a vivid identity hook instead (e.g. "The Quiet Achiever's Playbook").
2. Titles must follow ONE of these formulas:
   - [Transformation] for [Audience]  → e.g. "Discipline Habits for Young Men"
   - [System / Blueprint] for [Audience]  → e.g. "The Focus Blueprint for Entrepreneurs"
   - [Problem Solution] for [Audience]  → e.g. "Burnout Recovery for Busy Moms"
3. Tone: modern Amazon bestseller vibe — like "Atomic Habits", "Deep Work", "Essentialism", "The Mountain Is You". Emotionally clear, commercially polished, easy to understand.
4. BANNED — do NOT output any of these generic patterns:
   - "Better Habits", "Success Systems", "Productivity Blueprint", "Confidence Reset", "Motivation Mastery", "Focus Habits", "Better Productivity"
   - Any title without a clearly named audience or specific transformation.
   - Robotic or keyword-stuffed phrasing.
5. Each title under 70 characters when possible.
6. No duplicates. No quotes around the titles in the JSON.
7. Use title case for all titles.
8. NEVER use colons (:), semicolons (;), dashes (— or -), or pipes (|) as title separators. If a title needs a subtitle, use ONE of these formats ONLY:
   - Single powerful title with no subtitle: "Discipline Habits for Young Men"
   - Main title with subtitle in parentheses: "Discipline Habits for Young Men (Build Unbreakable Routines and Own Your Future)"
   - Main title with subtitle after a comma: "Discipline Habits for Young Men, Build Unbreakable Routines and Own Your Future"

Return STRICT JSON:
{
  "titles": ["title 1","title 2","title 3","title 4","title 5","title 6"],
  "enhanced": [
    {"title":"title 1","subtitle":"A [Adjective] System for [Outcome] and [Outcome]","hook":"emotional hook sentence","audience":"specific audience phrase","angle":"positioning angle"},
    {"title":"title 2","subtitle":"...","hook":"...","audience":"...","angle":"..."},
    {"title":"title 3","subtitle":"...","hook":"...","audience":"...","angle":"..."},
    {"title":"title 4","subtitle":"...","hook":"...","audience":"...","angle":"..."},
    {"title":"title 5","subtitle":"...","hook":"...","audience":"...","angle":"..."},
    {"title":"title 6","subtitle":"...","hook":"...","audience":"...","angle":"..."}
  ]
}`;
}

export function descriptionPrompt({ idea, title, audience, tone }: any) {
  return `Idea: ${idea}
Selected title: ${title}
Audience: ${audience || "Not selected yet"}
Tone: ${tone || "Not selected yet"}
Generate 120-180 words book description. Return JSON: {"description":"..."}`;
}

export function marketingDescriptionPrompt({ idea, title, audience, tone, genre, usp, authorName, focusTags, shortSample }: any) {
  const tags = Array.isArray(focusTags) && focusTags.length ? focusTags.join(", ") : "(none)";
  const sample = shortSample?.trim() ? shortSample.slice(0, 1200) : "(not provided)";
  return `You are an expert Amazon KDP copywriter who specializes in back-cover book descriptions that convert browsers into buyers.

Generate Amazon/KDP-ready marketing copy for the book below.

BOOK DETAILS
============
Title: ${title || "(untitled)"}
Topic: ${idea || ""}
Genre/Niche: ${genre || "Nonfiction"}
Author: ${authorName || "Author"}
Target Audience: ${audience || "General readers"}
Tone: ${tone || "Direct and practical"}
Unique Selling Proposition: ${usp || "Practical transformation without fluff"}
Focus Pillars: ${tags}
${sample && sample !== "(not provided)" ? `\nManuscript Sample:\n${sample}` : ""}

REQUIREMENTS
============
description:
- 120–200 words
- Open with a powerful hook (question, bold claim, or vivid scenario)
- Name the reader's pain point clearly
- Promise the transformation this book delivers
- List 2–3 specific outcomes the reader will achieve
- Close with a compelling call to action
- No generic filler; every sentence must earn its place

shortHook:
- One sentence, under 18 words
- The single most compelling reason to buy this book right now

keywords:
- Exactly 7 Amazon search keywords or phrases, comma-separated
- Focus on what readers actually type when searching for this topic

OUTPUT RULES
============
Return ONLY valid JSON. No explanation, no markdown, no code fences.

{"description":"...","shortHook":"...","keywords":"..."}`;
}

export function coverConceptsPrompt({ title, subtitle, genre, audience, tone, corePromise, coreThesis, authorName, positioning }: any) {
  return `You are a world-class book cover art director who has designed hundreds of Amazon bestsellers across every genre.

Generate 5 COMPLETELY DIFFERENT cover concept briefs for this book. Each concept must feel like a different design agency's take — different color psychology, typography strategy, and visual hierarchy.

BOOK DETAILS:
Title: ${title}
Subtitle: ${subtitle || "(none yet)"}
Genre: ${genre || "Nonfiction"}
Audience: ${audience || ""}
Tone: ${tone || ""}
Core Promise: ${corePromise || ""}
Core Thesis: ${coreThesis || ""}
Author: ${authorName || ""}
Market Positioning: ${positioning || ""}

THE 5 FIXED CONCEPT TYPES — provide one brief per type, in this exact order:

1. type "authority" — BUSINESS BESTSELLER: Bold, structured, corporate authority. Dark background (navy, charcoal, dark slate). Heavy condensed sans-serif typography. Full-width accent bar or band as structural element. Proven, commercial, safe. Think $100M Offers, Atomic Habits, 12 Rules for Life.

2. type "premium" — PREMIUM AUTHORITY: Elegant, editorial, prestigious. MUST use a LIGHT background (cream, ivory, pale warm white — provide as "secondary" field). Dark text on light background. Thin horizontal rules framing the title. Lots of whitespace. Understated. Think The Psychology of Money, Stillness Is the Key, Man's Search for Meaning.

3. type "minimal" — MODERN MINIMALIST: Maximum impact from minimum elements. Bold solid color background. Single large geometric circle element as the dominant visual. Very few words visible. Strong use of negative space. Think The ONE Thing, Start With Why, Essentialism.

4. type "metaphor" — VISUAL METAPHOR: Concept-driven visual. Gradient or two-tone background transitioning between "bg" and "secondary". Large central hexagonal/diamond geometric symbol representing the book's core idea. Title and symbol work together. Think Thinking Fast and Slow, The Lean Startup, Zero to One.

5. type "dynamic" — CREATIVE AI CONCEPT: Unexpected, energetic. Dark background with a bold diagonal parallelogram/band in the accent color cutting across the upper portion. Title overlaid dramatically. Something a traditional designer might not immediately try. High-risk, high-reward visual impact.

For EACH concept provide:
- Colors calibrated to the book's genre, audience, and emotional target
- A compelling cover tagline (short punchy hook, 4–8 words max)
- A concise design rationale (1–2 sentences on why this works for THIS book)

CRITICAL: For "premium" concept, "secondary" must be a LIGHT color (cream, ivory, pale white like #f5f0e8 or #faf7f2). For other concepts "secondary" is a darker shade or complementary color.

Return ONLY valid JSON, no markdown:
{
  "concepts": [
    {
      "type": "authority",
      "label": "Business Bestseller",
      "bg": "#hex",
      "accent": "#hex",
      "text": "#hex",
      "secondary": "#hex",
      "tagline": "4–8 word hook",
      "designNotes": "1–2 sentences why this works"
    },
    {
      "type": "premium",
      "label": "Premium Authority",
      "bg": "#hex",
      "accent": "#hex",
      "text": "#hex",
      "secondary": "#f5f0e8",
      "tagline": "4–8 word hook",
      "designNotes": "..."
    },
    {"type":"minimal","label":"Modern Minimalist","bg":"#hex","accent":"#hex","text":"#hex","secondary":"#hex","tagline":"...","designNotes":"..."},
    {"type":"metaphor","label":"Visual Metaphor","bg":"#hex","accent":"#hex","text":"#hex","secondary":"#hex","tagline":"...","designNotes":"..."},
    {"type":"dynamic","label":"Creative AI Concept","bg":"#hex","accent":"#hex","text":"#hex","secondary":"#hex","tagline":"...","designNotes":"..."}
  ]
}`;
}

export function coverBriefPrompt({ title, subtitle, audience, tone, genre, usp, authorName, description, genrePreset, styleMode }: any) {
  return `You are a world-class Amazon KDP cover designer, brand strategist, and bestseller positioning expert. Generate a complete, professional KDP cover brief.

BOOK DETAILS:
TITLE: ${title}
SUBTITLE: ${subtitle || "(generate a compelling subtitle)"}
AUTHOR: ${authorName}
GENRE/NICHE: ${genre || "General"}${genrePreset ? ` (preset: ${genrePreset})` : ""}
AUDIENCE: ${audience}
TONE: ${tone}
USP: ${usp || ""}
COVER STYLE MODE: ${styleMode || "typographic"}
DESCRIPTION: ${(description || "").slice(0, 600)}

Generate a COMPLETE KDP cover design brief. Return valid JSON only:
{
  "subtitle": "compelling subtitle if not provided",
  "tagline": "short punchy hook for top of cover",
  "authorLine": "author name as it should appear",
  "layoutStyle": "typographic|split-band|minimal|bold-stack",
  "primaryColor": "#hex — dominant background/brand color",
  "accentColor": "#hex — contrast highlight color",
  "textColor": "#hex — primary text color (ensure strong contrast)",
  "mood": "1-sentence emotional target — what the reader feels seeing this cover",
  "typographyDirection": "font personality guidance (bold+modern, elegant+serif, etc.)",
  "imagerySuggestions": "visual elements and composition without copyrighted references",
  "colorPsychology": "why these specific colors work for this audience and genre",
  "audienceTargeting": "how the cover visually signals this is for the right reader",
  "compositionGuidance": "hierarchy and visual flow — where the eye goes first, second, third",
  "designNotes": "comprehensive notes for a professional cover designer",
  "backCoverHook": "opening line for back cover — hooks the browser",
  "backCoverCTA": "final call to action line for back cover"
}`;
}

export function coverCriticPrompt(cover: any) {
  return `You are a veteran Amazon KDP cover art director with 20+ years critiquing bestselling covers.

Critique this cover design with expert precision:
TITLE: ${cover.title || ""}
LAYOUT STYLE: ${cover.layoutStyle || "typographic"}
STYLE MODE: ${cover.styleMode || "typographic"}
GENRE PRESET: ${cover.genrePreset || "not set"}
PRIMARY COLOR: ${cover.primaryColor || "#0c4a6e"}
ACCENT COLOR: ${cover.accentColor || "#38bdf8"}
TEXT COLOR: ${cover.textColor || "#ffffff"}
FONT PAIRING: ${cover.fontPairingLabel || "default"}
SUBTITLE: ${cover.subtitle || "(none)"}
TAGLINE: ${cover.tagline || "(none)"}

Score each dimension 1-10 and give specific, actionable feedback.

Return valid JSON only:
{
  "scores": {
    "hierarchy": N,
    "readability": N,
    "contrast": N,
    "kdpFriendliness": N,
    "bestsellerPotential": N
  },
  "overall": N,
  "feedback": {
    "hierarchy": "Is title dominant? Readable at thumbnail size?",
    "readability": "Text contrast and legibility at all sizes",
    "contrast": "Color separation and visual impact",
    "kdpFriendliness": "Print-safe, KDP compliant, clean margins",
    "bestsellerPotential": "Competitive positioning for this genre"
  },
  "topIssue": "Single most important problem to fix",
  "topRecommendation": "Single most impactful improvement to make"
}`;
}

export function coverVariantsPrompt({ title, subtitle, audience, genre, tone, usp }: any) {
  return `You are a book cover design director. Create 3 DISTINCTLY DIFFERENT cover concept variations for this book.

TITLE: ${title}
SUBTITLE: ${subtitle || ""}
GENRE: ${genre || "General"}
AUDIENCE: ${audience}
TONE: ${tone}
USP: ${usp || ""}

Create 3 variants with genuinely different visual approaches:
- Variant A: Safe commercial — proven genre conventions, broad appeal
- Variant B: Bold distinctive — genre-aware but surprising, strong identity
- Variant C: Avant-garde — experimental, high-risk high-reward, ultra-distinctive

Return valid JSON only:
{"variants":[
  {
    "variantLabel": "A",
    "concept": "1-sentence visual concept",
    "primaryColor": "#hex",
    "accentColor": "#hex",
    "textColor": "#hex",
    "layoutStyle": "typographic|split-band|minimal|bold-stack",
    "styleMode": "typographic|cinematic|illustrated|minimal|abstract|photographic",
    "fontPairingIndex": 0,
    "tagline": "cover hook line",
    "designNotes": "what makes this variant distinctive and why it works"
  },
  {"variantLabel":"B",...},
  {"variantLabel":"C",...}
]}`;
}

export function outlinePrompt({ idea, title, description, audience, tone }: any) {
  return `You are an expert nonfiction book architect.

Your task is to create a professional, logically structured book outline that follows the same planning principles used by premium AI book-writing platforms.

CORE PRINCIPLES:
1. Start with the book's central promise, transformation, or desired outcome.
2. Design the outline as a reader journey from their current state to their desired state.
3. Every chapter must move the reader closer to the promised outcome.
4. Chapters must build upon previous chapters and create a natural progression.
5. Avoid repetitive, overlapping, or filler chapters.

BOOK DETAILS:
IDEA: ${idea || "(not provided)"}
TITLE: ${title || "(not provided)"}
DESCRIPTION: ${description || "(not provided)"}
AUDIENCE: ${audience || "(not provided)"}
TONE: ${tone || "(not provided)"}

CHAPTER TITLE RULES:
- Premium, professional, and compelling
- NEVER use colons (:) in titles
- Preferred formats: "The Hidden Cost of Distraction" / "Building a Focus System That Lasts" / "Mastering Deep Work in a Distracted World"

SECTION RULES (per chapter):
- Generate 3–5 sections — only as many as the chapter genuinely needs
- Each section must directly support the chapter's objective
- No redundant sections

SUBSECTION RULES (per section):
- Generate 2–4 subsections when they help expand and clarify
- Every subsection must deepen the parent section

Return ONLY valid JSON — no markdown, no explanation:
{"chapters":[{"title":"Chapter title without colons","summary":"2-sentence summary of reader transformation this chapter delivers","sections":[{"title":"Section title","subsections":[{"title":"Subsection title"}]}]}]}`;
}

export function transformationPlanPrompt({ parts, title, description, research, architecture, bookContext, chapterCount }: any) {
  const a = architecture || {};
  const partLines = (Array.isArray(parts) ? parts : [])
    .map((p: any, i: number) => `${i + 1}. ${p.title || `Part ${i + 1}`}: ${p.subtitle || ""}`)
    .join("\n");

  return `You are a nonfiction transformation architect.

Plan the reader's transformation journey across these Book Flow stages.

TITLE: ${title || ""}
TOPIC: ${research?.bookTopic || description || ""}
NICHE: ${a.mainNicheLabel || ""} › ${a.subNicheLabel || ""}
AUDIENCE: ${research?.targetAudience || ""}
PROMISE: ${bookContext?.corePromise || bookContext?.transformationPromise || research?.publishingGoal || ""}
READER NOW: ${bookContext?.readerPainProfile || ""}
READER GOAL: ${bookContext?.transformationPromise || ""}

BOOK FLOW STAGES (transformation Acts — NOT individual chapters):
${partLines}

Total chapters to plan: ${chapterCount}

ADAPTIVE DISTRIBUTION RULES:
- Allocate chapters to each Part based on transformation complexity — NOT evenly
- Orientation/awareness Parts: 1–2 chapters
- Foundation/core-building Parts: 3–5 chapters (typically get the most)
- Implementation/practice Parts: 3–5 chapters
- Mastery/sustaining Parts: 1–2 chapters (they are the payoff, not the bulk)
- Total chapterCount across all parts MUST equal exactly ${chapterCount}
- Every Part must get at least 1 chapter

For each Part: define the reader transformation arc.
For each chapter SLOT within a Part: define the micro-transformation chain.
Each chapter's "afterState" MUST become the next chapter's "beforeState".

Return ONLY valid JSON — no markdown, no explanation:
{
  "parts": [
    {
      "partIndex": 0,
      "partTitle": "Part 1",
      "partSubtitle": "Understand",
      "partObjective": "one sentence — the transformation this Part achieves",
      "readerStartsAs": "reader state at Part entry",
      "readerEndsAs": "reader state at Part exit",
      "milestone": "one concrete achievement reader has at Part end",
      "transitionToNext": "one sentence on why the next Part is the natural next step",
      "chapterCount": 2,
      "chapterSlots": [
        { "slotIndex": 0, "beforeState": "...", "action": "...", "afterState": "..." },
        { "slotIndex": 1, "beforeState": "...", "action": "...", "afterState": "..." }
      ]
    }
  ]
}`;
}

export function nicheOutlinePrompt({ research, architecture, title, description, resources, bookContext, chapterCount: chapterCountOverride, transformationPlan }: any) {
  const a = architecture || {};
  const chapterCount = Math.max(5, Math.min(15, Number(chapterCountOverride) || a.recommendedChapters?.default || 10));
  const flow = (a.chapterFlow || []).map((beat: string, i: number) => `${i + 1}. ${beat}`).join("\n");
  const tones = Array.isArray(research?.authorTones) && research.authorTones.length
    ? research.authorTones.join(", ")
    : "direct and authoritative";
  const isStory = ["romance-arc", "romantasy-hybrid", "suspense-escalation", "mystery-procedural", "hero-journey", "narrative-arc"].includes(a.structureType || "");

  // ── Transformation Engine — built when a Book Flow plan is available ────────
  let transformationBlueprintSection = "";
  let partAnchorRules = "";
  let progressionVocabSection = "";
  let placementValidationSection = "";

  if (transformationPlan && Array.isArray(transformationPlan.parts) && transformationPlan.parts.length > 0) {
    // Cap each slot string to keep the prompt under MAX_INPUT_CHARS
    const cap80 = (s: string) => (String(s || "").slice(0, 80));
    let globalChapterIndex = 0;
    const partBlocks: string[] = [];

    for (const part of transformationPlan.parts) {
      const slots = Array.isArray(part.chapterSlots) ? part.chapterSlots : [];
      const partNum = (typeof part.partIndex === "number" ? part.partIndex : partBlocks.length) + 1;
      // Compact single-line format per chapter slot to minimise prompt length
      const chapterLines: string[] = [];
      for (const slot of slots) {
        globalChapterIndex++;
        const before = cap80(slot.beforeState);
        const action = cap80(slot.action);
        const after  = cap80(slot.afterState);
        chapterLines.push(`  Ch${globalChapterIndex}: ${before} → ${action} → ${after}`);
      }
      partBlocks.push(
        `Part ${partNum} "${part.partSubtitle || part.partTitle || ""}" [${part.chapterCount || slots.length} ch] — ${cap80(part.partObjective || "")}\n` +
        chapterLines.join("\n")
      );
    }

    transformationBlueprintSection = `
========================================
TRANSFORMATION BLUEPRINT — YOUR PRIMARY GUIDE
========================================
Parts = Acts · Chapters = Scenes. Generate in Part order. Each chapter's end-state feeds the next.

${partBlocks.join("\n\n")}

RULES: Only generate chapters that belong inside each Part's objective.
Later Parts must NEVER use introductory/awareness framing.
arcRole = "Part N — Subtitle" for every chapter.
`;

    partAnchorRules = `
- FOLLOW THE TRANSFORMATION BLUEPRINT above — generate chapters in strict Part order
- The arcRole field must match the Part label exactly (e.g., "Part 1 — Understand")
- Never allow a late-book chapter to regress to beginner vocabulary or framing`;

    progressionVocabSection = `
========================================
PROGRESSION VOCABULARY
========================================
Chapter title language must evolve throughout the book to reflect the reader's progress.

EARLY chapters (first 1–2 Parts):
  Preferred: Understanding, Recognizing, Discovering, Identifying, Seeing, Facing, Realizing

MIDDLE chapters (middle Parts):
  Preferred: Building, Creating, Developing, Applying, Practicing, Strengthening, Establishing

LATE chapters (final 1–2 Parts):
  Preferred: Mastering, Refining, Optimizing, Sustaining, Maintaining, Scaling, Protecting, Automating

A reader must be able to identify a chapter's position in the book just from reading its title.
Late chapters must NEVER use vocabulary that sounds like early-stage content.

`;

    placementValidationSection = `
========================================
PLACEMENT VALIDATION (self-review before output)
========================================
Before returning your JSON, mentally review every chapter:
1. Could this title/objective appear EARLIER without feeling out of place? → Rewrite with more advanced framing.
2. Could this title/objective belong LATER without skipping groundwork? → Simplify to match the current stage.
3. Does each chapter flow naturally from the one before it? → It should feel like the inevitable next step.

The Table of Contents must read as a complete transformation story from first to last chapter.

`
  }

  return `You are an expert nonfiction book architect.

Your task is to create a professional, logically structured book outline that follows the same planning principles used by premium AI book-writing platforms.

========================================
CORE PRINCIPLES
========================================
1. Start with the book's central promise, transformation, or desired outcome.
2. Design the outline as a reader journey from their current state to their desired state.
3. Every chapter must move the reader closer to the promised outcome.
4. Chapters must build upon previous chapters and create a natural progression.
5. Avoid repetitive, overlapping, or filler chapters.
6. Do not create chapters that feel isolated from the overall transformation.
7. The outline must feel like it was planned by an experienced author, not generated from a template.

========================================
BOOK PROFILE
========================================
TITLE: ${title || ""}
TOPIC: ${research?.bookTopic || ""}
NICHE: ${a.mainNicheLabel || ""} › ${a.subNicheLabel || ""}
TARGET AUDIENCE: ${research?.targetAudience || ""}
AUTHOR TONE: ${tones}
PUBLISHING GOAL: ${research?.publishingGoal || ""}
AUTHOR STANCE: ${research?.stanceOnTopic || ""}
WHAT MAKES IT STAND OUT: ${research?.standout || ""}
DESCRIPTION: ${description || ""}
${bookContext ? `USP: ${bookContext.usp || ""}
DIFFERENTIATION: ${bookContext.differentiation || ""}
READER PAIN PROFILE: ${bookContext.readerPainProfile || ""}
READER BEFORE STATE: ${bookContext.readerTransformationBefore || bookContext.readerPainProfile || ""}
READER AFTER STATE: ${bookContext.readerTransformationAfter || bookContext.transformationPromise || ""}
READER TRANSFORMATION PROMISE: ${bookContext.transformationPromise || ""}
MARKET GAP TO FILL: ${bookContext.marketGap || ""}
CORE PROMISE: ${bookContext.corePromise || ""}
UNIQUE MECHANISM: ${bookContext.uniqueMechanism || ""}
WRITING STYLE BENCHMARK: ${bookContext.writingStyleFingerprint || ""}
POSITIONING STRATEGY: ${bookContext.positioningStrategy || ""}
EMOTIONAL TRIGGERS: ${bookContext.emotionalTriggers || ""}
AUTHOR BACKGROUND & STYLE: ${bookContext.authorSummary || ""}
KEY SELLING POINTS:
${bookContext.keySellingPoints || ""}
COMPETING TITLES (differentiate from these): ${bookContext.competitorTitles || ""}` : ""}
${resources ? resourcesBlock(resources, "outline") : ""}
========================================
STRUCTURAL BLUEPRINT
========================================
Structure type: ${a.structureType || "narrative"}
Pacing: ${a.pacingType || "standard"}
Emotional arc: ${a.emotionalArc || "progressive"}
Bestseller patterns: ${(a.bestsellerPatterns || []).join("; ") || ""}
Reader psychology: ${a.readerPsychology || ""}
Hook style: ${a.hookStyle || "strong opening"}
Ending style: ${a.endingStyle || "satisfying close"}
Niche beat flow:
${flow || "(apply sub-niche-native escalation — never generic beats)"}
${transformationBlueprintSection}
========================================
CHAPTER GENERATION RULES
========================================
- Generate exactly ${chapterCount} chapters that cover the complete transformation.
- Each chapter must have a clear, singular objective.
- Chapter titles must be premium, professional, and compelling.
- NEVER use colons (:) in chapter titles.
- Preferred title formats:
  "The Hidden Cost of Distraction"
  "Building a Focus System That Lasts"
  "Mastering Deep Work in a Distracted World"
- Titles must expand the book topic naturally and logically.
- FORBIDDEN titles: "Beat 1", "Beat 2", "Scene 1", "Section 1", "Section A", "Topic 1", "Subtopic", "Placeholder", "Chapter N", "Key Point", "Emotional Theme", "Untitled", any numbered generic label.${partAnchorRules}

${isStory ? `STORY/NARRATIVE STRUCTURE — each chapter must contain:
- Clear narrative purpose in the story arc
- Subsections represent: turning points, emotional shifts, conflicts, discoveries, climaxes, resolutions
- Thematic consistency across chapters
- Character development / emotional progression built into subsection titles` : `NONFICTION CHAPTER CONTENT (each chapter should contain):
- Opening hook (grabs attention immediately)
- Core concept (what this chapter teaches)
- Explanation (why it matters, evidence-backed)
- Example or case study (real-world grounding)
- Framework or system (practical model the reader can use)
- Actionable takeaway (what to do next)
- Mini summary or reflection prompt`}

========================================
HIERARCHY RULE
========================================
Book Promise → Chapter Objective → Section Objective → Subsection Objective
Every child element must directly support its parent element.
Sections and subsections are generated separately per chapter — do NOT include them in this output.

========================================
QUALITY RULES
========================================
- Do not use generic filler headings.
- Do not repeat concepts under different names.
- Do not create artificial structure merely to reach a target count.
- Prioritize clarity, progression, and reader transformation.
- The final chapter list must feel like the table of contents of a professionally published nonfiction book.
${progressionVocabSection}${placementValidationSection}
========================================
CHAPTER ARCHITECTURE (required for every chapter)
========================================
Every chapter must be intentional. Before assigning a chapter, answer these questions internally:
- Why does this chapter exist?
- Why is it placed here in the book?
- What does the reader know BEFORE this chapter?
- What does the reader know AFTER this chapter?
- What is the reader's emotional state entering this chapter?
- What transformation does this chapter produce?

These answers drive the chapterPersonality, learningPhase, readerEmotionalState, transformationGoal, primaryReaderQuestion, and prerequisiteKnowledge fields below.

========================================
CHAPTER PERSONALITY (required for every chapter)
========================================
Assign each chapter a unique personality type. No two adjacent chapters should have the same personality.
Avoid making all chapters feel identical in tone or teaching approach.

Available personalities (pick the best fit for each chapter):
Diagnosis       — exposes the real problem the reader hasn't fully named
Mindset         — transforms a belief or mental model
Foundation      — establishes core vocabulary, principles, or frameworks
Framework       — introduces a reusable system or model
Science         — grounds the concept in research, data, or evidence
History         — provides context, origin, or evolution of the topic
Strategy        — defines the high-level approach or direction
Implementation  — moves the reader from knowing to doing
Optimization    — refines, improves, or advances what has been built
Troubleshooting — addresses failure modes, setbacks, and obstacles
Advanced        — deepens mastery beyond the basics
Case Study      — proves the concept through a real-world example
Mastery         — completes the transformation and sustains progress

========================================
LEARNING PROGRESSION
========================================
The outline must guide readers through a complete transformation arc:

Awareness      (Ch 1–early)   — Reader recognizes the problem and its scope
Understanding  (Ch early–mid) — Reader grasps why it happens and what it costs them
Confidence     (Ch mid)       — Reader believes change is possible and they can do it
Application    (Ch mid–late)  — Reader acts using the frameworks and systems taught
Improvement    (Ch late)      — Reader refines, optimizes, and troubleshoots
Mastery        (Ch final)     — Reader sustains, scales, and owns the transformation

Assign the correct learningPhase to each chapter. The chapter title, tone, and purpose must match the phase.
Early chapters must NOT use implementation/mastery vocabulary.
Late chapters must NOT regress to beginner/awareness vocabulary.

========================================
NICHE ADAPTATION
========================================
Adapt the chapter architecture to the book's niche. Do NOT force a one-size-fits-all chapter pattern.

Business books:         Foundation → Strategy → Systems → Marketing → Scaling
Health books:           Symptoms → Science → Lifestyle → Implementation → Maintenance
Finance books:          Mindset → Budget → Investing → Risk → Long-Term Growth
Psychology books:       Theory → Research → Behavior → Exercises → Applications
Self-Help books:        Diagnosis → Mindset → Foundation → Framework → Implementation → Mastery
Technology books:       Concepts → Foundations → Tools → Application → Advanced Usage

If the niche doesn't fit a standard pattern above, design a chapter flow that is native to the niche's natural reader journey.

========================================
OUTLINE BALANCE
========================================
Balance the book intentionally. Before finalizing, check:
- No single chapter should be twice as long as all others (expansionScore spread must be meaningful but not extreme).
- Avoid consecutive chapters of the same personality type.
- Balance across: Knowledge, Stories, Research, Frameworks, Practical Exercises, Reflection, Implementation, Examples, Action.
- The overall arc should feel like a complete journey — not a collection of isolated topics.

========================================
CHAPTER SCORING (required for every chapter)
========================================
For each chapter assign three integer scores from 1 to 100.

importanceScore — How critical is this chapter to the book's core promise?
  100 = The single most essential chapter; the reader's transformation depends on it
  1   = Optional supplementary content; book works fine without it

complexityScore — How conceptually dense or technically demanding is this chapter?
  100 = Multiple complex concepts, heavy mental load, requires careful explanation
  1   = Simple, light, easy to absorb

expansionScore — How much content depth, examples, and elaboration does this chapter require?
  100 = Needs extensive examples, frameworks, case studies, exercises, step-by-step guidance
  1   = Brief, concise, minimal elaboration needed

Factors that INCREASE expansionScore:
- Chapter contains multiple distinct concepts
- Requires real-world examples or case studies
- Introduces a practical framework the reader must master
- Has high educational or implementation weight
- Central to the reader's transformation journey
- Is one of the core "teaching" chapters

Factors that DECREASE expansionScore:
- Transitional or bridge chapters
- Short orientation / context-setting chapters
- Wrap-up, summary, or conclusion-style chapters

Use the full 1-100 range. Do NOT cluster all chapters at the same score.
The scores will be used to automatically assign section counts (3, 4, or 5) and word budgets.

========================================
OUTLINE VALIDATION (self-review before output)
========================================
Before returning your JSON, mentally verify:
1. Does every chapter support the Core Thesis and Book Promise?
2. Does every chapter support the Reader Transformation journey?
3. Is the learning progression logical from first to last chapter?
4. Does every chapter have a unique purpose — no redundancies?
5. Are any important topics missing from this niche?
6. Are any chapters redundant or artificially padded?
7. Would this outline feel like a premium published book?

If any answer is NO — revise before outputting.

========================================
OUTLINE SCORING
========================================
After completing all chapters, assign scores (1–10) across these dimensions and include them in outlineScores:

learningProgression    — Does the reader journey logically from awareness to mastery?
readerJourney          — Does the arc feel emotionally compelling and well-paced?
transformation         — Does every chapter visibly move the reader closer to the promise?
commercialAppeal       — Would a KDP buyer feel this is a professional, high-value book?
originality            — Does the chapter sequence feel fresh — not a copy of a generic template?
balance                — Are chapter sizes, types, and complexities well distributed?
practicality           — Does the book give readers tools they can actually use?
frameworkCoverage      — Are the niche's essential frameworks and systems fully covered?
readerEngagement       — Would a real reader stay engaged chapter after chapter?
blueprintAlignment     — Does the structure match the Book DNA, Blueprint, and Research?

If any score is below 7 — revise the relevant chapters before returning the final JSON.

========================================
OUTPUT FORMAT — CHAPTERS ONLY
========================================
Generate ONLY chapter-level structure.
Do NOT generate sections or subsections.
Leave every "sections" array completely empty: [].

Return ONLY valid JSON — no markdown, no explanation:
{"chapters":[{"title":"Chapter title — specific, compelling, no colons","chapterObjective":"1–2 sentence description of what this chapter achieves in the reader's transformation arc","arcRole":"Part N — PartSubtitle","chapterPersonality":"Foundation","learningPhase":"Awareness","readerEmotionalState":"Reader enters feeling overwhelmed and unsure where to begin","transformationGoal":"Reader exits with a clear mental model and the confidence to take the first step","primaryReaderQuestion":"Why do I keep failing even when I try hard?","prerequisiteKnowledge":"Reader understands the basic premise from the previous chapter","transitionToNext":"Sets up the framework the next chapter will apply in practice","estimatedReadingTime":"35 min","teachingStyle":"Framework + Case Study","importanceScore":85,"complexityScore":70,"expansionScore":80,"sections":[]}],"architectureNotes":"Brief note on the overall structural strategy and how chapters build on each other","outlineScores":{"learningProgression":9,"readerJourney":8,"transformation":9,"commercialAppeal":8,"originality":8,"balance":8,"practicality":9,"frameworkCoverage":8,"readerEngagement":9,"blueprintAlignment":9}}`;
}

export function regenTitlePrompt({ level, currentTitle, parentChapter, parentSection, architecture, research }: any) {
  const a = architecture || {};
  const niche = `${a.mainNicheLabel || ""} › ${a.subNicheLabel || ""}`;
  const audience = research?.targetAudience || "";
  const tones = Array.isArray(research?.authorTones) ? research.authorTones.join(", ") : "direct and authoritative";
  const bookTopic = research?.bookTopic || "";

  const qualityRule = `TITLE QUALITY RULES (non-negotiable):
- Must be SPECIFIC, MEANINGFUL, and PUBLICATION-READY
- NEVER generate: "Beat N", "Scene N", "Section N", "Topic N", "Placeholder", "Chapter N", "Key Point", "Untitled"
- Must feel like it was written by a bestselling author — emotionally intelligent, niche-specific, commercially viable
- Example good titles: "The Fear of Falling Behind", "When Failure Becomes Identity", "Breaking the Perfectionism Loop", "What Nobody Tells You About Starting Over"`;

  if (level === "chapter") {
    return `You are an expert AI Book Architect and Amazon KDP Publishing Specialist.
Generate ONE replacement chapter title.

${qualityRule}

BOOK TOPIC: ${bookTopic}
NICHE: ${niche}
AUDIENCE: ${audience}
TONE: ${tones}
CURRENT TITLE (replace — keep the same chapter position and role in the arc): ${currentTitle}

The title must signal a clear emotional or intellectual transformation the reader will experience.
Return JSON only: {"title":"..."}`;
  }
  if (level === "section") {
    return `You are an expert AI Book Architect and Amazon KDP Publishing Specialist.
Generate ONE replacement section title.

${qualityRule}

CHAPTER: ${parentChapter || ""}
NICHE: ${niche}
AUDIENCE: ${audience}
CURRENT TITLE (replace): ${currentTitle}

The section title must identify a specific idea, concept, conflict, or angle within the chapter.
It must flow logically from the chapter title and deepen its central theme.
Return JSON only: {"title":"..."}`;
  }
  return `You are an expert AI Book Architect and Amazon KDP Publishing Specialist.
Generate ONE replacement subsection title.

${qualityRule}

CHAPTER: ${parentChapter || ""}
SECTION: ${parentSection || ""}
NICHE: ${niche}
AUDIENCE: ${audience}
CURRENT TITLE (replace): ${currentTitle}

The subsection title must be a precise, emotionally specific insight, tactic, turning point, or story angle.
It must feel like a micro-promise to the reader — something worth reading.
Return JSON only: {"title":"..."}`;
}

export function structurePrompt({ chapterTitle, chapterSummary, fullOutline, audience, tone }: any) {
  return `Create deep chapter structure for "${chapterTitle}".
Summary: ${chapterSummary}, Audience: ${audience}, Tone: ${tone}
Output JSON: {"sections":[{"title":"...","explanation":"...","subsections":[{"title":"...","strategy":"...","explanation":"...","application":"..."}]}]}
3 sections, 3 subsections each.`;
}

/**
 * Format the compact book memory object as a prompt block.
 * All fields are already size-capped in buildBookContext on the frontend.
 */
export function subtitleSuggestPrompt({ title, niche, subNiche, bookTopic, bookContext }: any): string {
  const ctxBlock = bookContext ? bookContextBlock(bookContext) : "";
  const nicheStr = [niche, subNiche].filter(Boolean).join(" › ");
  return `Generate 5 compelling, specific book subtitles for a nonfiction book.

BOOK TITLE: "${title}"
NICHE: ${nicheStr || "(not specified)"}
CORE TOPIC: ${bookTopic || "(not specified)"}${ctxBlock}

Rules for each subtitle:
- Clearly state WHO it's for AND the specific outcome/transformation they get
- 6–14 words, no more
- Sound like an Amazon bestseller (specific, outcome-driven, emotionally resonant)
- Each must be meaningfully different in angle or audience framing
- No generic phrases: "A Guide to", "Everything You Need", "The Complete", "How to"
- No quotes around the subtitle

Return ONLY valid JSON: {"subtitles":["subtitle 1","subtitle 2","subtitle 3","subtitle 4","subtitle 5"]}`;
}

export function topicSuggestPrompt({ title, subtitle, niche, subNiche, deepNiche }: any): string {
  const nicheStr = [niche, subNiche, deepNiche].filter(Boolean).join(" › ");
  return `Write a concise book topic description for a nonfiction book.

TITLE: "${title}"${subtitle ? `\nSUBTITLE: "${subtitle}"` : ""}
NICHE: ${nicheStr || "(not specified)"}

The book topic is a 1–2 sentence description that captures:
- Exactly WHO the book is for (specific reader identity, not general)
- WHAT core problem or desire it addresses
- The specific TRANSFORMATION or outcome the reader achieves

Rules:
- 20–60 words total
- Concrete and specific, no generic phrases
- Written as a statement, not a question or list
- No quotes, no bullet points, plain prose

Return ONLY valid JSON: {"topic":"your topic description here"}`;
}

// ─── Unified KDP suggest prompt (titles / subtitles / topics) ─────────────────

export function kdpSuggestPrompt({
  action,
  mainNiche,
  subNiche,
  deepNiche,
  title,
  subtitle,
}: {
  action:    "suggest_titles" | "suggest_subtitles" | "suggest_topics";
  mainNiche: string;
  subNiche:  string;
  deepNiche?: string;
  title?:    string;
  subtitle?: string;
}): string {
  return `You are an elite Amazon KDP publishing strategist, nonfiction book positioning expert, and Amazon marketplace researcher.

INPUTS

Action:
${action}

Main Niche:
${mainNiche}

Sub-Niche:
${subNiche}

Deep Niche (Optional):
${deepNiche || ""}

Selected Title:
${title || ""}

Selected Subtitle:
${subtitle || ""}

IMPORTANT

- Main Niche and Sub-Niche are required.
- Deep Niche is optional.
- Never request additional information.
- If Deep Niche is empty, use Main Niche and Sub-Niche only.
- If Deep Niche is provided, use it to improve specificity, audience targeting, positioning, and market differentiation.
- Focus on Amazon KDP nonfiction books.
- Optimize for buyer intent and conversion potential.
- Avoid generic, vague, or AI-sounding content.
- Sound like real bestselling nonfiction books.

----------------------------------------------------
STEP 1 - MARKET ANALYSIS
----------------------------------------------------

Before generating any output, analyze the niche and infer:

- Target Audience
- Primary Problem
- Desired Outcome
- Buyer Intent
- Market Opportunity

Apply this framework:

Topic + Audience + Problem + Outcome

Examples:

Affiliate Marketing + College Students + Lack of Income + Build Online Revenue

Productivity + Entrepreneurs + Lack of Focus + Get More Done

Fitness + Women Over 40 + Slow Metabolism + Sustainable Weight Loss

----------------------------------------------------
ACTION: suggest_titles
----------------------------------------------------

If action = "suggest_titles"

Generate exactly 3 title options.

Use these title formulas:

OPTION 1
Benefit + Audience

OPTION 2
Unique Concept + Benefit

OPTION 3
Transformation-Focused Title

TITLE RULES

- Short and memorable
- Commercially attractive
- Bestseller style
- Clear audience or benefit
- Strong buyer appeal
- Avoid keyword stuffing
- Avoid generic wording
- Avoid clickbait
- Sound professional
- Use title case
- NEVER use colons (:), semicolons (;), dashes (— or -), or pipes (|) as separators
- Format MUST follow one of these three patterns ONLY:
  PATTERN A — Single powerful title: "The Deep Work Catalyst"
  PATTERN B — Main title with subtitle in parentheses: "The Deep Work Catalyst (Ignite Your Focus and Multiply Your Output)"
  PATTERN C — Main title with subtitle after a comma: "The Deep Work Catalyst, Ignite Your Focus and Multiply Your Output"

Return JSON:

{
  "titles": [
    {
      "title": "",
      "angle": "Audience-Focused",
      "reason": ""
    },
    {
      "title": "",
      "angle": "Benefit-Focused",
      "reason": ""
    },
    {
      "title": "",
      "angle": "Transformation-Focused",
      "reason": ""
    }
  ]
}

----------------------------------------------------
ACTION: suggest_subtitles
----------------------------------------------------

If action = "suggest_subtitles"

Generate exactly 3 subtitle options for the selected title.

SUBTITLE FORMULA

Problem + Outcome + Method

Examples:

- A Practical System to Beat Procrastination, Reduce Stress, and Get More Done Every Day

- How to Build Better Habits, Stay Focused, and Achieve More Without Burnout

- Proven Strategies for Managing Your Time, Increasing Productivity, and Reaching Your Goals

SUBTITLE RULES

- Expand on the promise of the title
- Clarify the transformation
- Focus on benefits
- Sound professional
- Sound publishable
- Avoid fluff
- Avoid buzzwords
- Avoid AI-sounding language

Return JSON:

{
  "subtitles": [
    {
      "subtitle": "",
      "angle": "Benefit-Focused"
    },
    {
      "subtitle": "",
      "angle": "Problem-Solution"
    },
    {
      "subtitle": "",
      "angle": "Transformation-Focused"
    }
  ]
}

----------------------------------------------------
ACTION: suggest_topics
----------------------------------------------------

If action = "suggest_topics"

Generate exactly 3 topic descriptions.

TOPIC FORMULA

Audience + Problem + Outcome + Key Methods + Scope

TOPIC RULES

- Clearly define what the book covers
- Provide enough detail to guide outline generation
- Explain who the book is for
- Explain the problems being solved
- Explain the outcomes readers can expect
- Mention key systems, frameworks, or methods that will be taught
- Sound like a professional book concept

Generate:

OPTION 1
Beginner-Friendly

OPTION 2
Practical & Action-Oriented

OPTION 3
Comprehensive Authority Style

Return JSON:

{
  "topics": [
    {
      "topic": "",
      "style": "Beginner-Friendly"
    },
    {
      "topic": "",
      "style": "Practical & Action-Oriented"
    },
    {
      "topic": "",
      "style": "Comprehensive Authority Style"
    }
  ]
}

----------------------------------------------------
FINAL RULES
----------------------------------------------------

- Generate ONLY the content requested by the action.
- Return ONLY valid JSON.
- No markdown.
- No explanations.
- No additional text.
- No code blocks.`;
}

export function bookContextBlock(ctx: any): string {
  if (!ctx) return "";
  const lines: string[] = [];

  if (ctx.title)    lines.push(`Book: "${ctx.title}"${ctx.subtitle ? ` — ${ctx.subtitle}` : ""}`);
  if (ctx.niche && ctx.subNiche) lines.push(`Niche: ${ctx.niche} › ${ctx.subNiche}${ctx.deepNiche ? ` › ${ctx.deepNiche}` : ""}`);
  else if (ctx.niche) lines.push(`Niche: ${ctx.niche}`);
  if (ctx.bookTopic)   lines.push(`Core Topic: ${ctx.bookTopic}`);
  if (ctx.stance)      lines.push(`Author Stance: ${ctx.stance}`);
  if (ctx.standout)    lines.push(`What Makes It Stand Out: ${ctx.standout}`);
  if (ctx.audience)    lines.push(`Target Reader: ${ctx.audience}`);
  if (ctx.tone)        lines.push(`Voice & Tone: ${ctx.tone}`);
  if (ctx.genre)       lines.push(`Genre: ${ctx.genre}`);
  if (ctx.wordCountRange) lines.push(`Target Length: ${ctx.wordCountRange}`);
  if (ctx.structure)   lines.push(`Structure: ${ctx.structure}`);
  if (ctx.usp)         lines.push(`USP: ${ctx.usp}`);
  if (ctx.differentiation) lines.push(`Differentiation: ${ctx.differentiation}`);
  if (ctx.keySellingPoints) lines.push(`Key Selling Points: ${ctx.keySellingPoints}`);
  if (ctx.authorName)  lines.push(`Author: ${ctx.authorName}`);
  if (ctx.authorSummary) lines.push(`Author Style/Background: ${ctx.authorSummary}`);
  if (ctx.readerPainProfile)     lines.push(`Reader Pain Profile: ${ctx.readerPainProfile}`);
  if (ctx.transformationPromise) lines.push(`Transformation Promise: ${ctx.transformationPromise}`);
  if (ctx.marketGap)   lines.push(`Market Gap to Fill: ${ctx.marketGap}`);
  if (ctx.writingStyleFingerprint) lines.push(`Ideal Writing Style: ${ctx.writingStyleFingerprint}`);
  if (ctx.positioningStrategy) lines.push(`Positioning Strategy: ${ctx.positioningStrategy}`);
  if (ctx.emotionalTriggers) lines.push(`Emotional Triggers: ${ctx.emotionalTriggers}`);
  if (ctx.competitorTitles) lines.push(`Competing Titles: ${ctx.competitorTitles}`);
  if (Array.isArray(ctx.bestCompetitorInsights) && ctx.bestCompetitorInsights.length) {
    const insights = ctx.bestCompetitorInsights
      .map((ins: any, i: number) =>
        `  ${i + 1}. "${ins.sourceBook}": ${ins.coreIdea} → Adapt as: ${ins.howToAdapt}`
      )
      .join("\n");
    lines.push(`Best Competitor Ideas to Adapt (paraphrase — never copy verbatim):\n${insights}`);
  }

  if (!lines.length) return "";

  let block = `\n\n========================================\nBOOK MEMORY — carry this through all generation\n========================================\n${lines.join("\n")}`;

  if (Array.isArray(ctx.previousChapterSummaries) && ctx.previousChapterSummaries.length) {
    const s = ctx.previousChapterSummaries.map((c: any) => `  • ${c.title}: ${c.summary}`).join("\n");
    block += `\n\nPreviously Written Chapters (build on these — don't repeat concepts):\n${s}`;
  }

  return block;
}

// ─── Structure-Aware Writing Flows ────────────────────────────────────────────

const STRUCTURE_FLOWS: Record<string, { flow: string[]; description: string }> = {
  "step-by-step": {
    flow: ["Objective", "Why It Matters", "Step Explanation", "Execution Instructions", "Common Mistakes", "Action Task"],
    description: "Sequential skill-building — guide the reader through a concrete capability one step at a time."
  },
  "framework": {
    flow: ["Framework Component", "Concept Explanation", "Why It Exists", "How It Connects To Other Components", "Practical Application"],
    description: "Framework-driven — each subsection teaches one component of the larger system and shows how it connects."
  },
  "blueprint": {
    flow: ["Desired Outcome", "System Design", "Required Components", "Implementation Process", "Optimization"],
    description: "Blueprint — describe the end-state first, then architect the path to get there with precision."
  },
  "playbook": {
    flow: ["Situation", "Decision Process", "Tactical Actions", "Example Scenario", "Expected Results"],
    description: "Tactical playbook — give readers clear decision frameworks for real situations they'll face."
  },
  "problem-solution": {
    flow: ["Problem", "Root Cause", "Consequences", "Solution", "Application"],
    description: "Problem-solution — identify the exact pain point, dig to its root, then deliver the specific fix."
  },
  "case-study": {
    flow: ["Case Study", "Analysis", "Lessons", "Principles", "Application"],
    description: "Case study driven — lead with a real example, extract the lessons, then generalize the principles."
  },
  "story-based": {
    flow: ["Narrative", "Conflict", "Turning Point", "Insight", "Lesson", "Application"],
    description: "Story-based — open with a scene, build tension, deliver the turning point, extract the reader's lesson."
  },
  "narrative": {
    flow: ["Narrative", "Conflict", "Turning Point", "Insight", "Lesson", "Application"],
    description: "Narrative — immerse readers in story, then surface the insight that changes how they see the world."
  },
  "academic": {
    flow: ["Definition", "Theory", "Research", "Analysis", "Implications"],
    description: "Academic — rigorous definitions, theoretical grounding, research evidence, analytical depth, and implications."
  },
  "manifesto": {
    flow: ["Belief", "Challenge To Conventional Thinking", "Evidence", "New Perspective", "Call To Action"],
    description: "Manifesto — state a bold belief, challenge the status quo, back it with evidence, reframe the world, and inspire action."
  },
  "transformation": {
    flow: ["Starting Point", "Obstacles", "Discovery", "Transformation", "Outcome"],
    description: "Transformation journey — trace the reader's evolution from where they are now to who they'll become."
  },
  "workbook": {
    flow: ["Core Concept", "Why It Matters", "Instructions", "Exercise", "Reflection Prompt"],
    description: "Workbook — teach the concept, then immediately give the reader something to do and reflect on."
  },
  "how-to": {
    flow: ["Objective", "Why It Matters", "Step Explanation", "Execution Instructions", "Common Mistakes", "Action Task"],
    description: "How-to — practical, sequential, and action-oriented. Every subsection teaches a concrete skill."
  },
  "thematic": {
    flow: ["Theme Introduction", "Core Argument", "Supporting Evidence", "Real-World Illustration", "Reader Takeaway"],
    description: "Thematic — explore a theme from multiple angles, building a cumulative case for the central argument."
  }
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  "business":      "Write strategically and professionally. Use analytical precision. Be direct and results-oriented. Avoid fluff.",
  "self-help":     "Write with warmth and encouragement. Be practical and reader-focused. Use 'you' frequently. Make the reader feel capable.",
  "memoir":        "Write personally and reflectively. Use first-person narrative. Let vulnerability and honesty carry authority.",
  "academic":      "Write with rigor and precision. Cite evidence. Use formal language. Every claim must be grounded.",
  "inspirational": "Write with emotional energy. Uplift and motivate. Let transformation feel not just possible but inevitable.",
  "leadership":    "Write with authority and vision. Challenge readers to think bigger. Model strategic thinking in every sentence.",
  "conversational": "Write like a smart friend having a real conversation. Use contractions, rhetorical questions, short punchy paragraphs.",
  "philosophical": "Write with depth and contemplation. Let ideas breathe. Reference principles and invite the reader to think.",
  "scientific":    "Write evidence-first. Lead with data, support with research, conclude with implications. Be precise about uncertainty."
};

function resolveStructureFlow(structureRaw: string): { key: string; flow: string[]; description: string } {
  if (!structureRaw) return { key: "step-by-step", ...STRUCTURE_FLOWS["step-by-step"] };
  const lower = structureRaw.toLowerCase();
  for (const [key, val] of Object.entries(STRUCTURE_FLOWS)) {
    if (lower.includes(key)) return { key, ...val };
  }
  if (lower.includes("how") || lower.includes("guide"))  return { key: "how-to",        ...STRUCTURE_FLOWS["how-to"] };
  if (lower.includes("story") || lower.includes("narr")) return { key: "story-based",   ...STRUCTURE_FLOWS["story-based"] };
  if (lower.includes("play"))                             return { key: "playbook",      ...STRUCTURE_FLOWS["playbook"] };
  if (lower.includes("blue"))                             return { key: "blueprint",     ...STRUCTURE_FLOWS["blueprint"] };
  if (lower.includes("frame") || lower.includes("model")) return { key: "framework",    ...STRUCTURE_FLOWS["framework"] };
  if (lower.includes("trans"))                            return { key: "transformation", ...STRUCTURE_FLOWS["transformation"] };
  if (lower.includes("manifest"))                        return { key: "manifesto",     ...STRUCTURE_FLOWS["manifesto"] };
  if (lower.includes("case"))                            return { key: "case-study",    ...STRUCTURE_FLOWS["case-study"] };
  if (lower.includes("acad") || lower.includes("research")) return { key: "academic",  ...STRUCTURE_FLOWS["academic"] };
  if (lower.includes("work"))                            return { key: "workbook",      ...STRUCTURE_FLOWS["workbook"] };
  if (lower.includes("problem") || lower.includes("solution")) return { key: "problem-solution", ...STRUCTURE_FLOWS["problem-solution"] };
  return { key: "step-by-step", ...STRUCTURE_FLOWS["step-by-step"] };
}

function resolveToneInstruction(toneRaw: string): string {
  if (!toneRaw) return TONE_INSTRUCTIONS["self-help"];
  const lower = toneRaw.toLowerCase();
  for (const [key, instr] of Object.entries(TONE_INSTRUCTIONS)) {
    if (lower.includes(key)) return instr;
  }
  return `Write with the following voice and tone: ${toneRaw}. Maintain this tone consistently throughout.`;
}

// ─── Chapter Writing Strategy ──────────────────────────────────────────────────

export function chapterWritingStrategyPrompt({
  chapterTitle,
  chapterNumber,
  chapterPurpose,
  sectionTitles,
  bookContext,
  bookStructure,
  bookTone
}: any): string {
  const structureInfo = resolveStructureFlow(bookStructure || "");
  const toneInstr = resolveToneInstruction(bookTone || "");

  const ctx = bookContext || {};
  const contextLines: string[] = [];
  if (ctx.title)       contextLines.push(`Book: "${ctx.title}"`);
  if (ctx.audience)    contextLines.push(`Reader: ${ctx.audience}`);
  if (ctx.bookTopic)   contextLines.push(`Core Topic: ${ctx.bookTopic}`);
  if (ctx.corePromise) contextLines.push(`Core Promise: ${ctx.corePromise}`);
  if (ctx.transformation || ctx.transformationPromise)
    contextLines.push(`Reader Transformation: ${ctx.transformation || ctx.transformationPromise}`);
  const contextBlock = contextLines.length ? contextLines.join("\n") : "(not specified)";

  const sectionsBlock = Array.isArray(sectionTitles) && sectionTitles.length
    ? sectionTitles.map((s: string, i: number) => `  ${i + 1}. ${s}`).join("\n")
    : "  (not specified)";

  return `You are an elite nonfiction developmental editor and book strategist.

Before this chapter is written, generate a Chapter Writing Strategy that will guide every section and subsection in it.

The strategy must ensure:
1. Every subsection feels consistent with the book's chosen structure
2. Every section builds toward this chapter's single purpose
3. The writing style matches the book's tone
4. No two subsections repeat concepts or teaching methods
5. The reader experiences a clear emotional and intellectual arc within this chapter

════════════════════════════════════
BOOK & CHAPTER CONTEXT
════════════════════════════════════

${contextBlock}

Book Structure: ${bookStructure || "(not set)"}
Structure Writing Approach: ${structureInfo.description}
Writing Flow Pattern: ${structureInfo.flow.join(" → ")}

Tone: ${bookTone || "(not set)"}
Tone Instruction: ${toneInstr}

Chapter ${chapterNumber || ""}: ${chapterTitle || "(not set)"}
Chapter Purpose: ${chapterPurpose || "Deliver the full promise of this chapter title"}

Planned Sections:
${sectionsBlock}

════════════════════════════════════
STRATEGY OUTPUT
════════════════════════════════════

Return ONLY valid JSON — no markdown, no commentary:

{
  "chapterTheme": "The single unifying idea that all sections must reinforce",
  "chapterArc": "Reader's journey through this chapter: where they start emotionally/intellectually → where they end",
  "structureType": "${structureInfo.key}",
  "writingFlow": ${JSON.stringify(structureInfo.flow)},
  "toneGuidance": "2-sentence instruction on how to apply this chapter's tone — be specific to this topic",
  "openingStrategy": "How to open this chapter to immediately hook the reader",
  "closingStrategy": "How to close this chapter to set up the next chapter",
  "teachingMethods": ["List of 3-5 distinct teaching methods to vary across sections: e.g. anecdote, data, analogy, exercise, case study, direct instruction"],
  "conceptsToAvoid": ["Concepts that already appeared in prior chapters and must not be repeated"],
  "uniquenessDirective": "One sentence telling each subsection how to be completely distinct from its siblings",
  "readerOutcome": "What the reader will be able to think, do, or feel after completing this chapter"
}`;
}

// ─── Structure-Aware Lesson Prompt ────────────────────────────────────────────

const ALL_BLUEPRINT_COMPONENTS = [
  "Key Takeaways", "Action Plan", "Checklist", "Exercise",
  "Reflection Questions", "Templates", "Case Study", "Real-Life Example",
  "Research Insight", "Resources", "One Small Step",
  "Common Mistakes", "Pro Tips", "7-Day Challenge", "FAQ", "Myth vs Reality",
  "Success Story", "Brain Science", "Statistics", "Why This Happens",
  "Practical Technique", "Self-Assessment", "Common Traps", "Expert Quote", "Story",
];

export function lessonPrompt({
  subsection,
  chapterContext,
  previousConcepts,
  audience,
  tone,
  resources,
  bookContext,
  chapterStrategy,
  bookStructure,
  sectionTitle,
  subsectionPurpose,
  blueprintComponents,
  upcomingTopics,
  chapterSummaries
}: any) {
  const resBlock = resources ? resourcesBlock(resources, "lesson") : "";
  const ctxBlock = bookContext ? bookContextBlock(bookContext) : "";

  // ── Book DNA Architecture — build all DNA layers from available context ──
  const dnaBookBlock       = buildBookDNAFromContext(bookContext);
  const dnaChapterBlock    = buildChapterDNABlock(chapterContext, chapterStrategy);
  const dnaSectionBlock    = buildSectionDNABlock(sectionTitle || "", "");
  const dnaSubsectionBlock = buildSubsectionDNABlock(subsection, subsectionPurpose || "");
  const dnaGlobalMemory    = buildGlobalMemoryBlock(previousConcepts || [], chapterSummaries || []);
  const knowledgeGraphBlock = buildKnowledgeGraphBlock(bookContext?.knowledgeGraph);

  // Rich covered-content block — shows chapter/section context + key takeaway for each prior block
  const coveredContentBlock = Array.isArray(previousConcepts) && previousConcepts.length
    ? (() => {
        const items = (previousConcepts as any[]).slice(-14);
        const lines = items.map((c: any) => {
          if (typeof c === "string") return `- ${c}`;
          const chSec = [c.chapter, c.section].filter(Boolean).join(" › ");
          const prefix = chSec ? `[${chSec}] ` : "";
          const take   = c.takeaway ? ` — "${c.takeaway}"` : "";
          return `- ${prefix}${c.title}${take}`;
        });
        return `
════════════════════════════════════
COVERED CONTENT (do NOT repeat or re-introduce)
════════════════════════════════════
The following subsections have already been written. Do not restate, redefine, or re-illustrate any concept listed here. Build on them — never repeat them:
${lines.join("\n")}`;
      })()
    : "";

  // Completed-chapters summary — key ideas from fully written chapters
  const chapterSummariesBlock = Array.isArray(chapterSummaries) && chapterSummaries.length
    ? `
════════════════════════════════════
COMPLETED CHAPTERS — KEY IDEAS ALREADY ESTABLISHED
════════════════════════════════════
These chapters are complete. Do not restate their core lessons — this book moves forward, not backward:
${(chapterSummaries as any[]).map((s: any) =>
    `${s.chapter}:\n${(s.keyIdeas as string[]).map((k: string) => `  • ${k}`).join("\n")}`
  ).join("\n\n")}`
    : "";

  // Upcoming topics — what the AI must save for later sections
  const upcomingBlock = Array.isArray(upcomingTopics) && upcomingTopics.length
    ? `
════════════════════════════════════
UPCOMING SECTIONS (do NOT pre-empt these)
════════════════════════════════════
The following topics will be covered in future subsections. Do not introduce, hint at, or partially cover them here — save them for their designated place:
${(upcomingTopics as string[]).map((t: string) => `→ ${t}`).join("\n")}`
    : "";

  const rawStructure = bookStructure || bookContext?.structure || chapterStrategy?.structureType || "";
  const { key: structureKey, flow, description: flowDesc } = resolveStructureFlow(rawStructure);
  const toneInstr = resolveToneInstruction(tone || bookContext?.tone || "");

  const COMPONENT_GUIDANCE: Record<string, string> = {
    "Key Takeaways":          "end with 3–5 clearly numbered key takeaways the reader should remember",
    "Action Plan":            "include a numbered action plan with specific, time-bound steps",
    "Checklist":              "include a formatted checklist the reader can use immediately",
    "Exercise":               "include at least one hands-on exercise or practice activity with clear instructions",
    "Reflection Questions":   "include 2–3 thought-provoking reflection questions for the reader",
    "Templates":              "include a reusable template, fill-in-the-blank framework, or structured format",
    "Case Study":             "include a real, named case study with specific details and measurable outcomes",
    "Real-Life Example":      "include multiple concrete, named real-world examples (not hypotheticals)",
    "Research Insight":       "cite specific research findings, statistics, or named studies with context",
    "Resources":              "include 2–3 recommended resources (books, tools, websites) with brief descriptions",
    "One Small Step":         "include a One Small Step — one specific action the reader can take in under 5 minutes right now to build immediate momentum",
    "Common Mistakes":        "include a Common Mistakes section listing 3–4 specific, named pitfalls that derail implementation of this concept",
    "Pro Tips":               "include 2–3 Pro Tips with advanced, expert-level optimization advice for readers who have already mastered the basics",
    "7-Day Challenge":        "end with a 7-Day Challenge — a specific, clearly defined commitment or mini-project the reader must complete before proceeding",
    "FAQ":                    "include 3–4 Frequently Asked Questions that address the most common doubts, objections, or confusions readers have at this exact point",
    "Myth vs Reality":        "include 2–3 Myth vs Reality comparisons that name common false beliefs and replace them with accurate, evidence-based reframes",
    "Success Story":          "include a brief Success Story (150–200 words) about a real or realistic person who applied these concepts and achieved a meaningful transformation",
    "Brain Science":          "explain the underlying neuroscience or psychology driving this behavior or concept, in plain language",
    "Statistics":             "cite 1–2 specific, credible statistics or data points that quantify the scale or impact of this concept",
    "Why This Happens":       "explain the root cause or mechanism behind why this problem or pattern occurs",
    "Practical Technique":    "include a specific, named technique or method the reader can apply directly",
    "Self-Assessment":        "include a short Self-Assessment with 2–3 honest questions the reader can use to evaluate where they currently stand",
    "Common Traps":           "include a Common Traps section naming 2–3 subtle pitfalls readers fall into when attempting this",
    "Expert Quote":           "include a plausible, attributed expert quote that reinforces the point being made",
    "Story":                  "open or illustrate the point with a short, specific narrative story that brings the concept to life",
  };

  // Which flow-step names map to a blueprint component (so we can suppress them when not selected)
  const FLOW_STEP_TO_COMPONENT: Record<string, string> = {
    "Action Task":       "Action Plan",
    "Exercise":          "Exercise",
    "Reflection Prompt": "Reflection Questions",
    "Case Study":        "Case Study",
    "Research":          "Research Insight",
  };

  const hasBlueprint = Array.isArray(blueprintComponents) && blueprintComponents.length > 0;

  // Remove flow steps that correspond to a blueprint component the user did NOT select
  const effectiveFlow = hasBlueprint
    ? flow.filter((step: string) => {
        const mapped = FLOW_STEP_TO_COMPONENT[step];
        return !mapped || (blueprintComponents as string[]).includes(mapped);
      })
    : flow;

  const forbiddenComponents = hasBlueprint
    ? ALL_BLUEPRINT_COMPONENTS.filter((c: string) => !(blueprintComponents as string[]).includes(c))
    : [];

  // Teaching-method keywords that map onto a specific blueprint component. Chapter strategy
  // (teachingMethods) is generated ONCE per chapter and reused across every subsection in it —
  // it has no idea which blueprint components THIS subsection selected. If a suggested teaching
  // method maps to a component the reader did NOT select for this subsection, it must be dropped,
  // otherwise the model happily "follows the strategy" and smuggles in extra components.
  const TEACHING_METHOD_KEYWORD_TO_COMPONENT: Array<[string, string]> = [
    ["case study", "Case Study"],
    ["exercise", "Exercise"],
    ["checklist", "Checklist"],
    ["action plan", "Action Plan"],
    ["action step", "Action Plan"],
    ["faq", "FAQ"],
    ["statistic", "Statistics"],
    ["data", "Statistics"],
    ["anecdote", "Real-Life Example"],
    ["story", "Story"],
    ["quote", "Expert Quote"],
    ["challenge", "7-Day Challenge"],
    ["template", "Templates"],
    ["myth", "Myth vs Reality"],
    ["success story", "Success Story"],
    ["reflection", "Reflection Questions"],
    ["self-assessment", "Self-Assessment"],
    ["brain science", "Brain Science"],
    ["neuroscience", "Brain Science"],
    ["resource", "Resources"],
    ["mistake", "Common Mistakes"],
    ["pro tip", "Pro Tips"],
    ["trap", "Common Traps"],
    ["one small step", "One Small Step"],
    ["root cause", "Why This Happens"],
    ["technique", "Practical Technique"],
    ["key takeaway", "Key Takeaways"],
  ];

  function teachingMethodConflictsWithBlueprint(method: string): boolean {
    const lower = method.toLowerCase();
    for (const [keyword, component] of TEACHING_METHOD_KEYWORD_TO_COMPONENT) {
      if (lower.includes(keyword) && forbiddenComponents.includes(component)) return true;
    }
    return false;
  }

  const rawTeachingMethods: string[] = Array.isArray(chapterStrategy?.teachingMethods)
    ? chapterStrategy.teachingMethods.filter((m: any) => typeof m === "string" && m.trim())
    : [];
  const effectiveTeachingMethods = hasBlueprint
    ? rawTeachingMethods.filter((m: string) => !teachingMethodConflictsWithBlueprint(m))
    : rawTeachingMethods;

  const blueprintBlock = hasBlueprint
    ? `
════════════════════════════════════
SUBSECTION INTELLIGENCE ENGINE
════════════════════════════════════

STEP 0 — TEACHING PURPOSE ANALYSIS (do this before writing a single word)
1. What is the single core idea this subsection teaches?
2. What category balance was selected? (Engagement / Authority / Explanation / Action / Reinforcement)
3. What does the reader need right now — to understand, to be convinced, to act, or to reflect?
4. How do the selected blueprint components work together to deliver one complete learning experience?

════════════════════════════════════
BLUEPRINT COMPONENTS — EXCLUSIVE & NON-NEGOTIABLE
════════════════════════════════════
The following are the ONLY content elements for this subsection.
You MUST include every one of them. You MUST NOT include anything else.

${(blueprintComponents as string[]).map((c: string) => `✓ ${c} — ${COMPONENT_GUIDANCE[c] || `include a ${c.toLowerCase()} element`}`).join("\n")}

FORBIDDEN — do NOT generate any of the following, even partially or under an alternate name:
${forbiddenComponents.map((c: string) => `✗ ${c}`).join("\n")}
${!(blueprintComponents as string[]).includes("Action Plan") ? "✗ Action Steps / Next Steps / To-Do / Practice Steps" : ""}
${!(blueprintComponents as string[]).includes("Exercise") ? "✗ Try This / Activity / Practice Exercise / Exercise" : ""}
${!(blueprintComponents as string[]).includes("Reflection Questions") ? "✗ Reflect / Think About / Self-Assessment questions" : ""}

This blueprint list OVERRIDES the "Teaching Methods Available" list below. That list is chapter-wide guidance and was NOT generated with this subsection's blueprint in mind — if any teaching method there would introduce a forbidden component, ignore it entirely for this subsection.

════════════════════════════════════
SINGLE IDEA PRINCIPLE
════════════════════════════════════
This subsection teaches EXACTLY ONE primary concept.
Do NOT mix multiple unrelated ideas.
Every paragraph must support the same learning objective.
If multiple ideas arise, cut the weaker ones — they belong in different subsections.

════════════════════════════════════
LEARNING FLOW — adapt this sequence to the selected components
════════════════════════════════════
Design the subsection using this educational progression:

  Attention       — open with something that hooks the reader into the topic
  Understanding   — introduce the core idea in plain, clear language
  Evidence        — ground the concept in research, data, or expert insight
  Example         — make it concrete with a specific, real-world illustration
  Application     — show how the reader applies this in their own life
  Reflection      — prompt the reader to internalize the idea
  Action          — convert understanding into a specific next behavior

This order may shift based on the selected components.
Never force all 7 steps if fewer serve the concept better.
The flow should feel natural — not a mechanical checklist.

════════════════════════════════════
COMPONENT INTEGRATION — blend, don't stack
════════════════════════════════════
Blueprint components must work TOGETHER as one continuous lesson.
Do NOT generate isolated blocks that sit side by side.
Instead, weave them naturally:

  Example: Story introduces the idea → Research validates it → Checklist applies it → Key Takeaways retain it.

The reader should experience a single unbroken educational flow.
No component should feel like an interruption of the previous one.

════════════════════════════════════
PARAGRAPH DESIGN — every paragraph has a purpose
════════════════════════════════════
Possible paragraph purposes:
  Hook | Context | Explanation | Evidence | Story | Example | Comparison |
  Framework | Clarification | Application | Reflection | Transition | Action | Conclusion

Before writing each paragraph, identify its purpose internally.
If a paragraph has no clear purpose — cut it.
Never write filler paragraphs to reach a word count.

════════════════════════════════════
STORYTELLING INTELLIGENCE ENGINE (when Story, Success Story, Case Study, or Real-Life Example are selected)
════════════════════════════════════
BEFORE generating any story, answer these five questions internally:
1. Why is a story needed here — what educational job does it do?
2. What specific concept does it clarify or prove?
3. What emotion should it create in the reader?
4. What misconception should it correct?
5. What reader question does it answer?
If none of these apply — do NOT generate a story.

STORY TYPE — rotate naturally across these 16 types. Never default to one style:
  Historical Story | Scientific Discovery | Business Case Study | Startup Journey |
  Customer Story | Personal Scenario | Composite Example | Failure Story |
  Success Story | Transformation Story | Industry Story | Biography |
  Thought Experiment | Future Scenario | Hypothetical Situation | Myth vs Reality

STORY STRUCTURE — adapt this arc naturally (do not force it mechanically):
  Context → Challenge → Decision → Outcome → Lesson → Connection to Reader → Action

STORY QUALITY RULES:
  — Stories must TEACH the concept, not merely entertain
  — Be concise: cut anything that doesn't serve the lesson
  — Be believable: grounded in reality or clearly framed as a scenario
  — Avoid unnecessary dramatic details or fictional embellishment
  — One story per subsection is sufficient; never use two stories for the same point
  — Do NOT default to: coffee shop, bakery, small business owner, store owner
  — Rotate example scale: large companies | small businesses | individuals | communities | historical events | scientific examples | daily life

NICHE STORY PREFERENCES:
  Business     → case studies, startup journeys, transformation stories
  Health        → patient journeys, lifestyle examples, research discoveries
  Finance       → planning scenarios, risk comparisons, turning point stories
  History       → historical stories, biography, timelines
  Psychology    → behavior experiments, thought experiments, reflection scenarios
  Self-Help     → personal scenarios, transformation stories, composite examples

STORY QUALITY REVIEW — before finalizing any story ask:
  ✓ Does it improve understanding of the specific concept?
  ✓ Is it memorable and relevant to this reader?
  ✓ Is it concise — no wasted detail?
  ✓ Does it align with Book DNA?
  ✓ Would a premium nonfiction editor approve it?
  If any answer is NO — rewrite automatically.

════════════════════════════════════
EVIDENCE INTEGRATION (when Research Insight, Statistics, Brain Science, or Expert Quote are selected)
════════════════════════════════════
Blend evidence intelligently:
  Research findings | Statistics | Expert opinion | Industry practice | Scientific findings

Avoid excessive percentages back-to-back.
Evidence should SUPPORT the lesson — not overwhelm it.
Connect each data point directly to the reader's situation.

════════════════════════════════════
FRAMEWORK INTELLIGENCE ENGINE (when Practical Technique, Templates, Checklist, or Action Plan are selected)
════════════════════════════════════
Frameworks must become MEMORABLE ASSETS — not one-time explanations.
Create a framework only when it genuinely simplifies understanding.

FRAMEWORK TYPES — choose the form that best fits the concept:
  Models | Systems | Processes | Decision Trees | Checklists | Matrices |
  Roadmaps | Pyramids | Cycles | Loops | Hierarchies | Scoring Systems |
  Diagnostic Models | Implementation Models

FRAMEWORK DESIGN — every framework must include:
  1. NAME — memorable, simple, professional. Avoid gimmicky acronyms unless they genuinely improve recall.
  2. PURPOSE — what problem does this framework solve?
  3. COMPONENTS — what are the parts?
  4. RELATIONSHIPS — how do the parts connect?
  5. SEQUENCE — in what order are they applied?
  6. PRACTICAL USAGE — how does the reader use it right now?
  7. COMMON MISTAKES — what do people get wrong when applying it?
  8. CONNECTION — does this reconnect to or build on a framework introduced earlier in the book?

FRAMEWORK NAMING RULES:
  — Memorable and relevant to the concept
  — Simple enough to recall without the book
  — Professional — no forced acronyms unless they aid memory
  — Consistent with the book's terminology and voice

FRAMEWORK QUALITY REVIEW — before finalizing any framework ask:
  ✓ Does it simplify understanding or create unnecessary complexity?
  ✓ Is it memorable — will the reader recall it without the book?
  ✓ Is the name professional and relevant?
  ✓ Can the reader apply it immediately?
  ✓ Does it align with Book DNA and Blueprint?
  If any answer is NO — redesign automatically.

════════════════════════════════════
TRANSITIONS — natural variety required
════════════════════════════════════
Transitions between components must feel organic.
AVOID repeatedly using:
  "Now let's..." | "The next step..." | "As discussed earlier..." | "In conclusion..."

Create varied transitions that emerge naturally from the content.

════════════════════════════════════
EMOTIONAL DESIGN — track reader state
════════════════════════════════════
Each subsection should intentionally move the reader toward:
  Understanding → Confidence → Motivation → Implementation → Progress

Never leave the reader overwhelmed.
End the subsection with the reader feeling capable of applying what they just learned.

════════════════════════════════════
NICHE ADAPTATION
════════════════════════════════════
Adapt writing style automatically to the book's niche:
  Business     → Strategic, direct, outcome-focused
  Health        → Supportive, empathetic, evidence-grounded
  Finance       → Analytical, precise, risk-aware
  History       → Narrative, contextual, cause-and-effect
  Psychology    → Reflective, mechanism-explaining, self-aware
  Self-Help     → Encouraging, personal, action-oriented

════════════════════════════════════
GLOBAL VARIETY & ANTI-REPETITION ENGINE
════════════════════════════════════
Consult Global Memory before writing. Track and vary the following across the entire manuscript:

OPENING VARIETY — rotate across these 11 types. Never use the same style back-to-back:
  Question | Surprising fact | Mini story | Contradiction | Reader misconception |
  Statistic | Observation | Quotation | Challenge | Visualization | Scenario

TRANSITION VARIETY — these transitions are BANNED from overuse:
  "Now let's..." | "Next..." | "As mentioned..." | "In conclusion..." | "Moving on..."
  Use contextual transitions that emerge naturally from the content.

PARAGRAPH RHYTHM — vary deliberately:
  Never use the same paragraph length 3 times in a row.
  Mix: short punchy (1–2 sentences) | medium explanatory (3–5 sentences) | longer analytical (6+ sentences)
  Vary sentence cadence and punctuation rhythm — avoid mechanical patterns.

VOCABULARY DIVERSITY — track frequently used words:
  Avoid repeating the same verb, adjective, phrase, or connector within 3 paragraphs.
  Flag: repeated verbs | repeated connectors | repeated expressions | recurring metaphors.
  Suggest alternatives that preserve tone but avoid monotony.

STORY VARIETY — track story categories used in this section/chapter:
  Do NOT repeat the same story type consecutively.
  Do NOT default to: coffee shop | small business | startup founder | family story | sports analogy | building analogy.
  Rotate: Historical | Scientific | Business | Personal Scenario | Transformation | Thought Experiment.

FRAMEWORK VARIETY — avoid every framework looking identical:
  Rotate types: Models | Roadmaps | Matrices | Systems | Pyramids | Cycles | Decision Trees | Diagnostic Tools.
  Each framework should have a different visual structure and teaching rhythm.

EMOTIONAL RHYTHM — track emotional pacing:
  Do NOT let every subsection sound the same (all motivational, all analytical, all serious).
  Natural variation: moments of inspiration | moments of depth | moments of practicality | moments of lightness.

READER FATIGUE DETECTION — flag and rebalance if:
  3+ consecutive subsections use the same teaching approach
  Too many statistics appear back-to-back
  Too many lists follow each other without narrative relief
  Too much theory without practical application
  When fatigue risk is detected — introduce a story, observation, or different pacing.

NOVELTY CHECK — before finalizing ask:
  1. What feels different about this subsection compared to the last?
  2. What has the reader not experienced yet in this book?
  3. Can this concept be taught in a more memorable way?
  Prefer novelty without sacrificing clarity.

VARIETY SELF-REVIEW — before returning, answer internally:
  Have I used this opening style recently? → If yes, choose a different one.
  Have I used this transition before? → If yes, find an organic alternative.
  Have I repeated this story pattern? → If yes, switch story type.
  Have I overused any vocabulary? → If yes, find stronger alternatives.
  Would the reader notice repetition? → If yes, revise before returning.

════════════════════════════════════
EDITORIAL INTELLIGENCE ENGINE — run all 7 reviews internally before returning
════════════════════════════════════
Perform each editorial review in sequence. Revise the content after each review if problems are found.

1. DEVELOPMENTAL REVIEW
   — Does this subsection support the Book DNA and Blueprint?
   — Does it contribute to the chapter mission and reader transformation?
   — Does it answer the specific reader question it was designed for?
   — Would removing it weaken the book? If not, revise.

2. TECHNICAL ACCURACY REVIEW
   — Is every claim factually consistent and logically sound?
   — Are there contradictions, unsupported claims, overgeneralizations, or misleading advice?
   — If evidence is weak, add stronger support or restate with appropriate caution.

3. EDUCATIONAL REVIEW
   — Can the reader actually learn from this subsection?
   — Is the concept introduced clearly, taught in the right order, and reinforced?
   — Is implementation guidance sufficient for the reader to act?
   — If understanding is likely to fail — rewrite the explanation.

4. READER ADVOCATE REVIEW
   — Would this answer the reader's question without confusion?
   — Would a reader trust this advice and continue reading?
   — Identify any friction points (boring passages, confusing sequences, unsupported claims) and fix them.

5. COPY EDITING
   — Fix grammar, punctuation, sentence flow, and wordiness.
   — Remove passive voice where it weakens clarity.
   — Eliminate repeated words within the same paragraph.
   — Correct only where it improves readability without changing intended meaning.

6. CONSISTENCY REVIEW
   — Are terminology, framework names, and definitions consistent with earlier sections?
   — Does the tone and voice match the established author voice?
   — Are example continuity and story continuity maintained?
   — Flag and correct any inconsistency with prior content.

7. COMMERCIAL REVIEW
   — Does this subsection deliver genuine reader value a paying customer would appreciate?
   — Is it original — not generic advice that appears in every book on this topic?
   — Would a professional editor at a major publisher approve it?
   — Would a reader highlight this passage and recommend this book because of it?

QUALITY SCORECARD — score each category internally (1–10). Revise any category scoring below 7:
  Accuracy | Clarity | Teaching Effectiveness | Reader Engagement | Practical Value |
  Originality | Evidence Quality | Readability | Flow | Book DNA Alignment |
  Blueprint Alignment | Chapter Alignment | Section Alignment | Transformation Impact |
  Commercial Value | Overall Quality

REVISION STRATEGY — when revising:
  Preserve the author's intended voice.
  Improve only the areas that failed validation.
  Do not make unnecessary changes.
  Avoid repeated cycles of rewriting.

Only after all 7 reviews pass — return the final subsection.
` : "";

  const strategyBlock = chapterStrategy ? `
════════════════════════════════════
CHAPTER WRITING STRATEGY (follow this for every subsection)
════════════════════════════════════
Chapter Theme: ${chapterStrategy.chapterTheme || ""}
Chapter Arc: ${chapterStrategy.chapterArc || ""}
Tone Guidance: ${chapterStrategy.toneGuidance || ""}
Teaching Methods Available: ${effectiveTeachingMethods.length ? effectiveTeachingMethods.join(", ") : "(none applicable to this subsection's blueprint — rely on the blueprint components instead)"}
Uniqueness Directive: ${chapterStrategy.uniquenessDirective || ""}
Reader Outcome for Chapter: ${chapterStrategy.readerOutcome || ""}
${Array.isArray(chapterStrategy.conceptsToAvoid) && chapterStrategy.conceptsToAvoid.length ? `Concepts to Avoid (already in prior chapters): ${chapterStrategy.conceptsToAvoid.join("; ")}` : ""}` : "";

  const isBookIntroduction     = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "introduction");
  const isHowToUseThisBook     = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "howToUseThisBook");
  const isWhatYouWillLearn     = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "whatYouWillLearn");
  const isWhoThisBookIsFor     = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "whoThisBookIsFor");
  const isDedication           = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "dedication");
  const isAcknowledgments      = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "acknowledgments");
  const isPreface              = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "preface");
  const isFrontMatterSpecial   = isBookIntroduction || isHowToUseThisBook || isWhatYouWillLearn || isWhoThisBookIsFor || isDedication || isAcknowledgments || isPreface;

  const isConclusion            = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "conclusion");
  const isEpilogue              = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "epilogue");
  const isKeyLessons            = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "keyLessons");
  const isAppendix              = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "appendix");
  const isGlossary              = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "glossary");
  const isReferences            = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "references");
  const isFurtherReading        = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "furtherReading");
  const isBackAcknowledgments   = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "backAcknowledgments");
  const isTheEnd                = !!(chapterContext && typeof chapterContext === "object" && chapterContext.role === "theEnd");
  const isBackMatterSpecial     = isConclusion || isEpilogue || isKeyLessons || isAppendix || isGlossary || isReferences || isFurtherReading || isBackAcknowledgments || isTheEnd;

  const chapterInfo = chapterContext
    ? `Chapter: ${typeof chapterContext === "string" ? chapterContext : (chapterContext.title || JSON.stringify(chapterContext))}`
    : "";
  const sectionInfo = sectionTitle ? `Section: ${sectionTitle}` : "";
  const subsectionTitle = typeof subsection === "string"
    ? subsection
    : (subsection?.title || JSON.stringify(subsection));
  const purposeNote = subsectionPurpose
    ? `\nSubsection Purpose: ${subsectionPurpose}`
    : "";

  // ── Book-level "Introduction" — dedicated instruction set (not a generic subsection) ──
  const bookIntroBlock = isBookIntroduction ? `
════════════════════════════════════
BOOK INTRODUCTION INSTRUCTIONS
════════════════════════════════════
You are an award-winning nonfiction author, editor, and ghostwriter. Write a premium-quality, human-written book introduction that is engaging, authentic, and professionally published in style.

OVERALL GOAL:
Write an introduction that makes readers feel understood, establishes credibility, creates curiosity, and motivates them to continue reading. The writing must feel natural, thoughtful, and personal — not AI-generated or robotic.

STRUCTURE — follow this exact order:

1. OPEN WITH A STRONG HOOK
   - Begin with a compelling story, question, observation, or surprising fact related to the book's topic.
   - Immediately capture the reader's attention.
   - Avoid clichés and generic openings.
   - Do NOT start with "In today's world..." or any variation of it.

2. EXPLAIN WHY THIS TOPIC MATTERS
   - Describe the real-world problem or challenge.
   - Explain why readers should care right now.
   - Show the consequences of ignoring the issue.

3. STATE WHY THIS BOOK WAS WRITTEN
   - Clearly explain the motivation behind the book.
   - Connect the reason to the reader's needs rather than the author's achievements.
   - Be authentic and sincere.

4. IDENTIFY THE TARGET AUDIENCE
   - Explain exactly who this book is for.
   - Mention who will benefit most.
   - Make the reader feel this book was written specifically for them.

5. DESCRIBE THE TRANSFORMATION
   - Explain what readers will understand, learn, or be able to do after reading.
   - Focus on outcomes, not a table of contents.

6. ESTABLISH CREDIBILITY NATURALLY
   - Briefly mention relevant experience, research, observations, or practical knowledge.
   - Build trust through authenticity — never boastfulness.

7. PROVIDE A ROADMAP (without spoiling)
   - Give a concise sense of what the book covers and how it is structured.
   - Create curiosity rather than summarizing every chapter.

8. EXPLAIN HOW TO USE THE BOOK
   - Tell readers how to get the most value.
   - Encourage active reading and reflection where appropriate.

9. END WITH AN INSPIRING TRANSITION
   - Close with confidence and genuine encouragement.
   - Leave readers excited to begin Chapter One.

WRITING STYLE:
- Write like a bestselling nonfiction author — sound completely human.
- Use varied sentence lengths. Mix short and long paragraphs naturally.
- Avoid repetitive wording.
- Use smooth, organic transitions.
- Maintain a warm, conversational, and intelligent tone.
- Show confidence without exaggeration.
- Avoid buzzwords and marketing language.
- Do not use emojis.
- Do not use excessive bullet points — write in flowing prose.
- Do not sound academic unless this specific book demands it.

WORDS AND PHRASES TO NEVER USE:
"delve", "unlock", "journey", "game-changer", "navigate", "ever-evolving landscape",
"in conclusion", "This book is about...", overused rhetorical questions, generic motivational filler.

QUALITY CHECK — before finishing, the introduction must:
- Read naturally aloud with no robotic or repetitive phrasing.
- Maintain a consistent voice throughout.
- Build genuine anticipation for the rest of the book.
- Feel polished enough to appear in a traditionally published, premium-quality book.

LENGTH: Write approximately 1,500–2,500 words, organized into clear, readable paragraphs. Do not pad — write only what earns its place.` : "";

  // ── Book-level "How to Use This Book" — dedicated instruction set ──
  const howToUseBlock = isHowToUseThisBook ? `
════════════════════════════════════
HOW TO USE THIS BOOK — INSTRUCTIONS
════════════════════════════════════
This is a mandatory front-matter section that appears after the Introduction and before Chapter 1. Follow these rules exactly:

1. EXPLAIN THE BEST WAY TO READ THE BOOK — Recommend reading from beginning to end unless there is a genuinely better approach for this specific book's topic.
2. CLARIFY ENGAGEMENT WITH EXERCISES — Tell readers whether (and how) to complete exercises, reflection questions, or action steps as they go, rather than skipping them.
3. EXPLAIN HOW TO GET MAXIMUM VALUE — Give concrete guidance for absorbing and applying the material (pacing, environment, mindset).
4. ENCOURAGE NOTE-TAKING AND APPLICATION — Explicitly encourage the reader to take notes, apply the lessons as they read, and revisit important concepts later.
5. TONE — Encouraging and practical throughout. This is a warm, helpful guide to the reading experience, not a summary of content.

Writing style requirements:
- Write in a natural, encouraging, and practical tone.
- Do NOT summarize or reveal the book's specific chapters or arguments — this section is about HOW to read, not WHAT the book says.
- Do NOT use generic filler text ("This book is designed to help you..." repeated without substance).
- Make it feel tailored to this specific book's topic and format, not a generic template usable in any book.

Length: target approximately 250–450 words, organized into clear, readable paragraphs.` : "";

  // ── Book-level "What You Will Learn" — dedicated instruction set ──
  const whatYouWillLearnBlock = isWhatYouWillLearn ? `
════════════════════════════════════
WHAT YOU WILL LEARN — INSTRUCTIONS
════════════════════════════════════
This is a mandatory front-matter section that appears after the Introduction and before Chapter 1. Follow these rules exactly:

1. SUMMARIZE OUTCOMES — Summarize the main knowledge, skills, and outcomes the reader will gain from this specific book.
2. USE CONCISE BULLET POINTS — Present the outcomes as a scannable list of bullet points (aim for 6–10 bullets), each one short, specific, and benefit-oriented.
3. HIGHLIGHT PRACTICAL BENEFITS — Focus on tangible, practical benefits the reader will walk away with. Do NOT reveal the specific frameworks, stories, or details found inside individual chapters.
4. BUILD EXCITEMENT — The bullets and any surrounding framing should build genuine anticipation for the chapters ahead.

Writing style requirements:
- Open with 1–2 short sentences framing the list, then present the bullet points.
- Each bullet should start with a strong action verb or clear outcome (e.g. "How to...", "A simple framework for...", "Why...").
- Keep bullets tight — one line or two at most each.
- Do NOT pad with vague, generic bullets ("You will learn valuable insights").
- Make it feel tailored to this specific book's topic, not a generic template.

Length: target approximately 200–400 words total including the bullet list.` : "";

  // ── Book-level "Who This Book Is For" — dedicated instruction set ──
  const whoThisBookIsForBlock = isWhoThisBookIsFor ? `
════════════════════════════════════
WHO THIS BOOK IS FOR — INSTRUCTIONS
════════════════════════════════════
This is a mandatory front-matter section that appears after the Introduction and before Chapter 1. Follow these rules exactly:

1. CLEARLY IDENTIFY THE INTENDED AUDIENCE — Name the specific type of reader this book is written for.
2. EXPLAIN WHO BENEFITS MOST — Describe the situations, goals, or pain points that make someone an ideal reader.
3. MENTION EXPERIENCE LEVEL — State what background or experience level the book is designed for (e.g. complete beginners, people with some experience, advanced practitioners), so readers can self-select accurately.
4. REASSURE THE READER — Close by reassuring readers that the content is practical, accessible, and valuable for the intended audience, regardless of where they are starting from.

Writing style requirements:
- Write in a warm, direct, second-person voice that helps the reader see themselves in the description.
- Be specific rather than trying to appeal to "everyone" — a book for everyone convinces no one.
- Do NOT reveal specific chapter content or frameworks — this section is about the READER, not the book's contents.
- Make it feel tailored to this specific book's topic and audience, not a generic template.

Length: target approximately 200–350 words, organized into clear, readable paragraphs.` : "";

  // ── Book-level "Dedication" — dedicated instruction set ──
  const dedicationBlock = isDedication ? `
════════════════════════════════════
DEDICATION — INSTRUCTIONS
════════════════════════════════════
This is the book's short, personal dedication page — the very first page a reader sees. Follow these rules exactly:

1. LENGTH — Write 80–150 words. This is a hard requirement — do not go below 80 or above 150 words.
2. MAKE IT PERSONAL AND SINCERE — Address it to a person, group, or cause connected to the book's subject or the author's motivation for writing it (e.g. family, mentors, a community, readers who share the struggle the book addresses). Infer a plausible, fitting dedication from the book's topic and purpose — do not use a placeholder name.
3. MATCH THE BOOK'S TONE — Warm and heartfelt for personal/self-help topics; can be slightly more restrained and professional for business/technical topics.
4. NO BOOK CONTENT — Do NOT summarize or reference the book's chapters, arguments, or teachings. This page is purely a personal gesture.
5. NO GENERIC FILLER — Avoid clichés like "To everyone who believed in me" without any specificity tied to this book's subject.
6. FLOWING PROSE — Write as 2–3 short paragraphs of sincere, flowing prose. No bullet points or lists.

Length: 80–150 words exactly.` : "";

  // ── Book-level "Acknowledgments" — dedicated instruction set ──
  const acknowledgmentsBlock = isAcknowledgments ? `
════════════════════════════════════
ACKNOWLEDGMENTS — INSTRUCTIONS
════════════════════════════════════
This is the book's Acknowledgments page — a short front-matter section thanking those who contributed to the book. Follow these rules exactly:

1. THANK RELEVANT CONTRIBUTORS — Plausibly thank categories of people connected to writing and publishing a book like this: e.g. mentors or experts in the book's field, early readers/reviewers, editors, family or colleagues for support and patience, and the reader for picking up the book. Tailor the specific people/groups thanked to the book's topic and audience.
2. KEEP IT WARM BUT CONCISE — Genuine and gracious in tone, not overly long or gushing.
3. NO BOOK CONTENT — Do NOT summarize the book's arguments or teachings here. This is purely gratitude.
4. NO GENERIC FILLER OR FAKE SPECIFIC NAMES — Never invent a specific real-sounding personal name (e.g. do not write "Thank you to Jane Smith"). Refer to roles/relationships instead (e.g. "my early readers," "my mentors in this field," "my family").

Length: target approximately 100–200 words, organized into 1–3 short paragraphs.` : "";

  // ── Book-level "Preface" — dedicated instruction set ──
  const prefaceBlock = isPreface ? `
════════════════════════════════════
PREFACE — INSTRUCTIONS
════════════════════════════════════
This is the book's Preface — distinct from the Introduction. Follow these rules exactly:

1. EXPLAIN THE AUTHOR'S "WHY" — Focus on the author's personal journey, motivation, or story behind why they wrote this specific book, not on what the book teaches (that belongs in the Introduction).
2. ESTABLISH CREDIBILITY AND CONNECTION — Give the reader a sense of the author's relationship to the topic (experience, curiosity, struggle, expertise) so they trust the voice behind the book.
3. DO NOT DUPLICATE THE INTRODUCTION — Do NOT restate the book's purpose, structure, audience, or overview of chapters — that is the Introduction's job. The Preface is about the author and the origin story of the book, not about the book's contents.
4. TONE — Personal, honest, and reflective; first-person voice.

Writing style requirements:
- Write in first person, as the author speaking directly and personally to the reader.
- Do NOT use generic filler ("I have always been passionate about...") without grounding it in something specific to this book's actual subject.
- Make it feel like a genuine, specific origin story tied to this exact book's topic.

Length: target approximately 250–450 words, organized into clear, readable paragraphs.` : "";

  // ── Back Matter: Conclusion ──
  const bookConclusionBlock = isConclusion ? `
════════════════════════════════════
BOOK CONCLUSION INSTRUCTIONS
════════════════════════════════════
You are an award-winning nonfiction author, editor, and ghostwriter. Your task is to write a premium-quality, human-written conclusion for this book.

Before writing anything, carefully read and analyze all previous chapters of the manuscript provided in the CHAPTER SUMMARIES above. Use the ideas, themes, arguments, examples, tone, and progression throughout the book to create a conclusion that feels like the natural and satisfying ending of the entire work.

OVERALL OBJECTIVE:
Write a conclusion that reinforces the book's central message, celebrates the reader's progress, connects the major ideas presented throughout the chapters, and inspires readers to apply what they have learned. Provide emotional and intellectual closure while remaining authentic, insightful, and professionally written.

BEFORE DRAFTING — ANALYZE THE MANUSCRIPT:
- Identify the book's central theme and purpose.
- Identify the most important lessons developed throughout the chapters.
- Notice recurring concepts, terminology, examples, and arguments.
- Preserve the same writing style, vocabulary, pacing, and voice used throughout.
- Build upon ideas already presented — do NOT introduce unrelated topics.
- Refer to important concepts naturally without repeating them verbatim.
- Make the conclusion feel like the inevitable ending of the reader's learning experience.

STRUCTURE — follow this exact order:

1. RECONNECT WITH THE BOOK'S PURPOSE
   - Remind readers why the subject matters.
   - Revisit the original challenge or question introduced at the beginning of the book.
   - Show how the book has addressed that challenge through its chapters.

2. REFLECT ON THE READER'S PROGRESS
   - Acknowledge the knowledge and understanding the reader has gained.
   - Emphasize how each chapter contributed to a broader understanding.
   - Highlight the transformation in perspective, skills, or confidence.

3. SYNTHESIZE THE MAIN IDEAS
   - Bring together the book's most important concepts into one coherent message.
   - Show how the individual chapters connect to support the overall purpose.
   - Focus on insights and principles — not a chapter-by-chapter summary.

4. CONNECT LEARNING TO REAL-WORLD APPLICATION
   - Encourage readers to apply the ideas presented throughout the book.
   - Explain that lasting value comes from thoughtful implementation.
   - Inspire continuous learning and practical action.

5. REINFORCE THE CORE MESSAGE
   - Clearly restate the book's most important takeaway.
   - Present it in a fresh, memorable way — not by repeating earlier wording.

6. INSPIRE CONFIDENCE
   - Encourage readers to move forward with confidence and curiosity.
   - Use an encouraging but realistic tone.
   - Avoid exaggerated promises or unrealistic guarantees.

7. END WITH A MEMORABLE CLOSING
   - Finish with a thoughtful reflection, powerful insight, or meaningful observation.
   - The final paragraph provides emotional closure while leaving readers inspired.

WRITING STYLE:
- Write like a bestselling nonfiction author — sound completely human.
- Match the tone, vocabulary, and style established throughout the manuscript.
- Use varied sentence lengths and natural transitions.
- Maintain a warm, intelligent, and engaging voice.
- Be reflective without becoming repetitive.
- Balance inspiration with practical wisdom.
- Avoid unnecessary filler.

WORDS AND PHRASES TO NEVER USE:
"delve", "unlock", "journey", "game-changer", "navigate", "ever-evolving landscape",
"in conclusion", "to wrap up", "Thank you for reading", or any AI-style filler phrase.

QUALITY CHECK — the conclusion must:
- Feel like the natural ending of this specific book.
- Reference ideas from previous chapters organically.
- Reinforce the overall narrative rather than merely summarizing it.
- Leave readers feeling accomplished, confident, and motivated.
- Read like a traditionally published premium nonfiction book.
- Be cohesive, polished, and emotionally satisfying.
- End with a memorable final paragraph.

LENGTH: Write approximately 1,500–2,500 words, organized into clear paragraphs. Do not pad — every sentence must earn its place.` : "";

  // ── Back Matter: Epilogue ──
  const epilogueBlock = isEpilogue ? `
════════════════════════════════════
EPILOGUE — INSTRUCTIONS
════════════════════════════════════
This is the book's Epilogue — a reflective closing that follows the Conclusion. Follow these rules exactly:

1. REFLECT ON THE READER'S JOURNEY — Acknowledge what the reader has worked through and the transformation they have begun. Speak directly to them.
2. LOOK FORWARD — Offer an inspiring vision of what their life can look like now that they have the knowledge, tools, or mindset the book provided. Be specific to this book's topic.
3. CONNECT EMOTIONALLY — This is one of the most personal sections of the book. Write with warmth, sincerity, and genuine care for the reader's outcome.
4. CLOSE THE LOOP — If the book opened with a story, anecdote, or question in the Introduction, consider bringing it back here as a satisfying narrative resolution.
5. BRIEF CALL TO ACTION — Optionally end with one short, encouraging sentence that propels the reader to take the first step.

Writing style requirements:
- Warm, personal, and reflective — not a summary or recap.
- Do NOT repeat chapter conclusions or list lessons — that is the Conclusion's job.
- First-or second-person voice appropriate for the book's overall tone.

Length: target approximately 200–400 words, organized into clear paragraphs.` : "";

  // ── Back Matter: Key Lessons ──
  const keyLessonsBlock = isKeyLessons ? `
════════════════════════════════════
KEY LESSONS — INSTRUCTIONS
════════════════════════════════════
This is the book's Key Lessons section. It summarises what THIS SPECIFIC BOOK actually teaches — derived entirely from the chapters already written above. Follow these rules exactly:

1. READ THE CHAPTER SUMMARIES ABOVE FIRST — Every lesson must come from a concept, framework, argument, method, theory, historical event, system, or discovery that actually appears in the chapters listed in the chapter summaries block above.
2. DERIVE ONLY FROM THIS BOOK — Write what the reader learned from reading THIS book. Do not write generic advice that would apply to any book regardless of topic.
3. FORBIDDEN CONTENT — Never write lessons about: writing advice, publishing advice, Amazon, KDP, readability, bestseller patterns, commercial viability, marketing, SEO, formatting, writing style, content quality, or emotional intelligence in writing — unless the ENTIRE book is about those topics.
4. NUMBERED LIST FORMAT — Present 8–15 lessons as a numbered list. Each item: a bold lesson headline (5–10 words naming the specific concept) followed by 1–2 sentences explaining what the reader learned about that concept from this book.
5. MAINTAIN BOOK ORDER — Arrange lessons roughly in the order the concepts appeared in the chapters above.
6. NO DUPLICATION — Do not repeat the same concept twice in different words.

Writing style requirements:
- Open with a 1–2 sentence framing paragraph (e.g., "Here are the most important ideas from [Book Title]:").
- Each lesson headline must name a specific concept from the book — not a generic principle.
- Every lesson must reference the book's actual subject matter.

Quality check before writing: "Could this exact lesson appear in a book about a completely different topic?" If yes — rewrite it to be specific to THIS book's content.

Length: target approximately 400–700 words total including the numbered list.` : "";

  // ── Back Matter: Appendix ──
  const appendixBlock = isAppendix ? `
════════════════════════════════════
APPENDIX — INSTRUCTIONS
════════════════════════════════════
This is the book's Appendix — supplementary reference material that supports but does not interrupt the main text. Follow these rules exactly:

1. CHOOSE THE RIGHT FORMAT FOR THIS BOOK — Based on the book's topic, provide the most useful type of supplementary material: this may be a quick-reference checklist, a framework summary, templates the reader can apply, data tables, comparison charts, or a resource directory. Choose what genuinely adds value.
2. ORGANIZE CLEARLY — Use headers, numbered lists, or tables as appropriate. The Appendix is meant to be scanned, not read linearly.
3. PRACTICAL AND READY-TO-USE — Every item in the Appendix should be immediately usable by the reader. Avoid abstract or theoretical content here.
4. LABEL SECTIONS — If the Appendix contains multiple types of content, use clear sub-headers (e.g., "Appendix A: Quick Reference Checklist", "Appendix B: Recommended Templates").
5. REFERENCE THE MAIN TEXT — Where helpful, briefly note which chapter or concept each appendix item relates to.

Writing style requirements:
- Functional and clear — prioritize utility over prose.
- Keep explanations brief — the Appendix supplements, it does not replace, the book's content.
- Tailor the content specifically to this book's subject matter.

Length: target approximately 300–600 words, or as long as genuinely useful for this book's topic.` : "";

  // ── Back Matter: Glossary ──
  const glossaryBlock = isGlossary ? `
════════════════════════════════════
GLOSSARY — INSTRUCTIONS
════════════════════════════════════
This is the book's Glossary — definitions of terms that actually appear in THIS book's chapters. Follow these rules exactly:

1. SCAN THE CHAPTER SUMMARIES ABOVE FIRST — Every term must come from one of the chapters listed in the chapter summaries block above. Define only terms a reader of THIS book would encounter and need explained.
2. WHAT TO INCLUDE — Look for: people (historical figures, theorists, practitioners mentioned), places (locations relevant to the content), events (historical events or movements discussed), specialist terminology (jargon or technical vocabulary from the chapters), named theories and frameworks, technologies or tools described, organizations or institutions mentioned, historical periods, and important concepts central to this book's subject.
3. FORBIDDEN TERMS — Never define the following unless the ENTIRE book is literally about these topics: Readability, Bestseller Patterns, Commercial Viability, Marketability, Writing Style, Content Quality Rules, Emotional Intelligence in Writing, Formatting, KDP, Amazon, SEO, Marketing. Any term you cannot trace back to a specific chapter above must not be included.
4. DEFINE CLEARLY AND CONCISELY — Each definition: 1–3 sentences. Use plain language. Define the term as it is used in THIS book's context.
5. ALPHABETICAL ORDER — List all terms alphabetically.
6. FORMAT — Each entry: **Term**: Definition text. One blank line between entries.
7. AIM FOR 10–20 TERMS — The most important and potentially unfamiliar terms from the chapters. Do not pad with obvious everyday words.
8. AVOID CIRCULAR DEFINITIONS — Do not define a term using only that term itself.

Writing style requirements:
- Neutral, precise, and definitional — not promotional or narrative.
- Each definition must be self-contained and reflect how THIS book uses the term.

Format: Start with a 1-sentence intro line ("The following terms appear throughout this book…"), then the alphabetical term list.
Length: target approximately 300–600 words depending on the number of terms.` : "";

  // ── Back Matter: References ──
  const referencesBlock = isReferences ? `
════════════════════════════════════
REFERENCES — INSTRUCTIONS
════════════════════════════════════
This is the book's References section — a list of sources, studies, and works cited or referenced in the book. Follow these rules exactly:

1. LIST ONLY PLAUSIBLE REFERENCES — Based on the book's topic, generate a realistic list of the types of books, studies, reports, or articles an author writing this book would actually cite. Make these realistic and specific (real-sounding titles, authors, publications). Do NOT fabricate specific page numbers or DOIs.
2. FORMAT — Use a numbered list. Each entry should follow a standard citation style (e.g., Author Last, First. "Title of Work." Publication/Publisher, Year.). Keep the format consistent throughout.
3. GROUP BY TYPE — Optionally group references under sub-headers: "Books," "Academic Studies," "Reports & Data," "Articles."
4. AIM FOR 10–20 REFERENCES — Include enough to be credible for a nonfiction book of this type. Do not pad with irrelevant sources.
5. NO MADE-UP SPECIFICS — Do not invent specific ISBN numbers, DOIs, or URLs. Use realistic but generic publication info.

Writing style requirements:
- Bibliographic and precise in format — no conversational prose.
- Open with a 1-sentence intro line before the numbered list.

Length: target approximately 250–500 words.` : "";

  // ── Back Matter: Further Reading ──
  const furtherReadingBlock = isFurtherReading ? `
════════════════════════════════════
FURTHER READING — INSTRUCTIONS
════════════════════════════════════
This is the book's Further Reading section — a curated list of recommended books and resources that complement and extend the book's content. Follow these rules exactly:

1. CURATE GENUINELY RELEVANT RESOURCES — Recommend real-sounding books, courses, websites, or other resources that a reader who loved this book would genuinely benefit from. Tailor recommendations specifically to this book's topic and audience.
2. INCLUDE A BRIEF DESCRIPTION — For each recommendation, write 1–3 sentences explaining: (a) what the resource covers, and (b) why it complements this book and what the reader will gain from it.
3. ORGANIZE BY CATEGORY — Group recommendations under logical sub-headers based on the reader's next likely need (e.g., "To Go Deeper on [Topic]", "For Practical Application", "For Inspiration and Case Studies").
4. AIM FOR 6–12 RECOMMENDATIONS — Enough to be a genuinely useful reading list without being overwhelming.
5. NO FAKE SPECIFICS — Do not invent URLs or ISBN numbers. Focus on titles, authors, and brief descriptions.

Writing style requirements:
- Helpful and enthusiastic but objective — like advice from a knowledgeable mentor.
- Open with 1–2 sentences contextualizing the list before diving into categories.

Length: target approximately 300–600 words.` : "";

  // ── Back Matter: Acknowledgments (back matter version) ──
  const backAcknowledgmentsBlock = isBackAcknowledgments ? `
════════════════════════════════════
ACKNOWLEDGMENTS — INSTRUCTIONS
════════════════════════════════════
This is the book's back-matter Acknowledgments page — a warm, personal thanks to those who made the book possible. Follow these rules exactly:

1. THANK RELEVANT CONTRIBUTORS — Plausibly thank the people and groups an author of this specific book would genuinely thank: mentors or experts in the field, early readers and reviewers, editors, family, colleagues, and the reader themselves for investing their time in the book.
2. BE SPECIFIC TO THE BOOK'S FIELD — Tie the gratitude to the book's actual subject where natural (e.g., for a book on leadership: "the leaders and teams who shared their stories").
3. WARM AND SINCERE TONE — More personal and heartfelt than the rest of the book. Let the author's gratitude come through.
4. NO FAKE PERSONAL NAMES — Never invent a specific real-sounding personal name. Refer to roles and relationships (e.g., "my early readers," "the practitioners who generously shared their insights").
5. CLOSE WITH THANKS TO THE READER — The final sentence or short paragraph should thank the reader directly for reading and choosing this book.

Length: target approximately 150–300 words, organized into 2–4 short paragraphs.` : "";

  // ── Back Matter: The End ──
  const theEndBlock = isTheEnd ? `
════════════════════════════════════
THE END — INSTRUCTIONS
════════════════════════════════════
This is the book's closing "The End" page — a very brief, warm final message to the reader. Follow these rules exactly:

1. KEEP IT EXTREMELY SHORT — This is a 1–4 sentence closing. It is NOT a summary, recap, or additional content.
2. THANK THE READER — Express sincere gratitude to the reader for completing the book.
3. LEAVE THEM INSPIRED — One brief, specific sentence that encapsulates the core promise or transformation of this book, leaving the reader uplifted.
4. OPTIONALLY INVITE ENGAGEMENT — A single brief line inviting the reader to share their experience, leave a review, or connect with the author — only if it fits naturally.
5. TONE — Warm, personal, and celebratory. This is the author's final word to the reader.

Format: Present this as 2–4 short lines or very short sentences. May include "The End" as a stylistic header before or after the text if desired.
Length: 30–80 words maximum. Never longer.` : "";

  const flowBlock = (hasBlueprint || isFrontMatterSpecial || isBackMatterSpecial) ? "" : `
════════════════════════════════════
WRITING FLOW — ${structureKey.toUpperCase()} STRUCTURE
════════════════════════════════════
Structure: ${rawStructure || structureKey}
Approach: ${flowDesc}

You MUST write this subsection following this exact internal flow:
${effectiveFlow.map((step: string, i: number) => `${i + 1}. ${step}`).join("\n")}

This flow determines how you organize and sequence the content.
Do NOT use a generic introduction → explanation → example → summary template.
Each section of this flow must be substantively different and add unique value.`;

  const antiTemplateRules = (isFrontMatterSpecial || isBackMatterSpecial) ? "" : `
════════════════════════════════════
ANTI-TEMPLATE RULES (non-negotiable)
════════════════════════════════════
❌ Do NOT open every subsection with a definition
❌ Do NOT end every subsection with a summary paragraph
❌ Do NOT use the same paragraph structure as other subsections
❌ Do NOT use motivational filler, clichés, or vague advice
❌ Do NOT repeat concepts already covered

✅ Vary your opening (start with a question, a scene, a fact, a provocative claim, a short story)
✅ Let the structure type shape the pacing, not a universal template
✅ Make this subsection feel DISTINCTLY different from its siblings`;

  const qualityCheck = isBookIntroduction ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Does the opening hook the reader immediately (question, story, fact, or bold statement)?
2. Does the tone match: ${toneInstr.slice(0, 120)}
3. Is the book's purpose and value to the reader clearly and concisely stated?
4. Does it give a brief overview of themes without revealing chapter details or conclusions?
5. Does it identify the intended audience and end with an inviting transition into Chapter 1?
6. Is the length approximately 500–1,000 words?

If any answer is NO — rewrite.` : isHowToUseThisBook ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Does it clearly explain the best way to read the book?
2. Does it clarify whether/how to engage with exercises, reflection questions, or action steps?
3. Does it explain how to get maximum value from the book?
4. Does it encourage note-taking, application, and revisiting concepts?
5. Is the tone encouraging and practical, without revealing chapter content?
6. Is the length approximately 250–450 words?

If any answer is NO — rewrite.` : isWhatYouWillLearn ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Does it summarize the main knowledge, skills, and outcomes readers will gain?
2. Is the core content presented as concise, scannable bullet points?
3. Does it highlight practical benefits without revealing chapter-level details?
4. Does it build excitement for the chapters ahead?
5. Is the length approximately 200–400 words?

If any answer is NO — rewrite.` : isWhoThisBookIsFor ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Does it clearly identify the intended audience?
2. Does it explain who benefits most from reading the book?
3. Does it mention the experience level or background the book is designed for?
4. Does it reassure readers the content is practical, accessible, and valuable for them?
5. Is the length approximately 200–350 words?

If any answer is NO — rewrite.` : isDedication ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Is it short — 1 to 4 sentences only?
2. Is it personal, sincere, and plausibly tied to this book's subject or the author's motivation?
3. Does it avoid summarizing or referencing the book's actual content?
4. Does it avoid generic, unspecific clichés?

If any answer is NO — rewrite.` : isAcknowledgments ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Does it warmly thank plausible categories of contributors relevant to this book (mentors, early readers, family, the reader)?
2. Is it concise — roughly 100–200 words?
3. Does it avoid inventing specific fake personal names?
4. Does it avoid summarizing the book's content?

If any answer is NO — rewrite.` : isPreface ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Is it written in first person, focused on the author's personal journey or motivation?
2. Does it avoid duplicating the Introduction's purpose/overview/audience content?
3. Is the tone personal, honest, and reflective?
4. Is the length approximately 250–450 words?

If any answer is NO — rewrite.` : isConclusion ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Does it reconnect with the book's original purpose and demonstrate a clear understanding of all previous chapters?
2. Does it synthesize the main ideas into a coherent message rather than summarizing chapters one-by-one?
3. Does it inspire the reader to apply what they've learned and move forward with confidence?
4. Is the tone warm, intelligent, and consistent with the manuscript's voice throughout?
5. Does the final paragraph provide genuine emotional closure and leave the reader inspired?
6. Is the length approximately 1,500–2,500 words with no filler, no repetition, and no AI-style phrases?

If any answer is NO — rewrite.` : isEpilogue ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Does it speak directly to the reader and acknowledge their journey through the book?
2. Does it look forward with an inspiring, topic-specific vision — not backward summarizing chapters?
3. Is the tone warm, personal, and emotionally resonant?
4. Is the length approximately 200–400 words?

If any answer is NO — rewrite.` : isKeyLessons ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Are there 8–15 specific, actionable lessons drawn from the actual book content?
2. Is each lesson concrete and tied to this book's topic — not a vague platitude?
3. Are lessons presented as a numbered list with a bold headline + brief elaboration?
4. Is the total length approximately 400–700 words?

If any answer is NO — rewrite.` : isAppendix ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Is the supplementary material genuinely useful and relevant to this book's topic?
2. Is it organized with clear headers, lists, or tables — designed to be scanned, not read linearly?
3. Is every item immediately practical and ready-to-use?
4. Does it avoid duplicating content already in the main chapters?

If any answer is NO — rewrite.` : isGlossary ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Does it include only terms that actually appear in or are central to this specific book?
2. Is each definition clear, concise (1–3 sentences), and in plain language?
3. Are terms listed in alphabetical order with the **Term**: Definition format?
4. Are there 10–20 terms — enough to be useful without padding?

If any answer is NO — rewrite.` : isReferences ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Are the references plausible and specific to this book's topic and field?
2. Is a consistent citation format used throughout?
3. Are there 10–20 references — enough to be credible?
4. Are no specific ISBN numbers, DOIs, or URLs fabricated?

If any answer is NO — rewrite.` : isFurtherReading ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Are all recommendations genuinely relevant to this book's topic and audience?
2. Does each recommendation include a 1–3 sentence description of what it covers and why it complements this book?
3. Are resources organized under logical category sub-headers?
4. Are there 6–12 recommendations?

If any answer is NO — rewrite.` : isBackAcknowledgments ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Does it warmly thank plausible categories of contributors relevant to this specific book?
2. Is it more personal and heartfelt than the rest of the book?
3. Does it avoid inventing specific fake personal names?
4. Does it close with a direct thank-you to the reader?
5. Is the length approximately 150–300 words?

If any answer is NO — rewrite.` : isTheEnd ? `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Is it extremely short — 30–80 words maximum?
2. Does it thank the reader sincerely?
3. Does it leave the reader inspired with a specific, book-relevant closing thought?
4. Is the tone warm, personal, and celebratory?

If any answer is NO — rewrite.` : `
════════════════════════════════════
EDITORIAL INTELLIGENCE ENGINE — run all 7 reviews before returning
════════════════════════════════════
Perform each review in sequence. Revise the content if any review reveals a problem.

1. DEVELOPMENTAL: Teaches one clear idea? Supports Book DNA, Blueprint, chapter mission, reader transformation? Writing flow matches ${structureKey}?
2. TECHNICAL: Every claim factually sound and logically consistent? No contradictions, overgeneralizations, or unsupported advice?
3. EDUCATIONAL: Can the reader actually learn from this? Concept clear? Right teaching order? Implementation guidance present? Tone matches: ${toneInstr.slice(0, 100)}?
4. READER ADVOCATE: Opening varied and engaging (not a definition)? Transitions natural (no "Now let's...", "The next step is...")? Reader leaves feeling capable?
5. COPY EDIT: Grammar, flow, sentence variety, wordiness, passive voice, repeated words — all clean?
6. CONSISTENCY: Voice, terminology, and style consistent with prior sections? Content unique — no overlap with adjacent subsections?
7. COMMERCIAL: Provides unique value a paying reader would highlight? Would a premium publisher in the ${structureKey} genre approve this?

QUALITY SCORECARD — score internally (1–10). Auto-revise any category below 7:
  Accuracy | Clarity | Teaching Effectiveness | Reader Engagement | Practical Value |
  Originality | Evidence Quality | Readability | Flow | Book DNA Alignment |
  Blueprint Alignment | Chapter Alignment | Transformation Impact | Commercial Value | Overall Quality

REVISION STRATEGY: Preserve author voice. Fix only failing areas. No unnecessary changes.
If any review fails — revise automatically before returning.`;

  return `You are a professional nonfiction author, instructional designer, and developmental editor. Your responsibility is to transform all available planning intelligence — Book DNA, Blueprint, Outline, Chapter DNA, Section DNA, Subsection DNA, Component Teaching Plan, and Global Memory — into premium-quality nonfiction content.

You do NOT generate text one paragraph at a time. You construct every subsection as a complete learning experience that supports the overall transformation promised by the book. Every subsection should feel like it was written by an experienced subject matter expert — accurate, useful, clear, practical, engaging, well-paced, and commercially valuable.

You must use ALL available data provided below — including topic research, bestseller analysis, competitor insights, book positioning, target audience, book description, chapter outline, chapter strategy, and any previously written sections.

════════════════════════════════════
AUTHOR THINKING PROCESS — answer these six questions internally before writing a single word
════════════════════════════════════
1. What is the single most important idea this subsection must teach?
2. Why does the reader need this right now — what problem, gap, or obstacle does it address?
3. What misconception or wrong assumption should this subsection correct?
4. What practical outcome should the reader achieve after reading this?
5. How does this subsection support the chapter mission and section objective?
6. How does this move the reader one concrete step closer to the transformation the book promises?

Only after answering all six questions should writing begin.

════════════════════════════════════
LOCATION IN BOOK
════════════════════════════════════
${chapterInfo}
${sectionInfo}
Subsection: ${subsectionTitle}${purposeNote}

Target Reader: ${audience || "(see book context)"}
Voice & Tone: ${tone || "(see book context)"}
Tone Instruction: ${toneInstr}${knowledgeGraphBlock}${coveredContentBlock}${chapterSummariesBlock}${upcomingBlock}${strategyBlock}${blueprintBlock}${bookIntroBlock}${howToUseBlock}${whatYouWillLearnBlock}${whoThisBookIsForBlock}${dedicationBlock}${acknowledgmentsBlock}${prefaceBlock}${bookConclusionBlock}${epilogueBlock}${keyLessonsBlock}${appendixBlock}${glossaryBlock}${referencesBlock}${furtherReadingBlock}${backAcknowledgmentsBlock}${theEndBlock}${flowBlock}${antiTemplateRules}

════════════════════════════════════
WRITING INTELLIGENCE — NON-NEGOTIABLE RULES
════════════════════════════════════

CONTENT QUALITY
1. CONSISTENCY — Match the voice, terminology, and narrative thread established in earlier sections. Do not contradict or reintroduce concepts already resolved.
2. NO REPETITION — Every concept, framework, or example used here must be NEW. If previousConcepts lists it, do not repeat it in any form.
3. DEPTH — Go deep on one idea rather than shallow on many. Expand important ideas beyond surface-level explanation. Experts earn nuance, research, and comparisons; beginners earn analogies and step-by-step breakdowns.
4. STANDALONE VALUE — This subsection must be valuable even if read in isolation. A reader who sees only this piece should gain a complete, usable insight.
5. NO GENERIC ADVICE, NO FILLER — Every sentence must earn its place. Cut anything that could appear in any book on any subject.

HUMAN-LIKE WRITING
6. NATURAL VOICE — Write like a confident, experienced human author. Avoid all predictable AI language. These phrases are BANNED:
   ✗ "It is important to note..." | "In today's world..." | "Let's dive in..." | "In conclusion..."
   ✗ "Now let's discuss..." | "This is a game-changer..." | "Unlock your potential..."
   ✗ "Delve into..." | "Navigate..." | "In essence..." | "Needless to say..."
   ✗ Opening with "The" followed by an abstract noun (e.g. "The concept of...", "The importance of...")
   ✗ Any phrase that could open a Wikipedia article
7. TONE — Stay strictly within the selected tone and structure type. No tonal drift between formal and casual.
8. VOICE CONSISTENCY — Maintain the same author voice established in earlier sections. The reader should hear one clear, consistent intelligence throughout the book.

READABILITY
9. VARIED RHYTHM — Mix paragraph lengths deliberately: short punchy paragraphs (1–2 sentences) for emphasis, medium paragraphs for explanation, longer paragraphs for complex reasoning. Never use the same length three paragraphs in a row.
10. SENTENCE VARIETY — Vary sentence structure and length. Avoid mechanical repetition of the same pattern (Subject + Verb + Object, Subject + Verb + Object, ...).
11. SMOOTH TRANSITIONS — Open with a bridge that connects to the prior subsection. Close with a sentence that naturally leads forward. Transitions must reinforce the learning journey, not merely link topics.

EXAMPLES AND EVIDENCE
12. REAL EXAMPLES ONLY — Include at least one concrete, specific, named example (real person, company, event, research finding). No hypothetical placeholders without grounding.
13. ROTATE EXAMPLE TYPES — Vary across: real businesses | historical events | scientific discoveries | personal scenarios | industry examples | composite examples. Avoid using the same example type back to back. Rotate example scale too: large corporations | small businesses | individuals | communities | daily life.

STORYTELLING INTELLIGENCE
14. STORY STRATEGY — Before writing any story, answer internally: Why is a story needed? What concept does it clarify? What emotion should it create? What misconception does it correct? If none of these apply — do NOT write a story.
15. STORY TYPES — Rotate across: Historical Story | Scientific Discovery | Business Case Study | Startup Journey | Customer Story | Personal Scenario | Composite Example | Failure Story | Transformation Story | Industry Story | Thought Experiment | Future Scenario. Never default to one type throughout the book.
16. STORY STRUCTURE — Adapt this arc naturally: Context → Challenge → Decision → Outcome → Lesson → Connection to Reader → Action. Do not force it mechanically.
17. STORY RULES — Be concise (cut anything not serving the lesson), believable (grounded or clearly framed), and educational (teaches the concept, not just entertains). Do NOT default to: coffee shop, bakery, small business owner, store owner.

FRAMEWORK INTELLIGENCE
18. FRAMEWORK PURPOSE — Create a framework only when it genuinely simplifies understanding. Choose the form that fits: Models | Processes | Decision Trees | Checklists | Matrices | Roadmaps | Cycles | Scoring Systems | Diagnostic Models.
19. FRAMEWORK DESIGN — Every framework must include: a memorable NAME, its PURPOSE (what problem it solves), its COMPONENTS, the RELATIONSHIPS between parts, the SEQUENCE of application, PRACTICAL USAGE guidance, COMMON MISTAKES, and how it CONNECTS to earlier frameworks in the book.
20. FRAMEWORK NAMING — Memorable, simple, professional, and relevant. Avoid gimmicky acronyms unless they genuinely aid recall. Reuse framework names consistently once established.

ANALOGIES AND MEMORABILITY
21. ANALOGIES — Use analogies only when they improve understanding for the target audience. Do NOT repeatedly compare concepts to: sports, driving, cooking, or building. Vary the source domain based on what the reader's world actually looks like.
22. MEMORABILITY — Improve retention through: mental models, visual language, contrast, progressive examples (simple → complex), simple terminology, and strategic vocabulary repetition. Do NOT repeat vocabulary mechanically — repeat key terms strategically at spaced intervals.

COMPETITOR INTELLIGENCE
23. COMPETITOR STRATEGY — Use competitor data in two ways:
    a) FILL GAPS: Deliver something competing books miss, handle superficially, or get wrong.
    b) ADAPT BEST IDEAS: Take the best ideas that work in the market and present them through a completely fresh angle — new framing, stronger evidence, a different example, or a more actionable version. Never copy phrasing.

DEPTH CONTROL
15. AUDIENCE-CALIBRATED DEPTH — Match detail level to the reader's stage:
    Beginners: more explanation, more analogies, more examples, more encouragement
    Intermediate: balance explanation with application, introduce nuance
    Advanced/Expert: more research, more nuance, more comparisons, advanced implementation
    Do NOT over-explain concepts the reader is already expected to understand.

PRACTICALITY
16. ACTIONABLE ADVICE — ${hasBlueprint && !(blueprintComponents as string[]).some((c: string) => ["Action Plan","Checklist","Exercise"].includes(c)) ? "Make ideas concrete and directly applicable to the reader's situation without forcing action steps." : "Every key point must close with something the reader can DO. Replace generic explanations with specific instructions."}
17. IMPLEMENTATION FIRST — When appropriate, conclude ideas with practical implementation: exercises, templates, reflection prompts, decision tools, action plans, checklists, mini challenges. Only include what genuinely improves understanding — never pad.

GLOBAL VARIETY & ANTI-REPETITION ENGINE
24. OPENING VARIETY — rotate across 11 types. Never use the same opening style consecutively:
    Question | Surprising fact | Mini story | Contradiction | Reader misconception |
    Statistic | Observation | Quotation | Challenge | Visualization | Scenario

25. TRANSITION VARIETY — these transitions are banned from overuse:
    "Now let's..." | "Next..." | "As mentioned..." | "In conclusion..." | "Moving on..."
    Use contextual transitions that emerge naturally from the content.

26. PARAGRAPH RHYTHM — never use the same paragraph length 3 times in a row. Mix: short (1–2 sentences) | medium (3–5) | long analytical (6+). Vary sentence cadence and punctuation patterns.

27. VOCABULARY DIVERSITY — avoid repeating the same verb, adjective, phrase, or connector within 3 paragraphs. Track: repeated verbs | repeated connectors | recurring metaphors. Substitute alternatives that preserve tone.

28. EMOTIONAL RHYTHM — vary emotional pacing. Do NOT let every subsection feel identical (all motivational, all analytical, all serious). Natural variation: inspiration | depth | practicality | moments of lightness.

29. READER FATIGUE DETECTION — if 3+ consecutive subsections use the same teaching approach, too many statistics appear back-to-back, or too many lists follow without narrative relief — introduce a story, observation, or different pacing to rebalance.

30. NOVELTY ENGINE — before writing, answer internally: What feels different here? What has the reader not experienced yet? Can this concept be taught more memorably? Prefer novelty without sacrificing clarity.

EDITORIAL INTELLIGENCE ENGINE (internal — run before returning)
18. After completing the subsection, perform all 7 editorial reviews in sequence:

    DEVELOPMENTAL: Supports Book DNA? Blueprint? Chapter mission? Reader transformation? If not — revise.
    TECHNICAL: Every claim factually sound? No contradictions, overgeneralizations, or misleading advice? If not — correct.
    EDUCATIONAL: Can the reader actually learn this? Concept clear? Right teaching order? Implementation guidance present? If not — rewrite.
    READER ADVOCATE: Would reader trust this and continue reading? Any confusion or friction? If yes — fix.
    COPY EDIT: Grammar, flow, wordiness, passive voice, repeated words — correct without changing meaning.
    CONSISTENCY: Terminology, framework names, tone, voice — consistent with prior sections? Fix any drift.
    COMMERCIAL: Does this deliver genuine reader value? Is it original? Would a major publisher approve it?

    QUALITY SCORECARD — score each internally (1–10). Auto-revise any category below 7:
      Accuracy | Clarity | Teaching Effectiveness | Reader Engagement | Practical Value |
      Originality | Evidence Quality | Readability | Flow | Book DNA Alignment |
      Blueprint Alignment | Chapter Alignment | Section Alignment | Transformation Impact |
      Commercial Value | Overall Quality

    REVISION STRATEGY: Preserve author voice. Improve only failing areas. No unnecessary changes.
    The reader should feel they have learned something meaningful — not merely consumed words.

${qualityCheck}${ctxBlock}${resBlock}

════════════════════════════════════
REQUIRED OUTPUT STRUCTURE
════════════════════════════════════
${isBookIntroduction
  ? `Follow the BOOK INTRODUCTION INSTRUCTIONS above exactly — hook, background/context, purpose, brief overview, intended audience, invitation to continue reading.
Target length: approximately 500–1,000 words.
The prose must flow as unified paragraphs — do NOT use section headers or labels inside the content, and do NOT include chapter summaries or spoilers.`
  : isHowToUseThisBook
  ? `Follow the HOW TO USE THIS BOOK INSTRUCTIONS above exactly — best way to read, engagement with exercises/action steps, how to get maximum value, encouragement to take notes and revisit concepts.
Target length: approximately 250–450 words.
The prose must flow as unified paragraphs — do NOT use section headers or labels inside the content.`
  : isWhatYouWillLearn
  ? `Follow the WHAT YOU WILL LEARN INSTRUCTIONS above exactly — a short framing intro followed by 6–10 concise, benefit-oriented bullet points summarizing outcomes.
Target length: approximately 200–400 words total.
Use a short framing paragraph, then plain-text bullet points (each starting with "- ") — this is the one front-matter section where bullet points are required instead of unified prose.`
  : isWhoThisBookIsFor
  ? `Follow the WHO THIS BOOK IS FOR INSTRUCTIONS above exactly — identify the audience, who benefits most, experience level, and reassurance the content is practical and accessible.
Target length: approximately 200–350 words.
The prose must flow as unified paragraphs — do NOT use section headers or labels inside the content.`
  : isDedication
  ? `Follow the DEDICATION INSTRUCTIONS above exactly — short, personal, sincere, tied to the book's subject or the author's motivation.
Target length: 1–4 sentences (roughly 15–60 words). Never longer.
No headers or labels — just the dedication text itself.`
  : isAcknowledgments
  ? `Follow the ACKNOWLEDGMENTS INSTRUCTIONS above exactly — warmly thank plausible categories of contributors relevant to this book.
Target length: approximately 100–200 words.
The prose must flow as 1–3 short paragraphs — do NOT use section headers or labels inside the content.`
  : isPreface
  ? `Follow the PREFACE INSTRUCTIONS above exactly — the author's personal journey and motivation for writing this specific book, first-person voice.
Target length: approximately 250–450 words.
The prose must flow as unified paragraphs — do NOT use section headers or labels inside the content.`
  : isConclusion
  ? `Follow the BOOK CONCLUSION INSTRUCTIONS above exactly — reconnect with the book's purpose, reflect on the reader's progress, synthesize the main ideas, connect learning to real-world application, reinforce the core message, inspire confidence, and end with a memorable closing paragraph.
Target length: approximately 1,500–2,500 words.
The prose must flow as unified paragraphs that match the manuscript's established voice. Do NOT summarize chapters one by one. Do NOT use section headers or labels inside the content.`
  : isEpilogue
  ? `Follow the EPILOGUE INSTRUCTIONS above exactly — reflect on the reader's journey, look forward with inspiration, connect emotionally, and optionally close the narrative loop from the Introduction.
Target length: approximately 200–400 words.
The prose must flow as unified paragraphs — warm, personal, and forward-looking. Do NOT use section headers or labels inside the content.`
  : isKeyLessons
  ? `Follow the KEY LESSONS INSTRUCTIONS above exactly — a short framing intro followed by 8–15 numbered lessons, each with a bold headline (5–10 words) and 1–2 sentences of elaboration.
Target length: approximately 400–700 words total.
Use a numbered list format with a bold headline per lesson. Keep lessons specific, actionable, and tied to this book's content.`
  : isAppendix
  ? `Follow the APPENDIX INSTRUCTIONS above exactly — practical supplementary reference material (checklist, templates, tables, or resource directory) organized with clear sub-headers and designed to be scanned.
Target length: approximately 300–600 words, or as long as genuinely useful.
Use headers, numbered lists, or tables as appropriate — do NOT write flowing narrative prose here.`
  : isGlossary
  ? `Follow the GLOSSARY INSTRUCTIONS above exactly — a 1-sentence intro followed by an alphabetical list of 10–20 key terms with concise, plain-language definitions.
Format: **Term**: Definition text. (One blank line between entries.) Target approximately 300–600 words total.
Do NOT use flowing narrative prose — this is a reference section.`
  : isReferences
  ? `Follow the REFERENCES INSTRUCTIONS above exactly — a 1-sentence intro followed by a numbered list of 10–20 plausible, consistently formatted citations relevant to this book's topic.
Target approximately 250–500 words total.
Do NOT fabricate specific ISBN numbers, DOIs, or URLs. Focus on realistic author, title, publisher, and year information.`
  : isFurtherReading
  ? `Follow the FURTHER READING INSTRUCTIONS above exactly — 1–2 sentence framing intro followed by 6–12 curated book/resource recommendations grouped under category sub-headers, each with a 1–3 sentence description.
Target approximately 300–600 words total.
Recommendations must be specific to this book's topic and include a clear explanation of WHY each resource complements this book.`
  : isBackAcknowledgments
  ? `Follow the ACKNOWLEDGMENTS INSTRUCTIONS above exactly — warmly thank 2–4 categories of plausible contributors relevant to this specific book, and close with a direct thank-you to the reader.
Target approximately 150–300 words, organized into 2–4 short paragraphs.
The prose must flow as unified paragraphs — warm, personal, and sincere. Do NOT use section headers or labels.`
  : isTheEnd
  ? `Follow the THE END INSTRUCTIONS above exactly — an extremely brief (30–80 words maximum), warm closing message: thank the reader, leave them inspired with a topic-specific thought, and optionally invite engagement.
May include "The End" as a stylistic header. Never exceed 80 words.`
  : hasBlueprint
  ? `SUBSECTION INTELLIGENCE ENGINE — WRITING INSTRUCTIONS
════════════════════════════════════════════
Build this subsection as a COMPLETE LEARNING EXPERIENCE, not a collection of paragraphs.

CONSTRUCTION SEQUENCE:
1. START with an Attention hook — one sentence or short scene that pulls the reader in immediately
2. ESTABLISH the single core idea in plain, clear language (2–3 sentences)
3. INTEGRATE the selected blueprint components in a natural educational flow:
   — Let Engagement components (Story, Example, Case Study) open or illustrate
   — Let Authority components (Research, Statistics, Brain Science) validate
   — Let Explanation components (Practical Technique, Common Mistakes, FAQ) clarify
   — Let Action components (Exercise, Checklist, Action Plan, Templates) apply
   — Let Reinforcement components (Key Takeaways, Reflection Questions, Pro Tips) cement
4. BLEND the components — they must work as one continuous lesson, not isolated blocks
5. CLOSE by leaving the reader feeling capable and ready to apply what they just learned

WRITING RULES:
— Flowing prose only. No internal headers or bold labels for component names.
— Every paragraph has a clear purpose. No filler.
— Transitions between components must feel organic — never use "Now let's..." or "The next step is..."
— Stories must teach the concept, not just entertain. Rotate story types (avoid coffee shop / bakery defaults).
— Evidence should support the lesson, not overwhelm it.
— One story per subsection is enough — never use two stories for the same point.
— End with the reader in a stronger position than when they started.

ONLY include the blueprint components listed above. Do NOT add any FORBIDDEN component.`
  : `Every section MUST follow this exact 6-part structure internally within the prose:

1. ENGAGING INTRODUCTION — Hook the reader with a surprising fact, bold claim, short scene, or provocative question specific to this topic. No generic warm-ups.
2. CLEAR CONCEPT EXPLANATION — Define and explain the core idea with precision. Use plain language. Anchor it to the reader's real situation.
3. REAL-WORLD EXAMPLE — A specific, concrete, named example (person, company, situation, research finding) that proves the concept works. Not a hypothetical.
4. PRACTICAL ACTION STEPS — 2–4 specific, numbered steps the reader can execute immediately. Not tips — steps with clear verbs and measurable outcomes.
5. KEY TAKEAWAY — One distilled sentence that captures the single most important lesson. Make it memorable and quotable.
6. NATURAL TRANSITION — A closing sentence or short paragraph that bridges into the next section without announcing it ("Next, we'll look at…").

The prose must flow as unified paragraphs — do NOT use section headers or labels inside the content.`}

${isBookIntroduction ? `════════════════════════════════════
INTRODUCTION QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Does this introduction hook the reader, establish the book's purpose and value, and make them want to keep reading — without giving away the content of the chapters?"
If the answer is no — rewrite.` : isHowToUseThisBook ? `════════════════════════════════════
HOW TO USE THIS BOOK QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Does this genuinely help the reader engage with THIS book — its exercises, pacing, and format — without repeating what the Introduction already said?"
If the answer is no — rewrite.` : isWhatYouWillLearn ? `════════════════════════════════════
WHAT YOU WILL LEARN QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Would a skimming reader immediately grasp the concrete outcomes of this book from the bullet points alone, without needing the rest of the book?"
If the answer is no — rewrite.` : isWhoThisBookIsFor ? `════════════════════════════════════
WHO THIS BOOK IS FOR QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Would the ideal reader recognize themselves in this description within the first two sentences?"
If the answer is no — rewrite.` : isDedication ? `════════════════════════════════════
DEDICATION QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Is this short, sincere, and specific to this book's subject or the author's motivation — not a generic template dedication?"
If the answer is no — rewrite.` : isAcknowledgments ? `════════════════════════════════════
ACKNOWLEDGMENTS QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Does this feel like genuine, warm gratitude tied to this specific book, without inventing fake personal names?"
If the answer is no — rewrite.` : isPreface ? `════════════════════════════════════
PREFACE QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Does this reveal the author's personal story and motivation for this book, without repeating what the Introduction already covers?"
If the answer is no — rewrite.` : isConclusion ? `════════════════════════════════════
CONCLUSION QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Does this conclusion clearly reflect a deep reading of the entire manuscript, synthesize the book's ideas into a coherent final message, inspire the reader to act, and end with a paragraph memorable enough to be the last thing a reader remembers?"
If the answer is no — rewrite.` : isEpilogue ? `════════════════════════════════════
EPILOGUE QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Does this speak directly to the reader, look forward with an inspiring and topic-specific vision, and feel emotionally resonant — without summarizing chapters?"
If the answer is no — rewrite.` : isKeyLessons ? `════════════════════════════════════
KEY LESSONS QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Are the lessons specific, actionable, and genuinely drawn from this book's content — not generic wisdom applicable to any book?"
If the answer is no — rewrite.` : isAppendix ? `════════════════════════════════════
APPENDIX QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Is this supplementary material immediately practical, clearly organized to be scanned, and genuinely specific to this book's topic?"
If the answer is no — rewrite.` : isGlossary ? `════════════════════════════════════
GLOSSARY QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Are these real terms from this specific book, defined clearly in plain language, alphabetically ordered, and in the correct **Term**: Definition format?"
If the answer is no — rewrite.` : isReferences ? `════════════════════════════════════
REFERENCES QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Are these plausible, topic-specific references formatted consistently, without fabricated ISBNs, DOIs, or URLs?"
If the answer is no — rewrite.` : isFurtherReading ? `════════════════════════════════════
FURTHER READING QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Are these recommendations genuinely relevant to this book's topic, with a clear explanation of why each one complements this book?"
If the answer is no — rewrite.` : isBackAcknowledgments ? `════════════════════════════════════
ACKNOWLEDGMENTS QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Does this feel like genuine, warm, and specific gratitude tied to this book, closing with a direct thank-you to the reader — without inventing fake personal names?"
If the answer is no — rewrite.` : isTheEnd ? `════════════════════════════════════
THE END QUALITY TEST
════════════════════════════════════
Before writing, answer internally: "Is this 30–80 words maximum, warm, sincere, and does it leave the reader genuinely inspired by something specific to this book's topic?"
If the answer is no — rewrite.` : `════════════════════════════════════
SUBSECTION UNIQUENESS TEST
════════════════════════════════════
Before writing, answer internally: "What unique value does this subsection provide that no other subsection provides?"
If the answer overlaps with another subsection — reframe the angle until it is genuinely distinct.`}

════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════
Return ONLY valid JSON — no markdown fences, no commentary outside the JSON:

{
  "title": "The subsection title (publication-ready, specific, compelling)",
  "structureUsed": "${structureKey}",
  "content": "${isBookIntroduction ? `The full book Introduction following the BOOK INTRODUCTION INSTRUCTIONS above — hook, background/context, purpose, brief overview, intended audience, invitation to continue reading. Multi-paragraph, flowing prose with no internal headers. Approximately 500-1000 words. Natural paragraph breaks.` : isHowToUseThisBook ? `The full How to Use This Book section following the instructions above — best way to read, exercises/action steps guidance, maximum value tips, encouragement to take notes and revisit concepts. Flowing prose with no internal headers. Approximately 250-450 words.` : isWhatYouWillLearn ? `A short framing intro followed by 6-10 concise bullet points (each line starting with "- ") summarizing knowledge, skills, and outcomes the reader will gain. Approximately 200-400 words total.` : isWhoThisBookIsFor ? `The full Who This Book Is For section following the instructions above — intended audience, who benefits most, experience level, reassurance. Flowing prose with no internal headers. Approximately 200-350 words.` : isDedication ? `The full dedication text following the instructions above — personal, sincere, 2-3 flowing paragraphs. Exactly 80–150 words. No headers or labels.` : isAcknowledgments ? `The full acknowledgments text following the instructions above — warm thanks to plausible categories of contributors. 1-3 short paragraphs, approximately 100-200 words.` : isPreface ? `The full Preface text following the instructions above — the author's personal journey and motivation for writing this book, first-person voice. Flowing prose with no internal headers. Approximately 250-450 words.` : isConclusion ? `The full book Conclusion following the BOOK CONCLUSION INSTRUCTIONS above — reconnect with purpose, reflect on reader progress, synthesize main ideas, connect to real-world application, reinforce core message, inspire confidence, memorable closing. Multi-paragraph flowing prose with no internal headers or chapter-by-chapter summary. Approximately 1,500-2,500 words. Match the manuscript's established voice exactly.` : isEpilogue ? `The full Epilogue text following the instructions above — reflective, forward-looking, emotionally resonant. Flowing prose with no internal headers. Approximately 200-400 words.` : isKeyLessons ? `A short framing intro followed by 8-15 numbered lessons, each with a bold headline and 1-2 sentences of elaboration. Approximately 400-700 words total.` : isAppendix ? `Practical supplementary reference material organized with clear sub-headers, lists, or tables — designed to be scanned. Approximately 300-600 words or as needed.` : isGlossary ? `A 1-sentence intro line followed by an alphabetical list of 10-20 key terms in **Term**: Definition format (one blank line between entries). Approximately 300-600 words total.` : isReferences ? `A 1-sentence intro line followed by a numbered list of 10-20 plausible, consistently formatted citations relevant to this book's topic. Approximately 250-500 words total.` : isFurtherReading ? `A 1-2 sentence framing intro followed by 6-12 curated recommendations grouped under category sub-headers, each with a 1-3 sentence description. Approximately 300-600 words total.` : isBackAcknowledgments ? `The full Acknowledgments text — warm thanks to 2-4 categories of plausible contributors, closing with a direct thank-you to the reader. 2-4 short paragraphs, approximately 150-300 words.` : isTheEnd ? `The full The End closing — an extremely brief, warm message (30-80 words maximum) thanking the reader and leaving them inspired. May include a stylistic "The End" header.` : hasBlueprint ? `The full subsection prose built around ONLY the selected blueprint components — multi-paragraph, flowing prose with no internal headers. Minimum 400 words. Natural paragraph breaks. Weave every selected blueprint component seamlessly into the prose.` : `The full subsection prose following the 6-part structure above — multi-paragraph, flowing prose with no internal headers. Minimum 400 words. Natural paragraph breaks. The 6 parts (intro, concept, example, action steps, takeaway, transition) must be woven in seamlessly.`}",
  "flowSections": [
    ${(isBookIntroduction
        ? ["Hook", "Background & Context", "Purpose of the Book", "Overview of the Book", "Intended Audience", "Invitation to Continue Reading"]
        : isHowToUseThisBook
        ? ["Best Way to Read", "Engaging with Exercises", "Getting Maximum Value", "Notes & Revisiting Concepts"]
        : isWhatYouWillLearn
        ? ["Framing Intro", "Key Outcomes"]
        : isWhoThisBookIsFor
        ? ["Intended Audience", "Who Benefits Most", "Experience Level", "Reassurance"]
        : isDedication
        ? ["Dedication"]
        : isAcknowledgments
        ? ["Thanks & Gratitude"]
        : isPreface
        ? ["Author's Motivation", "Origin Story", "Connection to the Reader"]
        : isEpilogue
        ? ["Reader's Journey", "Looking Forward", "Emotional Connection", "Call to Action"]
        : isKeyLessons
        ? ["Framing Intro", "Key Lessons List"]
        : isAppendix
        ? ["Appendix Content"]
        : isGlossary
        ? ["Intro Line", "Term Definitions"]
        : isReferences
        ? ["Intro Line", "Reference List"]
        : isFurtherReading
        ? ["Framing Intro", "Curated Recommendations"]
        : isBackAcknowledgments
        ? ["Thanks to Contributors", "Thanks to the Reader"]
        : isTheEnd
        ? ["Closing Message"]
        : hasBlueprint ? (blueprintComponents as string[]) : effectiveFlow
      ).map((step: string) => `{"label": "${step}", "text": "2-4 sentences summarizing what this section covers in the content"}`).join(",\n    ")}
  ],
  "keyTakeaway": "One sentence — the single most important thing the reader ${isBookIntroduction ? "should take away about what this book offers them" : isHowToUseThisBook ? "should remember about how to engage with this book" : isWhatYouWillLearn ? "should feel excited to gain from this book" : isWhoThisBookIsFor ? "should understand about whether this book is right for them" : isDedication ? "should feel about the sincerity of this dedication" : isAcknowledgments ? "should feel about the author's gratitude" : isPreface ? "should understand about the author's motivation for writing this book" : isEpilogue ? "should feel inspired and ready to act after completing this book" : isKeyLessons ? "should remember as the most important principle from this book" : isAppendix ? "should reference in the appendix to immediately apply what they've learned" : isGlossary ? "should understand about the core terminology of this book's subject" : isReferences ? "should know about the sources and research behind this book" : isFurtherReading ? "should explore next to deepen their knowledge after this book" : isBackAcknowledgments ? "should feel about the author's gratitude for their time and investment" : isTheEnd ? "should carry with them after closing this book" : "learns (matches part 5 of the prose)"}",
  "transition": "The exact closing sentence or short paragraph that bridges into ${isBookIntroduction ? "Chapter 1" : isHowToUseThisBook ? "the next front-matter section" : isWhatYouWillLearn ? "the next front-matter section" : isWhoThisBookIsFor ? "Chapter 1" : isDedication ? "the next front-matter section (or leave as a standalone closing line, since a dedication does not need a transition)" : isAcknowledgments ? "the next front-matter section" : isPreface ? "the Introduction" : isEpilogue ? "the Key Lessons or next back-matter section (or leave as a standalone closing — the Epilogue may stand alone)" : isKeyLessons ? "the Appendix or next back-matter section" : isAppendix ? "the Glossary or next back-matter section" : isGlossary ? "the References or next back-matter section" : isReferences ? "the Further Reading or next back-matter section" : isFurtherReading ? "the Acknowledgments or next back-matter section" : isBackAcknowledgments ? "The End page (or leave as a standalone closing paragraph)" : isTheEnd ? "(no transition needed — this is the final page of the book)" : "the next section"}",
  "teachingMethod": "The primary teaching method used (e.g. anecdote, data-led, analogy, direct instruction, case study, exercise)",
  "competitorGap": "One sentence describing what competing books miss that this ${isBookIntroduction ? "introduction" : isFrontMatterSpecial ? "front-matter section" : isBackMatterSpecial ? "back-matter section" : "section"} addresses (or 'N/A' if no competitor data provided)",
  "knowledgeGraphDelta": {
    "newConcepts": [
      {
        "name": "Exact concept name as used in the text",
        "definition": "One clear sentence — plain language, no jargon",
        "difficulty": "beginner | intermediate | advanced",
        "importance": "high | medium | low",
        "category": "concept | framework | definition | skill | principle | strategy | tool | process | method",
        "readerQuestion": "The specific reader question this concept answers (e.g. 'Why do I keep reverting to old habits?')"
      }
    ],
    "reinforcedConcepts": ["Names of concepts from the registry that were deepened or re-applied here (NOT redefined)"],
    "frameworks": [
      {
        "name": "Framework name exactly as introduced",
        "type": "model | process | checklist | matrix | roadmap | cycle | system | decision-tree | pyramid | diagnostic",
        "purpose": "One sentence — what problem this framework solves for the reader"
      }
    ],
    "storiesUsed": [
      {
        "type": "Historical Story | Scientific Discovery | Business Case Study | Startup Journey | Customer Story | Personal Scenario | Composite Example | Failure Story | Success Story | Transformation Story | Thought Experiment | Future Scenario | Myth vs Reality",
        "conceptTaught": "The concept this story was used to illustrate"
      }
    ],
    "questionsAnswered": ["Reader questions explicitly or implicitly answered by this section"],
    "questionsRaised": ["New questions this section raises that upcoming sections should address"],
    "definitionsEstablished": [
      {
        "term": "Exact term as used",
        "definition": "Exact 1-sentence definition established in this section"
      }
    ]
  }
}`;
}

export function improvementPrompt({ action, currentText, tone, audience, bookStructure, subsectionTitle, bookContext, blueprintComponents }: any) {
  const toneInstr = resolveToneInstruction(tone || "");

  const contextLines: string[] = [];
  if (bookContext?.title)        contextLines.push(`Book: "${bookContext.title}"`);
  if (audience || bookContext?.audience)
    contextLines.push(`Target Reader: ${audience || bookContext.audience}`);
  if (bookStructure || bookContext?.structure)
    contextLines.push(`Book Structure: ${bookStructure || bookContext.structure}`);
  if (subsectionTitle)           contextLines.push(`Subsection: ${subsectionTitle}`);
  if (bookContext?.bookTopic)    contextLines.push(`Core Topic: ${bookContext.bookTopic}`);
  if (bookContext?.usp)          contextLines.push(`USP: ${bookContext.usp}`);
  if (bookContext?.authorSummary) contextLines.push(`Author Voice: ${String(bookContext.authorSummary).slice(0, 200)}`);
  const ctxBlock = contextLines.length ? contextLines.join("\n") + "\n" : "";

  const hasBlueprint = Array.isArray(blueprintComponents) && blueprintComponents.length > 0;
  const forbiddenComponents = hasBlueprint
    ? ALL_BLUEPRINT_COMPONENTS.filter((c: string) => !(blueprintComponents as string[]).includes(c))
    : [];

  const ACTION_INSTRUCTIONS: Record<string, string> = {
    sharpen:     "Rewrite for maximum clarity and precision. Remove vague language, redundancy, and motivational filler. Every sentence must earn its place. Keep the same length.",
    shorten:     "Tighten the writing by at least 20%. Cut redundancy, filler, and over-explanation. Preserve every key insight, example, and named framework.",
    expand:      hasBlueprint
      ? "Deepen the content — add a nuanced sub-point, richer detail, or sharper insight that the reader can immediately apply, built ONLY from the components already allowed for this subsection (see BLUEPRINT COMPONENTS below). Do NOT add filler or generic summaries. Do NOT introduce a new structural element (e.g. a case study, exercise, checklist) that isn't already an allowed component. Add genuine depth only."
      : "Deepen the content — add a concrete example, case study, or nuanced sub-point that the reader can immediately apply. Do NOT add filler or generic summaries. Add genuine depth only.",
    add_example: "Insert a vivid, specific, real-world example that makes the main concept tangible. Place it naturally within the existing flow. The example must be concrete, not hypothetical.",
  };
  const instruction = ACTION_INSTRUCTIONS[action] || `Apply the following refinement: "${action}".`;

  const blueprintBlock = hasBlueprint
    ? `
════════════════════════════════════
BLUEPRINT COMPONENTS (non-negotiable)
════════════════════════════════════
This subsection was written using ONLY these selected components — do not introduce any other structural element while refining it:
ALLOWED:
${(blueprintComponents as string[]).map((c: string) => `✓ ${c}`).join("\n")}
FORBIDDEN — never add, even implicitly:
${forbiddenComponents.map((c: string) => `✗ ${c}`).join("\n")}
${!(blueprintComponents as string[]).includes("Case Study") ? "✗ Case Study / real-world story framed as a case study\n" : ""}${!(blueprintComponents as string[]).includes("Action Plan") ? "✗ Action Steps / Next Steps / To-Do / Practice Steps\n" : ""}${!(blueprintComponents as string[]).includes("Exercise") ? "✗ Try This / Activity / Practice Exercise / Exercise\n" : ""}${!(blueprintComponents as string[]).includes("Reflection Questions") ? "✗ Reflect / Think About / Self-Assessment questions\n" : ""}If the refinement action above conflicts with this list, follow this list instead.
`
    : "";

  return `You are a professional nonfiction editor refining a single book section.

════════════════════════════════════
BOOK CONTEXT
════════════════════════════════════
${ctxBlock}Voice & Tone: ${tone || "Direct & practical"}
Tone Instruction: ${toneInstr}
${blueprintBlock}
════════════════════════════════════
EDITING ACTION
════════════════════════════════════
${instruction}

════════════════════════════════════
EDITING RULES (non-negotiable)
════════════════════════════════════
- Match the existing voice, tone, and reading level exactly — do NOT shift register
- Do NOT change the structural purpose of the section
- Do NOT add a generic summary paragraph or motivational closer at the end
- Do NOT introduce markdown headers inside the prose
- Preserve any specific examples, data points, named frameworks, or statistics already present
- The refined text must feel like it belongs in a book with the context above
${hasBlueprint ? "- Do NOT introduce any component listed as FORBIDDEN above, even as a single sentence" : ""}

════════════════════════════════════
TEXT TO IMPROVE
════════════════════════════════════
${currentText}

Return ONLY the refined prose — no commentary, no JSON, no metadata.`;
}

export function architecturePreviewPrompt({
  niche,
  subNiche,
  deepNiche,
  audience,
  goal,
  tones,
  contentDirection
}: any) {
  const toneLine = Array.isArray(tones) && tones.length ? tones.join(", ") : "unspecified";
  return `You are an Amazon KDP nonfiction publishing strategist.

Analyze this book concept and generate an ideal book architecture.

NICHE: ${niche || "unspecified"}
SUB NICHE: ${subNiche || "unspecified"}
DEEP NICHE FOCUS: ${deepNiche || "unspecified"}
TARGET AUDIENCE: ${audience || "unspecified"}
BOOK GOAL: ${goal || "unspecified"}
TONE: ${toneLine}
CONTENT DIRECTION (existing): ${contentDirection || "unspecified"}

Generate the ideal blueprint for THIS specific combination.

Requirements:
- adapt to the reader's psychology and emotional state in this niche
- match patterns of bestselling books in this exact sub-niche
- avoid generic, one-size-fits-all outputs — every field must feel niche-specific
- be commercially realistic (real Amazon KDP ranges, not academic)
- the emotional arc must be 4–5 stages joined with " → " using the reader's
  actual psychological journey for this niche (e.g. for self-esteem:
  "insecurity → awareness → healing → confidence → empowerment")
- structure must name a real publishing approach (framework-based,
  step-by-step, narrative arc, psychological transformation, tactical
  playbook, workbook system, habit-building, mindset rewiring,
  challenge-based, case-study driven, philosophical, devotional, etc.)
- chapters must be a realistic range like "8–12", "10–14", "15–20"
- pacing must be a real pacing label (fast actionable, progressive build,
  emotionally immersive, tactical acceleration, slow reflective,
  workbook pacing, philosophical reflection, etc.)
- wordBand must be a realistic Amazon KDP range like "15k–25k",
  "20k–35k", "35k–50k", "45k–65k"
- contentDirection is one tight sentence describing what this book's
  reading experience should feel like

Output ONLY valid JSON with this exact shape:

{
  "structure": "",
  "chapters": "",
  "emotionalArc": "",
  "pacing": "",
  "wordBand": "",
  "contentDirection": ""
}`;
}

export function titleCardsPrompt({
  research, competitorSummaries, intelligence, mode
}: any) {
  const nicheLine = research.mainNicheLabel && research.subNicheLabel
    ? `${research.mainNicheLabel} › ${research.subNicheLabel}`
    : research.genre?.trim() || "Nonfiction";
  const deepNiche = research.deepNicheLabel?.trim() || "";

  const summariesBlock = Array.isArray(competitorSummaries) && competitorSummaries.length
    ? competitorSummaries.slice(0, 6).map((l: string, i: number) => `${i + 1}. ${l}`).join("\n")
    : "(none)";

  const intelBlock = intelligence ? `
TARGET AUDIENCE: ${intelligence.targetAudience || ""}
READER PAIN: ${intelligence.readerPainProfile || ""}
EMOTIONAL TRIGGERS: ${(intelligence.emotionalTriggers || []).join(", ")}
TRANSFORMATION PROMISE: ${intelligence.transformationPromise || ""}
BESTSELLER DNA: ${intelligence.bestsellerDNA || ""}
WRITING STYLE: ${intelligence.writingStyleFingerprint || ""}
POSITIONING STRATEGY: ${intelligence.positioningStrategy || ""}
MARKET GAP: ${intelligence.marketGapAnalysis || ""}`.trim()
    : "(not available — infer all signals from niche and competitor data)";

  const modeMap: Record<string, string> = {
    "bestseller":          "Commercial bestseller style — audience-named, transformation-forward, commercially polished. Like Atomic Habits, Deep Work, Can't Hurt Me.",
    "masculine-authority": "Masculine authority — strong, disciplined, direct, no-nonsense. For ambitious men, leaders, high-performers. Commands respect.",
    "emotional-transform": "Emotional transformation — vulnerability + hope + clear outcome. Feeling-forward, personal journey, empathy-driven.",
    "scientific":          "Scientific/evidence-based — credibility signals, 'research-backed', 'the psychology of', 'the science of'. Analytical reader.",
    "minimalist-premium":  "Minimalist premium — very short titles (2-4 words), elegant, timeless feel. Like 'Stillness Is the Key', 'Essentialism', 'Deep Work'.",
    "bold-controversial":  "Bold/controversial — challenges assumptions, disrupts conventions, provocative framing. Grabs attention and sparks debate.",
    "philosophical":       "Philosophical/wisdom — stoic or reflective, timeless principles, ancient meets modern. Contemplative, thoughtful readers.",
    "viral-modern":        "Viral modern self-help — Gen Z / millennial resonance, TikTok-friendly, conversational, identity-based. Feels current."
  };
  const modeInstruction = modeMap[mode] || modeMap["bestseller"];

  return `You are an Amazon KDP bestseller-title strategist and consumer psychology expert.

Generate 6 premium nonfiction title packages. Produce differentiated titles — vary patterns, categories, and emotional angles. Make each one genuinely distinct.

STYLE MODE: ${mode || "bestseller"}
MODE INSTRUCTION: ${modeInstruction}

BOOK PROFILE:
- NICHE: ${nicheLine}${deepNiche ? ` › ${deepNiche}` : ""}
- CONCEPT: ${research.bookTopic?.trim() || deepNiche || nicheLine}
- TRANSFORMATION: ${research.stanceOnTopic?.trim() || "(infer from niche)"}
- CUSTOM NOTES: ${research.standout?.trim() || "(none)"}
- COMPETITORS:
${summariesBlock}

MARKET INTELLIGENCE:
${intelBlock}

SCORING RULES (must follow):
- Scores should realistically vary — not all titles score equally. Range: 55-97.
- A title can be strong on SEO but weaker on emotion, or vice versa. Reflect real tradeoffs.
- isRecommended: true on the SINGLE best overall title only.
- Use at least 3 different categories across the 6 cards.

TITLE RULES:
- Every title must name or strongly imply a specific audience
- No generic patterns: "Better Habits", "Success Blueprint", "Confidence Reset", "Motivation Mastery"
- Commercially polished — feels like a $9.99 Amazon bestseller
- Mix these patterns across the 6 titles: "Transformation for Audience" | "System for Audience" | "Identity Label" | "The [Noun] of [Topic]" | "Art/Science of [Topic]"

Return STRICT JSON only — no markdown, no text outside the JSON:
{
  "cards": [
    {
      "title": "...",
      "subtitle": "A [Adjective] System for [Transformation] Without [Pain]",
      "subtitleOptions": [
        {"style": "SEO", "text": "keyword-rich subtitle with search terms"},
        {"style": "Emotional", "text": "feeling-forward subtitle"},
        {"style": "Minimalist", "text": "short elegant subtitle (max 8 words)"}
      ],
      "seoScore": 84,
      "emotionalScore": 91,
      "clickabilityScore": 88,
      "audienceMatch": 93,
      "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
      "toneProfile": ["calm authority", "masculine mentor"],
      "pattern": "Transformation for Audience",
      "category": "Masculine Authority",
      "hook": "One punchy sentence on why someone would impulse-buy this.",
      "audienceResonance": ["ambitious men 25-45", "entrepreneurs", "stoicism readers"],
      "isRecommended": false
    }
  ]
}

Valid categories: "Masculine Authority" | "Emotional Transformation" | "Premium Minimalist" | "Scientific Authority" | "Viral Modern" | "Philosophical Wisdom" | "Bold Challenger"
Valid patterns: "Transformation for Audience" | "System for Audience" | "Identity Label" | "How to [Outcome]" | "The [Noun] of [Topic]" | "Art/Science of [Topic]"`;
}

export function kdpPositioningTitlesPrompt({ research }: any) {
  const mainNiche  = research.mainNicheLabel?.trim() || "";
  const subNiche   = research.subNicheLabel?.trim()  || "";
  const deepNiche  = research.deepNicheLabel?.trim()  || "";

  return `You are an elite Amazon KDP publishing strategist, nonfiction book positioning expert, and Amazon marketplace researcher.

INPUTS

Main Niche:
${mainNiche}

Sub-Niche:
${subNiche}

Deep Niche (Optional):
${deepNiche || "(not provided)"}

IMPORTANT

- Main Niche and Sub-Niche are required inputs.
- Deep Niche is optional.
- Generate titles when Main Niche and Sub-Niche are available.
- If Deep Niche is empty, generate titles using only Main Niche and Sub-Niche.
- If Deep Niche is provided, use it to improve audience targeting, specificity, positioning, and market differentiation.
- Never request Deep Niche before generating titles.
- Never fail because Deep Niche is missing.

TASK

Step 1

Analyze the provided niche information and infer:

- Target Audience
- Primary Problem
- Desired Outcome
- Buyer Intent
- Market Opportunity

Step 2

Apply this positioning framework:

Topic + Audience + Problem + Outcome

Examples:

Affiliate Marketing + College Students + Lack of Income + Build Online Revenue

Productivity + Entrepreneurs + Lack of Focus + Get More Done

Fitness + Women Over 40 + Slow Metabolism + Sustainable Weight Loss

Step 3

Generate exactly 3 commercially attractive nonfiction book title options.

Each option must use a different positioning angle:

Title #1
Outcome-Focused

Title #2
Problem-Solution Focused

Title #3
Audience-Focused

TITLE RULES

- Sound like a real bestselling Amazon nonfiction book.
- Focus on reader benefits and transformation.
- Avoid generic wording.
- Avoid AI-sounding phrases.
- Avoid clickbait.
- Avoid vague promises.
- Prefer specificity over broadness.
- Make titles memorable and commercially attractive.
- Optimize for buyer intent and conversion.
- Differentiate from common competing titles.
- Use Deep Niche only when it strengthens positioning.

SUBTITLE RULES

- Clarify the promise.
- Expand on the transformation.
- Include audience, problem, or outcome when appropriate.
- Sound professional and publishable.

OUTPUT FORMAT

Return ONLY valid JSON — no markdown fences, no commentary:
[
  {
    "title": "",
    "subtitle": "",
    "angle": "Outcome-Focused",
    "targetAudience": "",
    "problem": "",
    "desiredOutcome": "",
    "reason": ""
  },
  {
    "title": "",
    "subtitle": "",
    "angle": "Problem-Solution Focused",
    "targetAudience": "",
    "problem": "",
    "desiredOutcome": "",
    "reason": ""
  },
  {
    "title": "",
    "subtitle": "",
    "angle": "Audience-Focused",
    "targetAudience": "",
    "problem": "",
    "desiredOutcome": "",
    "reason": ""
  }
]`;
}

export function titleVariationsPrompt({ title, subtitle, research, intelligence }: any) {
  const nicheLine = research?.mainNicheLabel && research?.subNicheLabel
    ? `${research.mainNicheLabel} › ${research.subNicheLabel}`
    : research?.genre || "Nonfiction";

  return `You are an Amazon KDP title strategist.
Create 6 powerful variations of this title, each with a meaningfully distinct style.

ORIGINAL TITLE: "${title}"
ORIGINAL SUBTITLE: "${subtitle || "(none)"}"
NICHE: ${nicheLine}
AUDIENCE: ${intelligence?.targetAudience || research?.targetAudience || "(infer from niche)"}
PAIN: ${intelligence?.readerPainProfile || "(infer from niche)"}
TRANSFORMATION: ${intelligence?.transformationPromise || research?.stanceOnTopic || "(infer)"}

Generate exactly these 6 styles — each must feel noticeably different from the original and from each other:
1. Bolder — more aggressive, challenging, confrontational wording
2. Premium — shorter, elevated, timeless (2-4 words ideal)
3. SEO — keyword-rich but still emotionally compelling
4. Emotional — vulnerability + hope + clear transformation promise
5. Modern Viral — Gen Z / TikTok-friendly energy, conversational
6. Philosophical — timeless wisdom angle, stoic or reflective

Return STRICT JSON only:
{
  "variations": [
    {"style": "Bolder", "title": "...", "subtitle": "...", "note": "one sentence on why this works"},
    {"style": "Premium", "title": "...", "subtitle": "...", "note": "..."},
    {"style": "SEO", "title": "...", "subtitle": "...", "note": "..."},
    {"style": "Emotional", "title": "...", "subtitle": "...", "note": "..."},
    {"style": "Modern Viral", "title": "...", "subtitle": "...", "note": "..."},
    {"style": "Philosophical", "title": "...", "subtitle": "...", "note": "..."}
  ]
}`;
}

// ─── Resource helpers ─────────────────────────────────────────────────────────

/**
 * Build a compact, priority-ordered resources block for prompt injection.
 * @param resources  The project's resources object (links, findings, files, settings)
 * @param context    Which prompt context: "outline" | "lesson" | "all"
 */
export function resourcesBlock(resources: any, context: "outline" | "lesson" | "all" = "all"): string {
  if (!resources) return "";
  const { links = [], findings = [], files = [] } = resources;
  const all = [
    ...links.map((r: any) => ({ ...r, _rtype: "link" })),
    ...findings.map((r: any) => ({ ...r, _rtype: "finding" })),
    ...files.map((r: any) => ({ ...r, _rtype: "file" }))
  ];
  if (!all.length) return "";

  const contextAllowed: Record<string, string[]> = {
    outline: ["entire_book", "outline_only"],
    lesson:  ["entire_book", "statistics", "quotes", "research_only"],
    all:     ["entire_book", "outline_only", "writing_style", "statistics", "quotes", "research_only"]
  };
  const allowed = contextAllowed[context] || contextAllowed.all;

  const filtered = all.filter((r: any) => {
    const useFor: string[] = Array.isArray(r.useFor) ? r.useFor : ["entire_book"];
    return useFor.some((u: string) => allowed.includes(u));
  });
  if (!filtered.length) return "";

  const PRIO: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  filtered.sort((a: any, b: any) => (PRIO[a.priority] ?? 2) - (PRIO[b.priority] ?? 2));

  const lines: string[] = [];
  for (const r of filtered.slice(0, 8)) {
    const prio    = r.priority === "critical" ? " [CRITICAL]" : r.priority === "high" ? " [HIGH]" : "";
    const title   = r.title || r.label || r.originalName || r._rtype;
    const content = String(r.summary || r.body || r.note || (r._rtype === "link" ? r.url : "")).slice(0, 250);
    if (!content) continue;
    const style   = r.isStyleRef ? " [Writing Style Reference]" : "";
    const useNote = Array.isArray(r.useFor) && r.useFor.length && !r.useFor.includes("entire_book")
      ? ` [Focus: ${r.useFor.join(", ")}]` : "";
    lines.push(`• ${title}${prio}${style}${useNote}: ${content}`);
  }
  if (!lines.length) return "";

  const cite = resources.settings?.citation;
  const citeNote = cite?.style && cite.style !== "none"
    ? `\n[Citation format: ${cite.style.toUpperCase()}${cite.inline ? ", inline" : ""}${cite.bibliography ? ", bibliography" : ""}]`
    : "";
  return `\n\nAuthor's Research Resources (priority-ordered):\n${lines.join("\n")}${citeNote}`;
}

/**
 * Prompt for extracting key insights from a resource's text content.
 */
export function extractResourcePrompt({ text, title, category }: any): string {
  const truncated = String(text || "").slice(0, 5000);
  return `Extract the most valuable information from this ${category || "resource"} titled "${title || "Untitled"}".

Content:
${truncated}

Return a concise extraction with only the sections that have content:
**Key Insights** — 3-5 bullet points of the most important takeaways
**Statistics** — specific data points, percentages, or numbers worth citing
**Notable Quotes** — verbatim phrases worth preserving verbatim
**Frameworks / Models** — any named systems, processes, or structured approaches

Keep the total response under 350 words. Be specific and factual. Do not add commentary.`;
}

export function generateFindingPrompt({ bookContext, category, priority, useFor, existingFindings, competitorBooks }: any) {
  const ctx = bookContext || {};
  const existing = Array.isArray(existingFindings) ? existingFindings : [];
  const bc = Array.isArray(competitorBooks) ? competitorBooks : [];

  const categoryGuidance: Record<string, string> = {
    academic_paper:  "Generate a research summary: key findings, implications, and evidence-based insights from academic literature relevant to this book's topic.",
    research_study:  "Generate a study summary: methodology overview, key findings, practical implications, and how this applies to the book's core argument.",
    gov_report:      "Generate a report summary: key statistics, demographic trends, policy findings, and data points directly useful for the book.",
    statistics:      "Generate a statistics finding: key metrics, trends, quantitative findings, and how to use these numbers persuasively in the manuscript.",
    competitor_book: "Generate a competitive analysis: this competitor's positioning, core strengths, weaknesses, gaps the author can exploit, and structural insights worth borrowing or avoiding.",
    book:            "Generate a book analysis: core concepts, major frameworks, lessons learned, and ideas the author can reference, adapt, or build upon.",
    writing_style:   "Generate a style observation: tone characteristics, voice patterns, sentence structure, readability techniques, and stylistic elements to emulate or contrast.",
    interview:       "Generate an interview analysis: notable insights, recurring themes, useful observations, and any memorable quotes or examples worth referencing.",
    blog_article:    "Generate an article analysis: key arguments, supporting evidence, useful ideas, and notable observations that strengthen the book's thesis.",
    case_study:      "Generate a case study breakdown: the situation, key actions taken, outcomes achieved, and lessons directly applicable to the book's readers.",
    note:            "Generate a research insight: a valuable principle, finding, or concept that should be woven into the book. Expand the idea with evidence and application guidance.",
    other:           "Generate the most useful research finding possible for this specific book project. Be creative and specific."
  };

  const priorityDepth: Record<string, string> = {
    critical: "Highly detailed, deeply actionable, ready for direct manuscript use. Include specific data points, evidence, and concrete application guidance.",
    high:     "Detailed and actionable. Provide strong analysis with specific examples and clear manuscript application.",
    medium:   "Moderate detail. Provide useful context and supporting analysis.",
    low:      "Brief and supplemental. Concise supporting notes with key takeaways."
  };

  const useForFocus: Record<string, string> = {
    entire_book:   "Make this broadly useful across the full manuscript.",
    outline_only:  "Focus on chapter ideas, structural insights, and organizational guidance.",
    writing_style: "Focus on voice, tone, flow, and readability insights.",
    statistics:    "Focus on data, metrics, trends, and quantitative evidence.",
    quotes:        "Highlight memorable quotes, anecdotes, and story-worthy moments.",
    research_only: "Deep research focus — evidence, citations, methodological detail."
  };

  const useForList = (Array.isArray(useFor) ? useFor : ["entire_book"])
    .map((u: string) => useForFocus[u] || u)
    .join(" ");

  const competitorList = bc.length
    ? bc.slice(0, 6).map((b: any, i: number) =>
        `${i + 1}. "${b.title || "Untitled"}"${b.authors ? ` by ${b.authors}` : ""}`
      ).join("\n")
    : "(none)";

  const existingList = existing.length
    ? existing.slice(0, 12).map((f: any) =>
        `- ${f.label || f.title || "(untitled)"}`
      ).join("\n")
    : "(none yet)";

  const categoryKey = (category as string) || "note";
  const priorityKey = (priority as string) || "medium";

  return `You are a professional nonfiction research assistant. Generate a single, highly relevant research finding for a nonfiction book project.

BOOK PROJECT:
Title: ${ctx.title || "not set"}
Subtitle: ${ctx.subtitle || ""}
Topic: ${ctx.bookTopic || ""}
Niche: ${ctx.niche || ""}${ctx.subNiche ? ` › ${ctx.subNiche}` : ""}${ctx.deepNiche ? ` › ${ctx.deepNiche}` : ""}
Audience: ${ctx.audience || ""}
Tone: ${ctx.tone || ""}
Transformation Promise: ${ctx.transformationPromise || ""}
Reader Pain: ${ctx.readerPainProfile || ""}
Market Gap: ${ctx.marketGap || ""}
Positioning: ${ctx.positioningStrategy || ""}
Writing Style Fingerprint: ${ctx.writingStyleFingerprint || ""}

COMPETITOR BOOKS:
${competitorList}

EXISTING FINDINGS (do NOT duplicate these topics):
${existingList}

FINDING REQUEST:
Category: ${categoryKey}
Priority: ${priorityKey} — ${priorityDepth[priorityKey] || ""}
Focus: ${useForList}

CATEGORY INSTRUCTION: ${categoryGuidance[categoryKey] || categoryGuidance.note}

CONTENT REQUIREMENTS:
- Directly related to THIS specific book project — not generic advice
- Written as professional nonfiction research notes
- Structured and easy to scan (use short paragraphs, bold key terms, bullet lists where helpful)
- Actionable and specific — include concrete examples or data where possible
- Unique — do not repeat existing findings
- Target length: 300–800 words for the content field

OUTPUT FORMAT — use exactly this structure, nothing before or after:

TITLE: <concise, specific finding title — like a published research headline>
CONTENT:
<full finding content — structured, actionable, book-ready research notes>

Do NOT wrap in JSON, markdown fences, or any other formatting. Start with "TITLE:" on the first line.`;
}

export function generateResourcePrompt({ bookContext, category, priority, useFor, existingResources, competitorBooks }: any) {
  const ctx = bookContext || {};
  const bc = Array.isArray(competitorBooks) ? competitorBooks : [];
  const existing = Array.isArray(existingResources) ? existingResources : [];

  const categoryDescriptions: Record<string, string> = {
    academic_paper:  "peer-reviewed papers, PubMed articles, NIH resources, university research, journal publications — for scientific evidence and citations",
    research_study:  "research studies, meta-analyses, systematic reviews, behavioral or industry studies — for evidence-based insights",
    gov_report:      "CDC, NIH, WHO, OECD, Bureau of Labor Statistics, or similar government publications — for trusted data and statistics",
    statistics:      "surveys, industry reports, public datasets, national studies, research dashboards — for charts, numbers, data points",
    competitor_book: "books from the competitor analysis — rank by relevance, pick one not already added, explain how to use it",
    book:            "influential nonfiction books, bestselling references relevant to the topic — for research and framework development",
    writing_style:   "books, articles, or authors whose style matches the desired tone — for voice, flow, and writing quality",
    interview:       "podcast transcripts, TED Talks, expert interviews, researcher discussions — for stories, examples, and quotes",
    blog_article:    "high-quality long-form content from Harvard Business Review, Psychology Today, Farnam Street, McKinsey, or industry authorities",
    case_study:      "business case studies, personal transformation stories, academic or organizational examples — for real-world proof",
    note:            "a valuable research insight or principle — NO URL REQUIRED, generate a key finding to weave into the book",
    other:           "the best available source based on book context and topic"
  };

  const priorityDescriptions: Record<string, string> = {
    critical: "the single most authoritative and relevant source available — highest research quality",
    high:     "most authoritative, trusted, and relevant source available",
    medium:   "balanced relevance and accessibility",
    low:      "supplementary supporting material"
  };

  const useForDescriptions: Record<string, string> = {
    entire_book:   "foundational resources that support the whole manuscript",
    outline_only:  "resources focused on frameworks, structures, and organization",
    writing_style: "stylistic references and exemplary authors",
    statistics:    "quantitative data sources",
    quotes:        "interview, transcript, speech, and quote-rich sources",
    research_only: "deep research and evidence-based material"
  };

  const useForList = (Array.isArray(useFor) ? useFor : ["entire_book"])
    .map((u: string) => useForDescriptions[u] || u)
    .join("; ");

  const competitorList = bc.length
    ? bc.slice(0, 8).map((b: any, i: number) =>
        `${i + 1}. "${b.title || "Untitled"}"${b.authors ? ` by ${b.authors}` : ""}${b.asin ? ` (ASIN: ${b.asin})` : ""}`
      ).join("\n")
    : "(none discovered)";

  const existingList = existing.length
    ? existing.slice(0, 20).map((r: any) =>
        `- ${r.label || r.title || ""}${r.url ? `: ${r.url}` : ""}`
      ).join("\n")
    : "(none yet)";

  const categoryKey = (category as string) || "other";
  const priorityKey = (priority as string) || "medium";
  const isNoteCategory = categoryKey === "note";
  const isCompetitorBook = categoryKey === "competitor_book";

  return `You are an AI research librarian helping to build a high-quality nonfiction book. Recommend ONE specific, highly relevant resource.

BOOK PROJECT:
Title: ${ctx.title || "not set"}
Subtitle: ${ctx.subtitle || ""}
Topic: ${ctx.bookTopic || ""}
Niche: ${ctx.niche || ""}${ctx.subNiche ? ` › ${ctx.subNiche}` : ""}${ctx.deepNiche ? ` › ${ctx.deepNiche}` : ""}
Audience: ${ctx.audience || ""}
Tone: ${ctx.tone || ""}
Transformation Promise: ${ctx.transformationPromise || ""}
Reader Pain: ${ctx.readerPainProfile || ""}
Market Gap: ${ctx.marketGap || ""}
Positioning: ${ctx.positioningStrategy || ""}

COMPETITOR BOOKS DISCOVERED:
${competitorList}

ALREADY ADDED RESOURCES — do NOT recommend these:
${existingList}

REQUEST:
Category: ${categoryKey} — ${categoryDescriptions[categoryKey] || "best available source"}
Priority: ${priorityKey} — ${priorityDescriptions[priorityKey] || ""}
Purpose: ${useForList}

${isCompetitorBook ? "COMPETITOR BOOK RULE: Only recommend a book from the 'COMPETITOR BOOKS DISCOVERED' list. Pick the most relevant one not already in the added resources list. If all are added, recommend the closest published rival in the same niche." : ""}
${isNoteCategory ? "NOTE/FINDING RULE: Generate a valuable insight, principle, or finding — NOT a URL. Leave url as empty string \"\"." : "URL RULE: Only use real, verifiable URLs. Never fabricate deep links. If a specific page URL is uncertain, use the authoritative domain (e.g. https://pubmed.ncbi.nlm.nih.gov) rather than a fake path."}

Return ONLY valid JSON:
{
  "url": "${isNoteCategory ? "" : "<real URL or empty string>"}",
  "label": "<descriptive title for this resource>",
  "note": "<1-2 sentences: exactly how to use this in the book>"
}`;
}

export function competitiveIntelligencePrompt({ niche, subNiche, deepNiche, bookTopic, stanceOnTopic, standout, publishingGoal, books }: any) {
  const bookLines = Array.isArray(books) && books.length
    ? books.slice(0, 12).map((b: any, i: number) => {
        const parts = [`${i + 1}. "${b.title || "Untitled"}"`];
        if (b.authors)              parts.push(`by ${b.authors}`);
        if (b.subtitle)             parts.push(`(${b.subtitle})`);
        if (b.rating)               parts.push(`${b.rating}★`);
        if (b.ratingsTotal)         parts.push(`${b.ratingsTotal.toLocaleString()} reviews`);
        if (b.publicationDate)      parts.push(`(${b.publicationDate})`);
        if (b.bestsellersRankFlat)  parts.push(`[rank: ${String(b.bestsellersRankFlat).slice(0, 60)}]`);
        if (b.description)          parts.push(`\n   Desc: ${String(b.description).slice(0, 200)}`);
        return parts.join(" ");
      }).join("\n")
    : "(no competitor books provided — infer from deep niche knowledge)";

  return `You are an elite AI Research Analyst and Amazon KDP Market Intelligence Specialist.

Your role is NOT to summarize competitor books. Your role is to extract strategic intelligence that makes every downstream book creation step significantly smarter.

Think like:
- A senior market research analyst who turns raw data into competitive strategy
- A developmental editor who knows exactly what readers want and what they hate
- A bestselling author who understands commercial differentiation
- A reader psychology specialist who maps the emotional journey to purchase

Be specific to this exact niche. No generic advice. Every insight must reflect real Amazon KDP market dynamics for this category.

========================================
RESEARCH INPUTS
========================================
Main Niche: ${niche || "unspecified"}
Sub-Niche: ${subNiche || "unspecified"}
Deep Niche: ${deepNiche || "not specified"}
Book Topic: ${bookTopic || "not specified"}
Author Stance: ${stanceOnTopic || "not specified"}
Standout Angle: ${standout || "not specified"}
Publishing Goal: ${publishingGoal || "not specified"}

Competitor Books:
${bookLines}

========================================
ANALYSIS PIPELINE — follow in order
========================================

PHASE 1 — COMPETITOR ANALYSIS
For each competitor, infer from title/subtitle/ratings/market position:
- Core promise and reader transformation
- Likely strengths (why readers rate it highly)
- Likely weaknesses and reader complaints
- Commercial positioning and market reach

PHASE 2 — MARKET PATTERN IDENTIFICATION
Across all competitors, identify:
- Topics every successful book in this niche covers (table stakes)
- Overused frameworks and tired advice readers are sick of
- Reader frustrations that appear repeatedly across competitors
- Emerging content trends gaining traction
- Topics that are underserved or missing entirely

PHASE 3 — READER PSYCHOLOGY PROFILING
Build a deep psychological portrait of the ideal reader:
- Current situation vs. desired future
- Internal obstacles (mindset, limiting beliefs, fear)
- External obstacles (time, money, circumstances)
- False beliefs they hold that keep them stuck
- Preferred learning style (stories / frameworks / data / examples)
- Emotional drivers that make them buy

PHASE 4 — MARKET GAP ANALYSIS
Identify what competitors have collectively missed:
- Questions nobody answers clearly
- Shallow or outdated explanations
- Missing frameworks, tools, or exercises
- Lack of emotional support or reader empathy
- Missing implementation guidance

PHASE 5 — COMMERCIAL POSITIONING
Determine differentiation opportunities with the highest commercial potential.

PHASE 6 — BOOK DNA EXTRACTION
Extract the essential signals needed for downstream steps:
- Energy style (tone/energy register of winning books)
- Writing style fingerprint (how top books write)
- Emotional triggers that drive purchase decisions
- Transformation promise and reader pain narrative

PHASE 7 — RESEARCH QUALITY SCORING
Score the quality of this intelligence on a 0–100 scale across 5 dimensions.

========================================
OUTPUT — return ONLY valid JSON, no markdown, no code fences
========================================

{
  "targetAudience": {
    "primary": "Primary reader description (2-3 specific sentences)",
    "secondary": "Secondary reader segment",
    "experienceLevel": "Beginner / Intermediate / Advanced",
    "demographics": "Age range, gender skew, career/life stage",
    "motivations": "Core emotional and practical motivations (2-3 sentences)"
  },
  "readerPainPoints": [
    "Specific pain point in reader voice (what they would say)",
    "Pain point 2",
    "Pain point 3",
    "Pain point 4",
    "Pain point 5",
    "Pain point 6",
    "Pain point 7"
  ],
  "desiredOutcomes": [
    "Specific outcome readers want (in reader voice)",
    "Outcome 2",
    "Outcome 3",
    "Outcome 4",
    "Outcome 5",
    "Outcome 6",
    "Outcome 7"
  ],
  "marketGaps": [
    "Specific content gap or underserved topic competitors missed",
    "Gap 2",
    "Gap 3",
    "Gap 4",
    "Gap 5",
    "Gap 6"
  ],
  "uniqueSellingPropositions": [
    {"statement": "USP 1", "whyItStandsOut": "Why it differentiates from every competitor", "whyReadersCare": "Emotional reason readers would buy this"},
    {"statement": "USP 2", "whyItStandsOut": "...", "whyReadersCare": "..."},
    {"statement": "USP 3", "whyItStandsOut": "...", "whyReadersCare": "..."},
    {"statement": "USP 4", "whyItStandsOut": "...", "whyReadersCare": "..."},
    {"statement": "USP 5", "whyItStandsOut": "...", "whyReadersCare": "..."}
  ],
  "positioningStrategies": [
    "Specific positioning angle 1 for this niche",
    "Positioning angle 2",
    "Positioning angle 3",
    "Positioning angle 4",
    "Positioning angle 5"
  ],
  "titleInsights": {
    "bestTitleStyle": "Specific title style that converts best in this niche with rationale",
    "bestSubtitleStyle": "Subtitle formula that performs best in this market",
    "bestPositioningApproach": "The differentiation angle the title should communicate",
    "recommendedTransformationPromise": "The single transformation promise the title must convey"
  },
  "authorPersonaGuidance": {
    "authorVoice": "Specific voice recommendation based on what readers respond to in this niche",
    "tone": "Tone recommendation with specific examples from the market",
    "credibilityStyle": "How to establish authority specifically in this market",
    "writingApproach": "Framework + narrative style that outperforms competitors here"
  },
  "bestCompetitorInsights": [
    {
      "sourceBook": "Competitor book title",
      "coreIdea": "The strongest idea or angle from this book — 1-2 sentences",
      "howToAdapt": "How to present this same idea more effectively with fresher framing or deeper exploration"
    }
  ],
  "outlineGenerationBrief": "3-5 sentence strategic blueprint: transformation arc this book should follow, core topics it must cover, recommended structure, unique angle, and how to outperform competitors.",
  "readerPainProfile": "2-3 sentence narrative portrait of the reader — their daily frustrations, failed attempts, and emotional state when they pick up this book.",
  "transformationPromise": "One sentence: the specific transformation this book will deliver. Should feel emotionally true and commercially compelling.",
  "marketGapAnalysis": "2-3 sentences: the most significant gaps in current market coverage that this book must fill. Be specific about what competitors fail to deliver.",
  "writingStyleFingerprint": "2-3 sentences describing the ideal writing style for this market: sentence complexity, use of stories, pacing, evidence style, framework density.",
  "positioningStrategy": "2-3 sentences: the single strongest commercial differentiation strategy for this book — what makes it definitively different.",
  "emotionalTriggers": [
    "Specific emotional trigger that drives purchase in this market",
    "Trigger 2",
    "Trigger 3",
    "Trigger 4"
  ],
  "energyStyle": "The energy register that works best in this niche — e.g. 'urgent and action-driven', 'warm mentor voice guiding through transformation', 'confident expert sharing hard-won insights'.",
  "readerPsychologyProfile": {
    "currentSituation": "Where the reader is right now — their reality, daily struggles, and past failed attempts",
    "desiredFuture": "Where they want to be — specific, emotional, concrete",
    "internalObstacles": "Mindset blocks, self-doubt, and limiting beliefs preventing success",
    "externalObstacles": "Time, money, environment, or tools — practical barriers",
    "falseBeliefsToBreak": "The specific misconceptions this book must address and disprove",
    "learningPreferences": "How this audience learns best: stories, frameworks, data, step-by-step, case studies",
    "emotionalDrivers": "The deeper emotional needs driving them to seek this book",
    "commonMistakes": "The 3-5 most common mistakes this audience makes before finding the right solution"
  },
  "competitorStrengthsWeaknesses": [
    {
      "title": "Competitor book title",
      "likelyStrengths": ["Strength 1 inferred from market position", "Strength 2", "Strength 3"],
      "likelyWeaknesses": ["Weakness 1 inferred from niche patterns", "Weakness 2"],
      "likelyReaderComplaints": ["Complaint 1", "Complaint 2", "Complaint 3"]
    }
  ],
  "marketPatterns": {
    "topicsEverySuccessfulBookCovers": ["Must-cover topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5"],
    "overusedFrameworks": ["Overused approach 1 readers are tired of", "Overused 2", "Overused 3"],
    "readerFrustrations": ["Common frustration recurring across this market 1", "Frustration 2", "Frustration 3"],
    "emergingTrends": ["Emerging trend 1 gaining traction", "Trend 2"],
    "underservedTopics": ["Topic not well-covered by competitors 1", "Topic 2", "Topic 3"]
  },
  "researchScores": {
    "competitorCoverage": 85,
    "readerUnderstanding": 90,
    "marketUnderstanding": 80,
    "commercialOpportunity": 75,
    "confidence": 85
  },
  "priorityRecommendations": [
    "Specific strategic recommendation for this book 1",
    "Recommendation 2",
    "Recommendation 3",
    "Recommendation 4",
    "Recommendation 5"
  ]
}`;
}

// ─── Generate Details (Book Details step auto-fill) ────────────────────────

export function generateDetailsPrompt(project: any): string {
  const r     = project?.research               || {};
  const intel = project?.analysis?.intelligence || {};
  const pb    = project?.proposedBook?.content  || {};
  const bd    = project?.bookDetails            || {};
  const bt    = project?.bookTitle              || {};
  const ap    = project?.authorPersona          || {};
  const saved = Array.isArray(ap.savedPersonas) ? ap.savedPersonas : [];
  const pid   = ap.selectedId;
  const persona = pid ? saved.find((p: any) => p.id === pid) || saved[0] : saved[0];

  const titleVal =
    bt?.selectedCard?.title?.trim() || pb.title?.trim() || r.bookTitle?.trim() || "(not set)";

  const subtitleVal =
    bd.subtitle?.trim() || bt?.selectedCard?.subtitle?.trim() || r.bookSubtitle?.trim() || "";

  const personaBlock = persona
    ? [
        persona.generated?.summary,
        persona.generated?.voice?.tone && `Voice tone: ${persona.generated.voice.tone}`,
        persona.generated?.voice?.mood && `Voice mood: ${persona.generated.voice.mood}`,
        persona.generated?.style?.pacing && `Pacing: ${persona.generated.style.pacing}`,
        persona.generated?.style?.sentenceStructure && `Sentences: ${persona.generated.style.sentenceStructure}`
      ].filter(Boolean).join("\n")
    : "(not generated)";

  const findingsBlock = (() => {
    const findings = project?.findings;
    if (!findings || typeof findings !== "object") return "(none)";
    const entries = Object.values(findings) as any[];
    return entries.slice(0, 6)
      .map((f: any) => `• ${f.title || ""}: ${String(f.content || "").slice(0, 120)}`)
      .join("\n") || "(none)";
  })();

  const resourcesBlock = (() => {
    const links = project?.resources?.links;
    if (!Array.isArray(links) || !links.length) return "(none)";
    return links.slice(0, 5)
      .map((l: any) => `• ${l.label || l.url || "link"}: ${(l.note || "").slice(0, 100)}`)
      .join("\n");
  })();

  const competitorBlock = (() => {
    const books = project?.analysis?.books;
    if (!Array.isArray(books) || !books.length) return "(none)";
    return books.slice(0, 5)
      .map((b: any) => `• "${b.title}" by ${b.author || "unknown"} — ${String(b.description || "").slice(0, 80)}`)
      .join("\n");
  })();

  const existingFields = [
    bd.genre               && `Genre: ${bd.genre}`,
    bd.structure           && `Structure: ${bd.structure}`,
    bd.tone                && `Tone: ${bd.tone}`,
    bd.audience            && `Audience: ${bd.audience}`,
    bd.wordCountRange      && `Word count: ${bd.wordCountRange}`,
    bd.chapterCount        && `Chapters: ${bd.chapterCount}`,
    bd.researchIntensity   && `Research intensity: ${bd.researchIntensity}`,
    bd.uniqueSellingProposition?.trim() && `USP (preserve unless weak): ${bd.uniqueSellingProposition.slice(0, 120)}`,
    bd.readerPainPoints?.trim()         && `Pain points (preserve unless weak): ${bd.readerPainPoints.slice(0, 120)}`,
    bd.corePromise?.trim()              && `Core promise already set: ${bd.corePromise.slice(0, 120)}`,
    bd.coreThesis?.trim()               && `Core thesis already set: ${bd.coreThesis.slice(0, 120)}`
  ].filter(Boolean).join("\n");

  return `You are an elite nonfiction publishing strategist and senior publishing consultant.

Analyze ALL project data below and generate a complete strategic Details profile for this book.
Return ONLY valid JSON — no prose, no markdown, no code fences.

═══════════════════════════
PROJECT DATA
═══════════════════════════

BOOK TITLE: ${titleVal}
SUBTITLE: ${subtitleVal || "(none yet)"}
NICHE: ${r.mainNicheLabel || "(not set)"}
SUB-NICHE: ${r.subNicheLabel || "(not set)"}
DEEP NICHE: ${r.deepNicheLabel || "(not set)"}
BOOK TOPIC: ${r.bookTopic || pb.bookTopic || "(not set)"}
PUBLISHING GOAL: ${r.publishingGoal || "(not set)"}
AUTHOR STANCE: ${r.stanceOnTopic || "(not set)"}
STANDOUT ANGLE: ${r.standout || "(not set)"}
TARGET AUDIENCE (research): ${r.targetAudience || "(not set)"}
AUTHOR TONES: ${Array.isArray(r.authorTones) ? r.authorTones.join(", ") : "(not set)"}

COMPETITIVE INTELLIGENCE:
  Audience: ${intel.targetAudience || "(not set)"}
  Reader Pain Profile: ${intel.readerPainProfile || "(not set)"}
  Transformation Promise: ${intel.transformationPromise || "(not set)"}
  Market Gap: ${intel.marketGapAnalysis || "(not set)"}
  Positioning Strategy: ${intel.positioningStrategy || "(not set)"}
  Energy Style: ${intel.energyStyle || "(not set)"}
  Emotional Triggers: ${Array.isArray(intel.emotionalTriggers) ? intel.emotionalTriggers.join(", ") : "(not set)"}

PROPOSED BOOK:
  USP: ${pb.uniqueSellingProposition || "(not set)"}
  Audience: ${pb.proposedAudience || "(not set)"}
  Differentiation: ${pb.differentiation || "(not set)"}
  Key Selling Points: ${pb.keySellingPoints || "(not set)"}

AUTHOR PERSONA:
${personaBlock}

RESEARCH FINDINGS:
${findingsBlock}

RESOURCES:
${resourcesBlock}

COMPETITOR BOOKS:
${competitorBlock}

EXISTING DETAILS (preserve strong values where present):
${existingFields || "(none yet)"}

═══════════════════════════
VALID OPTION LISTS
═══════════════════════════

GENRE options: Business | Self-help | Productivity | Personal finance | Entrepreneurship | Leadership | Investing | Marketing | Career development | Philosophy / ideas | Health & wellness | Cookbooks & food writing | Spirituality | Parenting & family | Technology | Memoir / narrative nonfiction | Other
STRUCTURE options: Chronological | Comparative | How-to | List-based | Modular | Problem-solution | Workbook | Question and answer | Thematic | Hybrid / mixed | Other
TONE options: Conversational | Academic | Neutral | Reflective | Authoritative | Witty | Narrative | Persuasive | Minimalist | Direct & practical
AUDIENCE options: Adult | Young adult | Child | Teen | Senior
WORD COUNT options: 10k–15k | 15k–20k | 20k–25k | 25k–30k | 30k–35k | 35k–40k | 40k–50k | 50k–70k | 70k–90k | 90k–120k
RESEARCH INTENSITY options: Light | Moderate | Heavy

═══════════════════════════
INSTRUCTIONS
═══════════════════════════

- Every recommendation must be SPECIFIC to THIS book. No generic boilerplate.
- Recommendations should feel like they came from a senior publishing consultant.
- Each suggestions array must have EXACTLY 3 items representing different strategic directions.
- genreSuggestions, structureSuggestions, toneSuggestions, audienceSuggestions: pick from the VALID OPTION LISTS above.
- researchIntensitySuggestions: always exactly ["Light","Moderate","Heavy"] ordered by what fits best first.
- uniqueMechanismSuggestions: invent 3 distinct marketable proprietary framework names with explanations.
- Positioning Statement template: "This book helps [audience] achieve [outcome] without [obstacle]."
- focusTopics: 10–20 highly specific strategic topic areas.
- readerObjectionsSuggestions: 3 DIFFERENT sets of 5–8 realistic objections. Each set is a single string with one objection per line (use literal \\n). Each set should emphasize different objection angles (e.g., set 1: practical barriers; set 2: emotional/mindset resistance; set 3: past-failure skepticism).
- readerPainPointsSuggestions: 3 different 2–3 sentence narratives of the reader's core frustrations, from different emotional angles.
- beforeStateSuggestions / afterStateSuggestions: 3 multi-line alternatives (4–6 states per alternative, one state per line).
- chapterCount: integer 5–15. wordCountRange: pick from WORD COUNT options.
- blueprintLayers: generate all 5 strategic layers — every field must be specific to THIS book, not generic.
- transformationMap: 6–8 stages, each stage 1 sentence describing what shifts in the reader.
- chapterMissions: generate exactly chapterCount missions (one per planned chapter) — each mission must connect directly to the core thesis and reader transformation.
- blueprintValidation: answer each question honestly based on the project data — if weak areas exist, set overallPass to false and describe what needs refinement.
- blueprintScores: integer 0–100 for each dimension — be critical and realistic, not flattering.

OUTPUT — return only this JSON object:

{
  "genreSuggestions": ["<genre1>", "<genre2>", "<genre3>"],
  "structureSuggestions": ["<struct1>", "<struct2>", "<struct3>"],
  "structureReasons": ["<reason for struct1>", "<reason for struct2>", "<reason for struct3>"],
  "toneSuggestions": ["<tone1>", "<tone2>", "<tone3>"],
  "audienceSuggestions": ["<audience1>", "<audience2>", "<audience3>"],
  "researchIntensitySuggestions": ["<best fit first>", "<second>", "<third>"],
  "chapterCount": <5-15>,
  "chapterCountReason": "<1 sentence>",
  "wordCountRange": "<value from list>",
  "wordCountReason": "<1 sentence>",
  "positioningStatementSuggestions": [
    "This book helps <audience> achieve <outcome1> without <obstacle1>.",
    "This book helps <audience> achieve <outcome2> without <obstacle2>.",
    "This book helps <audience> achieve <outcome3> without <obstacle3>."
  ],
  "corePromiseSuggestions": ["<promise1>", "<promise2>", "<promise3>"],
  "coreThesisSuggestions": ["<thesis1>", "<thesis2>", "<thesis3>"],
  "uniqueMechanismSuggestions": [
    { "name": "<Framework Name 1>", "description": "<2-3 sentence explanation>" },
    { "name": "<Framework Name 2>", "description": "<2-3 sentence explanation>" },
    { "name": "<Framework Name 3>", "description": "<2-3 sentence explanation>" }
  ],
  "beforeStateSuggestions": [
    "<state1a>\\n<state1b>\\n<state1c>\\n<state1d>",
    "<state2a>\\n<state2b>\\n<state2c>\\n<state2d>",
    "<state3a>\\n<state3b>\\n<state3c>\\n<state3d>"
  ],
  "afterStateSuggestions": [
    "<state1a>\\n<state1b>\\n<state1c>\\n<state1d>",
    "<state2a>\\n<state2b>\\n<state2c>\\n<state2d>",
    "<state3a>\\n<state3b>\\n<state3c>\\n<state3d>"
  ],
  "readerObjectionsSuggestions": [
    "<objection1>\\n<objection2>\\n<objection3>\\n<objection4>\\n<objection5>",
    "<alt_b_obj1>\\n<alt_b_obj2>\\n<alt_b_obj3>\\n<alt_b_obj4>\\n<alt_b_obj5>",
    "<alt_c_obj1>\\n<alt_c_obj2>\\n<alt_c_obj3>\\n<alt_c_obj4>\\n<alt_c_obj5>"
  ],
  "readerPainPointsSuggestions": [
    "<version 1: 2-3 sentence pain narrative from a practical angle>",
    "<version 2: 2-3 sentence pain narrative from an emotional angle>",
    "<version 3: 2-3 sentence pain narrative from a missed-potential angle>"
  ],
  "desiredEmotionalOutcomeSuggestions": ["<outcome1>", "<outcome2>", "<outcome3>"],
  "uspSuggestions": ["<usp1>", "<usp2>", "<usp3>"],
  "focusTopics": ["<topic1>", "<topic2>", "<topic3>", "<topic4>", "<topic5>", "<topic6>", "<topic7>", "<topic8>", "<topic9>", "<topic10>"],
  "subtitle": "<subtitle or empty string if existing subtitle is strong>",
  "blueprintLayers": {
    "bookIdentity": {
      "bookMission": "<1-sentence mission — what this book exists to do in the world>",
      "writingVoice": "<the distinctive voice this book must have — e.g. 'analytical mentor with dry wit'>",
      "teachingStyle": "<how the book teaches — e.g. 'concept → example → exercise → reflection'>",
      "evidenceStyle": "<how evidence is woven in — e.g. 'research-backed with real case studies'>",
      "practicalityLevel": "<Highly practical | Balanced | Conceptual>",
      "bookPersonality": "<the book's personality archetype — e.g. 'wise coach', 'research analyst', 'fellow traveler'>",
      "frameworkStyle": "<Single core framework | Multi-framework | Story-based | Checklist-driven | Hybrid>",
      "difficultyLevel": "<Beginner-friendly | Intermediate | Advanced | Expert>"
    },
    "readerModel": {
      "currentSituation": "<1-2 sentences: where the reader is right now in their life>",
      "desiredFuture": "<1-2 sentences: where they want to be after reading>",
      "goals": ["<specific reader goal 1>", "<goal 2>", "<goal 3>", "<goal 4>"],
      "motivations": ["<what drives them to seek this book 1>", "<motivation 2>", "<motivation 3>"],
      "fears": ["<what holds them back 1>", "<fear 2>", "<fear 3>"],
      "frustrations": ["<recurring frustration 1>", "<frustration 2>", "<frustration 3>"],
      "falseBeliefsToBreak": ["<false belief this book must dismantle 1>", "<false belief 2>", "<false belief 3>"],
      "learningStyle": "<how this specific audience absorbs information best>",
      "transformationMilestones": ["<milestone 1 — early win>", "<milestone 2>", "<milestone 3>", "<milestone 4>", "<milestone 5 — lasting change>"]
    },
    "marketModel": {
      "competitorStrengths": ["<what competing books do well 1>", "<strength 2>", "<strength 3>"],
      "competitorWeaknesses": ["<where competing books consistently fail readers 1>", "<weakness 2>", "<weakness 3>"],
      "readerExpectations": ["<what readers expect when buying this type of book 1>", "<expectation 2>", "<expectation 3>"],
      "marketTrends": ["<emerging trend in this category 1>", "<trend 2>"],
      "marketGaps": ["<specific gap no current book fills 1>", "<gap 2>", "<gap 3>"],
      "uniqueOpportunities": ["<opportunity this book can uniquely own 1>", "<opportunity 2>"],
      "overusedAdvice": ["<advice readers are tired of hearing 1>", "<overused 2>", "<overused 3>"],
      "missingTopics": ["<topic readers need but no book covers well 1>", "<missing 2>", "<missing 3>"],
      "commercialRisks": ["<what could limit commercial success 1>", "<risk 2>"],
      "competitiveAdvantages": ["<this book's strongest competitive edge 1>", "<advantage 2>", "<advantage 3>"]
    },
    "bookStrategy": {
      "coreFramework": "<name and 1-sentence description of the primary framework/system>",
      "supportingFrameworks": ["<supporting framework 1>", "<supporting framework 2>"],
      "keyVocabulary": ["<proprietary term 1>", "<term 2>", "<term 3>", "<term 4>", "<term 5>"],
      "recurringConcepts": ["<concept threaded throughout the book 1>", "<concept 2>", "<concept 3>"],
      "learningProgression": "<how the reader's capability builds from chapter 1 to final chapter>",
      "implementationStrategy": "<how the book ensures readers actually implement its teachings>",
      "evidenceStrategy": "<what mix of research, stories, data, and examples to use>",
      "storyStrategy": "<how narrative and case studies are woven through the book>",
      "practicalStrategy": "<how exercises, tools, and frameworks are delivered>"
    },
    "qualityTargets": {
      "commercialGoal": "<what defines commercial success for this book>",
      "educationalGoal": "<the core knowledge transformation the reader gains>",
      "emotionalGoal": "<the emotional state the reader finishes with>",
      "practicalGoal": "<the concrete skill or system the reader walks away with>",
      "transformationGoal": "<the lasting life change this book enables>",
      "originalityGoal": "<what makes this book distinctively different from everything else>",
      "readabilityGoal": "<the reading experience quality target — pace, clarity, flow>",
      "memorabilityGoal": "<what readers will still remember and cite 1 year later>"
    }
  },
  "transformationMap": [
    { "stage": "Current State", "description": "<reader's painful starting reality>" },
    { "stage": "Awareness", "description": "<first shift — what opens up when they start reading>" },
    { "stage": "Understanding", "description": "<the core insight that changes their mental model>" },
    { "stage": "Confidence", "description": "<where belief in the approach builds>" },
    { "stage": "Implementation", "description": "<where action and practice begin>" },
    { "stage": "Momentum", "description": "<when early results compound into consistency>" },
    { "stage": "Mastery", "description": "<the achieved outcome — what they can now do>" },
    { "stage": "Long-Term Success", "description": "<the lasting transformation in their life or work>" }
  ],
  "chapterMissions": [
    {
      "chapterNumber": 1,
      "chapterTopic": "<what this chapter is about — 5-8 words>",
      "purpose": "<why this chapter must exist in the book>",
      "transformationGoal": "<what shifts in the reader after this chapter>",
      "knowledgeGoal": "<what the reader understands after this chapter>",
      "practicalGoal": "<what the reader can do or try after this chapter>",
      "connectionToThesis": "<how this chapter advances the core argument>",
      "expectedReaderAction": "<the one thing the reader should do after finishing>"
    }
  ],
  "blueprintValidation": {
    "solvesRealMarketProblem": true,
    "clearlyDifferentiates": true,
    "strongUSP": true,
    "realisticTransformation": true,
    "logicalLearningProgression": true,
    "allChaptersSupportTransformation": true,
    "marketGapsAddressed": true,
    "supportsPremiumBook": true,
    "overallPass": true,
    "refinementNeeded": null
  },
  "blueprintScores": {
    "readerUnderstanding": 80,
    "marketUnderstanding": 75,
    "commercialPotential": 70,
    "transformationStrength": 85,
    "frameworkStrength": 75,
    "originality": 70,
    "practicality": 80,
    "learningDesign": 75,
    "competitiveAdvantage": 70,
    "researchConfidence": 75,
    "blueprintConfidence": 76
  }
}`;
}

// ─── Subsection Generation Engine ──────────────────────────────────────────────

export function sectionGenerationPrompt(
  bookTitle: string,
  chapterTitle: string,
  sectionCount: number,
  research?: any,
  corePromise?: string,
  coreThesis?: string,
  chapterPurpose?: string,
  chapterNumber?: number,
  totalChapters?: number
): string {
  const niche    = research?.mainNicheLabel || "";
  const subNiche = research?.subNicheLabel  || "";
  const audience = research?.targetAudience || "";
  const topic    = research?.bookTopic      || "";

  // ── Learning phase computation ─────────────────────────────────────────────
  const chNum   = chapterNumber && chapterNumber > 0 ? chapterNumber : 1;
  const chTotal = totalChapters && totalChapters > 0 ? totalChapters : 10;
  const ratio   = chTotal > 1 ? (chNum - 1) / (chTotal - 1) : 0;

  let learningPhase: number;
  let phaseName: string;
  let phaseGoal: string;
  let phasePreferred: string[];
  let phaseOccasional: string[];
  let phaseAvoid: string[];

  if (ratio <= 0.20) {
    learningPhase = 1; phaseName = "Understanding";
    phaseGoal     = "Build trust, teach foundational concepts, and create awareness.";
    phasePreferred  = ["Research Insight","Real-Life Example","Case Study","Resources","Myth vs Reality","Success Story"];
    phaseOccasional = ["Key Takeaways","FAQ"];
    phaseAvoid      = ["Action Plan","Checklist","Exercise","Templates","7-Day Challenge","Pro Tips","Common Mistakes"];
  } else if (ratio <= 0.40) {
    learningPhase = 2; phaseName = "Foundation";
    phaseGoal     = "Build self-awareness and help readers deeply understand themselves and the problem.";
    phasePreferred  = ["Real-Life Example","Case Study","Reflection Questions","Research Insight","Key Takeaways","One Small Step","Myth vs Reality"];
    phaseOccasional = ["Exercise","Success Story","FAQ"];
    phaseAvoid      = ["Action Plan","Templates","Checklist","Pro Tips","7-Day Challenge"];
  } else if (ratio <= 0.65) {
    learningPhase = 3; phaseName = "Implementation";
    phaseGoal     = "Get the reader doing. Apply concepts through concrete action and practice.";
    phasePreferred  = ["Action Plan","Checklist","Exercise","Templates","Real-Life Example","Reflection Questions","Key Takeaways","Common Mistakes","7-Day Challenge","One Small Step"];
    phaseOccasional = ["Research Insight","Resources","FAQ","Success Story"];
    phaseAvoid      = ["Myth vs Reality"];
  } else if (ratio <= 0.80) {
    learningPhase = 4; phaseName = "Mastery";
    phaseGoal     = "Optimize performance and build advanced capabilities beyond the basics.";
    phasePreferred  = ["Templates","Exercise","Reflection Questions","Action Plan","Key Takeaways","Checklist","Pro Tips","Self-Assessment"];
    phaseOccasional = ["Case Study","Success Story","Common Mistakes"];
    phaseAvoid      = ["Resources","Myth vs Reality","One Small Step","FAQ"];
  } else {
    learningPhase = 5; phaseName = "Long-Term Success";
    phaseGoal     = "Sustain transformation and maintain long-term change.";
    phasePreferred  = ["Reflection Questions","Action Plan","Checklist","Key Takeaways","Self-Assessment"];
    phaseOccasional = ["Success Story"];
    phaseAvoid      = ["Research Insight","Case Study","Myth vs Reality","One Small Step","FAQ","7-Day Challenge"];
  }

  const purposeLine = chapterPurpose?.trim()
    ? `Chapter Purpose:\n${chapterPurpose.trim()}`
    : `Chapter Purpose:\nDeliver the full promise of this chapter: "${chapterTitle}"`;

  const contextBlock = [
    topic    ? `Book Topic: ${topic}` : "",
    niche    ? `Niche: ${niche}${subNiche ? ` › ${subNiche}` : ""}` : "",
    audience ? `Target Audience: ${audience}` : ""
  ].filter(Boolean).join("\n");

  return `You are an elite nonfiction book architect, developmental editor, and bestselling book strategist.

Your task is to generate ALL section titles for a chapter at the same time.

BOOK STRUCTURE
Book
└─ Chapter
   └─ Section
      └─ Subsection

INPUTS

Book Title: ${bookTitle || "(not set)"}

Book Core Promise: ${corePromise?.trim() || "Provide meaningful, actionable value to the target audience."}

Book Core Thesis: ${coreThesis?.trim() || "Help readers achieve the transformation this book promises."}

Chapter Title: ${chapterTitle}

${purposeLine}

${contextBlock ? `${contextBlock}\n\n` : ""}====================================================

CRITICAL REQUIREMENT — EXACT SECTION COUNT

You MUST generate EXACTLY ${sectionCount} section${sectionCount !== 1 ? "s" : ""}.

Not ${sectionCount - 1}. Not ${sectionCount + 1}. Exactly ${sectionCount}.

This number is locked by the book's structural plan and cannot change.
Do not add sections. Do not remove sections. Do not merge sections.
Your only job is to generate ${sectionCount} high-quality section titles.

====================================================

PRIMARY OBJECTIVE

Generate section titles that fully expand and deliver the promise of the chapter.

Each section should represent a major pillar of the chapter.

When combined, all section titles should create a complete learning journey for the reader.

====================================================

RULE 1 — CHAPTER EXPANSION

Every section must directly support and expand the chapter title.

Ask: "Does this section help the reader better understand, apply, or benefit from the chapter?"

If not, reject it. Never generate sections unrelated to the chapter.

====================================================

RULE 2 — NO DUPLICATES

Every section title must be unique.

Forbidden:
❌ Exact duplicates
❌ Similar wording
❌ Same concept phrased differently
❌ Multiple sections teaching the same lesson

Before returning results, compare every section title against every other section title.

If overlap exists: Regenerate.

====================================================

RULE 3 — DIFFERENT LEARNING ANGLES

Each section must explore a different major aspect of the chapter.

Possible angles: Foundations, Causes, Psychology, Science, Frameworks, Strategies, Systems, Habits, Mistakes, Obstacles, Case Studies, Real Examples, Implementation, Advanced Techniques, Long-Term Application.

Do not repeat the same angle.

====================================================

RULE 4 — COMPLETE COVERAGE

The combined sections should fully cover the chapter topic.

A reader should feel: "This chapter explored the topic from every important angle."

Avoid gaps. Avoid redundancy.

====================================================

RULE 5 — LOGICAL PROGRESSION

Arrange sections in a logical sequence.

Recommended flow:
1. Understanding
2. Why It Happens
3. Consequences
4. Solutions
5. Systems
6. Implementation
7. Long-Term Success

====================================================

RULE 6 — BOOK ALIGNMENT

Every section must support: Book Title, Core Promise, Core Thesis, Chapter Purpose.

Do not create sections that contradict the overall book positioning.

====================================================

RULE 7 — SECTION QUALITY

Avoid generic titles.

Forbidden:
❌ Introduction
❌ Overview
❌ Key Concepts
❌ Main Ideas
❌ Summary
❌ Final Thoughts

Create professional, compelling, commercially valuable section titles.

Each title should feel like it belongs in a bestselling nonfiction book.

====================================================

RULE 8 — NO COLON FORMAT (CRITICAL)

NEVER use a two-part title with a colon.

❌ WRONG: "The Productivity Trap: Why Being Busy Isn't Effective"
❌ WRONG: "The Focus Problem: How Distractions Destroy Deep Work"
❌ WRONG: "The Attention Crisis: What Modern Work Does to Your Brain"

✅ CORRECT: "Why Being Busy Isn't the Same as Being Effective"
✅ CORRECT: "How Distractions Destroy Deep Work"
✅ CORRECT: "What Modern Work Does to Your Brain"

The section title is the explanatory phrase only — never a label followed by a colon.

No section title may contain a colon (:) under any circumstances.

Preferred formats:
- Why [something happens or is true]
- How [something works or can be changed]
- What [the reader needs to understand or do]
- The [specific concept, tactic, or insight]
- Building / Creating / Designing [something actionable]

====================================================

RULE 9 — SELF-AUDIT

Before returning results, check every section title:
1. Is it directly related to the chapter?
2. Is it unique?
3. Does it teach something different from every other section?
4. Does it help fulfill the chapter promise?
5. Would a professional editor approve it?
6. Does it contain a colon? If YES — rewrite it.

If any answer is NO: Regenerate.

====================================================

RULE 10 — CHAPTER COMPLETENESS TEST

After generating all sections, ask:

"If these were the only sections in the chapter, would the reader fully understand and be able to apply the chapter's main lesson?"

If NO: Regenerate.

====================================================

CORE BOOK LOGIC (applies to all sections)

1. The book is a transformation journey: problem → solution → mastery.
2. Every section must move the reader forward in the chapter's transformation.
3. Sections break the chapter into distinct logical dimensions.
4. No repetition across sections. No filler or decorative titles.

====================================================

ANTI-REPETITION VALIDATION

Count unique section titles. If any are duplicates: REGENERATE.
Never return duplicate section titles.

====================================================

SECTION ARCHITECTURE (required for every section)
====================================================

Every section must be intentional. Before creating each section, define its role:

- Purpose: What does this section contribute to the chapter mission?
- Reader Question: What specific question does the reader have that this section answers?
- Learning Objective: What will the reader understand or be able to do after this section?
- Teaching Method: How does this section teach? (Direct Instruction / Case Study / Framework / Socratic / Story-Based / Exercise-Driven)
- Framework Contribution: How does this section build on or advance the chapter's core framework?
- Difficulty: Is this section Introductory, Intermediate, or Advanced relative to the chapter?
- Practical Requirement: Does the reader need to DO something in or after this section?
- Expected Reader Action: What should the reader attempt after reading this section?
- Connection to Chapter Mission: In one phrase, how does this section serve the chapter objective?

No section should exist simply to fill a count.
Every section must earn its place by serving a distinct role in the chapter's transformation arc.

====================================================

BLUEPRINT COMPONENT INTELLIGENCE ENGINE

====================================================

STEP 1 — ANALYZE SECTION CONTEXT BEFORE SELECTING

Before choosing any component, identify:
A. What is the teaching purpose of this section? (see list below)
B. What category balance does this purpose require?
C. What does the reader need right now — Engagement, Authority, Explanation, Action, or Reinforcement?
D. What natural component pairings strengthen learning here?

====================================================

TEACHING PURPOSES — identify the purpose of each section before selecting

Introduce Concept    → reader needs: Engagement + Explanation (Story/Example + Why This Happens/Framework)
Correct Misconception → reader needs: Authority + Explanation (Myth vs Reality + Research/Brain Science)
Teach Skill          → reader needs: Explanation + Action (Framework + Exercise/Checklist/Templates)
Explain Framework    → reader needs: Explanation + Action (Framework + Real-Life Example + Checklist)
Build Confidence     → reader needs: Engagement + Reinforcement (Success Story + Key Takeaways/Pro Tips)
Inspire Action       → reader needs: Engagement + Action (Story + Action Plan/One Small Step)
Diagnose Problem     → reader needs: Authority + Explanation (Statistics/Research + Why This Happens)
Compare Options      → reader needs: Authority + Explanation (Case Study + Common Mistakes/Common Traps)
Deepen Understanding → reader needs: Authority + Explanation (Brain Science + Research Insight + Case Study)
Summarize            → reader needs: Reinforcement (Key Takeaways + Reflection Questions + Self-Assessment)
Implementation       → reader needs: Action (Action Plan + Checklist + Templates + Common Mistakes)
Troubleshooting      → reader needs: Explanation + Reinforcement (Common Traps + FAQ + Practical Technique)
Optimization         → reader needs: Action + Reinforcement (Pro Tips + Templates + Self-Assessment)
Mastery              → reader needs: Action + Reinforcement (Self-Assessment + Reflection Questions + Pro Tips)

====================================================

COMPONENT CATEGORIES
(every component belongs to exactly one category)

ENGAGEMENT (draws readers in, makes concepts relatable)
  Story, Real-Life Example, Success Story, Case Study, Expert Quote

AUTHORITY (establishes credibility, grounds concepts in evidence)
  Research Insight, Statistics, Brain Science, Why This Happens, Myth vs Reality

EXPLANATION (builds understanding, delivers the core concept)
  Common Mistakes, Common Traps, Practical Technique, FAQ

ACTION (drives application and behavior change)
  Exercise, Checklist, Templates, Action Plan, One Small Step, Self-Assessment, 7-Day Challenge

REINFORCEMENT (cements learning, sustains momentum)
  Key Takeaways, Reflection Questions, Resources, Pro Tips

====================================================

BALANCED RECIPE (target for every section)

Select 3 components total. Build a balanced recipe:
  0–1 from ENGAGEMENT
  0–1 from AUTHORITY
  1–2 from EXPLANATION or ACTION
  0–1 from REINFORCEMENT

Not every section needs every category.
The balance depends on the teaching purpose identified in STEP 1.

====================================================

NATURAL COMPONENT PAIRINGS (prefer these combinations)

Story + Common Mistakes           — narrative with grounded lesson
Research Insight + Statistics     — evidence layered with scale
Framework + Real-Life Example     — model made concrete
Checklist + Action Plan           — sequence plus commitment
Reflection Questions + Exercise   — introspection into practice
Case Study + Key Takeaways        — proof distilled into lessons
FAQ + Resources                   — doubts resolved with deeper paths
Templates + Self-Assessment       — tool plus progress check
One Small Step + Action Plan      — momentum into full commitment
Myth vs Reality + Brain Science   — reframe grounded in science

====================================================

NICHE-AWARE COMPONENT PREFERENCES

Business:       Case Study, Framework (Practical Technique), Checklist, Action Plan, Templates
Health:         Research Insight, Brain Science, Exercise, Reflection Questions, Statistics
Finance:        Statistics, Templates, Common Traps, Action Plan, Self-Assessment
Psychology:     Research Insight, Exercise, Reflection Questions, Case Study, Brain Science
History:        Story, Expert Quote, Common Mistakes, Research Insight, Why This Happens
Self-Help:      Story, Real-Life Example, Exercise, Reflection Questions, Action Plan
Technology:     Practical Technique, Checklist, Common Mistakes, Templates, FAQ

Adapt component selection to the book's niche. Do not force identical patterns across all niches.

====================================================

DIFFICULTY ADAPTATION

Beginner chapters (Phase 1–2):
  Prefer: Story, Real-Life Example, Success Story, Why This Happens, One Small Step, Key Takeaways
  Reduce: Research Insight, Statistics, Pro Tips, Templates, Self-Assessment

Intermediate chapters (Phase 3):
  Prefer: Practical Technique, Checklist, Action Plan, Case Study, Reflection Questions
  Balance: Explanation + Action evenly

Advanced chapters (Phase 4–5):
  Prefer: Research Insight, Brain Science, Pro Tips, Templates, Self-Assessment, Common Traps
  Reduce: Story, FAQ, One Small Step (reader is past these)

====================================================

READER'S CURRENT LEARNING STAGE

Chapter ${chNum} of ${chTotal} → Phase ${learningPhase} — ${phaseName}
Stage Goal: ${phaseGoal}

PREFERRED for this phase — prioritize these:
${phasePreferred.map((c: string) => `✅ ${c}`).join("\n")}

OCCASIONAL — use only when the section purpose clearly warrants it:
${phaseOccasional.map((c: string) => `⚪ ${c}`).join("\n")}

AVOID at this stage — reader is not ready for these:
${phaseAvoid.length ? phaseAvoid.map((c: string) => `❌ ${c}`).join("\n") : "(none — all components are available at this stage)"}

====================================================

ANTI-REPETITION RULES

Across all sections in this chapter, avoid repeating the same combination.
No two consecutive sections should share the same 3-component set.
Vary which categories you draw from section to section.

❌ Repetitive (avoid): Story + Research Insight + Checklist (used for every section)
✅ Varied: Section 1 = Story + Why This Happens + Key Takeaways
           Section 2 = Research Insight + Action Plan + Reflection Questions
           Section 3 = Case Study + Templates + Common Mistakes

====================================================

COMPONENT VALIDATION (self-check before finalizing)

For every component selected, confirm:
1. Does it support the section's teaching purpose?
2. Does it serve a different learning function from the other selected components?
3. Is it appropriate for Phase ${learningPhase} (${phaseName})?
4. Would a premium educational book teach this concept this way?
5. Does the combination create a balanced learning recipe?

If any answer is NO — replace that component before returning the result.

====================================================

COMPONENT SELECTION RULES (NON-NEGOTIABLE)

1. Choose EXACTLY 3 components per section.

2. Follow the balanced recipe: select from at least 2 different categories.
   Never pick 3 components from the same category.

3. AVOID components must NOT be used at Phase ${learningPhase}. The reader is not ready for them.

4. Each component must serve a DIFFERENT learning purpose.
   ❌ WEAK: Research Insight + Case Study + Real-Life Example (all explain/prove — redundant)
   ❌ WEAK: Action Plan + Checklist + Exercise (all action — one-dimensional)
   ❌ WEAK: Key Takeaways + Reflection Questions + FAQ (all passive — no active element)
   ✅ STRONG: Research Insight + Reflection Questions + Key Takeaways
   ✅ STRONG: Action Plan + Common Mistakes + Reflection Questions
   ✅ STRONG: Case Study + Exercise + Key Takeaways
   ✅ STRONG: Myth vs Reality + Real-Life Example + Key Takeaways
   ✅ STRONG: Templates + Exercise + Self-Assessment
   ✅ STRONG: One Small Step + Action Plan + Common Mistakes

5. Match component to section type:
   Conceptual section     → Research Insight, Real-Life Example, Case Study, Statistics, Myth vs Reality
   Framework section      → Practical Technique, Templates, Checklist, Action Plan, Exercise
   Implementation section → Action Plan, Templates, Exercise, Checklist, Common Mistakes
   Optimization section   → Key Takeaways, Templates, Reflection Questions, Pro Tips, Checklist
   Conclusion section     → Reflection Questions, Key Takeaways, Action Plan, Self-Assessment

6. Vary combinations across sections in this chapter.
   No two consecutive sections should share the same 3-component set.

====================================================

SUBSECTION EXPANSION SCORING

After you finish writing all ${sectionCount} section titles, analyze them AGAINST EACH OTHER to judge which ones carry the most weight in this chapter and which need the deepest expansion.

For every section, assign an "expansionScore" from 0–100 based on:
- Importance: how central this section is to delivering the chapter's core promise.
- Complexity: how many distinct sub-ideas, steps, or nuances the topic naturally contains.
- Need for expansion: whether the topic is dense enough to justify being broken into more subsections, versus a narrower topic that only needs a light treatment.

Score sections relative to one another — do not give every section the same score. There should be a clear top tier and a clear rest.

====================================================

OUTPUT FORMAT

Return ONLY valid JSON — no markdown, no explanations, no code fences, no comments.

{"sections":[{"sectionTitle":"Section title — unique, compelling, no colons","sectionObjective":"1 sentence: what this section teaches or achieves within the chapter","readerQuestion":"The specific question the reader has that this section answers","teachingMethod":"Direct Instruction","difficulty":"Intermediate","frameworkContribution":"How this section advances the chapter framework","blueprintComponents":["Research Insight","Key Takeaways","Reflection Questions"],"expansionScore":72}]}`;
}

// Simplified fallback used when the full sectionGenerationPrompt fails to
// produce parseable JSON (weaker/smaller models can choke on the long prompt).
export function sectionGenerationFallbackPrompt(
  bookTitle: string,
  chapterTitle: string,
  sectionCount: number,
  chapterPurpose?: string
): string {
  return `Generate exactly ${sectionCount} section titles for a nonfiction book chapter.

Book Title: ${bookTitle || "(not set)"}
Chapter Title: ${chapterTitle}
${chapterPurpose?.trim() ? `Chapter Purpose: ${chapterPurpose.trim()}` : ""}

Rules:
- Exactly ${sectionCount} sections, each covering a distinct major aspect of the chapter.
- No colons in titles. No generic titles like "Introduction" or "Summary".
- Each section needs a one-sentence objective and 3 blueprint components picked from this list: Key Takeaways, Action Plan, Checklist, Exercise, Reflection Questions, Templates, Case Study, Real-Life Example, Research Insight, Resources, One Small Step, Common Mistakes, Pro Tips, 7-Day Challenge, FAQ, Myth vs Reality, Success Story, Brain Science, Statistics, Why This Happens, Practical Technique, Self-Assessment, Common Traps, Expert Quote, Story.
- After writing the titles, compare them against each other and assign each an "expansionScore" from 0-100 based on importance, complexity, and how much the topic needs to be broken down further. Vary the scores — do not give every section the same score.

Return ONLY this JSON with no markdown, no code fences, no extra text:
{"sections":[{"sectionTitle":"...","sectionObjective":"...","blueprintComponents":["...","...","..."],"expansionScore":72}]}`;
}

export function subsectionGenerationPrompt(
  chapterTitle: string,
  sectionTitle: string,
  subsectionCount: number,
  research?: any,
  sectionObjective?: string,
  chapterPurpose?: string,
  corePromise?: string,
  coreThesis?: string,
  chapterNumber?: number,
  totalChapters?: number
): string {
  const niche    = research?.mainNicheLabel || "";
  const subNiche = research?.subNicheLabel  || "";
  const audience = research?.targetAudience || "";
  const topic    = research?.bookTopic      || "";

  // ── Learning phase computation (mirrors sectionGenerationPrompt) ───────────
  const chNum   = chapterNumber && chapterNumber > 0 ? chapterNumber : 1;
  const chTotal = totalChapters && totalChapters > 0 ? totalChapters : 10;
  const ratio   = chTotal > 1 ? (chNum - 1) / (chTotal - 1) : 0;

  let learningPhase: number;
  let phaseName: string;
  let phaseGoal: string;
  let phasePreferred: string[];
  let phaseOccasional: string[];
  let phaseAvoid: string[];

  if (ratio <= 0.20) {
    learningPhase = 1; phaseName = "Understanding";
    phaseGoal     = "Build trust, teach foundational concepts, and create awareness.";
    phasePreferred  = ["Research Insight","Real-Life Example","Case Study","Resources","Myth vs Reality","Success Story"];
    phaseOccasional = ["Key Takeaways","FAQ"];
    phaseAvoid      = ["Action Plan","Checklist","Exercise","Templates","7-Day Challenge","Pro Tips","Common Mistakes"];
  } else if (ratio <= 0.40) {
    learningPhase = 2; phaseName = "Foundation";
    phaseGoal     = "Build self-awareness and help readers deeply understand themselves and the problem.";
    phasePreferred  = ["Real-Life Example","Case Study","Reflection Questions","Research Insight","Key Takeaways","One Small Step","Myth vs Reality"];
    phaseOccasional = ["Exercise","Success Story","FAQ"];
    phaseAvoid      = ["Action Plan","Templates","Checklist","Pro Tips","7-Day Challenge"];
  } else if (ratio <= 0.65) {
    learningPhase = 3; phaseName = "Implementation";
    phaseGoal     = "Get the reader doing. Apply concepts through concrete action and practice.";
    phasePreferred  = ["Action Plan","Checklist","Exercise","Templates","Real-Life Example","Reflection Questions","Key Takeaways","Common Mistakes","7-Day Challenge","One Small Step"];
    phaseOccasional = ["Research Insight","Resources","FAQ","Success Story"];
    phaseAvoid      = ["Myth vs Reality"];
  } else if (ratio <= 0.80) {
    learningPhase = 4; phaseName = "Mastery";
    phaseGoal     = "Optimize performance and build advanced capabilities beyond the basics.";
    phasePreferred  = ["Templates","Exercise","Reflection Questions","Action Plan","Key Takeaways","Checklist","Pro Tips","Self-Assessment"];
    phaseOccasional = ["Case Study","Success Story","Common Mistakes"];
    phaseAvoid      = ["Resources","Myth vs Reality","One Small Step","FAQ"];
  } else {
    learningPhase = 5; phaseName = "Long-Term Success";
    phaseGoal     = "Sustain transformation and maintain long-term change.";
    phasePreferred  = ["Reflection Questions","Action Plan","Checklist","Key Takeaways","Self-Assessment"];
    phaseOccasional = ["Success Story"];
    phaseAvoid      = ["Research Insight","Case Study","Myth vs Reality","One Small Step","FAQ","7-Day Challenge"];
  }

  const contextLines = [
    corePromise?.trim()      ? `Book Core Promise: ${corePromise.trim()}` : "",
    coreThesis?.trim()       ? `Book Core Thesis: ${coreThesis.trim()}` : "",
    chapterPurpose?.trim()   ? `Chapter Purpose: ${chapterPurpose.trim()}` : "",
    sectionObjective?.trim() ? `Section Objective: ${sectionObjective.trim()}` : "",
  ].filter(Boolean).join("\n");

  return `You are an elite nonfiction book architect.
Your task is to generate ALL subsection titles for a section at the same time.

BOOK STRUCTURE
Chapter
└─ Section
   └─ Subsections

INPUTS
Chapter Title: ${chapterTitle}
Section Title: ${sectionTitle}
${contextLines ? `${contextLines}\n` : ""}${topic ? `Book Topic: ${topic}\n` : ""}${niche ? `Niche: ${niche}${subNiche ? ` › ${subNiche}` : ""}\n` : ""}${audience ? `Target Audience: ${audience}\n` : ""}
====================================================

CRITICAL REQUIREMENT — EXACT SUBSECTION COUNT

You MUST generate EXACTLY ${subsectionCount} subsection${subsectionCount !== 1 ? "s" : ""}.

Not ${subsectionCount - 1}. Not ${subsectionCount + 1}. Exactly ${subsectionCount}.

This number was already determined upstream based on this section's importance and need for expansion relative to the other sections in the chapter. It is locked and cannot change.

Do not add subsections. Do not remove subsections. Do not merge subsections. Your only job is to generate ${subsectionCount} high-quality subsection titles that, together, fully expand the section.

====================================================

RULES (NON-NEGOTIABLE)

RULE 1 — NO DUPLICATE SUBSECTIONS
Every subsection title MUST be completely unique.
Forbidden: same title repeated, same idea with slightly different wording, multiple titles covering the same topic.
Before returning results, compare every subsection against every other and remove duplicates.

RULE 2 — SUBSECTIONS MUST EXPAND THE SECTION
Each subsection must directly support the parent section.
Ask: "Does this subsection help explain, teach, prove, explore, or apply the section title?"
If not, reject it. Never introduce unrelated concepts. Never drift into topics belonging to another section.

RULE 3 — DIFFERENT ANGLES
Each subsection must cover a different aspect of the section.
Possible angles: Definition, Root Causes, Psychology, Science, Frameworks, Methods, Challenges, Mistakes, Examples, Real-Life Scenarios, Case Studies, Action Steps, Practical Application.
Do not use the same angle twice unless absolutely necessary.

RULE 4 — LOGICAL LEARNING FLOW
Arrange subsections in a natural progression: Understanding → Causes → Effects → Solutions → Application.
The reader should feel a clear progression from one subsection to the next.

RULE 5 — TITLE QUALITY
Avoid generic titles.
Forbidden: "Introduction", "Key Concepts", "Overview", "Summary", "Final Thoughts", "Chapter N", "Section N", "Topic N", "Subsection N".
Titles must feel professionally published and commercially valuable — specific, emotionally intelligent, niche-relevant.

RULE 6 — NO COLON FORMAT (CRITICAL)
NEVER use a two-part title with a colon separator.

❌ WRONG: "The Attention Crisis: What Distractions Do to Deep Work"
❌ WRONG: "The Habit Loop: How Triggers Control Your Behavior"
❌ WRONG: "Emotional Labor: Why Caregiving Exhausts the Body"

✅ CORRECT: "What Distractions Actually Do to Deep Work"
✅ CORRECT: "How Triggers Control Your Behavior Without Your Awareness"
✅ CORRECT: "Why Caregiving Exhausts the Body Over Time"

The subsection title is the explanatory phrase only — never a label followed by a colon.
No subsection title may contain a colon (:) under any circumstances.
If you catch yourself writing "X: Y" — delete "X:" and keep only "Y".

RULE 7 — SUBSECTION UNIQUENESS TEST
Before returning output, verify every pair: Are they discussing different ideas? Providing unique value? Would a reader learn something different from each?
If the answer is NO, regenerate.

RULE 8 — ANTI-REPETITION CHECK
Count unique subsection titles. If any are duplicates: REGENERATE until all are unique.
Never return duplicate subsection titles.

RULE 9 — SECTION RELEVANCE CHECK
For every subsection: re-read the section title and score relevance 1–10. If relevance < 8: regenerate that subsection.

RULE 9A — CORE BOOK LOGIC
The book is a transformation journey: problem → solution → mastery.
Every subsection must move the reader forward in the section's logical expansion.
No repetition. No filler or decorative titles.

RULE 10 — RETURN ONLY FINAL RESULTS
Output ONLY valid JSON — no explanations, no markdown, no code fences, no comments.

====================================================

SUBSECTION ARCHITECTURE (required for every subsection)

====================================================

Every subsection must teach EXACTLY ONE major idea. Before creating each subsection, define:

- Teaching Goal: What is the single pedagogical purpose of this subsection?
- Single Core Idea: State the ONE concept, insight, or skill this subsection delivers (one sentence max).
- Expected Reader Insight: What should the reader think, feel, or understand immediately after reading this subsection?
- Story Requirement: Does this subsection need a brief narrative to land the concept?
- Evidence Requirement: Does this subsection require data, research, or expert support to be credible?
- Exercise Requirement: Does the reader need to practice or apply something here?
- Complexity: Is this subsection Easy, Moderate, or Dense in cognitive load?
- Expected Reader Outcome: What will the reader be able to do after this subsection that they couldn't do before?

CRITICAL: Never mix two unrelated concepts in one subsection. If a subsection covers two ideas, split it.
Every subsection must feel purposeful — the reader should never wonder why it's here.

====================================================

BLUEPRINT COMPONENT INTELLIGENCE ENGINE (PER SUBSECTION)

====================================================

STEP 1 — ANALYZE SUBSECTION CONTEXT BEFORE SELECTING

Before choosing any component, identify:
A. What is the teaching purpose of this subsection? (see purpose list below)
B. What single core idea does this subsection teach?
C. What does the reader need right now — Engagement, Authority, Explanation, Action, or Reinforcement?
D. What natural component pairings would strengthen learning here?
E. What components have already been used heavily in this section? (avoid repeating them)

====================================================

TEACHING PURPOSES — identify the purpose of each subsection before selecting

Introduce Concept    → Engagement + Explanation (Story/Example + Why This Happens/Framework)
Correct Misconception → Authority + Explanation (Myth vs Reality + Research Insight/Brain Science)
Teach Skill          → Explanation + Action (Practical Technique + Exercise/Checklist)
Explain Framework    → Explanation + Action (Why This Happens + Real-Life Example + Checklist)
Build Confidence     → Engagement + Reinforcement (Success Story + Key Takeaways)
Inspire Action       → Engagement + Action (Story + Action Plan/One Small Step)
Diagnose Problem     → Authority + Explanation (Statistics + Why This Happens)
Deepen Understanding → Authority + Explanation (Brain Science + Research Insight)
Implementation       → Action (Action Plan + Checklist + Common Mistakes)
Troubleshooting      → Explanation + Reinforcement (Common Traps + FAQ + Practical Technique)
Optimization         → Action + Reinforcement (Pro Tips + Templates + Self-Assessment)
Summarize            → Reinforcement (Key Takeaways + Reflection Questions)
Mastery              → Action + Reinforcement (Self-Assessment + Reflection Questions + Pro Tips)

====================================================

COMPONENT CATEGORIES
(every component belongs to exactly one category)

ENGAGEMENT (draws readers in, makes concepts relatable)
  Story, Real-Life Example, Success Story, Case Study, Expert Quote

AUTHORITY (establishes credibility, grounds concepts in evidence)
  Research Insight, Statistics, Brain Science, Why This Happens, Myth vs Reality

EXPLANATION (builds understanding, delivers the concept clearly)
  Common Mistakes, Common Traps, Practical Technique, FAQ

ACTION (drives application and behavior change)
  Exercise, Checklist, Templates, Action Plan, One Small Step, Self-Assessment, 7-Day Challenge

REINFORCEMENT (cements learning, sustains momentum)
  Key Takeaways, Reflection Questions, Resources, Pro Tips

====================================================

BALANCED RECIPE (target for every subsection)

Select 3–4 components. Build a balanced recipe:
  0–1 from ENGAGEMENT
  0–1 from AUTHORITY
  1–2 from EXPLANATION or ACTION
  0–1 from REINFORCEMENT

Not every subsection needs every category.
Single-purpose subsections (skill drill, quick action) may use 2–3 ACTION components.
Conceptual subsections (explaining why) may use 2 AUTHORITY + 1 REINFORCEMENT.

====================================================

NATURAL COMPONENT PAIRINGS (prefer these)

Story + Common Mistakes           — narrative with grounded lesson
Research Insight + Statistics     — evidence layered with scale
Practical Technique + Exercise    — method made actionable
Checklist + Action Plan           — sequence plus commitment
Reflection Questions + Exercise   — introspection into practice
Case Study + Key Takeaways        — proof distilled into lessons
FAQ + Resources                   — doubts resolved with deeper paths
Templates + Self-Assessment       — tool plus progress check
One Small Step + Action Plan      — momentum into full commitment
Myth vs Reality + Brain Science   — reframe grounded in science
Brain Science + Why This Happens  — mechanism explained at depth

====================================================

NICHE-AWARE COMPONENT PREFERENCES

Business:       Case Study, Practical Technique, Checklist, Action Plan, Templates
Health:         Research Insight, Brain Science, Exercise, Reflection Questions, Statistics
Finance:        Statistics, Templates, Common Traps, Action Plan, Self-Assessment
Psychology:     Research Insight, Exercise, Reflection Questions, Case Study, Brain Science
History:        Story, Expert Quote, Common Mistakes, Research Insight, Why This Happens
Self-Help:      Story, Real-Life Example, Exercise, Reflection Questions, Action Plan
Technology:     Practical Technique, Checklist, Common Mistakes, Templates, FAQ

====================================================

DIFFICULTY ADAPTATION

Beginner subsections (Phase 1–2):
  Prefer: Story, Real-Life Example, Success Story, Why This Happens, One Small Step, Key Takeaways
  Reduce: Research Insight, Statistics, Pro Tips, Templates, Self-Assessment

Intermediate subsections (Phase 3):
  Prefer: Practical Technique, Checklist, Action Plan, Case Study, Reflection Questions

Advanced subsections (Phase 4–5):
  Prefer: Research Insight, Brain Science, Pro Tips, Templates, Self-Assessment, Common Traps
  Reduce: Story, FAQ, One Small Step

====================================================

READER'S CURRENT LEARNING STAGE

Chapter ${chNum} of ${chTotal} → Phase ${learningPhase} — ${phaseName}
Stage Goal: ${phaseGoal}

PREFERRED for this phase — prioritize these:
${phasePreferred.map((c: string) => `✅ ${c}`).join("\n")}

OCCASIONAL — use only when the subsection purpose clearly warrants it:
${phaseOccasional.map((c: string) => `⚪ ${c}`).join("\n")}

AVOID at this stage — reader is not ready for these:
${phaseAvoid.length ? phaseAvoid.map((c: string) => `❌ ${c}`).join("\n") : "(none — all components are available at this stage)"}

====================================================

ANTI-REPETITION RULES

Across all subsections in this section, track what has already been selected.
Avoid using the same component more than twice in one section.
Vary which categories you draw from subsection to subsection.

❌ Repetitive: Story + Research + Checklist | Story + Research + Checklist | Story + Research + Checklist
✅ Varied:     Story + Why This Happens + Key Takeaways
               Research Insight + Action Plan + Reflection Questions
               Case Study + Templates + Common Mistakes

====================================================

COMPONENT VALIDATION (self-check before finalizing)

For every component selected, confirm:
1. Does it support this specific subsection's single core idea?
2. Does it support the parent section's teaching mission?
3. Does it serve a different learning function than the other selected components?
4. Is it appropriate for Phase ${learningPhase} (${phaseName})?
5. Has this exact combination already been used in an earlier subsection of this section?
6. Would a premium educational book teach this concept this way?

If any answer is NO — replace that component before returning the result.

====================================================

COMPONENT SELECTION RULES (NON-NEGOTIABLE)

1. Choose 3 OR 4 components for EACH subsection, independently.
   Default to 3. Only use 4 when the subsection is dense or multi-faceted and a 4th component adds genuinely different learning value.
   Vary the count across subsections — do not apply the same count to every subsection.

2. Select based on: this specific subsection's title, its single core idea, the parent section, the parent chapter, and the reader's current learning phase.

3. Build a balanced recipe — never pick 3 components from the same category.

4. AVOID components must NOT be used at Phase ${learningPhase}. The reader is not ready for them.

5. Each component must serve a DIFFERENT learning purpose:
   ❌ WEAK: Research Insight + Case Study + Real-Life Example (all explain/prove)
   ❌ WEAK: Action Plan + Checklist + Exercise (all action)
   ❌ WEAK: Key Takeaways + Reflection Questions + FAQ (all passive)
   ✅ STRONG: Research Insight + Reflection Questions + Key Takeaways
   ✅ STRONG: Action Plan + Common Mistakes + Reflection Questions
   ✅ STRONG: Case Study + Exercise + Key Takeaways
   ✅ STRONG: Myth vs Reality + Brain Science + Action Plan
   ✅ STRONG: Templates + Exercise + Self-Assessment
   ✅ STRONG: One Small Step + Action Plan + Common Mistakes

6. Vary combinations across subsections — no two subsections should share the exact same component set.

7. Never use fewer than 3 or more than 4 components per subsection.

====================================================

OUTPUT FORMAT

Output ONLY valid JSON — no explanations, no markdown, no code fences, no comments.

{"subsections":[{"subsectionTitle":"Subsection title — precise, specific, no colons","subsectionPurpose":"1 sentence: what insight or action this subsection delivers","singleCoreIdea":"The one concept this subsection teaches, stated in plain language","expectedReaderInsight":"What the reader will think or understand immediately after reading this","teachingGoal":"The single pedagogical purpose of this subsection","blueprintComponents":["Research Insight","Key Takeaways","Reflection Questions"]},{"subsectionTitle":"Another subsection title","subsectionPurpose":"1 sentence","singleCoreIdea":"...","expectedReaderInsight":"...","teachingGoal":"...","blueprintComponents":["Action Plan","Common Mistakes","Reflection Questions","Case Study"]}]}`;
}

// ─── Generate Field-Level Suggestion ──────────────────────────────────────────

export function generateFieldSuggestionPrompt(fieldName: string, project: any): string {
  const r     = project?.research               || {};
  const intel = project?.analysis?.intelligence || {};
  const pb    = project?.proposedBook?.content  || {};
  const bd    = project?.bookDetails            || {};
  const bt    = project?.bookTitle              || {};
  const ap    = project?.authorPersona          || {};
  const saved = Array.isArray(ap.savedPersonas) ? ap.savedPersonas : [];
  const pid   = ap.selectedId;
  const persona = pid ? saved.find((p: any) => p.id === pid) || saved[0] : saved[0];

  const titleVal =
    bt?.selectedCard?.title?.trim() || pb.title?.trim() || r.bookTitle?.trim() || "(not set)";

  const personaBrief = persona
    ? [persona.generated?.summary].filter(Boolean).join(" ").slice(0, 200)
    : "(not set)";

  const ctx = `BOOK: "${titleVal}"
GENRE: ${bd.genre || r.mainNicheLabel || "(not set)"}
STRUCTURE: ${bd.structure || "(not set)"}
TONE: ${bd.tone || (Array.isArray(r.authorTones) ? r.authorTones[0] : "(not set)")}
AUDIENCE: ${bd.audience || r.targetAudience || "(not set)"}
BOOK TOPIC: ${r.bookTopic || pb.bookTopic || "(not set)"}
AUTHOR STANCE: ${r.stanceOnTopic || "(not set)"}
STANDOUT ANGLE: ${r.standout || "(not set)"}
MARKET GAP: ${intel.marketGapAnalysis || "(not set)"}
READER PAIN PROFILE: ${intel.readerPainProfile || "(not set)"}
TRANSFORMATION PROMISE: ${intel.transformationPromise || "(not set)"}
AUTHOR PERSONA: ${personaBrief}

EXISTING DETAILS (use for cross-field consistency):
- Positioning Statement: ${bd.positioningStatement || "(not set)"}
- Core Promise: ${bd.corePromise || "(not set)"}
- Core Thesis: ${bd.coreThesis || "(not set)"}
- Unique Mechanism: ${bd.uniqueMechanism || "(not set)"}
- Desired Emotional Outcome: ${bd.desiredEmotionalOutcome || "(not set)"}
- USP: ${bd.uniqueSellingProposition || "(not set)"}`;

  const header = `You are an elite nonfiction publishing strategist.
Generate field-level suggestions ONLY for the field specified below.
Return ONLY valid JSON — no prose, no markdown, no code fences.
Every suggestion must be SPECIFIC to this book — absolutely no generic boilerplate.

${ctx}

FIELD TO GENERATE: ${fieldName.toUpperCase()}

`;

  switch (fieldName) {
    case "positioningStatement":
      return header + `Generate 4 Positioning Statement alternatives using the exact template: "This book helps [audience] achieve [outcome] without [obstacle]."
- Index 0 is the single best-fit RECOMMENDED option
- Indices 1–3 are alternatives with different outcomes, obstacles, or audience framings
- Every item must be a complete sentence following the template

Return ONLY:
{ "recommendations": ["<rec0>", "<rec1>", "<rec2>", "<rec3>"] }`;

    case "corePromise":
      return header + `Generate 4 Core Promise alternatives — the specific, measurable outcome readers will achieve after finishing this book.
- Index 0 is the RECOMMENDED option (clearest, most compelling)
- Indices 1–3 are alternatives with different framings or specificity levels
- 1–2 sentences each, concrete and results-focused

Return ONLY:
{ "recommendations": ["<rec0>", "<rec1>", "<rec2>", "<rec3>"] }`;

    case "coreThesis":
      return header + `Generate 4 Core Thesis alternatives — the central argument or conviction that anchors this book.
- Index 0 is the RECOMMENDED option (strongest, most specific argument)
- Indices 1–3 use different angles: one contrarian, one research-backed, one paradigm-shift
- 1–2 sentences each, arguable and specific

Return ONLY:
{ "recommendations": ["<rec0>", "<rec1>", "<rec2>", "<rec3>"] }`;

    case "uniqueMechanism":
      return header + `Generate 4 Unique Mechanism alternatives — proprietary frameworks with memorable, publishable names.
- Index 0 is the RECOMMENDED framework (most marketable name + clearest description)
- Indices 1–3 are alternatives with different conceptual angles
- Each must have a distinct, marketable framework name and a 2–3 sentence description

Return ONLY:
{ "recommendations": [
    { "name": "<Framework Name 1>", "description": "<2-3 sentences>" },
    { "name": "<Framework Name 2>", "description": "<2-3 sentences>" },
    { "name": "<Framework Name 3>", "description": "<2-3 sentences>" },
    { "name": "<Framework Name 4>", "description": "<2-3 sentences>" }
  ]
}`;

    case "readerTransformation":
      return header + `Generate 3 Reader Transformation sets — concrete before/after states the reader experiences.
- Each set has 5–8 before-reading struggles AND 5–8 after-reading outcomes
- Each set is a single string with one state per line (use \\n)
- Index 0 is the RECOMMENDED transformation arc; indices 1–2 are alternative angles

Return ONLY:
{
  "beforeSuggestions": [
    "<set0: struggle1\\nstruggle2\\nstruggle3\\nstruggle4\\nstruggle5>",
    "<set1: struggle1\\nstruggle2\\nstruggle3\\nstruggle4\\nstruggle5>",
    "<set2: struggle1\\nstruggle2\\nstruggle3\\nstruggle4\\nstruggle5>"
  ],
  "afterSuggestions": [
    "<set0: outcome1\\noutcome2\\noutcome3\\noutcome4\\noutcome5>",
    "<set1: outcome1\\noutcome2\\noutcome3\\noutcome4\\noutcome5>",
    "<set2: outcome1\\noutcome2\\noutcome3\\noutcome4\\noutcome5>"
  ]
}`;

    case "readerObjections":
      return header + `Generate 3 Reader Objection sets — realistic beliefs that may prevent readers from accepting this book's message.
- Set 0 (RECOMMENDED): practical/logistical barriers
- Set 1: emotional/mindset resistance angle
- Set 2: past-failure skepticism angle
- Each set: 5–8 objections as a single string, one objection per line (use \\n)

Return ONLY:
{ "recommendations": [
    "<set0: obj1\\nobj2\\nobj3\\nobj4\\nobj5>",
    "<set1: obj1\\nobj2\\nobj3\\nobj4\\nobj5>",
    "<set2: obj1\\nobj2\\nobj3\\nobj4\\nobj5>"
  ]
}`;

    case "desiredEmotionalOutcome":
      return header + `Generate 4 Desired Emotional Outcome alternatives — how readers will feel after finishing this book.
- Index 0 is the RECOMMENDED option (most resonant for this audience)
- Indices 1–3 are alternatives with different emotional registers
- Each: 3–6 evocative words or a short phrase (e.g. "Empowered, clear, and unstoppable")

Return ONLY:
{ "recommendations": ["<rec0>", "<rec1>", "<rec2>", "<rec3>"] }`;

    default:
      return header + `Generate 4 alternatives for the "${fieldName}" field.
Return ONLY:
{ "recommendations": ["<rec0>", "<rec1>", "<rec2>", "<rec3>"] }`;
  }
}

// ─── Chapter Architecture (Blueprint export) ───────────────────────────────

export function chapterArchitecturePrompt(project: any): string {
  const bd    = project?.bookDetails   || {};
  const r     = project?.research      || {};
  const intel = project?.analysis?.intelligence || {};
  const pb    = project?.proposedBook?.content || {};
  const bt    = project?.bookTitle     || {};
  const ap    = project?.authorPersona || {};

  const saved   = Array.isArray(ap.savedPersonas) ? ap.savedPersonas : [];
  const pid     = ap.selectedId;
  const persona = pid ? saved.find((p: any) => p.id === pid) || saved[0] : saved[0];

  const titleVal     = bt?.selectedCard?.title?.trim() || pb.title?.trim() || r.bookTitle?.trim() || bd.title?.trim() || "(not set)";
  const chapterCount = bd.chapterCount || 10;
  const structure    = bd.structure || "How-to";

  const personaBlock = persona
    ? [
        persona.generated?.summary,
        persona.generated?.voice?.tone     && `Voice tone: ${persona.generated.voice.tone}`,
        persona.generated?.style?.pacing   && `Pacing: ${persona.generated.style.pacing}`,
      ].filter(Boolean).join("\n")
    : "(not set)";

  const competitorBlock = (() => {
    const books = project?.analysis?.books;
    if (!Array.isArray(books) || !books.length) return "(none)";
    return books.slice(0, 4).map((b: any) => `• "${b.title}" by ${b.author || "unknown"}`).join("\n");
  })();

  return `You are an elite nonfiction developmental editor and book architect.

Generate a complete, professional chapter architecture for this book.
Return ONLY valid JSON — no prose, no markdown, no code fences.

═══════════════════════════
BOOK DATA
═══════════════════════════

TITLE: ${titleVal}
SUBTITLE: ${bd.subtitle?.trim() || "(none)"}
GENRE: ${bd.genre || "(not set)"}
STRUCTURE: ${structure}
TONE: ${bd.tone || "(not set)"}
AUDIENCE: ${bd.audience || "(not set)"}
CHAPTER COUNT: ${chapterCount} (generate EXACTLY this many chapters)
WORD COUNT RANGE: ${bd.wordCountRange || "(not set)"}
RESEARCH INTENSITY: ${bd.researchIntensity || "(not set)"}

NICHE: ${r.mainNicheLabel || "(not set)"}
BOOK TOPIC: ${r.bookTopic || pb.bookTopic || "(not set)"}
AUTHOR STANCE: ${r.stanceOnTopic || "(not set)"}
STANDOUT ANGLE: ${r.standout || "(not set)"}

STRATEGIC FOUNDATION:
Positioning Statement: ${bd.positioningStatement || "(not set)"}
Core Promise: ${bd.corePromise || "(not set)"}
Core Thesis: ${bd.coreThesis || "(not set)"}
Unique Mechanism: ${bd.uniqueMechanism || "(not set)"}
Unique Selling Proposition: ${bd.uniqueSellingProposition || "(not set)"}
Desired Emotional Outcome: ${bd.desiredEmotionalOutcome || "(not set)"}

READER TRANSFORMATION:
Before: ${bd.readerTransformationBefore || "(not set)"}
After: ${bd.readerTransformationAfter || "(not set)"}

READER PAIN POINTS: ${bd.readerPainPoints || intel.readerPainProfile || "(not set)"}
READER OBJECTIONS: ${bd.readerObjections || "(not set)"}
FOCUS TOPICS: ${bd.focusTopics || "(not set)"}

AUTHOR PERSONA:
${personaBlock}

COMPETITOR BOOKS:
${competitorBlock}

${(() => {
  const missions = bd.chapterMissions;
  if (!Array.isArray(missions) || !missions.length) return "";
  const lines = missions.slice(0, 15).map((m: any) =>
    `Ch ${m.chapterNumber}: ${m.chapterTopic || ""} — Purpose: ${m.purpose || ""} | Action: ${m.expectedReaderAction || ""}`
  ).join("\n");
  return `BLUEPRINT CHAPTER MISSIONS (use these as the strategic guide for each chapter's title and sections):
${lines}`;
})()}

${(() => {
  const layers = bd.blueprintLayers;
  if (!layers || typeof layers !== "object") return "";
  const bi = layers.bookIdentity || {};
  const bs = layers.bookStrategy || {};
  const parts: string[] = [];
  if (bi.teachingStyle)   parts.push(`Teaching Style: ${bi.teachingStyle}`);
  if (bi.evidenceStyle)   parts.push(`Evidence Style: ${bi.evidenceStyle}`);
  if (bi.bookPersonality) parts.push(`Book Personality: ${bi.bookPersonality}`);
  if (bs.coreFramework)   parts.push(`Core Framework: ${bs.coreFramework}`);
  if (bs.learningProgression) parts.push(`Learning Progression: ${bs.learningProgression}`);
  if (bs.keyVocabulary?.length) parts.push(`Key Vocabulary: ${(bs.keyVocabulary as string[]).join(", ")}`);
  if (!parts.length) return "";
  return `BLUEPRINT INTELLIGENCE (inherited — all chapters must reinforce these):
${parts.join("\n")}`;
})()}

═══════════════════════════
STRUCTURE RULE
═══════════════════════════

THE ARCHITECTURE MUST STRICTLY FOLLOW THE SELECTED STRUCTURE: ${structure}

Structure implementation guidelines:
- How-to: Sequential skill-building — each chapter teaches one concrete capability
- Problem-solution: Ch1=Problem, Ch2=Root Cause, middle=Solutions, end=Results
- Thematic: Organize around major themes from the focus topics
- Transformation-based / Chronological: Reader evolution arc — current state → mastery
- Framework-driven / Modular: Each chapter covers one stage or module of the unique mechanism
- List-based / Comparative: Parallel structure, each chapter a distinct item or comparison
- Workbook: Alternating concept + exercise chapters, practical and action-oriented
- Narrative: Story arc structure — setup, conflict, rising action, climax, resolution

═══════════════════════════
CHAPTER QUALITY RULES
═══════════════════════════

Chapter titles MUST:
- Sound professionally published and commercially viable
- Create curiosity and anticipation
- Be specific to THIS book's topic and audience
- Avoid generic textbook wording ("Introduction to X", "Understanding Y")
- Reflect the book's unique mechanism and voice
- Build logical momentum from chapter to chapter

BAD title: "Chapter 1: Introduction to Productivity"
GOOD title: "Why Everything You Know About Getting Things Done Is Making You Worse"

Section titles MUST:
- Directly expand the chapter concept
- Progress logically (each section builds on the previous)
- Be specific, actionable, and intriguing
- NOT repeat or paraphrase the chapter title
- Prepare the reader for what comes next

═══════════════════════════
OUTPUT FORMAT
═══════════════════════════

Return exactly this JSON structure — EXACTLY ${chapterCount} chapters, EXACTLY 5 sections per chapter:

{
  "chapters": [
    {
      "number": 1,
      "title": "Full chapter title without any 'Chapter N:' prefix",
      "sections": [
        "Section 1 title",
        "Section 2 title",
        "Section 3 title",
        "Section 4 title",
        "Section 5 title"
      ]
    }
  ]
}`;
}

// ─── Generate Focus Areas ─────────────────────────────────────────────────────

export function generateFocusAreasPrompt(project: any): string {
  const research = project?.research  || {};
  const intel    = project?.analysis?.intelligence || {};
  const pb       = project?.proposedBook?.content  || {};
  const bd       = project?.bookDetails || {};
  const books    = project?.analysis?.books || [];

  const title     = bd.title     || research.bookTitle    || project?.bookTitle?.selectedCard?.title    || "";
  const subtitle  = bd.subtitle  || research.bookSubtitle || project?.bookTitle?.selectedCard?.subtitle || "";
  const topic     = research.bookTopic || "";
  const niche     = [research.mainNicheLabel, research.subNicheLabel, research.deepNicheLabel].filter(Boolean).join(" › ");
  const genre     = bd.genre     || research.mainNicheLabel || "";
  const audience  = bd.audience  || pb.proposedAudience   || intel.targetAudience || "";
  const tone      = bd.tone      || pb.proposedTone        || intel.energyStyle    || "";
  const structure = bd.structure || "";

  const painProfile    = intel.readerPainProfile     || "";
  const transformation = intel.transformationPromise || pb.proposedTransformation || "";
  const marketGap      = intel.marketGapAnalysis     || "";
  const corePromise    = bd.corePromise              || "";
  const uniqueMechanism = bd.uniqueMechanism         || "";
  const beforeState    = bd.readerTransformationBefore || "";
  const afterState     = bd.readerTransformationAfter  || "";

  const topBooks = books.slice(0, 4).map((b: any) => b?.title || b?.name || "").filter(Boolean);

  return `You are a nonfiction book strategist. Your task is to suggest exactly 10 specific, actionable FOCUS AREAS for a book — these are thematic pillars that will guide the book's strategy, chapter structure, and drafting voice.

Focus areas are short phrases (3–7 words each) that capture what the book will emphasize. They are NOT chapter titles — they are strategic lenses that cut across the whole book.

Good examples: "Step-by-step practical frameworks", "Beginner-friendly language", "Real case studies from practitioners", "Emotional mindset shifts", "Actionable checklists per chapter", "Busy professional time constraints".

━━━ BOOK DATA ━━━
${title       ? `Title: ${title}` : ""}
${subtitle    ? `Subtitle: ${subtitle}` : ""}
${topic       ? `Topic: ${topic}` : ""}
${niche       ? `Niche: ${niche}` : ""}
${genre       ? `Genre: ${genre}` : ""}
${audience    ? `Target audience: ${audience}` : ""}
${tone        ? `Tone / voice: ${tone}` : ""}
${structure   ? `Book structure: ${structure}` : ""}
${corePromise ? `Core promise: ${corePromise}` : ""}
${uniqueMechanism ? `Unique mechanism: ${uniqueMechanism}` : ""}
${beforeState ? `Reader before: ${beforeState}` : ""}
${afterState  ? `Reader after: ${afterState}` : ""}
${painProfile    ? `Reader pain profile: ${painProfile}` : ""}
${transformation ? `Transformation promise: ${transformation}` : ""}
${marketGap      ? `Market gap: ${marketGap}` : ""}
${topBooks.length ? `Top competing books: ${topBooks.join(", ")}` : ""}

━━━ TASK ━━━
Generate exactly 10 focus area phrases that are:
1. Specific to THIS book's niche, audience, and genre — not generic
2. Diverse — covering different dimensions (content style, reader experience, structural approach, emotional angle, practical depth, etc.)
3. Short and punchy (3–7 words each)
4. Actionable — each one meaningfully guides what goes INTO the book

Return ONLY this JSON — no explanation:

{
  "focusAreas": [
    "Focus area one",
    "Focus area two",
    "Focus area three",
    "Focus area four",
    "Focus area five",
    "Focus area six",
    "Focus area seven",
    "Focus area eight",
    "Focus area nine",
    "Focus area ten"
  ]
}`;
}

// ─── Back Matter: Key Lessons (structured JSON) ──────────────────────────────

export function backMatterKeyLessonsPrompt(opts: {
  bookContext: string;
  chapterSummaries: Array<{ chapter: string; keyIdeas: string[] }>;
  manuscriptContent: Array<{ chapter: string; content: string }>;
  tone: string;
  audience: string;
}): string {
  const { bookContext, chapterSummaries, manuscriptContent, tone, audience } = opts;

  const manuscriptBlock = manuscriptContent.length
    ? `\n\n════════════════════════════════════\nMANUSCRIPT CONTENT (read carefully — derive all lessons from this)\n════════════════════════════════════\n${
        manuscriptContent.map(c => `[CHAPTER: ${c.chapter}]\n${c.content}`).join("\n\n---\n\n")
      }`
    : chapterSummaries.length
      ? `\n\nCHAPTER KEY IDEAS:\n${chapterSummaries.map(s => `${s.chapter}: ${s.keyIdeas.join("; ")}`).join("\n")}`
      : "";

  return `You are a professional nonfiction editor creating the Key Lessons section of THIS specific book.

BOOK CONTEXT:
${bookContext}
Tone: ${tone || "Direct & practical"}
Audience: ${audience || "general reader"}${manuscriptBlock}

════════════════════════════════════
YOUR TASK
════════════════════════════════════
Read the manuscript content above carefully. Identify between 5 and 10 Key Lessons (never fewer than 5, never more than 10) that summarize what THIS book actually teaches.

WHAT A KEY LESSON IS:
- A concept, framework, argument, method, theory, historical event, system, discovery, or technique that appears in the manuscript above
- Something the reader learned by reading this specific book
- A lesson that references ideas from specific chapters listed above

WHAT A KEY LESSON IS NOT:
- Generic writing advice ("Use clear language", "Organize your writing")
- Generic publishing advice ("Market your book", "SEO matters")
- Any advice about: Amazon, KDP, readability, bestseller patterns, commercial viability, marketing, formatting, writing style, content quality, emotional intelligence in writing
- A lesson that could appear in any book regardless of topic
- Anything not traceable to the manuscript content above

STRICT RULE: Every lesson MUST be derivable from a specific chapter in the manuscript above. If you cannot cite which chapter it came from, do not include it.

FORMAT RULES:
- title: 3–7 words naming the specific concept from the book (NOT a generic principle)
- principle: One sentence explaining what the reader learned about this topic (under 30 words)
- explanation: 2–3 sentences connecting this lesson to specific content from the manuscript — mention where it appeared and why it matters for THIS book's subject
- relatedChapters: exact chapter titles from the manuscript above where this concept appears

Return ONLY valid JSON (no markdown fences, no explanation text):

{
  "lessons": [
    {
      "title": "3-7 word title naming the specific concept",
      "principle": "One sentence — what the reader learned about this topic from reading this book",
      "explanation": "2-3 sentences referencing specific manuscript content — where this appeared and why it matters for this book's subject",
      "relatedChapters": ["Exact chapter title from the manuscript above"]
    }
  ]
}`;
}

// ─── Back Matter: References (structured JSON) ───────────────────────────────

export function backMatterReferencesPrompt(opts: {
  bookContext: string;
  manuscriptContent: Array<{ chapter: string; content: string }>;
  tone: string;
  audience: string;
}): string {
  const { bookContext, manuscriptContent, tone, audience } = opts;

  const manuscriptBlock = manuscriptContent.length
    ? `\n\n════════════════════════════════════\nMANUSCRIPT CONTENT (scan this for every citable source)\n════════════════════════════════════\n${
        manuscriptContent.map(c => `[CHAPTER: ${c.chapter}]\n${c.content}`).join("\n\n---\n\n")
      }`
    : "";

  return `You are a professional nonfiction editor and researcher compiling the References section for THIS specific book.

BOOK CONTEXT:
${bookContext}
Tone: ${tone || "Direct & practical"}
Audience: ${audience || "general reader"}${manuscriptBlock}

════════════════════════════════════
YOUR TASK
════════════════════════════════════
Carefully scan the entire manuscript above for every book, study, article, framework, statistic, standard, tool, or authority it cites, quotes, paraphrases, or clearly relies on. Compile a References list of AT LEAST 15 distinct, real, verifiable sources that a reader could plausibly look up — do not invent fictitious sources, but you may supply the well-known, real-world source that a mentioned concept, study, or framework is known to come from (e.g. if the manuscript discusses "the Eisenhower Matrix", cite its real-world origin).

Assign EVERY reference to exactly ONE of these six groups, based on what kind of source it is:
- "Books" — full-length published books
- "Articles" — magazine, newspaper, or blog articles
- "Research Papers" — academic papers, peer-reviewed studies, journal articles
- "Standards" — official standards, regulations, certifications, ISO/industry standards
- "Official Documentation" — government, institutional, or organizational official documentation/reports
- "Websites" — general websites, tools, or online resources not covered above

RULES:
- Use the exact group names above, verbatim, as the "group" field.
- Distribute references realistically across groups based on what the manuscript actually draws on — do not force every group to be non-empty if the book's content doesn't warrant it.
- Prioritize sources that are directly tied to specific claims, statistics, frameworks, or quotes found in the manuscript above.
- author: the real author, organization, or publisher of the source
- title: the real title of the book/article/paper/standard/site
- publication: journal name, publisher, or hosting organization, if applicable (empty string if not applicable)
- year: best-known real publication year, or empty string if unknown
- url: a real, plausible URL only if you are confident it is accurate; otherwise empty string
- notes: one short clause on why this book cites/relies on this source (optional, empty string if none)

CRITICAL: You MUST return at least 15 references total across all groups combined.

Return ONLY valid JSON (no markdown fences, no explanation text):

{
  "references": [
    {
      "group": "Books",
      "author": "Author Name",
      "title": "Source Title",
      "publication": "Publisher or Journal (if applicable)",
      "year": "Year",
      "url": "",
      "notes": "Why this book relies on/cites this source"
    }
  ]
}`;
}

// ─── Back Matter: Glossary (structured JSON) ─────────────────────────────────

export function backMatterGlossaryPrompt(opts: {
  bookContext: string;
  chapterSummaries: Array<{ chapter: string; keyIdeas: string[] }>;
  manuscriptContent: Array<{ chapter: string; content: string }>;
  tone: string;
  audience: string;
}): string {
  const { bookContext, chapterSummaries, manuscriptContent, tone, audience } = opts;

  const manuscriptBlock = manuscriptContent.length
    ? `\n\n════════════════════════════════════\nMANUSCRIPT CONTENT (scan this for terms — define ONLY what appears here)\n════════════════════════════════════\n${
        manuscriptContent.map(c => `[CHAPTER: ${c.chapter}]\n${c.content}`).join("\n\n---\n\n")
      }`
    : chapterSummaries.length
      ? `\n\nCHAPTER KEY IDEAS:\n${chapterSummaries.map(s => `${s.chapter}: ${s.keyIdeas.join("; ")}`).join("\n")}`
      : "";

  return `You are a professional nonfiction editor creating the Glossary for THIS specific book.

BOOK CONTEXT:
${bookContext}
Tone: ${tone || "Direct & practical"}
Audience: ${audience || "general reader"}${manuscriptBlock}

════════════════════════════════════
YOUR TASK
════════════════════════════════════
Scan the manuscript content above. Identify 15–25 terms that a reader of THIS book needs defined.

WHAT TO INCLUDE — terms that actually appear in the chapters above:
- People (historical figures, theorists, practitioners mentioned in the manuscript)
- Places (locations, regions, countries relevant to the book's content)
- Events (historical events, movements, periods discussed in the chapters)
- Terminology (specialist terms, jargon, technical vocabulary used in the manuscript)
- Theories and frameworks (named models, approaches, philosophies from the book)
- Technologies (tools, systems, methods described in the chapters)
- Organizations (institutions, groups, movements mentioned in the manuscript)
- Historical periods (eras, epochs, time periods discussed)
- Important concepts (key ideas, themes central to this book's subject matter)

WHAT TO NEVER INCLUDE — these are forbidden unless the entire book is literally about these topics:
- Readability, Readability Drives Engagement
- Bestseller Patterns, Commercial Viability, Marketability
- Writing Style, Content Quality Rules, Content Quality
- Emotional Intelligence in Writing
- Formatting, KDP, Amazon, SEO, Marketing
- Generic self-help terms not found in the chapters above
- Any term invented by you that does not appear in the manuscript above

STRICT RULE: Every term MUST be found in the manuscript content above. If you cannot point to which chapter introduced it, do not include it.

FORMAT RULES:
- term: the exact term as it appears in the manuscript
- definition: 1–3 sentences defining it within the context of how THIS book uses it
- firstChapter: exact title of the chapter where the term first appears above
- relatedChapters: other chapters where the term is used
- synonyms: only genuine alternative names for this term; empty array if none

Return ONLY valid JSON (no markdown fences, no explanation text):

{
  "terms": [
    {
      "term": "Term as it appears in the manuscript",
      "definition": "1-3 sentences defining this term within the context of this book's subject matter",
      "firstChapter": "Exact chapter title from the manuscript above where this first appears",
      "relatedChapters": ["Additional chapter title from the manuscript above"],
      "synonyms": ["alternative name for this term if any"]
    }
  ]
}`;
}

export function backMatterGlossaryTermPrompt(opts: {
  bookContext: string;
  manuscriptContent: Array<{ chapter: string; content: string }>;
  tone: string;
  audience: string;
  existingTerms: string[];
  termHint: string;
}): string {
  const { bookContext, manuscriptContent, tone, audience, existingTerms, termHint } = opts;

  const manuscriptBlock = manuscriptContent.length
    ? `\n\n════════════════════════════════════\nMANUSCRIPT CONTENT (scan this for terms — define ONLY what appears here)\n════════════════════════════════════\n${
        manuscriptContent.map(c => `[CHAPTER: ${c.chapter}]\n${c.content}`).join("\n\n---\n\n")
      }`
    : "";
  const existingBlock = existingTerms.length
    ? `\n\nTERMS ALREADY IN THE GLOSSARY (do NOT repeat any of these):\n${existingTerms.join(", ")}`
    : "";
  const hintBlock = termHint.trim()
    ? `\n\nThe author wants this specific term defined: "${termHint.trim()}". Use the manuscript above to understand how this book uses it.`
    : `\n\nPick ONE additional term not already in the glossary that a reader of this book needs defined.`;

  return `You are a professional nonfiction editor adding ONE new entry to the Glossary of THIS specific book.

BOOK CONTEXT:
${bookContext}
Tone: ${tone || "Direct & practical"}
Audience: ${audience || "general reader"}${manuscriptBlock}${existingBlock}${hintBlock}

════════════════════════════════════
YOUR TASK
════════════════════════════════════
Produce exactly ONE glossary entry, found in (or clearly implied by) the manuscript content above.

WHAT TO NEVER INCLUDE — forbidden unless the entire book is literally about these topics:
- Readability, Bestseller Patterns, Commercial Viability, Marketability
- Writing Style, Content Quality Rules, Formatting, KDP, Amazon, SEO, Marketing
- Generic self-help terms not found in the chapters above
- Any of the terms already listed above as existing

FORMAT RULES:
- term: the exact term as it appears in (or fits naturally into) the manuscript
- definition: 1–3 sentences defining it within the context of how THIS book uses it
- firstChapter: exact chapter title from the manuscript above where it first appears (best guess if using a hint not directly quoted)
- relatedChapters: other chapters where the term is used, if any
- synonyms: genuine alternative names for this term; empty array if none

CRITICAL OUTPUT FORMAT:
- Your entire response must be a single JSON object and nothing else — no text before or after it, no markdown code fences, no commentary.

Return ONLY this JSON object, with no other text:

{
  "term": "Term as it appears in the manuscript",
  "definition": "1-3 sentences defining this term within the context of this book's subject matter",
  "firstChapter": "Exact chapter title from the manuscript above where this first appears",
  "relatedChapters": ["Additional chapter title from the manuscript above"],
  "synonyms": ["alternative name for this term if any"]
}`;
}

// ─── Back Matter: Further Reading (structured JSON) ──────────────────────────

// ─── Back Matter: The End (structured JSON) ──────────────────────────────────

export function backMatterTheEndPrompt(opts: {
  bookContext: string;
  manuscriptContent: Array<{ chapter: string; content: string }>;
  tone: string;
  audience: string;
}): string {
  const { bookContext, manuscriptContent, tone, audience } = opts;
  const manuscriptBlock = manuscriptContent.length
    ? `\n\n════════════════════════════════════\nMANUSCRIPT CONTENT (use this to personalise the closing)\n════════════════════════════════════\n${
        manuscriptContent.map(c => `[CHAPTER: ${c.chapter}]\n${c.content}`).join("\n\n---\n\n")
      }`
    : "";
  return `You are a professional nonfiction author writing the final "The End" closing page of this specific book.

BOOK CONTEXT:
${bookContext}
Tone: ${tone || "Direct & practical"}
Audience: ${audience || "general reader"}${manuscriptBlock}

════════════════════════════════════
YOUR TASK
════════════════════════════════════
Generate two things for the closing page of this book:

1. THANK-YOU MESSAGE — A warm, personal 2–4 sentence message thanking the reader for completing the book. It must:
   - Express sincere gratitude
   - Reference this book's specific subject matter and the transformation the reader experienced
   - Feel personal, not generic ("Thank you for reading" alone is not enough)
   - Optionally invite the reader to share the book, leave a review, or apply what they've learned
   - Tone: warm, celebratory, genuine — match the book's established voice
   - Length: 40–80 words maximum

2. CLOSING QUOTE — A single memorable, inspiring sentence or short quote that:
   - Captures the core message or spirit of THIS book
   - Could be an original author's thought, or a well-known relevant quote attributed to its author
   - Feels like the perfect final word for a reader who just finished THIS book
   - Length: 10–35 words

RULES:
- Both must be specific to this book's subject — not generic self-help platitudes
- The thank-you message must feel like it was written by the actual author of this book
- The closing quote must resonate with the book's core theme

CRITICAL OUTPUT FORMAT — read carefully:
- Do NOT write a closing chapter, essay, or reflection. Do NOT use markdown headers (##), bullet points, or section titles.
- Your entire response must be a single JSON object and nothing else — no text before or after it, no markdown code fences.
- Keep each field short and within the word limits given above.

Return ONLY this JSON object, with no other text:

{
  "thankYouMessage": "The warm 2-4 sentence thank-you message to the reader (40-80 words)",
  "quote": "The memorable closing quote or original thought (10-35 words)"
}`;
}

export function backMatterAcknowledgmentsGroupPrompt(opts: {
  bookContext: string;
  groupName: string;
  manuscriptContent: Array<{ chapter: string; content: string }>;
  tone: string;
  audience: string;
}): string {
  const { bookContext, groupName, manuscriptContent, tone, audience } = opts;
  const manuscriptBlock = manuscriptContent.length
    ? `\n\n════════════════════════════════════\nMANUSCRIPT CONTENT (use only for tone/context — do not summarize it)\n════════════════════════════════════\n${
        manuscriptContent.map(c => `[CHAPTER: ${c.chapter}]\n${c.content}`).join("\n\n---\n\n")
      }`
    : "";
  return `You are a professional nonfiction author writing ONE paragraph of the Acknowledgments page for this specific book.

BOOK CONTEXT:
${bookContext}
Tone: ${tone || "Direct & practical"}
Audience: ${audience || "general reader"}${manuscriptBlock}

════════════════════════════════════
YOUR TASK
════════════════════════════════════
Write a short, warm, sincere acknowledgments paragraph thanking the group: "${groupName}".

RULES:
- Write ONLY the paragraph for this one group — do not mention or thank any other group
- Keep it plausible and generic enough to fit any author of this book (do not invent specific names unless the group name itself implies a role, e.g. "Editors")
- Sincere, warm tone matching the book's voice — not generic filler
- 2-4 sentences, approximately 40-90 words
- No headers, labels, or the group name itself as a title — just the flowing thank-you text

CRITICAL OUTPUT FORMAT:
- Your entire response must be a single JSON object and nothing else — no text before or after it, no markdown code fences.

Return ONLY this JSON object, with no other text:

{
  "text": "The 2-4 sentence acknowledgments paragraph for this group (40-90 words)"
}`;
}

export function backMatterFurtherReadingPrompt(opts: {
  bookContext: string;
  chapterSummaries: Array<{ chapter: string; keyIdeas: string[] }>;
  tone: string;
  audience: string;
}): string {
  const { bookContext, chapterSummaries, tone, audience } = opts;
  const summaries = chapterSummaries.length
    ? `\n\nCHAPTER KEY IDEAS:\n${chapterSummaries.map(s => `${s.chapter}: ${s.keyIdeas.join("; ")}`).join("\n")}`
    : "";
  return `You are a professional nonfiction editor. Curate a Further Reading list for readers of this completed manuscript.

BOOK CONTEXT:
${bookContext}
Tone: ${tone || "Direct & practical"}
Audience: ${audience || "general reader"}${summaries}

TASK: Recommend 8–12 books or resources that complement this book and guide readers toward continued learning.

Rules:
- Recommend real-sounding books/resources — use realistic titles, authors, publishers (do NOT invent ISBNs, DOIs, or fake URLs)
- Each recommendation must logically extend the reader's knowledge BEYOND this specific book
- type: exactly one of "Book", "Article", "Course", "Website", "Podcast", "Research Paper"
- difficulty: exactly one of "Beginner", "Intermediate", "Advanced"
- url: use empty string "" unless it's a widely known public URL (e.g., a major platform or publication)
- Vary difficulty levels across recommendations to serve different reader needs
- why: explain specifically how this resource extends THIS book's ideas, not a generic "great for learning" statement

Return ONLY valid JSON (no markdown fences, no explanation text):

{
  "recommendations": [
    {
      "title": "Resource title",
      "author": "Author name(s) or organization",
      "type": "Book",
      "description": "1-2 sentences describing what this resource covers",
      "why": "1-2 sentences explaining how it specifically complements this book",
      "difficulty": "Intermediate",
      "url": ""
    }
  ]
}`;
}

// ─── Developmental Editor & Commercial Book Optimizer (Prompt 12) ─────────────

export function developmentalEditPrompt(opts: {
  bookContext?: any;
  manuscriptDigest?: any;
  knowledgeGraph?: any;
}): string {
  const ctx  = opts.bookContext  || {};
  const md   = opts.manuscriptDigest || {};
  const kg   = opts.knowledgeGraph || null;

  const title       = safeStr(ctx.title)       || "Untitled Book";
  const subtitle    = safeStr(ctx.subtitle)    || "";
  const audience    = safeStr(ctx.audience)    || "general readers";
  const promise     = safeStr(ctx.promise)     || "";
  const usp         = safeStr(ctx.usp)         || "";
  const tone        = safeStr(ctx.tone)        || "";
  const genre       = safeStr(ctx.genre)       || "nonfiction";

  // Build compact chapter digest block
  const chapters: any[] = Array.isArray(md.chapters) ? md.chapters : [];
  const chapterBlock = chapters.length > 0 ? `
════════════════════════════════════
MANUSCRIPT DIGEST (${chapters.length} chapters | ${(md.totalWordsWritten || 0).toLocaleString()} words | ${md.completionPercent || 0}% written)
════════════════════════════════════
${chapters.map((ch: any) => {
  const sections: any[] = Array.isArray(ch.sections) ? ch.sections : [];
  const sectionLines = sections.map((sec: any) => {
    const subs: any[] = Array.isArray(sec.subsections) ? sec.subsections : [];
    const subLines = subs.map((sub: any) =>
      `      • ${sub.title || "(untitled)"}${sub.keyTakeaway ? ` — ${sub.keyTakeaway}` : ""}${sub.teachingMethod ? ` [${sub.teachingMethod}]` : ""}${sub.wordCount ? ` (${sub.wordCount}w)` : " (not yet written)"}`
    ).join("\n");
    return `    § ${sec.title || "(untitled)"} (${sec.totalWords || 0}w)\n${subLines}`;
  }).join("\n");
  const missionNote = ch.mission
    ? `\n  Mission: ${ch.mission.purpose || ""} | Goal: ${ch.mission.practicalGoal || ""}`
    : "";
  return `Chapter ${ch.chapterNumber}: ${ch.title || "(untitled)"} (${ch.totalWords || 0}w)${missionNote}\n${sectionLines}`;
}).join("\n\n")}` : "";

  // Build knowledge graph block
  const kgBlock = kg ? `
════════════════════════════════════
KNOWLEDGE GRAPH SUMMARY
════════════════════════════════════
Concepts Taught: ${(kg.totals?.concepts || 0)} | Frameworks: ${(kg.totals?.frameworks || 0)} | Open Reader Questions: ${(kg.totals?.openQuestions || 0)}
${Array.isArray(kg.openQuestions) && kg.openQuestions.length ? `Unanswered Reader Questions:\n${kg.openQuestions.map((q: string) => `  — ${q}`).join("\n")}` : ""}` : "";

  return `You are a world-class Developmental Editor specializing in nonfiction books for Amazon KDP.
Your job is not to ask "Is this subsection well written?" — your job is to ask "Is this the BEST POSSIBLE BOOK for this reader?"

════════════════════════════════════
BOOK DNA
════════════════════════════════════
Title: ${title}${subtitle ? `\nSubtitle: ${subtitle}` : ""}
Genre: ${genre}
Target Reader: ${audience}
Core Promise: ${promise || "(see title)"}
Unique Selling Point: ${usp}
Tone: ${tone}
${chapterBlock}${kgBlock}

════════════════════════════════════
YOUR EDITORIAL TASK
════════════════════════════════════

Review this manuscript from FOUR independent perspectives before merging into recommendations:

PERSPECTIVE 1 — READER
Ask: Would I finish this book? Would I recommend it? Did it deliver the promised transformation? Was every chapter worth my time?

PERSPECTIVE 2 — PUBLISHER
Ask: Is this commercially viable? Does it stand out? Would it generate reviews and word-of-mouth? Does it justify shelf space?

PERSPECTIVE 3 — SUBJECT MATTER EXPERT
Ask: Is the content accurate, current, and credible? Are frameworks properly explained? Is the teaching methodology sound? Are key concepts missing?

PERSPECTIVE 4 — COMMERCIAL REVIEWER
Ask: Does it compete well on Amazon? Would readers buy it over similar books? Does it deliver measurable reader value?

════════════════════════════════════
EVALUATION CRITERIA
════════════════════════════════════

BOOK-LEVEL: Evaluate overall flow, reader transformation, chapter progression, learning progression, practical usefulness, emotional engagement, commercial appeal, originality, teaching quality, book completeness, knowledge progression, framework integration, story balance, evidence balance, exercise balance.

CHAPTER-LEVEL: For every chapter — clear mission, advances reader, would removing it weaken the book, repeats prior chapters, correct position, information overload risk, sufficient implementation, reader enjoyment.

WEAK AREAS: Identify specific weak chapters, sections, or subsections with actionable recommendations: rewrite | expand | condense | reorder | merge | split | replace | strengthen.

VALUE DENSITY: Detect chapters with too much theory, too much repetition, too much storytelling, too little implementation, too little evidence.

PACING: Detect slow sections, information overload, fatigue triggers, advanced/simple imbalances.

TRANSFORMATION: For every chapter — does it move the reader measurably closer to the promised transformation?

READER QUESTIONS: Cross-reference open Knowledge Graph questions — are they answered in the manuscript?

ACTIONABILITY: Measure exercises, templates, worksheets, reflections, action plans, checklists, decision tools. Ensure readers know exactly what to do after each chapter.

BOOK SCORECARD: Rate each of the 13 dimensions from 0.0–10.0 (one decimal). Calculate overallPublishingScore as the weighted average.

BOOK APPROVAL: Evaluate all 8 quality gates. Only approve if ALL gates pass. If any gate fails, mark approved: false and explain in approvalNotes.

════════════════════════════════════
SCORING THRESHOLDS
════════════════════════════════════
Approved (publish-ready): overallPublishingScore ≥ 7.5 AND all 8 approval gates pass.
Conditional (minor improvements needed): 6.5–7.4
Not ready (significant work required): < 6.5

════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════
Return ONLY valid JSON (no markdown fences, no explanation text):

{
  "perspectiveReviews": {
    "reader": { "summary": "2-3 sentence assessment from a reader's perspective", "strengths": ["strength 1", "strength 2"], "concerns": ["concern 1"] },
    "publisher": { "summary": "2-3 sentence assessment from a publisher's perspective", "strengths": [], "concerns": [] },
    "subjectMatterExpert": { "summary": "2-3 sentence SME assessment", "strengths": [], "concerns": [] },
    "commercialReviewer": { "summary": "2-3 sentence commercial assessment", "strengths": [], "concerns": [] }
  },
  "bookLevelAnalysis": {
    "overallFlow": "One sentence assessment",
    "readerTransformation": "One sentence assessment",
    "chapterProgression": "One sentence assessment",
    "learningProgression": "One sentence assessment",
    "practicalUsefulness": "One sentence assessment",
    "emotionalEngagement": "One sentence assessment",
    "commercialAppeal": "One sentence assessment",
    "originality": "One sentence assessment",
    "teachingQuality": "One sentence assessment",
    "bookCompleteness": "One sentence assessment",
    "knowledgeProgression": "One sentence assessment",
    "frameworkIntegration": "One sentence assessment",
    "storyBalance": "One sentence assessment",
    "evidenceBalance": "One sentence assessment",
    "exerciseBalance": "One sentence assessment"
  },
  "chapterReviews": [
    {
      "chapterNumber": 1,
      "chapterTitle": "exact chapter title",
      "missionClarity": "clear | unclear",
      "advancesReader": true,
      "weakensBookIfRemoved": true,
      "repeatsChapters": "none | Chapter X title",
      "positionCorrect": true,
      "informationOverload": false,
      "sufficientImplementation": true,
      "readerEnjoyment": "high | medium | low",
      "score": 8.5,
      "recommendation": "One actionable sentence. If no issue, write 'No changes needed.'"
    }
  ],
  "weakAreas": [
    {
      "level": "book | chapter | section | subsection",
      "location": "e.g. Chapter 3 — Section 2",
      "issue": "One sentence describing the problem",
      "action": "rewrite | expand | condense | reorder | merge | split | replace | strengthen",
      "priority": "high | medium | low"
    }
  ],
  "unansweredQuestions": ["Reader questions from the Knowledge Graph that were NOT answered in the manuscript"],
  "pacingIssues": [
    { "location": "Chapter X or 'Chapters 3–5'", "type": "slow | overloaded | too_advanced | too_simple | fatigue", "recommendation": "One sentence fix" }
  ],
  "valueDensityByChapter": [
    { "chapterNumber": 1, "score": 8.0, "issue": null }
  ],
  "actionabilityAssessment": {
    "score": 7.5,
    "missingElements": ["exercises | templates | worksheets | reflections | action plans | checklists"],
    "recommendations": ["One sentence recommendation per missing element"]
  },
  "transformationVerification": {
    "transformationClear": true,
    "transformationDelivered": true,
    "weakTransformationChapters": [3],
    "recommendation": "One sentence on how to strengthen the transformation arc"
  },
  "bookScorecard": {
    "commercialPotential": 8.0,
    "educationalValue": 8.5,
    "practicalValue": 7.5,
    "originality": 7.0,
    "readerEngagement": 8.0,
    "transformation": 8.5,
    "implementation": 7.5,
    "storytelling": 8.0,
    "frameworkQuality": 8.0,
    "evidenceQuality": 7.5,
    "readerSatisfactionPrediction": 8.0,
    "marketCompetitiveness": 7.5,
    "overallPublishingScore": 7.9
  },
  "bookApproval": {
    "approved": true,
    "bookDNAAlignment": true,
    "blueprintAlignment": true,
    "knowledgeGraphConsistency": true,
    "commercialReadiness": true,
    "educationalQuality": true,
    "transformationComplete": true,
    "consistency": true,
    "readerExperience": true,
    "approvalNotes": "One sentence summary of the approval decision and next step"
  }
}
