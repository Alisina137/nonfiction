import { buildVerifiedSourceList } from "./referenceIntelligence.js";

const CLAIM_SIGNAL_PATTERNS = [
  /\b\d+(?:\.\d+)?\s*%\b/i,
  /\b(?:study|studies|research|researchers|survey|report|data|statistics|trial|experiment)\b/i,
  /\b(?:according to|found that|showed that|shows that|demonstrated that|reported that)\b/i,
  /\b(?:experts|scientists|psychologists|economists|doctors|researchers)\s+(?:say|agree|found|believe|report)/i,
  /["“][^"”]{8,}["”]/,
  /\b(?:in 19\d{2}|in 20\d{2})\b/i,
  /\b(?:million|billion|trillion)\b/i,
];

const STOP = new Set([
  "a","an","and","are","as","at","be","been","being","but","by","can","could","did","do","does","for",
  "from","had","has","have","how","if","in","into","is","it","its","may","more","most","of","on","or",
  "our","should","so","than","that","the","their","then","there","these","they","this","to","was","we",
  "were","what","when","where","which","who","will","with","would","you","your"
]);

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function tokens(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP.has(token));
}

function splitSentences(text) {
  const compact = clean(text);
  if (!compact) return [];
  return compact
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"])/)
    .map(clean)
    .filter((sentence) => sentence.length >= 24);
}

function looksLikeClaim(sentence) {
  return CLAIM_SIGNAL_PATTERNS.some((pattern) => pattern.test(sentence));
}

function evidenceMatchScore(sentence, evidence) {
  const claimTokens = new Set(tokens(sentence));
  const evidenceTokens = new Set(tokens(`${evidence?.title || ""} ${evidence?.text || ""}`));
  if (!claimTokens.size || !evidenceTokens.size) return 0;
  let overlap = 0;
  for (const token of claimTokens) if (evidenceTokens.has(token)) overlap += 1;
  return overlap / Math.max(3, Math.min(claimTokens.size, 12));
}

function normalizedEvidence(entry) {
  return (Array.isArray(entry?.sourceEvidence) ? entry.sourceEvidence : [])
    .filter((item) => item?.sourceId && (item?.text || item?.title))
    .map((item) => ({
      sourceId: clean(item.sourceId),
      sourceTitle: clean(item.sourceTitle || "Reference"),
      sourceAuthor: clean(item.sourceAuthor),
      kind: clean(item.kind),
      title: clean(item.title),
      text: clean(item.text),
      pages: Array.isArray(item.pages) ? item.pages.map(Number).filter(Number.isFinite) : [],
      pageLabel: clean(item.pageLabel),
    }));
}

export function buildManuscriptEvidenceAudit(lessons = {}) {
  const sourceUsage = new Map();
  const sections = [];
  const unsupportedClaims = [];
  const supportedClaims = [];

  for (const [sectionId, rawEntry] of Object.entries(lessons && typeof lessons === "object" ? lessons : {})) {
    const entry = rawEntry && typeof rawEntry === "object" ? rawEntry : {};
    const prose = clean(entry.prose);
    if (prose.length < 40) continue;

    const evidence = normalizedEvidence(entry);
    const sectionTitle = clean(entry.targetSubsectionTitle || entry.lesson?.title || sectionId);
    const claims = splitSentences(prose)
      .filter(looksLikeClaim)
      .slice(0, 40)
      .map((sentence) => {
        const matches = evidence
          .map((item) => ({ item, score: evidenceMatchScore(sentence, item) }))
          .filter((match) => match.score >= 0.2)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        const claim = {
          sectionId,
          sectionTitle,
          text: sentence,
          status: matches.length ? "supported" : "review",
          evidence: matches.map(({ item }) => item),
        };
        if (matches.length) supportedClaims.push(claim);
        else unsupportedClaims.push(claim);
        return claim;
      });

    const sectionSourceIds = [...new Set(evidence.map((item) => item.sourceId))];
    for (const item of evidence) {
      const current = sourceUsage.get(item.sourceId) || {
        sourceId: item.sourceId,
        sourceTitle: item.sourceTitle,
        sourceAuthor: item.sourceAuthor,
        sectionIds: new Set(),
        sectionTitles: new Set(),
        pages: new Set(),
        evidenceItems: 0,
      };
      current.sectionIds.add(sectionId);
      current.sectionTitles.add(sectionTitle);
      item.pages.forEach((page) => current.pages.add(page));
      current.evidenceItems += 1;
      sourceUsage.set(item.sourceId, current);
    }

    sections.push({
      sectionId,
      sectionTitle,
      wordCount: prose.split(/\s+/).filter(Boolean).length,
      evidenceCount: evidence.length,
      sourceCount: sectionSourceIds.length,
      sourceIds: sectionSourceIds,
      evidence,
      claims,
      unsupportedClaimCount: claims.filter((claim) => claim.status === "review").length,
      supportedClaimCount: claims.filter((claim) => claim.status === "supported").length,
    });
  }

  const sectionsWithEvidence = sections.filter((section) => section.evidenceCount > 0).length;
  const coveragePercent = sections.length
    ? Math.round((sectionsWithEvidence / sections.length) * 100)
    : 0;

  const usage = [...sourceUsage.values()]
    .map((item) => ({
      sourceId: item.sourceId,
      sourceTitle: item.sourceTitle,
      sourceAuthor: item.sourceAuthor,
      sectionIds: [...item.sectionIds],
      sectionTitles: [...item.sectionTitles],
      pages: [...item.pages].sort((a, b) => a - b),
      evidenceItems: item.evidenceItems,
    }))
    .sort((a, b) => b.sectionIds.length - a.sectionIds.length || b.evidenceItems - a.evidenceItems);

  return {
    draftedSections: sections.length,
    sectionsWithEvidence,
    sectionsWithoutEvidence: sections.length - sectionsWithEvidence,
    coveragePercent,
    usedSourceIds: usage.map((item) => item.sourceId),
    sourceUsage: usage,
    supportedClaimCount: supportedClaims.length,
    unsupportedClaimCount: unsupportedClaims.length,
    unsupportedClaims: unsupportedClaims.slice(0, 100),
    supportedClaims: supportedClaims.slice(0, 100),
    sections,
  };
}

