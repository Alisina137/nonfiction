// Utility to gather all finalized content up to the current section/chapter for context-aware AI generation
// Usage: getPreviousContent(book, currentChapterIdx, currentSectionIdx)

/**
 * Collects all finalized content up to the current section/chapter.
 * @param {Object} book - The book data structure (with introduction, chapters, etc.)
 * @param {number} currentChapterIdx - Index of the current chapter
 * @param {number} currentSectionIdx - Index of the current section in the chapter
 * @returns {string} - Concatenated previous content
 */
export function getPreviousContent(book, currentChapterIdx, currentSectionIdx) {
  let content = [];
  // Add introduction if exists and finalized
  if (book.introduction?.content) content.push(book.introduction.content);

  // Loop through chapters up to current
  for (let c = 0; c <= currentChapterIdx; c++) {
    const chapter = book.chapters[c];
    if (!chapter) continue;
    // For previous chapters, add all sections
    if (c < currentChapterIdx) {
      chapter.sections?.forEach((sec) => {
        if (sec.content) content.push(sec.content);
      });
    } else if (c === currentChapterIdx) {
      // For current chapter, add sections up to currentSectionIdx
      for (let s = 0; s < currentSectionIdx; s++) {
        const sec = chapter.sections[s];
        if (sec?.content) content.push(sec.content);
      }
    }
  }
  return content.join("\n\n");
}
