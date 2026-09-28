export const PAPERBACK_PREVIEW_CHECKS = [
  {
    id: "interior-preview-opened",
    label: "Open and inspect the final paperback PDF preview.",
    required: true,
  },
  {
    id: "trim-margins",
    label: "Check trim, gutter, outside margins, and page-edge clearance.",
    required: true,
  },
  {
    id: "chapter-starts",
    label: "Check chapter openings, headings, and paragraph starts for awkward page breaks.",
    required: true,
  },
  {
    id: "headers-pages",
    label: "Check running headers and page numbers where enabled.",
    required: true,
  },
  {
    id: "blank-pages",
    label: "Check front matter, intentional blanks, and unexpected empty pages.",
    required: true,
  },
  {
    id: "cover-spine",
    label: "Check the final cover/spine against the exact interior page count.",
    required: true,
  },
  {
    id: "proof-copy",
    label: "Review a physical proof copy when practical before publication.",
    required: false,
  },
];

const ARCHIVE_FIELDS = [
  ["pageCount", "Exact page count"],
  ["trimSize", "Trim size"],
  ["citationStyle", "Citation style"],
  ["productionStatus", "Production status"],
  ["epubStatus", "EPUB status"],
  ["coverDesignHash", "Cover design"],
  ["fingerprintSha256", "Production fingerprint"],
];

function clean(value) {
  if (value == null) return "";
  return String(value).trim();
}

function firstValue(project, paths) {
  for (const path of paths) {
    const value = path.split(".").reduce((obj, key) => obj && obj[key], project);
    if ((typeof value === "string" || typeof value === "number") && clean(value)) return clean(value);
  }
  return "";
}

function normalizeKeywords(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  return clean(value)
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function coverMeta(project) {
  return project?.bookCover?.coverStudio?.metadata || {};
}

function finalCoverExport(project) {
  return project?.bookCover?.coverStudio?.finalExport || project?.bookCover?.finalExport || null;
}

export function normalizeArchiveSnapshot(snapshot = {}) {
  return {
    archiveId: clean(snapshot.archiveId),
    pageCount: Number(snapshot.pageCount || snapshot.exactPageCount || 0) || null,
    trimSize: clean(snapshot.trimSize),
    citationStyle: clean(snapshot.citationStyle || "none") || "none",
    productionStatus: clean(snapshot.productionStatus || snapshot.status || "unknown") || "unknown",
    epubStatus: clean(snapshot.epubStatus || "unknown") || "unknown",
    coverDesignHash: clean(snapshot.coverDesignHash),
    fingerprintSha256: clean(snapshot.fingerprintSha256),
    createdAt: clean(snapshot.createdAt),
  };
}

export function compareProductionArchives(newerSnapshot, olderSnapshot) {
  const newer = normalizeArchiveSnapshot(newerSnapshot);
  const older = normalizeArchiveSnapshot(olderSnapshot);
  const changes = ARCHIVE_FIELDS.map(([field, label]) => ({
    field,
    label,
    before: older[field] ?? null,
    after: newer[field] ?? null,
    changed: (older[field] ?? null) !== (newer[field] ?? null),
  })).filter((item) => item.changed);

  return {
    newer,
    older,
    changes,
    changeCount: changes.length,
    hasChanges: changes.length > 0,
  };
}

export function normalizePreviewChecks(value) {
  const incoming = value && typeof value === "object" ? value : {};
  return Object.fromEntries(PAPERBACK_PREVIEW_CHECKS.map((check) => [check.id, Boolean(incoming[check.id])]));
}

export function previewChecklistComplete(value) {
  const checks = normalizePreviewChecks(value);
  return PAPERBACK_PREVIEW_CHECKS
    .filter((check) => check.required)
    .every((check) => checks[check.id]);
}

export function buildKdpMetadataHandoff(project, productionReport, citationStyle = "none") {
  const meta = coverMeta(project);
  const coverExport = finalCoverExport(project);
  const title = firstValue(project, ["bookDetails.title", "bookTitle.selectedCard.title", "research.bookTitle", "title"]);
  const subtitle = firstValue(project, ["bookDetails.subtitle", "bookTitle.selectedCard.subtitle", "research.bookSubtitle"]);
  const author = firstValue(project, [
    "authorBio.authorName",
    "authorBio.name",
    "research.authorName",
    "bookCover.coverStudio.metadata.author",
  ]);
  const description = firstValue(project, [
    "description.description",
    "bookMarketing.description",
    "description",
  ]);
  const keywords = normalizeKeywords(project?.bookMarketing?.keywords || meta.keywords || "");
  const exactPageCount = Number(
    productionReport?.exactPageCount
      || project?.productionSnapshot?.pageCount
      || project?.bookCover?.coverStudio?.printSetup?.pageCount
      || project?.bookCover?.printSetup?.pageCount
      || 0
  ) || null;

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    book: {
      title,
      subtitle,
      author,
      language: clean(meta.language || project?.bookCover?.language || "English") || "English",
      description,
    },
    listing: {
      keywords,
      primaryCategory: clean(meta.primaryCategory || project?.bookCover?.primaryCategory),
      secondaryCategory: clean(meta.secondaryCategory || project?.bookCover?.secondaryCategory),
    },
    paperback: {
      trimSize: clean(productionReport?.trim?.id || project?.productionSnapshot?.trimSize || ""),
      exactPageCount,
      productionStatus: clean(productionReport?.status || project?.productionSnapshot?.productionStatus || project?.productionSnapshot?.status || "unknown"),
      finalCoverExported: Boolean(coverExport),
      finalCoverExportedAt: clean(coverExport?.exportedAt),
    },
    ebook: {
      epubStatus: clean(productionReport?.epub?.status || project?.productionSnapshot?.epubStatus || "unknown"),
      citationStyle: clean(citationStyle || project?.productionSnapshot?.citationStyle || "none") || "none",
    },
    files: {
      paperbackInterior: "Use the final exported interior PDF.",
      paperbackCover: "Use the separately exported flattened print-cover PDF.",
      kindleManuscript: "Use the final exported EPUB.",
      kindleCover: "Upload the front-cover image separately in KDP.",
    },
    control: {
      uploadsRemainManual: true,
      note: "Review every field in KDP before saving or publishing. This handoff does not submit anything to Amazon.",
    },
  };
}

