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
      chapterKey: "__intro__",
      chapterContext: { title: intro.title || "Introduction", role: "introduction" },
      sectionTitle: null,
      subsection: syntheticSubsection(
        intro.title || "Introduction",
        "Hook the reader with pain → promise; preview the transformation arc without fluff."
      )
    });
  }

  const chapters = Array.isArray(o.chapters) ? o.chapters : [];
  chapters.forEach((ch, ci) => {
    const chapterKey = ch.id || `ch-${ci}`;
    const chapterContext = {
      index: ci,
      number: ci + 1,
      title: ch.title || `Chapter ${ci + 1}`,
      words: Number(ch.words) || 0,
      sectionTitles: Array.isArray(ch.sections) ? ch.sections.map((s) => s.title || "Section") : []
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
          chapterKey,
          chapterContext,
          sectionTitle: sec.title || null,
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
          chapterKey,
          chapterContext,
          sectionTitle: sec.title || null,
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
      chapterKey: "__conclusion__",
      chapterContext: { title: concl.title || "Conclusion", role: "conclusion" },
      sectionTitle: null,
      subsection: syntheticSubsection(
        concl.title || "Conclusion",
        "Synthesize wins, restate transformation, and give a crisp call-to-action."
      )
    });
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

/** Frameworks / titles from blocks before `beforeIndex` for continuity. */
export function collectPreviousConcepts(blocks, lessons, beforeIndex) {
  const concepts = [];
  for (let i = 0; i < beforeIndex; i += 1) {
    const id = blocks[i]?.id;
    const entry = id ? lessons?.[id] : null;
    const fw = str(entry?.lesson?.framework);
    const title = str(entry?.lesson?.title) || str(blocks[i]?.label);
    if (fw) concepts.push(fw);
    else if (title) concepts.push(title);
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
