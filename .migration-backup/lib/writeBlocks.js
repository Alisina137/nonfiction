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
      chapterContext: { title: intro.title || "Introduction", role: "introduction" },
      subsection: syntheticSubsection(
        intro.title || "Introduction",
        "Hook the reader with pain → promise; preview the transformation arc without fluff."
      )
    });
  }

  const chapters = Array.isArray(o.chapters) ? o.chapters : [];
  chapters.forEach((ch, ci) => {
    const chapterContext = {
      index: ci,
      title: ch.title || `Chapter ${ci + 1}`,
      words: Number(ch.words) || 0
    };
    const sections = Array.isArray(ch.sections) ? ch.sections : [];
    sections.forEach((sec, si) => {
      const subs = Array.isArray(sec.subsections) ? sec.subsections : [];
      if (subs.length === 0) {
        blocks.push({
          kind: "section",
          id: sec.id || `sec-${ci}-${si}`,
          label: sec.title || "Section",
          breadcrumb: `${chapterContext.title} › ${sec.title || "Section"}`,
          chapterContext,
          subsection: syntheticSubsection(
            sec.title || "Section",
            `Section-level lesson within ${chapterContext.title}.`
          )
        });
        return;
      }
      subs.forEach((sub) => {
        blocks.push({
          kind: "subsection",
          id: sub.id,
          label: sub.title || "Subsection",
          breadcrumb: `${chapterContext.title} › ${sec.title || "Section"} › ${sub.title || "Subsection"}`,
          chapterContext,
          subsection: syntheticSubsection(
            sub.title || "Subsection",
            `Subsection in ${sec.title || "section"} — deliver one new framework or tactic.`
          )
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
      chapterContext: { title: concl.title || "Conclusion", role: "conclusion" },
      subsection: syntheticSubsection(
        concl.title || "Conclusion",
        "Synthesize wins, restate transformation, and give a crisp call-to-action."
      )
    });
  }

  return blocks;
}

/** Render API lesson JSON into editable manuscript prose. */
export function lessonToProse(lesson) {
  if (!lesson || typeof lesson !== "object") return "";
  const parts = [];
  if (lesson.explanation?.trim()) parts.push(lesson.explanation.trim());
  if (lesson.example?.trim()) {
    parts.push("", "Example", lesson.example.trim());
  }
  if (lesson.framework?.trim()) {
    parts.push("", `Framework: ${lesson.framework.trim()}`);
  }
  const steps = Array.isArray(lesson.executionSteps) ? lesson.executionSteps.filter(Boolean) : [];
  if (steps.length) {
    parts.push("", "Execution steps:");
    steps.forEach((step, i) => parts.push(`${i + 1}. ${String(step).trim()}`));
  }
  return parts.join("\n").trim();
}

/** Frameworks / titles from blocks before `beforeIndex` for continuity. */
export function collectPreviousConcepts(blocks, lessons, beforeIndex) {
  const concepts = [];
  for (let i = 0; i < beforeIndex; i += 1) {
    const id = blocks[i]?.id;
    const entry = id ? lessons?.[id] : null;
    const fw = entry?.lesson?.framework;
    const title = entry?.lesson?.title || blocks[i]?.label;
    if (fw?.trim()) concepts.push(fw.trim());
    else if (title?.trim()) concepts.push(title.trim());
  }
  return concepts.slice(-24);
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
