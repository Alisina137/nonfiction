import { buildVerifiedSourceList } from "./referenceIntelligence.js";
import { buildManuscriptEvidenceAudit } from "./manuscriptEvidence.js";

const STOP = new Set([
  "a","an","and","are","as","at","be","been","being","but","by","can","could","did","do","does","for",
  "from","had","has","have","how","if","in","into","is","it","its","may","more","most","of","on","or",
  "our","should","so","than","that","the","their","then","there","these","they","this","to","was","we",
  "were","what","when","where","which","who","will","with","would","you","your"
]);

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function tokens(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(function (token) { return token.length >= 3 && !STOP.has(token); });
}

function evidenceKey(item) {
  return [clean(item && item.sourceId), clean(item && item.title), clean(item && item.text)].join("|").toLowerCase();
}

function evidenceFreshnessScore(prose, evidence) {
  const proseTokens = new Set(tokens(prose));
  const evidenceTokens = new Set(tokens(clean(evidence && evidence.title) + " " + clean(evidence && evidence.text)));
  if (!proseTokens.size || !evidenceTokens.size) return 0;

  let shared = 0;
  evidenceTokens.forEach(function (token) {
    if (proseTokens.has(token)) shared += 1;
  });
  const lexicalCoverage = shared / Math.max(4, Math.min(evidenceTokens.size, 18));

  const ordered = tokens(clean(evidence && evidence.title) + " " + clean(evidence && evidence.text));
  const proseText = clean(prose).toLowerCase();
  let pairs = 0;
  let sharedPairs = 0;
  for (let i = 0; i < ordered.length - 1 && pairs < 10; i += 1) {
    pairs += 1;
    if (proseText.includes(ordered[i] + " " + ordered[i + 1])) sharedPairs += 1;
  }
  const phraseCoverage = pairs ? sharedPairs / pairs : 0;
  return Math.min(1, lexicalCoverage * 0.75 + phraseCoverage * 0.25);
}

export function pruneStaleSourceEvidence(prose, sourceEvidence, options) {
  const opts = options || {};
  const evidence = Array.isArray(sourceEvidence) ? sourceEvidence.filter(Boolean) : [];
  if (!clean(prose) || !evidence.length) return { active: evidence, stale: [], scored: [] };

  const minScore = Number.isFinite(Number(opts.minScore)) ? Number(opts.minScore) : 0.08;
  const scored = evidence.map(function (item) {
    return Object.assign({}, item, {
      freshnessScore: Number(evidenceFreshnessScore(prose, item).toFixed(3))
    });
  });
  return {
    active: scored.filter(function (item) { return item.freshnessScore >= minScore; }),
    stale: scored.filter(function (item) { return item.freshnessScore < minScore; }),
    scored: scored
  };
}