export function buildUsedVerifiedSourceList(project) {
  const audit = buildManuscriptEvidenceAudit(project?.lessons || {});
  const usedIds = new Set(audit.usedSourceIds);
  return buildVerifiedSourceList(project).filter((source) => usedIds.has(String(source.id)));
}

function projectText(project, paths) {
  for (const path of paths) {
    const value = path.split(".").reduce((obj, key) => obj?.[key], project);
    if ((typeof value === "string" || typeof value === "number") && clean(value)) return clean(value);
  }
  return "";
}

function hasGeneratedReferences(project) {
  return Object.values(project?.lessons || {}).some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const title = clean(entry.targetSubsectionTitle).toLowerCase();
    const groups = entry.structuredData?.groups;
    return title === "references" ||
      (groups && typeof groups === "object" && Object.values(groups).some((items) => Array.isArray(items) && items.length));
  });
}

export function buildPublishingPreflight({
  project = {},
  settings = {},
  evidenceAudit,
  referenceSafety,
  wordCount = 0,
  sectionCount = 0,
} = {}) {
  const audit = evidenceAudit || buildManuscriptEvidenceAudit(project?.lessons || {});
  const overlap = referenceSafety || { risk: "none", matches: [] };
  const title = projectText(project, ["bookDetails.title", "bookTitle", "research.bookTitle", "title"]);
  const coverTitle = projectText(project, ["bookCover.title"]);
  const subtitle = projectText(project, ["bookDetails.subtitle", "research.bookSubtitle"]);
  const coverSubtitle = projectText(project, ["bookCover.subtitle"]);
  const author = projectText(project, ["authorBio.authorName", "research.authorName", "bookDetails.author", "bookDetails.authorName", "author.name", "authorName"]);
  const description = projectText(project, ["description.description", "description", "bookDescription.description"]);
  const indexedReferences = (project?.resources?.files || []).filter((file) => file?.referenceAnalysis).length;

  const checks = [];
  const add = (id, label, status, detail) => checks.push({ id, label, status, detail });

  add("title", "Book title", title ? "pass" : "block", title ? "Title is present." : "Add the final book title before export.");
  add("author", "Author name", author ? "pass" : "block", author ? "Author name is present." : "Add the author name before export.");
  add(
    "manuscript",
    "Manuscript content",
    Number(wordCount) > 0 && Number(sectionCount || audit.draftedSections) > 0 ? "pass" : "block",
    Number(wordCount) > 0 ? `${Number(wordCount).toLocaleString()} words across ${sectionCount || audit.draftedSections} drafted sections.` : "Generate manuscript content before export."
  );

  add(
    "description",
    "Listing description",
    description ? "pass" : "warn",
    description ? "Listing description is available." : "Generate or add the listing description before publishing."
  );

  const trim = clean(settings?.trimSize);
  add(
    "trim",
    "Print trim size",
    ["5x8","5.5x8.5","6x9","8x10","8.5x11"].includes(trim) ? "pass" : "warn",
    trim ? `Selected trim size: ${trim}.` : "Select and review the print trim size."
  );

  if (title && coverTitle) {
    add(
      "title-consistency",
      "Title consistency",
      title.toLowerCase() === coverTitle.toLowerCase() ? "pass" : "warn",
      title.toLowerCase() === coverTitle.toLowerCase()
        ? "Manuscript metadata and cover title match."
        : "Book-details title and cover title differ; review them before publishing."
    );
  }

  if (subtitle && coverSubtitle) {
    add(
      "subtitle-consistency",
      "Subtitle consistency",
      subtitle.toLowerCase() === coverSubtitle.toLowerCase() ? "pass" : "warn",
      subtitle.toLowerCase() === coverSubtitle.toLowerCase()
        ? "Manuscript metadata and cover subtitle match."
        : "Book-details subtitle and cover subtitle differ; review them before publishing."
    );
  }

  add(
    "reference-overlap",
    "Reference wording safety",
    overlap?.risk === "review" ? "warn" : "pass",
    overlap?.risk === "review"
      ? `${overlap.matches?.length || 0} indexed phrase match(es) need editorial review.`
      : "No indexed verbatim phrase overlap was detected."
  );

  if (indexedReferences > 0) {
    add(
      "claim-review",
      "Unsupported-claim review",
      audit.unsupportedClaimCount === 0 ? "pass" : "warn",
      audit.unsupportedClaimCount === 0
        ? "No factual/statistical/attributed claim signals are currently missing matching retrieved evidence."
        : `${audit.unsupportedClaimCount} claim-like sentence(s) need source verification or rewriting.`
    );
  }

  if (audit.usedSourceIds.length > 0) {
    add(
      "references-section",
      "References section",
      hasGeneratedReferences(project) ? "pass" : "warn",
      hasGeneratedReferences(project)
        ? "A References section is present."
        : "Generate the References section so sources actually used in the manuscript are listed."
    );
  }

  const blockingCount = checks.filter((check) => check.status === "block").length;
  const warningCount = checks.filter((check) => check.status === "warn").length;
  const passedCount = checks.filter((check) => check.status === "pass").length;

  return {
    status: blockingCount ? "block" : warningCount ? "review" : "pass",
    blockingCount,
    warningCount,
    passedCount,
    checks,
  };
}
