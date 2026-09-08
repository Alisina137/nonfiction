const WORD_PATTERN = /[\p{L}\p{N}]{3,}/gu;
const LIST_ITEM_PATTERN = /^\s*(?:[-*•]|\d+[.)])\s+/;

function words(value: string): string[] {
  return String(value || "").toLocaleLowerCase().match(WORD_PATTERN) || [];
}

function paragraphCount(value: string): number {
  const paragraphs = String(value || "")
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return paragraphs.length;
}

function listItemCount(value: string): number {
  return String(value || "")
    .split(/\r?\n/)
    .filter((line) => LIST_ITEM_PATTERN.test(line))
    .length;
}

export type EditQuality = {
  accepted: boolean;
  reasons: string[];
  wordOverlap: number;
  lengthRatio: number;
  originalParagraphs: number;
  candidateParagraphs: number;
  originalListItems: number;
  candidateListItems: number;
};

/**
 * An edit must be a revision of the supplied draft, not a fresh generation.
 * The overlap check intentionally measures how much of the original vocabulary
 * remains, while the structure checks protect paragraphs and lists.
 */
export function assessEditQuality(original: string, candidate: string): EditQuality {
  const originalWords = new Set(words(original));
  const candidateWords = new Set(words(candidate));
  const sharedWords = [...originalWords].filter((word) => candidateWords.has(word)).length;
  const wordOverlap = originalWords.size ? sharedWords / originalWords.size : 0;
  const originalLength = Math.max(String(original || "").trim().length, 1);
  const lengthRatio = String(candidate || "").trim().length / originalLength;
  const originalParagraphs = paragraphCount(original);
  const candidateParagraphs = paragraphCount(candidate);
  const originalListItems = listItemCount(original);
  const candidateListItems = listItemCount(candidate);
  const reasons: string[] = [];

  if (!String(candidate || "").trim()) reasons.push("the response was empty");
  if (wordOverlap < 0.38) reasons.push("too much of the original wording was replaced");
  if (lengthRatio < 0.55 || lengthRatio > 1.65) reasons.push("the response changed the draft length too much");
  if (Math.abs(candidateParagraphs - originalParagraphs) > 1) reasons.push("the paragraph structure changed");
  if (originalListItems !== candidateListItems) reasons.push("the list structure changed");

  return {
    accepted: reasons.length === 0,
    reasons,
    wordOverlap,
    lengthRatio,
    originalParagraphs,
    candidateParagraphs,
    originalListItems,
    candidateListItems
  };
}