export function buildPrecisionEvidenceAudit(lessons) {
  const inputLessons = lessons && typeof lessons === "object" ? lessons : {};
  const base = buildManuscriptEvidenceAudit(inputLessons);
  const sourceUsage = new Map();
  const unsupportedClaims = [];
  const supportedClaims = [];

  const sections = base.sections.map(function (section) {
    const entry = inputLessons[section.sectionId] || {};
    const freshness = pruneStaleSourceEvidence(entry.prose, entry.sourceEvidence);
    const activeKeys = new Set(freshness.active.map(evidenceKey));

    const claims = (section.claims || []).map(function (claim) {
      const evidence = (claim.evidence || []).filter(function (item) {
        return activeKeys.has(evidenceKey(item));
      });
      const next = Object.assign({}, claim, {
        evidence: evidence,
        status: evidence.length ? "supported" : "review"
      });
      if (next.status === "supported") supportedClaims.push(next);
      else unsupportedClaims.push(next);
      return next;
    });

    const sourceIds = Array.from(new Set(freshness.active.map(function (item) { return clean(item.sourceId); }).filter(Boolean)));
    freshness.active.forEach(function (item) {
      const sourceId = clean(item.sourceId);
      if (!sourceId) return;
      const current = sourceUsage.get(sourceId) || {
        sourceId: sourceId,
        sourceTitle: clean(item.sourceTitle || "Reference"),
        sourceAuthor: clean(item.sourceAuthor),
        sectionIds: new Set(),
        sectionTitles: new Set(),
        pages: new Set(),
        evidenceItems: 0
      };
      current.sectionIds.add(section.sectionId);
      current.sectionTitles.add(section.sectionTitle);
      (Array.isArray(item.pages) ? item.pages : []).forEach(function (page) {
        const n = Number(page);
        if (Number.isFinite(n)) current.pages.add(n);
      });
      current.evidenceItems += 1;
      sourceUsage.set(sourceId, current);
    });

    return Object.assign({}, section, {
      evidence: freshness.active,
      evidenceCount: freshness.active.length,
      sourceIds: sourceIds,
      sourceCount: sourceIds.length,
      staleEvidence: freshness.stale,
      staleEvidenceCount: freshness.stale.length,
      claims: claims,
      supportedClaimCount: claims.filter(function (claim) { return claim.status === "supported"; }).length,
      unsupportedClaimCount: claims.filter(function (claim) { return claim.status === "review"; }).length
    });
  });

  const usage = Array.from(sourceUsage.values()).map(function (item) {
    return {
      sourceId: item.sourceId,
      sourceTitle: item.sourceTitle,
      sourceAuthor: item.sourceAuthor,
      sectionIds: Array.from(item.sectionIds),
      sectionTitles: Array.from(item.sectionTitles),
      pages: Array.from(item.pages).sort(function (a, b) { return a - b; }),
      evidenceItems: item.evidenceItems
    };
  }).sort(function (a, b) {
    return b.sectionIds.length - a.sectionIds.length || b.evidenceItems - a.evidenceItems;
  });

  const sectionsWithEvidence = sections.filter(function (section) { return section.evidenceCount > 0; }).length;
  return Object.assign({}, base, {
    sections: sections,
    sectionsWithEvidence: sectionsWithEvidence,
    sectionsWithoutEvidence: sections.length - sectionsWithEvidence,
    coveragePercent: sections.length ? Math.round(sectionsWithEvidence / sections.length * 100) : 0,
    usedSourceIds: usage.map(function (item) { return item.sourceId; }),
    sourceUsage: usage,
    staleEvidenceCount: sections.reduce(function (total, section) { return total + section.staleEvidenceCount; }, 0),
    supportedClaimCount: supportedClaims.length,
    unsupportedClaimCount: unsupportedClaims.length,
    supportedClaims: supportedClaims.slice(0, 100),
    unsupportedClaims: unsupportedClaims.slice(0, 100)
  });
}

export function buildPrecisionUsedSourceList(project) {
  const audit = buildPrecisionEvidenceAudit(project && project.lessons);
  const used = new Set(audit.usedSourceIds.map(String));
  return buildVerifiedSourceList(project).filter(function (source) { return used.has(String(source.id)); });
}

