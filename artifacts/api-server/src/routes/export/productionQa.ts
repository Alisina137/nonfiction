import {
  ExportSettings,
  getTrimSize,
  kdpMinimumInsideMargin,
  normalizeExportSettings,
  resolveMargins,
} from "./exportSettings.js";

export type ProductionCheckStatus = "pass" | "review" | "block";

export interface ProductionCheck {
  id: string;
  label: string;
  status: ProductionCheckStatus;
  detail: string;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTrimText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/["″]/g, "")
    .replace(/[×x]/g, "x")
    .replace(/s+/g, "")
    .replace(/—.*$/, "");
}

function coverPrintSetup(project: any): any {
  return project?.bookCover?.coverStudio?.printSetup
    || project?.bookCover?.printSetup
    || {};
}

function coverMetadata(project: any): any {
  return project?.bookCover?.coverStudio?.metadata
    || project?.bookCover?.metadata
    || project?.bookCover
    || {};
}

function coverBackMatter(project: any): any {
  return project?.bookCover?.coverStudio?.backCover
    || project?.bookCover?.backCover
    || {};
}

function selectedCoverConcept(project: any): any | null {
  const concepts = Array.isArray(project?.bookCover?.concepts)
    ? project.bookCover.concepts
    : Array.isArray(project?.bookCover?.coverStudio?.concepts)
      ? project.bookCover.coverStudio.concepts
      : [];
  const idx = typeof project?.bookCover?.selectedConceptIndex === "number"
    ? project.bookCover.selectedConceptIndex
    : typeof project?.bookCover?.coverStudio?.selectedConceptIndex === "number"
      ? project.bookCover.coverStudio.selectedConceptIndex
      : null;
  return idx != null ? concepts[idx] || null : null;
}

export function paperbackSpineWidth(pageCount: number, interiorId = "bw-white"): number {
  const multiplier = interiorId === "bw-cream"
    ? 0.0025
    : interiorId === "premium-color"
      ? 0.002347
      : 0.002252;
  return Math.max(0, Math.round(num(pageCount) * multiplier * 1_000_000) / 1_000_000);
}

export function buildFinalProductionReport(
  project: any,
  rawSettings: Partial<ExportSettings> | undefined,
  exactPageCount: number,
  epubValidation?: { status?: string; checks?: ProductionCheck[] } | null
) {
  const settings = normalizeExportSettings(rawSettings);
  const trim = getTrimSize(settings.trimSize);
  const pages = Math.max(0, Math.round(num(exactPageCount)));
  const margins = resolveMargins(settings, pages || 24);
  const minimumInside = kdpMinimumInsideMargin(pages || 24);
  const printSetup = coverPrintSetup(project);
  const meta = coverMetadata(project);
  const back = coverBackMatter(project);
  const concept = selectedCoverConcept(project);
  const coverPages = Math.round(num(printSetup.pageCount));
  const coverTrim = meta.bookSize || project?.bookCover?.bookSize || "";
  const expectedTrim = `${trim.widthIn}x${trim.heightIn}`;
  const trimMatches = !coverTrim || normalizeTrimText(coverTrim).includes(expectedTrim);
  const interiorId = printSetup.interiorId || "bw-white";
  const spineWidth = paperbackSpineWidth(pages, interiorId);

  const checks: ProductionCheck[] = [];
  const add = (id: string, label: string, status: ProductionCheckStatus, detail: string) =>
    checks.push({ id, label, status, detail });

  add(
    "page-count",
    "Final paperback page count",
    pages >= 24 && pages <= 828 ? "pass" : "block",
    pages >= 24 && pages <= 828
      ? `Rendered interior contains ${pages} pages.`
      : `Rendered interior has ${pages} pages; KDP paperbacks must stay within the supported page-count range for the selected print configuration.`
  );

  add(
    "trim-size",
    "Interior trim size",
    trim ? "pass" : "block",
    `Interior is rendered at ${trim.label}.`
  );

  add(
    "inside-margin",
    "Inside margin",
    margins.inside + 1e-6 >= minimumInside ? "pass" : "block",
    `Inside margin is ${margins.inside.toFixed(3)} in; current KDP minimum for ${pages || "this"} pages is ${minimumInside.toFixed(3)} in.`
  );

  add(
    "outside-margin",
    "Outside margin",
    margins.outside + 1e-6 >= 0.25 ? "pass" : "block",
    `Outside margin is ${margins.outside.toFixed(3)} in; KDP no-bleed interiors require at least 0.250 in.`
  );

  add(
    "top-bottom-margin",
    "Top and bottom margins",
    margins.top + 1e-6 >= 0.25 && margins.bottom + 1e-6 >= 0.25 ? "pass" : "block",
    `Top ${margins.top.toFixed(3)} in · bottom ${margins.bottom.toFixed(3)} in.`
  );

  add(
    "cover-page-sync",
    "Cover page-count sync",
    coverPages === pages && pages > 0 ? "pass" : "review",
    coverPages === pages && pages > 0
      ? `Cover Studio already uses the exact final page count (${pages}).`
      : `Cover Studio uses ${coverPages || "an estimated"} page count; sync it to the exact final count of ${pages} before exporting the print cover.`
  );

  add(
    "cover-trim-sync",
    "Cover/interior trim consistency",
    trimMatches ? "pass" : "block",
    trimMatches
      ? `Cover trim is consistent with the ${trim.label} interior.`
      : `Cover Studio trim (${coverTrim || "unknown"}) does not match the ${trim.label} interior.`
  );

  add(
    "cover-concept",
    "Selected cover direction",
    concept ? "pass" : "review",
    concept ? "A cover concept is selected." : "Select the final front-cover concept before print-cover export."
  );

  add(
    "back-cover",
    "Back-cover copy",
    String(back?.blurb || "").trim() ? "pass" : "review",
    String(back?.blurb || "").trim() ? "Back-cover copy is present." : "Back-cover copy is still empty."
  );

  add(
    "spine-text",
    "Spine text eligibility",
    printSetup.spineText && pages < 80 ? "review" : "pass",
    pages >= 80
      ? `Final spine width is ${spineWidth.toFixed(3)} in and the page count supports spine text.`
      : `Final page count is ${pages}; keep spine text disabled below 80 pages.`
  );

  add(
    "barcode",
    "Barcode handling",
    printSetup.barcodeMode === "none" ? "review" : "pass",
    printSetup.barcodeMode === "own"
      ? "Custom barcode mode is selected; verify placement and print resolution before upload."
      : printSetup.barcodeMode === "none"
        ? "No barcode-safe area is reserved."
        : "KDP barcode placement is reserved on the back cover."
  );

  if (epubValidation?.checks?.length) {
    for (const check of epubValidation.checks) checks.push(check);
  }

  const blocked = checks.filter((c) => c.status === "block").length;
  const reviews = checks.filter((c) => c.status === "review").length;
  const passed = checks.filter((c) => c.status === "pass").length;

  const kdpChecklist = {
    paperback: [
      { id: "interior-pdf", label: "Upload the final interior PDF.", done: blocked === 0 },
      { id: "cover-pdf", label: "Upload one flattened PDF containing back, spine, and front cover.", done: false },
      { id: "cover-300dpi", label: "Confirm cover artwork is at least 300 DPI and fonts/transparencies are flattened or embedded.", done: false },
      { id: "previewer", label: "Run KDP Print Previewer and inspect trim, margins, blank pages, and spine alignment.", done: false },
      { id: "proof-copy", label: "Order/inspect a proof copy before final publication when possible.", done: false },
    ],
    ebook: [
      { id: "epub", label: "Upload the generated EPUB for the Kindle eBook.", done: epubValidation?.status === "pass" },
      { id: "kindle-previewer", label: "Validate the EPUB in Kindle Previewer before publishing.", done: false },
      { id: "ebook-cover", label: "Upload the eBook front-cover image separately in KDP.", done: false },
    ],
  };

  return {
    status: blocked ? "block" : reviews ? "review" : "pass",
    exactPageCount: pages,
    trim,
    margins,
    minimumInsideMargin: minimumInside,
    cover: {
      pageCount: coverPages || null,
      trim: coverTrim || null,
      interiorId,
      spineWidth,
      spineTextEligible: pages >= 80,
      synced: coverPages === pages && trimMatches,
    },
    passed,
    reviews,
    blocked,
    checks,
    kdpChecklist,
    generatedAt: new Date().toISOString(),
  };
}
