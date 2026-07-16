/**
 * Manuscript Digest Builder — Developmental Editor & Commercial Book Optimizer
 *
 * Builds a compact, token-efficient structural summary of the manuscript
 * for the Developmental Editing Engine. Does NOT include full prose —
 * only structural metadata (chapter missions, key takeaways, teaching methods,
 * word counts) that lets the AI perform book-level editorial analysis without
 * consuming the entire manuscript in context.
 */

function cap(v, max) {
  if (v == null) return "";
  const s = String(v).replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Build a compact manuscript digest from the project.
 *
 * @param {object} project — full project object from localStorage (use fullProject)
 * @returns {object} — compact digest for the developmental edit API
 */
export function buildManuscriptDigest(project) {
  const outline = project?.bookOutline || {};
  const chapters = safeArr(outline.chapters);
  const lessons = project?.lessons || {};
  const chapterMissions = safeArr(project?.bookDetails?.chapterMissions);

  // Build chapter-mission lookup by chapterNumber
  const missionByChNum = {};
  for (const m of chapterMissions) {
    if (m?.chapterNumber != null) missionByChNum[m.chapterNumber] = m;
  }

  let totalSections = 0;
  let totalSubsections = 0;
  let totalWordsWritten = 0;
  let totalSubsectionsWritten = 0;

  const chapterDigests = chapters.map((ch, chIdx) => {
    const chNum = chIdx + 1;
    const mission = missionByChNum[chNum] || null;

    const sectionDigests = safeArr(ch.sections).map((sec, secIdx) => {
      const subsectionDigests = safeArr(sec.subsections).map((sub, subIdx) => {
        totalSubsections++;

        const lessonKey = `${chIdx}-${secIdx}-${subIdx}`;
        const entry = lessons[lessonKey];
        const lesson = entry?.lesson || {};

        // Approximate word count from prose length
        const prose = entry?.prose || "";
        const wordCount = prose ? prose.split(/\s+/).filter(Boolean).length : 0;
        if (wordCount > 0) {
          totalSubsectionsWritten++;
          totalWordsWritten += wordCount;
        }

        return {
          title:          cap(sub.title || sub.explanation || "", 90),
          keyTakeaway:    cap(lesson.keyTakeaway, 160),
          teachingMethod: cap(lesson.teachingMethod, 60),
          competitorGap:  cap(lesson.competitorGap, 100),
          wordCount,
          written:        wordCount > 0,
        };
      });

      totalSections++;
      return {
        title:      cap(sec.title, 110),
        totalWords: subsectionDigests.reduce((a, s) => a + s.wordCount, 0),
        subsections: subsectionDigests,
      };
    });

    const chapterWords = sectionDigests.reduce((a, s) => a + s.totalWords, 0);

    return {
      chapterNumber: chNum,
      title:         cap(ch.title, 110),
      description:   cap(ch.description || ch.summary, 200),
      mission: mission ? {
        purpose:              cap(mission.purpose, 160),
        expectedReaderAction: cap(mission.expectedReaderAction, 130),
        knowledgeGoal:        cap(mission.knowledgeGoal, 130),
        practicalGoal:        cap(mission.practicalGoal, 130),
      } : null,
      sections:   sectionDigests,
      totalWords: chapterWords,
      written:    chapterWords > 0,
    };
  });

  return {
    chapterCount:              chapters.length,
    totalSections,
    totalSubsections,
    totalSubsectionsWritten,
    totalWordsWritten,
    completionPercent:         totalSubsections > 0
      ? Math.round((totalSubsectionsWritten / totalSubsections) * 100)
      : 0,
    chapters: chapterDigests,
  };
}