function sourceSurname(author, title) {
  const cleanAuthor = clean(author);
  if (cleanAuthor) {
    const parts = cleanAuthor.replace(/\bet al\.?$/i, "").split(/[\s,]+/).filter(Boolean);
    if (parts.length) return parts[parts.length - 1].replace(/[^A-Za-z0-9'-]/g, "") || "Source";
  }
  return clean(title).split(/\s+/).filter(Boolean).slice(0, 2).join(" ") || "Source";
}

export const CITATION_STYLE_OPTIONS = [
  { id: "none", label: "No markers", help: "Keep prose clean; retain verified References only." },
  { id: "apa7", label: "APA 7", help: "Author–year markers with practical APA-style reference lines." },
  { id: "chicago-author-date", label: "Chicago author–date", help: "Author–date markers and Chicago-style reference lines." },
  { id: "ieee", label: "IEEE", help: "Numbered in-text markers and numbered reference lines." },
];

function citationMarker(source, style) {
  if (style === "apa7" || style === "author-year") return source.authorYearLabel;
  if (style === "chicago-author-date") return source.chicagoAuthorDateLabel;
  return source.numberedLabel;
}

export function buildCitationRegistry(project) {
  const audit = buildPrecisionEvidenceAudit(project && project.lessons);
  const verified = new Map(buildVerifiedSourceList(project).map(function (source) {
    return [String(source.id), source];
  }));
  const used = audit.sourceUsage.map(function (usage) {
    const source = verified.get(String(usage.sourceId));
    return source ? Object.assign({}, source, { usage: usage }) : null;
  }).filter(Boolean);

  const counts = new Map();
  const prepared = used.map(function (source) {
    const surname = sourceSurname(source.author, source.title);
    const year = clean(source.year) || "n.d.";
    const base = surname + ", " + year;
    counts.set(base, (counts.get(base) || 0) + 1);
    return { source: source, surname: surname, year: year, base: base };
  });
  const seen = new Map();

  const sources = prepared.map(function (row, index) {
    const countSeen = seen.get(row.base) || 0;
    seen.set(row.base, countSeen + 1);
    const suffix = (counts.get(row.base) || 0) > 1 ? String.fromCharCode(97 + countSeen) : "";
    return Object.assign({}, row.source, {
      citationId: "S" + (index + 1),
      number: index + 1,
      numberedLabel: "[" + (index + 1) + "]",
      authorYearLabel: "(" + row.surname + ", " + row.year + suffix + ")",
      chicagoAuthorDateLabel: "(" + row.surname + " " + row.year + suffix + ")"
    });
  });

  return {
    sources: sources,
    bySourceId: Object.fromEntries(sources.map(function (source) { return [String(source.id), source]; }))
  };
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
}

function formatReferenceLine(source, style) {
  const author = clean(source.author);
  const title = clean(source.title);
  const publication = clean(source.publication);
  const year = clean(source.year) || "n.d.";
  const url = clean(source.url);

  if (style === "apa7") {
    return [author, "(" + year + ").", title ? title + "." : "", publication ? publication + "." : "", url]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (style === "chicago-author-date") {
    return [author ? author + "." : "", year ? year + "." : "", title ? title + "." : "", publication ? publication + "." : "", url]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (style === "ieee") {
    const body = [
      author ? author + "," : "",
      title ? "\"" + title + ",\"" : "",
      publication ? publication + "," : "",
      year ? year + "." : "",
      url,
    ].filter(Boolean).join(" ");
    return source.numberedLabel + " " + body.replace(/\s+/g, " ").trim();
  }

  const details = [author, title, publication, clean(source.year), url].filter(Boolean).join(". ");
  return style === "numbered" ? source.numberedLabel + " " + details : details;
}

export function buildCitationReadyProject(project, style) {
  const citationStyle = style || "none";
  if (!project || typeof project !== "object" || citationStyle === "none") return project;

  const registry = buildCitationRegistry(project);
  if (!registry.sources.length) return Object.assign({}, project, { citationRegistry: registry, citationStyle: citationStyle });

  const audit = buildPrecisionEvidenceAudit(project.lessons || {});
  const nextLessons = Object.assign({}, project.lessons || {});

  audit.sections.forEach(function (section) {
    const current = nextLessons[section.sectionId];
    if (!current || !current.prose) return;
    let prose = String(current.prose);

    section.claims.filter(function (claim) { return claim.status === "supported"; }).forEach(function (claim) {
      const sourceId = claim.evidence && claim.evidence[0] && claim.evidence[0].sourceId;
      const source = registry.bySourceId[String(sourceId || "")];
      if (!source) return;
      const marker = citationMarker(source, citationStyle);
      if (!marker || claim.text.includes(marker)) return;
      const parts = claim.text.split(/\s+/).map(escapeRegExp);
      const pattern = new RegExp(parts.join("\\s+"));
      prose = prose.replace(pattern, function (match) { return match + " " + marker; });
    });

    nextLessons[section.sectionId] = Object.assign({}, current, { prose: prose });
  });

  const referencesId = project.bookOutline && project.bookOutline.references && project.bookOutline.references.id;
  if (referencesId && nextLessons[referencesId]) {
    const lines = registry.sources.map(function (source) { return formatReferenceLine(source, citationStyle); });
    nextLessons[referencesId] = Object.assign({}, nextLessons[referencesId], {
      prose: lines.join("\n\n"),
      citationStyle: citationStyle,
      citationRegistry: registry.sources
    });
  }

  return Object.assign({}, project, {
    lessons: nextLessons,
    citationStyle: citationStyle,
    citationRegistry: registry
  });
}

function projectText(project, paths) {
  for (const path of paths) {
    const value = path.split(".").reduce(function (obj, key) { return obj && obj[key]; }, project);
    if ((typeof value === "string" || typeof value === "number") && clean(value)) return clean(value);
  }
  return "";
}

export function buildPublicationConsistencyReport(project, settings, citationStyle) {
  const cfg = settings || {};
  const style = citationStyle || "none";
  const values = {
    title: {
      manuscript: projectText(project, ["bookDetails.title", "research.bookTitle", "title"]),
      cover: projectText(project, ["bookCover.coverStudio.metadata.title", "bookCover.title"])
    },
    subtitle: {
      manuscript: projectText(project, ["bookDetails.subtitle", "research.bookSubtitle"]),
      cover: projectText(project, ["bookCover.coverStudio.metadata.subtitle", "bookCover.subtitle"])
    },
    author: {
      manuscript: projectText(project, ["authorBio.authorName", "research.authorName"]),
      cover: projectText(project, ["bookCover.coverStudio.metadata.author", "bookCover.authorLine"])
    },
    primaryCategory: projectText(project, ["bookCover.coverStudio.metadata.primaryCategory", "bookCover.primaryCategory"]),
    secondaryCategory: projectText(project, ["bookCover.coverStudio.metadata.secondaryCategory", "bookCover.secondaryCategory"]),
    keywords: projectText(project, ["bookMarketing.keywords"])
  };

  const checks = [];
  function compare(id, label, left, right) {
    if (!left && !right) return;
    if (!left || !right) {
      checks.push({ id: id, label: label, status: "review", detail: label + " exists in only one publishing surface.", values: { manuscript: left, cover: right } });
      return;
    }
    const match = left.toLowerCase() === right.toLowerCase();
    checks.push({
      id: id,
      label: label,
      status: match ? "pass" : "review",
      detail: match ? label + " matches across manuscript and cover metadata." : label + " differs between manuscript and cover metadata.",
      values: { manuscript: left, cover: right }
    });
  }

  compare("title", "Title", values.title.manuscript, values.title.cover);
  compare("subtitle", "Subtitle", values.subtitle.manuscript, values.subtitle.cover);
  compare("author", "Author", values.author.manuscript, values.author.cover);

  checks.push({
    id: "keywords",
    label: "Discovery keywords",
    status: values.keywords ? "pass" : "review",
    detail: values.keywords ? "Listing keywords are present." : "Add discovery keywords before publishing."
  });
  checks.push({
    id: "categories",
    label: "Categories",
    status: values.primaryCategory ? "pass" : "review",
    detail: values.primaryCategory ? [values.primaryCategory, values.secondaryCategory].filter(Boolean).join(" · ") : "Select at least a primary category in cover/publishing metadata."
  });
  checks.push({
    id: "citation-style",
    label: "Citation style",
    status: style === "none" ? "info" : "pass",
    detail: style === "none" ? "No in-manuscript citation markers selected." : "Export citation style: " + style + "."
  });
  checks.push({
    id: "trim-cover",
    label: "Trim size review",
    status: cfg.trimSize ? "pass" : "review",
    detail: cfg.trimSize ? "Manuscript trim is " + cfg.trimSize + "; confirm the cover dimensions match this trim before KDP upload." : "Select a manuscript trim size."
  });

  return {
    values: values,
    checks: checks,
    reviewCount: checks.filter(function (check) { return check.status === "review"; }).length,
    passCount: checks.filter(function (check) { return check.status === "pass"; }).length
  };
}
