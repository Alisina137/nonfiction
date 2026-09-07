/**
 * Provider-neutral lesson output normalization.
 *
 * Models differ in how aggressively they use Markdown, headings, separators,
 * and metadata language. The lesson endpoint owns the publication contract, so
 * these presentation differences are normalized after every provider response.
 */

const DECORATIVE_LINE = /^[\s\-=*_~═─—–]{4,}$/;

const PLANNING_LEAK_PATTERNS = [
  /\b(book|chapter|section|subsection)\s+dna\b/i,
  /\bprovide\s+(the\s+)?(dna|blueprint|features?|context)\b/i,
  /\b(request|need|require)\s+(more|additional)\s+(information|context|details)\b/i,
  /\bas an ai\b/i,
  /\bhow (this|the)\s+(section|content|feature)\s+should\b/i,
  /\boutput format\b/i,
  /\binternal guidance\b/i,
  /\bplanning (data|instructions|notes)\b/i
];

function normalizeLine(line: string): string {
  return line
    // Providers often use Markdown headings even though the editor is plain prose.
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    // Keep the words, not provider-specific emphasis syntax.
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/[ \t]+$/g, "")
    .trim();
}

export function normalizeLessonProse(value: unknown): string {
  if (typeof value !== "string") return "";

  const lines = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(normalizeLine)
    .filter((line) => !DECORATIVE_LINE.test(line));

  const output: string[] = [];
  let blankPending = false;
  for (const line of lines) {
    if (!line) {
      blankPending = output.length > 0;
      continue;
    }
    if (blankPending) output.push("");
    output.push(line);
    blankPending = false;
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function normalizeLessonPayload(data: any): any {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { content: normalizeLessonProse(data) };
  }

  const normalized = { ...data };
  if (typeof normalized.content === "string") {
    normalized.content = normalizeLessonProse(normalized.content);
  }
  if (typeof normalized.prose === "string") {
    normalized.prose = normalizeLessonProse(normalized.prose);
  }
  if (typeof normalized.title === "string") {
    normalized.title = normalizeLessonProse(normalized.title).replace(/\n+/g, " ");
  }

  return normalized;
}

export function lessonContentText(data: any): string {
  if (!data || typeof data !== "object") return "";
  return typeof data.content === "string"
    ? data.content.trim()
    : typeof data.prose === "string"
      ? data.prose.trim()
      : "";
}

export function isLessonContentUsable(data: any): boolean {
  const content = lessonContentText(data);
  if (content.length < 80) return false;
  return !PLANNING_LEAK_PATTERNS.some((pattern) => pattern.test(content));
}
