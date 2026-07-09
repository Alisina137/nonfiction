/**
 * Flatten bookOutline into ordered draft targets (intro → subsections → conclusion).
 */

function syntheticSubsection(title, role) {
  return {
    title,
    strategy: role,
    explanation: `Develop "${title}" with concrete, non-generic insight.`,
    application: "Give the reader a clear next action or mental model."
  };
}

/** Build subsection context from the real outline object, falling back gracefully. */
function realSubsection(sub, fallbackRole) {
  return {
    title:       sub.title || "Subsection",
    description: sub.explanation || sub.description || sub.objective || sub.intent || `Develop "${sub.title}" with concrete, specific insight.`,
    strategy:    sub.strategy    || fallbackRole,
    ...(Array.isArray(sub.keyPoints) && sub.keyPoints.length ? { keyPoints: sub.keyPoints } : {}),
    ...(sub.application ? { application: sub.application } : {}),
    ...(sub.intent      ? { intent: sub.intent }            : {}),
  };
}

export const BACK_MATTER_SECTIONS = [
  { key: "epilogue",            role: "epilogue",            defaultTitle: "Epilogue",        chKey: "__epilogue__" },
  { key: "keyLessons",          role: "keyLessons",          defaultTitle: "Key Lessons",     chKey: "__keyLessons__" },
  { key: "appendix",            role: "appendix",            defaultTitle: "Appendix",        chKey: "__appendix__" },
  { key: "glossary",            role: "glossary",            defaultTitle: "Glossary",        chKey: "__glossary__" },
  { key: "references",          role: "references",          defaultTitle: "References",      chKey: "__references__" },
  { key: "furtherReading",      role: "furtherReading",      defaultTitle: "Further Reading", chKey: "__furtherReading__" },
  { key: "backAcknowledgments", role: "backAcknowledgments", defaultTitle: "Acknowledgments", chKey: "__backAcknowledgments__" },
  { key: "theEnd",              role: "theEnd",              defaultTitle: "The End",         chKey: "__theEnd__" },
];