export function formatKdpMetadataHandoffText(handoff) {
  const h = handoff || {};
  const lines = [
    "KDP METADATA HANDOFF",
    "",
    `Title: ${clean(h.book?.title)}`,
    `Subtitle: ${clean(h.book?.subtitle)}`,
    `Author: ${clean(h.book?.author)}`,
    `Language: ${clean(h.book?.language)}`,
    "",
    "DESCRIPTION",
    clean(h.book?.description),
    "",
    "KEYWORDS",
    ...(Array.isArray(h.listing?.keywords) ? h.listing.keywords.map((item, index) => `${index + 1}. ${item}`) : []),
    "",
    `Primary category: ${clean(h.listing?.primaryCategory)}`,
    `Secondary category: ${clean(h.listing?.secondaryCategory)}`,
    "",
    `Paperback trim: ${clean(h.paperback?.trimSize)}`,
    `Paperback pages: ${h.paperback?.exactPageCount || ""}`,
    `Production status: ${clean(h.paperback?.productionStatus)}`,
    `EPUB status: ${clean(h.ebook?.epubStatus)}`,
    `Citation style: ${clean(h.ebook?.citationStyle)}`,
    "",
    "FILES",
    `Paperback interior: ${clean(h.files?.paperbackInterior)}`,
    `Paperback cover: ${clean(h.files?.paperbackCover)}`,
    `Kindle manuscript: ${clean(h.files?.kindleManuscript)}`,
    `Kindle cover: ${clean(h.files?.kindleCover)}`,
    "",
    "Final KDP review and publication remain manual.",
  ];
  return lines.join("\n");
}

export function canFreezePublication({ productionReport, productionSnapshot, previewChecks } = {}) {
  const reasons = [];
  const snapshot = normalizeArchiveSnapshot(productionSnapshot || {});
  if (!snapshot.archiveId) reasons.push("Create a final publication archive first.");
  if (!productionReport) reasons.push("Run Final Production Check in this session.");
  if (Number(productionReport?.blocked || 0) > 0 || productionReport?.status === "block") {
    reasons.push("Resolve blocking final-production checks.");
  }
  if (!previewChecklistComplete(previewChecks)) {
    reasons.push("Complete the required paperback preview review items.");
  }
  return { ok: reasons.length === 0, reasons };
}

export function buildPublicationFreezeRecord({
  productionReport,
  productionSnapshot,
  previewChecks,
  citationStyle = "none",
} = {}) {
  const gate = canFreezePublication({ productionReport, productionSnapshot, previewChecks });
  if (!gate.ok) return { frozen: false, reasons: gate.reasons };

  const snapshot = normalizeArchiveSnapshot(productionSnapshot);
  return {
    frozen: true,
    frozenAt: new Date().toISOString(),
    archiveId: snapshot.archiveId,
    fingerprintSha256: snapshot.fingerprintSha256 || clean(productionReport?.archiveManifest?.fingerprintSha256),
    exactPageCount: Number(productionReport?.exactPageCount || snapshot.pageCount || 0) || null,
    trimSize: clean(productionReport?.trim?.id || snapshot.trimSize),
    citationStyle: clean(citationStyle || snapshot.citationStyle || "none") || "none",
    previewChecks: normalizePreviewChecks(previewChecks),
    note: "Publication freeze protects manuscript, metadata, layout, and cover edits until explicitly unfrozen.",
  };
}

export function isPublicationFrozen(project) {
  return Boolean(project?.publicationFreeze?.frozen);
}