export function enumerateWriteBlocks(bookOutline) {
  const o = bookOutline && typeof bookOutline === "object" ? bookOutline : {};
  const blocks = [];

  const intro = o.introduction;
  if (intro?.id) {
    blocks.push({
      kind: "introduction",
      id: intro.id,
      label: intro.title || "Introduction",
      breadcrumb: "Front matter",
      chapterKey: "__intro__",
      chapterContext: { title: intro.title || "Introduction", role: "introduction" },
      sectionTitle: null,
      subsection: syntheticSubsection(
        intro.title || "Introduction",
        "Hook the reader with pain → promise; preview the transformation arc without fluff."
      )
    });
  }

  const howToUse = o.howToUseThisBook;
  if (howToUse?.id) {
    blocks.push({
      kind: "howToUseThisBook",
      id: howToUse.id,
      label: howToUse.title || "How to Use This Book",
      breadcrumb: "Front matter",
      chapterKey: "__howToUse__",
      chapterContext: { title: howToUse.title || "How to Use This Book", role: "howToUseThisBook" },
      sectionTitle: null,
      subsection: syntheticSubsection(
        howToUse.title || "How to Use This Book",
        "Explain the best way to read the book, how to engage with exercises/action steps, and how to get maximum value from it."
      )
    });
  }

  const whatYouWillLearn = o.whatYouWillLearn;
  if (whatYouWillLearn?.id) {
    blocks.push({
      kind: "whatYouWillLearn",
      id: whatYouWillLearn.id,
      label: whatYouWillLearn.title || "What You Will Learn",
      breadcrumb: "Front matter",
      chapterKey: "__whatYouWillLearn__",
      chapterContext: { title: whatYouWillLearn.title || "What You Will Learn", role: "whatYouWillLearn" },
      sectionTitle: null,
      subsection: syntheticSubsection(
        whatYouWillLearn.title || "What You Will Learn",
        "Summarize the main knowledge, skills, and outcomes readers will gain, in concise bullet points, without revealing all details."
      )
    });
  }

  const whoThisBookIsFor = o.whoThisBookIsFor;
  if (whoThisBookIsFor?.id) {
    blocks.push({
      kind: "whoThisBookIsFor",
      id: whoThisBookIsFor.id,
      label: whoThisBookIsFor.title || "Who This Book Is For",
      breadcrumb: "Front matter",
      chapterKey: "__whoThisBookIsFor__",
      chapterContext: { title: whoThisBookIsFor.title || "Who This Book Is For", role: "whoThisBookIsFor" },
      sectionTitle: null,
      subsection: syntheticSubsection(
        whoThisBookIsFor.title || "Who This Book Is For",
        "Identify the intended audience, experience level, and reassure readers the content is practical and valuable for them."
      )
    });
  }

  const chapters = Array.isArray(o.chapters) ? o.chapters : [];
  chapters.forEach((ch, ci) => {
    const chapterKey = ch.id || `ch-${ci}`;
    const chapterContext = {
      index:        ci,
      number:       ci + 1,
      title:        ch.title   || `Chapter ${ci + 1}`,
      summary:      ch.summary || "",
      words:        Number(ch.words) || 0,
      sectionTitles: Array.isArray(ch.sections) ? ch.sections.map((s) => s.title || "Section") : []
    };
    const sections = Array.isArray(ch.sections) ? ch.sections : [];
    sections.forEach((sec, si) => {
      const subs = Array.isArray(sec.subsections) ? sec.subsections : [];
      const sectionBlueprint = Array.isArray(sec.blueprintComponents) ? sec.blueprintComponents : [];
      if (subs.length === 0) {
        blocks.push({
          kind: "section",
          id: sec.id || `sec-${ci}-${si}`,
          label: sec.title || "Section",
          breadcrumb: `${chapterContext.title} › ${sec.title || "Section"}`,
          chapterKey,
          chapterContext,
          sectionTitle: sec.title || null,
          blueprintComponents: sectionBlueprint,
          subsection: realSubsection(sec, `Section-level lesson within ${chapterContext.title}.`)
        });
        return;
      }
      subs.forEach((sub) => {
        const subBlueprint = Array.isArray(sub.blueprintComponents) ? sub.blueprintComponents : sectionBlueprint;
        blocks.push({
          kind: "subsection",
          id: sub.id,
          label: sub.title || "Subsection",
          breadcrumb: `${chapterContext.title} › ${sec.title || "Section"} › ${sub.title || "Subsection"}`,
          chapterKey,
          chapterContext,
          sectionTitle: sec.title || null,
          blueprintComponents: subBlueprint,
          subsection: realSubsection(sub, `Subsection in ${sec.title || "section"} — deliver one new framework or tactic.`)
        });
      });
    });
  });

  const concl = o.conclusion;
  if (concl?.id) {
    blocks.push({
      kind: "conclusion",
      id: concl.id,
      label: concl.title || "Conclusion",
      breadcrumb: "Back matter",
      chapterKey: "__conclusion__",
      chapterContext: { title: concl.title || "Conclusion", role: "conclusion" },
      sectionTitle: null,
      subsection: syntheticSubsection(
        concl.title || "Conclusion",
        "Synthesize wins, restate transformation, and give a crisp call-to-action."
      )
    });
  }

  for (const { key, role, defaultTitle, chKey } of BACK_MATTER_SECTIONS) {
    const node = o[key];
    if (node?.id) {
      blocks.push({
        kind: key,
        id: node.id,
        label: node.title || defaultTitle,
        breadcrumb: "Back matter",
        chapterKey: chKey,
        chapterContext: { title: node.title || defaultTitle, role },
        sectionTitle: null,
        subsection: syntheticSubsection(node.title || defaultTitle, `Back matter: ${defaultTitle}`),
      });
    }
  }

  return blocks;
}

/** Safely coerce any AI-returned field to a trimmed string. */
function str(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map((x) => String(x ?? "").trim()).filter(Boolean).join(", ");
  if (typeof v === "object") return Object.values(v).map((x) => String(x ?? "").trim()).filter(Boolean).join(", ");
  return String(v).trim();
}

/** Render API lesson JSON into editable manuscript prose. */
export function lessonToProse(lesson) {
  if (!lesson || typeof lesson !== "object") return "";

  // New structure-aware format: use full content prose directly
  const content = str(lesson.content);
  if (content && content.length > 80) return content;

  // Legacy fallback: reconstruct prose from old field shape
  const parts = [];
  const explanation = str(lesson.explanation);
  if (explanation) parts.push(explanation);
  const example = str(lesson.example);
  if (example) parts.push("", "Example", example);
  const framework = str(lesson.framework);
  if (framework) parts.push("", `Framework: ${framework}`);
  const steps = Array.isArray(lesson.executionSteps) ? lesson.executionSteps.filter(Boolean) : [];
  if (steps.length) {
    parts.push("", "Execution steps:");
    steps.forEach((step, i) => parts.push(`${i + 1}. ${str(step)}`));
  }
  return parts.join("\n").trim();
}

/** Rich context objects from blocks before `beforeIndex` — used by the AI to avoid repetition. */
export function collectPreviousConcepts(blocks, lessons, beforeIndex) {
  const concepts = [];
  for (let i = 0; i < beforeIndex; i++) {
    const block = blocks[i];
    const id = block?.id;
    const entry = id ? lessons?.[id] : null;
    const takeaway = str(entry?.lesson?.keyTakeaway || entry?.lesson?.framework);
    const title = str(entry?.lesson?.title) || str(block?.label);
    concepts.push({
      title:    title,
      chapter:  str(block?.chapterContext?.title) || "",
      section:  str(block?.sectionTitle) || "",
      takeaway: takeaway || "",
    });
  }
  return concepts.slice(-20);
}

/** Titles of not-yet-written blocks after `afterIndex` so the AI knows what to save for later. */
export function collectUpcomingTopics(blocks, afterIndex, n = 8) {
  const upcoming = [];
  for (let i = afterIndex + 1; i < blocks.length && upcoming.length < n; i++) {
    const b = blocks[i];
    const label = str(b?.sectionTitle) || str(b?.label);
    if (label) upcoming.push(label);
  }
  return upcoming;
}

/** Compact per-chapter key-idea summaries for chapters where every block already has content. */
export function buildChapterSummaries(blocks, lessons) {
  const chMap = new Map();
  for (const block of blocks) {
    const key = block.chapterKey;
    if (!chMap.has(key)) {
      chMap.set(key, { title: str(block?.chapterContext?.title) || key, blocks: [] });
    }
    chMap.get(key).blocks.push(block);
  }
  const summaries = [];
  for (const ch of chMap.values()) {
    const allDone = ch.blocks.every((b) => blockHasContent(lessons, b.id));
    if (!allDone) continue;
    const keyIdeas = ch.blocks
      .map((b) => str(lessons?.[b.id]?.lesson?.keyTakeaway || lessons?.[b.id]?.lesson?.framework))
      .filter(Boolean)
      .slice(0, 4);
    if (keyIdeas.length) summaries.push({ chapter: ch.title, keyIdeas });
  }
  return summaries;
}

/**
 * Build a manuscript context object for content-aware back matter generation.
 * Returns chapters with actual prose excerpts so the AI can derive lessons/terms
 * from the real manuscript rather than inventing generic advice.
 * Each block's prose is truncated to ~600 chars to keep the payload manageable.
 */
export function buildManuscriptContext(blocks, lessons) {
  const PROSE_LIMIT = 600;
  const chMap = new Map();
  for (const block of blocks) {
    const key = block.chapterKey;
    if (!chMap.has(key)) {
      chMap.set(key, { title: str(block?.chapterContext?.title) || key, blocks: [] });
    }
    chMap.get(key).blocks.push(block);
  }
  const chapters = [];
  for (const ch of chMap.values()) {
    const proseChunks = ch.blocks
      .filter((b) => blockHasContent(lessons, b.id))
      .map((b) => {
        const prose = String(lessons?.[b.id]?.prose || "").trim();
        const label = b.sectionTitle ? `[${b.sectionTitle}] ` : "";
        const truncated = prose.length > PROSE_LIMIT ? prose.slice(0, PROSE_LIMIT) + "…" : prose;
        return label + truncated;
      })
      .filter(Boolean);
    if (proseChunks.length) {
      chapters.push({ chapter: ch.title, content: proseChunks.join("\n\n") });
    }
  }
  return chapters;
}

export function blockHasContent(lessons, blockId) {
  const prose = String(lessons?.[blockId]?.prose || "").trim();
  return prose.length >= 40;
}

export function countDraftedBlocks(blocks, lessons) {
  if (!blocks.length) return { done: 0, total: 0 };
  const done = blocks.filter((b) => blockHasContent(lessons, b.id)).length;
  return { done, total: blocks.length };
}
